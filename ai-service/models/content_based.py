"""
Content-Based Filtering v2.0 — Sentence Transformers + FAISS + TF-IDF Hybrid

Nâng cấp:
 - Dual-index: FAISS IVF for large catalogs + FlatIP for small
 - TF-IDF fallback when embedding model not available
 - Category-aware re-ranking for diversity
 - Price-range & brand similarity boosting
 - Batch embedding generation with progress tracking
 - Product metadata caching for fast enrichment
"""
import numpy as np
import faiss
from loguru import logger
from pathlib import Path
from config import settings
import pickle
from collections import defaultdict

try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    logger.warning("sentence-transformers not installed")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class ContentBasedModel:
    """
    Content-Based Filtering sử dụng:
    1. Sentence Transformers (all-MiniLM-L6-v2) để tạo dense embeddings
    2. TF-IDF vectorizer làm fallback / hybrid signal
    3. FAISS index cho fast approximate nearest neighbor search
    4. Product metadata (category, brand, price) cho re-ranking
    """

    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.encoder: SentenceTransformer = None
        self.faiss_index: faiss.Index = None
        self.product_ids: list[str] = []
        self.embeddings: np.ndarray = None
        self._fitted = False
        self.index_path = settings.FAISS_INDEX_PATH / "product_index.faiss"
        self.meta_path = settings.FAISS_INDEX_PATH / "product_meta.pkl"
        self.embedding_dim = settings.EMBEDDING_DIM

        # TF-IDF fallback
        self.tfidf_vectorizer: TfidfVectorizer = None
        self.tfidf_matrix = None

        # Product metadata cache for re-ranking
        self._product_meta: dict[str, dict] = {}  # pid -> {category, brand, price}

    def _load_encoder(self):
        """Lazy load sentence transformer model."""
        if self.encoder is None and HAS_SENTENCE_TRANSFORMERS:
            logger.info(f"Loading sentence transformer: {self.model_name}")
            self.encoder = SentenceTransformer(self.model_name)
            self.embedding_dim = self.encoder.get_sentence_embedding_dimension()
            logger.info(f"Encoder loaded, dim={self.embedding_dim}")

    def _product_to_text(self, product: dict) -> str:
        """Convert product data to rich text for embedding."""
        parts = []

        name = product.get("name", "")
        if name:
            parts.append(name)

        category = product.get("category", "")
        if category:
            parts.append(f"Danh mục: {category}")

        brand = product.get("brand", "")
        if brand:
            parts.append(f"Thương hiệu: {brand}")

        subcats = product.get("subcategory", [])
        if subcats:
            if isinstance(subcats, list):
                parts.append(f"Tags: {', '.join(str(s) for s in subcats)}")
            else:
                parts.append(f"Tags: {subcats}")

        price = product.get("price", 0)
        if price > 0:
            if price < 2_000_000:
                parts.append("Giá rẻ, phân khúc bình dân, giá tốt")
            elif price < 5_000_000:
                parts.append("Phân khúc phổ thông")
            elif price < 15_000_000:
                parts.append("Tầm trung")
            elif price < 30_000_000:
                parts.append("Cao cấp, flagship")
            else:
                parts.append("Premium, siêu cao cấp, ultra flagship")

        specs = product.get("specs_text", "")
        if specs:
            parts.append(specs[:300])

        desc = product.get("description", "")
        if desc:
            parts.append(desc[:400])

        return " | ".join(parts)

    def fit(self, products: list[dict]) -> dict:
        """
        Build FAISS index + TF-IDF matrix từ product data.

        Args:
            products: List of product dicts with name, category, brand, etc.
        """
        if not products:
            return {"status": "skipped", "reason": "no_products"}

        # Cache product metadata for re-ranking
        self.product_ids = [p["product_id"] for p in products]
        self._product_meta = {}
        for p in products:
            self._product_meta[p["product_id"]] = {
                "category": p.get("category", ""),
                "brand": p.get("brand", ""),
                "price": p.get("price", 0),
                "rating": p.get("rating", 0),
                "subcategory": p.get("subcategory", []),
            }

        # Generate texts
        texts = [self._product_to_text(p) for p in products]

        # ── Build TF-IDF (always, as backup & hybrid signal) ──
        tfidf_status = "skipped"
        if HAS_SKLEARN:
            try:
                self.tfidf_vectorizer = TfidfVectorizer(
                    max_features=5000,
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    strip_accents="unicode",
                )
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
                tfidf_status = "success"
                logger.info(f"TF-IDF matrix: {self.tfidf_matrix.shape}")
            except Exception as e:
                logger.error(f"TF-IDF build failed: {e}")
                tfidf_status = "failed"

        # ── Build FAISS from Sentence Transformer embeddings ──
        faiss_status = "skipped"
        if HAS_SENTENCE_TRANSFORMERS:
            self._load_encoder()
            logger.info(f"Generating embeddings for {len(products)} products...")

            self.embeddings = self.encoder.encode(
                texts,
                batch_size=32,
                show_progress_bar=True,
                normalize_embeddings=True,
            ).astype(np.float32)

            self.embedding_dim = self.embeddings.shape[1]

            # Choose index type based on catalog size
            n = len(products)
            if n > 5000:
                # IVFFlat for larger catalogs — faster search O(√n)
                n_lists = max(int(np.sqrt(n)), 4)
                quantizer = faiss.IndexFlatIP(self.embedding_dim)
                self.faiss_index = faiss.IndexIVFFlat(
                    quantizer, self.embedding_dim, n_lists, faiss.METRIC_INNER_PRODUCT
                )
                self.faiss_index.train(self.embeddings)
                self.faiss_index.add(self.embeddings)
                self.faiss_index.nprobe = max(n_lists // 4, 1)
                index_type = f"IVFFlat(nlist={n_lists})"
            else:
                # FlatIP for small catalogs — exact search
                self.faiss_index = faiss.IndexFlatIP(self.embedding_dim)
                self.faiss_index.add(self.embeddings)
                index_type = "FlatIP"

            faiss_status = "success"
            logger.info(f"FAISS index built: {index_type}, n={n}")
        else:
            self.embeddings = None
            index_type = "none"

        self._fitted = True
        self.save()

        return {
            "status": "success",
            "n_products": len(products),
            "embedding_dim": self.embedding_dim,
            "index_type": index_type,
            "faiss": faiss_status,
            "tfidf": tfidf_status,
        }

    def get_similar_products(
        self,
        product_id: str,
        top_k: int = 10,
        exclude_ids: list[str] = None,
        category_filter: str = None,
        boost_same_category: float = 0.1,
        boost_same_brand: float = 0.05,
    ) -> list[dict]:
        """
        Tìm sản phẩm tương tự bằng FAISS + metadata re-ranking.

        Enhanced:
        - Category/brand similarity boosting
        - Price-range proximity bonus
        - Diversity enforcement
        """
        if not self._fitted:
            return []

        exclude_ids = set(exclude_ids or [])
        exclude_ids.add(product_id)

        try:
            idx = self.product_ids.index(product_id)
        except ValueError:
            # Product not in index — try TF-IDF fallback
            return self._tfidf_similar(product_id, top_k, exclude_ids)

        results = []
        source_meta = self._product_meta.get(product_id, {})

        # ── FAISS search ──
        if self.faiss_index is not None and self.embeddings is not None:
            query_vec = self.embeddings[idx: idx + 1]
            k_search = min(top_k * 3 + len(exclude_ids), len(self.product_ids))
            distances, indices = self.faiss_index.search(query_vec, k_search)

            for dist, fidx in zip(distances[0], indices[0]):
                if fidx < 0 or fidx >= len(self.product_ids):
                    continue
                pid = self.product_ids[fidx]
                if pid in exclude_ids:
                    continue

                score = float(dist)

                # Metadata boosting
                target_meta = self._product_meta.get(pid, {})
                if source_meta.get("category") and source_meta["category"] == target_meta.get("category"):
                    score += boost_same_category
                if source_meta.get("brand") and source_meta["brand"] == target_meta.get("brand"):
                    score += boost_same_brand

                # Price proximity bonus (within 50% range → small boost)
                src_price = source_meta.get("price", 0)
                tgt_price = target_meta.get("price", 0)
                if src_price > 0 and tgt_price > 0:
                    price_ratio = min(src_price, tgt_price) / max(src_price, tgt_price)
                    if price_ratio > 0.5:
                        score += (price_ratio - 0.5) * 0.1

                if category_filter and target_meta.get("category") != category_filter:
                    continue

                results.append({
                    "product_id": pid,
                    "score": round(score, 4),
                    "sources": ["content_based_faiss"],
                })

                if len(results) >= top_k:
                    break

        # If FAISS not available, use TF-IDF
        if not results and self.tfidf_matrix is not None:
            results = self._tfidf_similar(product_id, top_k, exclude_ids)

        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def _tfidf_similar(
        self, product_id: str, top_k: int, exclude_ids: set
    ) -> list[dict]:
        """Fallback similarity using TF-IDF cosine similarity."""
        if self.tfidf_matrix is None:
            return []
        try:
            idx = self.product_ids.index(product_id)
        except ValueError:
            return []

        query_vec = self.tfidf_matrix[idx]
        sims = sk_cosine(query_vec, self.tfidf_matrix).flatten()

        top_indices = np.argsort(sims)[::-1]
        results = []
        for i in top_indices:
            pid = self.product_ids[i]
            if pid in exclude_ids:
                continue
            if sims[i] <= 0:
                break
            results.append({
                "product_id": pid,
                "score": round(float(sims[i]), 4),
                "sources": ["content_based_tfidf"],
            })
            if len(results) >= top_k:
                break
        return results

    def search_by_text(self, query: str, top_k: int = 10) -> list[dict]:
        """
        Semantic search: Tìm sản phẩm bằng text query.
        Hybrid: FAISS embedding + TF-IDF keyword matching.
        """
        results_map = {}  # pid -> score

        # ── FAISS semantic search ──
        if self._fitted and self.encoder is not None and self.faiss_index is not None:
            query_emb = self.encoder.encode(
                [query], normalize_embeddings=True
            ).astype(np.float32)

            k_search = min(top_k * 2, len(self.product_ids))
            distances, indices = self.faiss_index.search(query_emb, k_search)

            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or idx >= len(self.product_ids):
                    continue
                pid = self.product_ids[idx]
                results_map[pid] = results_map.get(pid, 0) + float(dist) * 0.7

        # ── TF-IDF keyword search ──
        if self.tfidf_vectorizer is not None and self.tfidf_matrix is not None:
            try:
                query_vec = self.tfidf_vectorizer.transform([query])
                sims = sk_cosine(query_vec, self.tfidf_matrix).flatten()
                top_tfidf = np.argsort(sims)[::-1][:top_k * 2]
                for i in top_tfidf:
                    if sims[i] <= 0:
                        break
                    pid = self.product_ids[i]
                    results_map[pid] = results_map.get(pid, 0) + float(sims[i]) * 0.3
            except Exception:
                pass

        # Sort and return
        sorted_pids = sorted(results_map.items(), key=lambda x: x[1], reverse=True)
        results = []
        for pid, score in sorted_pids[:top_k]:
            results.append({
                "product_id": pid,
                "score": round(score, 4),
                "recommendation_type": "semantic_search",
            })
        return results

    def get_embedding(self, product_id: str) -> np.ndarray:
        """Get embedding vector for a product."""
        if not self._fitted or self.embeddings is None:
            return np.array([])
        try:
            idx = self.product_ids.index(product_id)
            return self.embeddings[idx]
        except (ValueError, IndexError):
            return np.array([])

    def get_category_products(self, category: str) -> list[str]:
        """Get all product IDs in a category."""
        return [
            pid for pid, meta in self._product_meta.items()
            if meta.get("category") == category
        ]

    def save(self):
        """Persist FAISS index + metadata + TF-IDF."""
        if not self._fitted:
            return
        try:
            if self.faiss_index is not None:
                faiss.write_index(self.faiss_index, str(self.index_path))
            with open(self.meta_path, "wb") as f:
                pickle.dump(
                    {
                        "product_ids": self.product_ids,
                        "embeddings": self.embeddings,
                        "embedding_dim": self.embedding_dim,
                        "model_name": self.model_name,
                        "product_meta": self._product_meta,
                        "tfidf_vectorizer": self.tfidf_vectorizer,
                        "tfidf_matrix": self.tfidf_matrix,
                    },
                    f,
                )
            logger.info(f"Content-based model saved to {self.index_path}")
        except Exception as e:
            logger.error(f"Failed to save content-based model: {e}")

    def load(self) -> bool:
        """Load FAISS index + metadata from disk."""
        if not self.index_path.exists() or not self.meta_path.exists():
            return False
        try:
            self.faiss_index = faiss.read_index(str(self.index_path))
            with open(self.meta_path, "rb") as f:
                meta = pickle.load(f)
            self.product_ids = meta["product_ids"]
            self.embeddings = meta.get("embeddings")
            self.embedding_dim = meta["embedding_dim"]
            self.model_name = meta.get("model_name", self.model_name)
            self._product_meta = meta.get("product_meta", {})
            self.tfidf_vectorizer = meta.get("tfidf_vectorizer")
            self.tfidf_matrix = meta.get("tfidf_matrix")
            self._fitted = True
            logger.info(
                f"Content-based model loaded: {len(self.product_ids)} products, "
                f"tfidf={'yes' if self.tfidf_matrix is not None else 'no'}"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to load content-based model: {e}")
            return False
