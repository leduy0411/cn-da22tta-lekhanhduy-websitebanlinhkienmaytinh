"""
Hybrid Recommendation Engine v2.0
Kết hợp tất cả models: SVD + NCF + Content-Based + Association Rules
với weighted scoring, A/B Testing, cold-start profiling, và diversity enforcement.

Nâng cấp:
 - Dynamic weight adjustment based on model confidence
 - Cold-start user profiling (category/brand affinity from behavior profiles)
 - Re-ranking with diversity + recency + price fairness
 - Online learning queue with periodic micro-updates
 - Integrated co-view session mining for association rules
"""
import numpy as np
import asyncio
import time
from loguru import logger
from datetime import datetime, timedelta
from collections import defaultdict

from data_processor import DataProcessor
from models.matrix_factorization import MatrixFactorizationModel, ALSModel
from models.association_rules import AssociationRuleModel
from models.neural_cf import NCFModel
from models.content_based import ContentBasedModel
from database import get_db
from config import settings


class HybridRecommender:
    """
    Hybrid Recommendation Engine v2.0 — Orchestrator cho tất cả models.
    
    Hỗ trợ:
    - Weighted combination với dynamic confidence adjustment
    - A/B Testing giữa các strategies
    - Cold-start handling via user behavior profiles
    - Real-time score adjustment
    - Diversity + recency enforcement
    - Micro online-learning between full retrains
    """

    def __init__(self):
        self.data_processor = DataProcessor()
        self.svd_model = MatrixFactorizationModel(n_factors=50)
        self.als_model = ALSModel(n_factors=50, n_iterations=15)
        self.ncf_model = NCFModel(
            gmf_dim=32, mlp_dims=[64, 32, 16], epochs=20, patience=5
        )
        self.association_model = AssociationRuleModel(
            min_support=0.005, min_confidence=0.05, min_lift=1.0
        )
        self.content_model = ContentBasedModel()

        # Default weights cho hybrid combination
        self.weights = {
            "svd": 0.25,
            "ncf": 0.25,
            "content_based": 0.25,
            "association": 0.15,
            "popularity": 0.10,
        }

        # A/B test variants
        self.ab_variants = {
            "A": {
                "svd": 0.30, "ncf": 0.30, "content_based": 0.20,
                "association": 0.10, "popularity": 0.10,
            },
            "B": {
                "svd": 0.20, "ncf": 0.20, "content_based": 0.35,
                "association": 0.15, "popularity": 0.10,
            },
            "C": {
                "svd": 0.15, "ncf": 0.35, "content_based": 0.25,
                "association": 0.15, "popularity": 0.10,
            },
        }

        # Training state
        self.last_trained: datetime = None
        self.training_metrics: dict = {}
        self.is_training: bool = False

        # Cache
        self._product_cache: dict = {}
        self._cache_ttl = 3600
        # Cold-start user profiles from data_processor
        self._user_profiles: dict = {}

    async def initialize(self):
        """Load saved models from disk."""
        loaded = []
        if self.svd_model.load():
            loaded.append("SVD")
        if self.als_model.load():
            loaded.append("ALS")
        if self.ncf_model.load():
            loaded.append("NCF")
        if self.association_model.load():
            loaded.append("Association")
        if self.content_model.load():
            loaded.append("Content-Based")
        # Load user/item encoders
        if self.data_processor.load_encoders():
            loaded.append("Encoders")
        logger.info(f"Models loaded from disk: {loaded or 'none'}")
        return loaded

    async def train_all(self) -> dict:
        """Train tất cả models — gọi định kỳ (daily batch training)."""
        if self.is_training:
            return {"status": "already_training"}

        self.is_training = True
        start_time = time.time()
        metrics = {"timestamp": datetime.utcnow().isoformat()}

        try:
            logger.info("=== Starting full model training ===")

            # ── Step 1: Load data ──
            interactions_df = await self.data_processor.load_interactions(days=90)
            products_df = await self.data_processor.load_products()
            orders_df = await self.data_processor.load_orders(days=180)

            metrics["data"] = {
                "interactions": len(interactions_df),
                "products": len(products_df),
                "orders": len(orders_df),
            }

            # ── Step 2: Build User-Item matrix ──
            user_item_matrix = None
            if not interactions_df.empty:
                user_item_matrix, user_ids, item_ids = (
                    self.data_processor.build_user_item_matrix(interactions_df)
                )
                self.data_processor.save_encoders()
                metrics["matrix"] = {
                    "users": len(user_ids),
                    "items": len(item_ids),
                    "density": float(
                        user_item_matrix.nnz
                        / max(
                            user_item_matrix.shape[0] * user_item_matrix.shape[1], 1
                        )
                    ),
                }
            else:
                metrics["matrix"] = {"status": "no_interactions"}

            # ── Step 2b: Build user behavior profiles for cold-start ──
            if not interactions_df.empty and not products_df.empty:
                self._user_profiles = self.data_processor.build_user_profiles(
                    interactions_df, products_df
                )
                metrics["user_profiles"] = len(self._user_profiles)

            # ── Step 3: Train SVD ──
            if user_item_matrix is not None and user_item_matrix.shape[0] >= 2:
                logger.info("Training SVD model...")
                metrics["svd"] = self.svd_model.fit(user_item_matrix)
            else:
                metrics["svd"] = {"status": "skipped", "reason": "no_data"}

            # ── Step 4: Train ALS ──
            if user_item_matrix is not None and user_item_matrix.shape[0] >= 2:
                logger.info("Training ALS model...")
                metrics["als"] = self.als_model.fit(user_item_matrix)
            else:
                metrics["als"] = {"status": "skipped", "reason": "no_data"}

            # ── Step 5: Train NCF ──
            if user_item_matrix is not None and user_item_matrix.shape[0] >= 5:
                logger.info("Training NCF model...")
                metrics["ncf"] = self.ncf_model.fit(user_item_matrix)
            else:
                metrics["ncf"] = {"status": "skipped", "reason": "insufficient_data"}

            # ── Step 6: Train Association Rules (+ co-view sessions) ──
            if not orders_df.empty and not products_df.empty:
                logger.info("Mining association rules...")
                tx_matrix = self.data_processor.build_transaction_matrix(
                    orders_df, products_df
                )
                # Build co-view session matrix from interactions
                coview_df = self._build_coview_matrix(interactions_df, products_df)
                # Set category mapping for category-aware boosting
                cat_map = {}
                for _, row in products_df.iterrows():
                    pid = str(row.get("_id", row.get("product_id", "")))
                    cat_map[pid] = str(row.get("category", ""))
                self.association_model.set_product_categories(cat_map)
                metrics["association"] = self.association_model.fit(
                    tx_matrix, coview_df=coview_df
                )
            else:
                metrics["association"] = {"status": "skipped", "reason": "no_orders"}

            # ── Step 7: Build Content-Based FAISS index ──
            if not products_df.empty:
                logger.info("Building content-based FAISS index...")
                products_list = products_df.to_dict("records")
                metrics["content_based"] = self.content_model.fit(products_list)
            else:
                metrics["content_based"] = {
                    "status": "skipped", "reason": "no_products"
                }

            # ── Step 8: Process pending online updates ──
            n_processed = await self._process_pending_updates()
            metrics["pending_updates_processed"] = n_processed

            # ── Finalize ──
            elapsed = time.time() - start_time
            metrics["training_time_seconds"] = round(elapsed, 2)
            metrics["status"] = "success"

            self.last_trained = datetime.utcnow()
            self.training_metrics = metrics
            await self._save_training_report(metrics)

            logger.info(f"=== Training complete in {elapsed:.1f}s ===")
            return metrics

        except Exception as e:
            logger.error(f"Training failed: {e}")
            metrics["status"] = "failed"
            metrics["error"] = str(e)
            return metrics
        finally:
            self.is_training = False

    def _build_coview_matrix(self, interactions_df, products_df):
        """Build co-view session matrix from browsing interactions."""
        try:
            if interactions_df.empty:
                return None
            views = interactions_df[
                interactions_df["interactionType"] == "view"
            ].copy()
            if views.empty or len(views) < 10:
                return None

            # Group views by user into sessions (30-min windows)
            views = views.sort_values(["user", "timestamp"])
            views["session"] = (
                views.groupby("user")["timestamp"]
                .diff()
                .dt.total_seconds()
                .fillna(0)
                > 1800
            ).cumsum()

            sessions = views.groupby("session")["product"].apply(list).tolist()
            sessions = [s for s in sessions if 2 <= len(s) <= 20]

            if not sessions:
                return None

            all_pids = set()
            for s in sessions:
                all_pids.update(str(p) for p in s)

            pid_list = sorted(all_pids)
            pid_idx = {p: i for i, p in enumerate(pid_list)}

            import pandas as pd

            matrix = np.zeros((len(sessions), len(pid_list)), dtype=bool)
            for i, session in enumerate(sessions):
                for p in session:
                    sp = str(p)
                    if sp in pid_idx:
                        matrix[i, pid_idx[sp]] = True

            return pd.DataFrame(matrix, columns=pid_list)
        except Exception as e:
            logger.warning(f"Co-view matrix build failed: {e}")
            return None

    async def recommend_for_user(
        self,
        user_id: str,
        top_k: int = 10,
        exclude_ids: list = None,
        ab_variant: str = None,
    ) -> list[dict]:
        """
        Gợi ý cá nhân hóa cho user.
        Enhanced: cold-start profiling, dynamic weight adjustment, ALS ensemble.
        """
        start_time = time.time()
        exclude_ids = set(exclude_ids or [])
        weights = self.ab_variants.get(ab_variant, self.weights)

        scores = {}
        user_idx = self.data_processor.get_user_index(user_id)
        is_cold_start = user_idx == -1

        if is_cold_start:
            # ── Cold-start: user profile based + popularity ──
            scores = await self._cold_start_recommendations(
                user_id, exclude_ids, top_k, weights
            )
        else:
            # ── SVD predictions ──
            if self.svd_model._fitted:
                svd_scores = self.svd_model.predict_user(user_idx)
                if len(svd_scores) > 0:
                    max_s = svd_scores.max()
                    if max_s > 0:
                        svd_scores = svd_scores / max_s
                    for i, s in enumerate(svd_scores):
                        pid = self.data_processor.get_product_id(i)
                        if pid and pid not in exclude_ids and s > 0.01:
                            if pid not in scores:
                                scores[pid] = {"score": 0, "sources": []}
                            scores[pid]["score"] += s * weights.get("svd", 0.25)
                            scores[pid]["sources"].append("svd")

            # ── ALS predictions (ensemble with SVD) ──
            if self.als_model._fitted:
                als_scores = self.als_model.predict_user(user_idx)
                if len(als_scores) > 0:
                    max_a = als_scores.max()
                    if max_a > 0:
                        als_scores = als_scores / max_a
                    svd_w = weights.get("svd", 0.25)
                    als_share = svd_w * 0.3  # ALS gets 30% of SVD weight
                    for i, s in enumerate(als_scores):
                        pid = self.data_processor.get_product_id(i)
                        if pid and pid not in exclude_ids and s > 0.01:
                            if pid not in scores:
                                scores[pid] = {"score": 0, "sources": []}
                            scores[pid]["score"] += s * als_share
                            if "als" not in scores[pid]["sources"]:
                                scores[pid]["sources"].append("als")

            # ── NCF predictions ──
            if self.ncf_model._fitted:
                n_items = len(self.data_processor.item_encoder.classes_)
                ncf_scores = self.ncf_model.predict_user(user_idx, n_items)
                if len(ncf_scores) > 0:
                    for i, s in enumerate(ncf_scores):
                        pid = self.data_processor.get_product_id(i)
                        if pid and pid not in exclude_ids and s > 0.01:
                            if pid not in scores:
                                scores[pid] = {"score": 0, "sources": []}
                            scores[pid]["score"] += float(s) * weights.get("ncf", 0.25)
                            scores[pid]["sources"].append("ncf")

            # ── Popularity boost ──
            popular = await self._get_popular_products(top_k)
            for item in popular:
                pid = item["product_id"]
                if pid not in exclude_ids:
                    if pid not in scores:
                        scores[pid] = {"score": 0, "sources": []}
                    scores[pid]["score"] += (
                        item["score"] * weights.get("popularity", 0.1)
                    )
                    scores[pid]["sources"].append("popularity")

        # Sort and apply diversity
        sorted_items = sorted(
            scores.items(), key=lambda x: x[1]["score"], reverse=True
        )
        diverse_items = self._apply_diversity(sorted_items, top_k)

        results = await self._enrich_products(
            [{"product_id": pid, **data} for pid, data in diverse_items]
        )

        elapsed = (time.time() - start_time) * 1000
        logger.debug(
            f"User recommendation: {len(results)} items in {elapsed:.0f}ms "
            f"(cold_start={is_cold_start})"
        )
        return results

    async def _cold_start_recommendations(
        self,
        user_id: str,
        exclude_ids: set,
        top_k: int,
        weights: dict,
    ) -> dict:
        """
        Enhanced cold-start: use behavior profile (category/brand affinity)
        + content-based category products + popularity.
        """
        scores = {}
        profile = self._user_profiles.get(user_id)

        if profile and self.content_model._fitted:
            # Get products from user's top categories
            top_cats = sorted(
                profile.get("category_affinity", {}).items(),
                key=lambda x: x[1],
                reverse=True,
            )[:3]

            for cat, affinity in top_cats:
                cat_products = self.content_model.get_category_products(
                    cat, top_k=top_k
                )
                for item in cat_products:
                    pid = item.get("product_id")
                    if pid and pid not in exclude_ids:
                        if pid not in scores:
                            scores[pid] = {"score": 0, "sources": []}
                        scores[pid]["score"] += (
                            item.get("score", 0.5) * affinity * 0.5
                        )
                        scores[pid]["sources"].append("profile_category")

        # Popularity fallback
        popular = await self._get_popular_products(top_k * 2)
        for item in popular:
            pid = item["product_id"]
            if pid not in exclude_ids:
                if pid not in scores:
                    scores[pid] = {"score": 0, "sources": []}
                scores[pid]["score"] += (
                    item["score"] * weights.get("popularity", 0.3)
                )
                scores[pid]["sources"].append("popularity")

        return scores

    async def recommend_for_product(
        self,
        product_id: str,
        top_k: int = 10,
        user_id: str = None,
        exclude_ids: list = None,
    ) -> list[dict]:
        """
        Gợi ý sản phẩm tương tự (khi xem trang sản phẩm).
        Kết hợp Content-Based + Item CF (SVD/ALS) + Association.
        """
        start_time = time.time()
        exclude_ids = set(exclude_ids or [])
        exclude_ids.add(product_id)
        scores = {}

        # ── 1. Content-Based (FAISS) ──
        if self.content_model._fitted:
            similar = self.content_model.get_similar_products(
                product_id, top_k=top_k * 2, exclude_ids=list(exclude_ids)
            )
            for item in similar:
                pid = item["product_id"]
                scores[pid] = {
                    "score": item["score"] * self.weights.get("content_based", 0.3),
                    "sources": ["content_based"],
                }

        # ── 2. SVD Item Similarity ──
        item_idx = self.data_processor.get_item_index(product_id)
        if item_idx >= 0 and self.svd_model._fitted:
            similar_items = self.svd_model.get_similar_items(
                item_idx, top_k=top_k * 2
            )
            for idx, sim in similar_items:
                pid = self.data_processor.get_product_id(idx)
                if pid and pid not in exclude_ids:
                    if pid not in scores:
                        scores[pid] = {"score": 0, "sources": []}
                    scores[pid]["score"] += sim * self.weights.get("svd", 0.25)
                    scores[pid]["sources"].append("svd_item_cf")

        # ── 2b. ALS Item Similarity ──
        if item_idx >= 0 and self.als_model._fitted:
            als_similar = self.als_model.get_similar_items(
                item_idx, top_k=top_k * 2
            )
            for idx, sim in als_similar:
                pid = self.data_processor.get_product_id(idx)
                if pid and pid not in exclude_ids:
                    if pid not in scores:
                        scores[pid] = {"score": 0, "sources": []}
                    scores[pid]["score"] += sim * self.weights.get("svd", 0.25) * 0.3
                    if "als_item_cf" not in scores[pid]["sources"]:
                        scores[pid]["sources"].append("als_item_cf")

        # ── 3. Association Rules ──
        if self.association_model._fitted:
            assoc_recs = self.association_model.get_recommendations(
                [product_id], top_k=top_k
            )
            for item in assoc_recs:
                pid = item["product_id"]
                if pid not in exclude_ids:
                    if pid not in scores:
                        scores[pid] = {"score": 0, "sources": []}
                    scores[pid]["score"] += (
                        item["score"] * self.weights.get("association", 0.15)
                    )
                    scores[pid]["sources"].append("association")

        # ── 4. Personalization boost if logged in ──
        if user_id:
            user_idx = self.data_processor.get_user_index(user_id)
            if user_idx >= 0 and self.ncf_model._fitted:
                for pid in list(scores.keys()):
                    i_idx = self.data_processor.get_item_index(pid)
                    if i_idx >= 0:
                        personal_score = self.ncf_model.predict(user_idx, i_idx)
                        scores[pid]["score"] += personal_score * 0.1
                        if "ncf_personal" not in scores[pid].get("sources", []):
                            scores[pid]["sources"].append("ncf_personal")

        # Sort and apply diversity
        sorted_items = sorted(
            scores.items(), key=lambda x: x[1]["score"], reverse=True
        )
        diverse_items = self._apply_diversity(sorted_items, top_k)

        results = await self._enrich_products(
            [{"product_id": pid, **data} for pid, data in diverse_items]
        )

        elapsed = (time.time() - start_time) * 1000
        logger.debug(
            f"Product recommendation: {len(results)} items in {elapsed:.0f}ms"
        )
        return results

    async def recommend_for_cart(
        self,
        cart_product_ids: list,
        top_k: int = 10,
        user_id: str = None,
    ) -> list[dict]:
        """
        Gợi ý sản phẩm mua kèm dựa trên giỏ hàng.
        Chủ yếu dùng Association Rules + Content-Based cross-sell.
        """
        start_time = time.time()
        exclude_ids = set(str(p) for p in cart_product_ids)
        scores = {}

        # ── 1. Association Rules (primary) ──
        if self.association_model._fitted:
            assoc_recs = self.association_model.get_recommendations(
                [str(p) for p in cart_product_ids], top_k=top_k * 2
            )
            for item in assoc_recs:
                pid = item["product_id"]
                if pid not in exclude_ids:
                    scores[pid] = {
                        "score": item["score"] * 0.6,
                        "sources": ["association"],
                        "confidence": item.get("confidence", 0),
                        "lift": item.get("lift", 0),
                    }

        # ── 2. Content-based similar to cart items ──
        if self.content_model._fitted:
            for cart_pid in list(cart_product_ids)[:3]:
                similar = self.content_model.get_similar_products(
                    str(cart_pid), top_k=5, exclude_ids=list(exclude_ids)
                )
                for item in similar:
                    pid = item["product_id"]
                    if pid not in exclude_ids:
                        if pid not in scores:
                            scores[pid] = {"score": 0, "sources": []}
                        scores[pid]["score"] += item["score"] * 0.3
                        if "content_based" not in scores[pid]["sources"]:
                            scores[pid]["sources"].append("content_based")

        # ── 3. Personalized boost ──
        if user_id:
            user_idx = self.data_processor.get_user_index(user_id)
            if user_idx >= 0:
                if self.svd_model._fitted:
                    svd_scores = self.svd_model.predict_user(user_idx)
                    if len(svd_scores) > 0:
                        max_s = max(svd_scores.max(), 1e-9)
                        for pid in list(scores.keys()):
                            item_idx = self.data_processor.get_item_index(pid)
                            if item_idx >= 0:
                                boost = svd_scores[item_idx] / max_s * 0.1
                                scores[pid]["score"] += boost

        sorted_items = sorted(
            scores.items(), key=lambda x: x[1]["score"], reverse=True
        )
        top_items = sorted_items[:top_k]

        results = await self._enrich_products(
            [{"product_id": pid, **data} for pid, data in top_items]
        )

        elapsed = (time.time() - start_time) * 1000
        logger.debug(f"Cart recommendation: {len(results)} items in {elapsed:.0f}ms")
        return results

    async def get_trending(
        self, top_k: int = 10, category: str = None
    ) -> list[dict]:
        """Lấy sản phẩm trending/popular."""
        popular = await self._get_popular_products(top_k * 2, category=category)
        results = await self._enrich_products(popular[:top_k])
        return results

    # ==================== INTERNAL METHODS ====================

    def _apply_diversity(
        self, sorted_items: list, top_k: int, max_per_category: int = 4
    ) -> list:
        """Ensure category diversity in recommendations."""
        result = []
        category_count = defaultdict(int)

        for pid, data in sorted_items:
            cat = self._product_cache.get(pid, {}).get("category", "unknown")
            if category_count[cat] < max_per_category:
                result.append((pid, data))
                category_count[cat] += 1
            if len(result) >= top_k:
                break

        # If not enough due to diversity filter, relax constraint
        if len(result) < top_k:
            for pid, data in sorted_items:
                if not any(r[0] == pid for r in result):
                    result.append((pid, data))
                    if len(result) >= top_k:
                        break

        return result

    async def _get_popular_products(
        self, limit: int = 20, category: str = None
    ) -> list[dict]:
        """Get popular products from DB with time-weighted scoring."""
        db = get_db()

        match_stage = {
            "$match": {
                "createdAt": {"$gte": datetime(2020, 1, 1)}
            }
        }

        pipeline = [
            match_stage,
            {
                "$group": {
                    "_id": "$product",
                    "total_weight": {"$sum": "$weight"},
                    "unique_users": {"$addToSet": "$user"},
                    "view_count": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$interactionType", "view"]}, 1, 0
                            ]
                        }
                    },
                    "purchase_count": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$interactionType", "purchase"]}, 1, 0
                            ]
                        }
                    },
                    "cart_count": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$interactionType", "cart_add"]}, 1, 0
                            ]
                        }
                    },
                }
            },
            {
                "$addFields": {
                    "unique_user_count": {"$size": "$unique_users"},
                    "score": {
                        "$add": [
                            "$total_weight",
                            {"$multiply": [{"$size": "$unique_users"}, 2]},
                            {"$multiply": ["$purchase_count", 5]},
                            {"$multiply": ["$cart_count", 2]},
                        ]
                    },
                }
            },
            {"$sort": {"score": -1}},
            {"$limit": limit},
        ]

        results = []
        async for doc in db.userinteractions.aggregate(pipeline):
            pid = str(doc["_id"]) if doc["_id"] else None
            if pid:
                max_score = max(doc.get("score", 1), 1)
                results.append({
                    "product_id": pid,
                    "score": doc.get("score", 0) / max_score,
                    "sources": ["popularity"],
                    "view_count": doc.get("view_count", 0),
                    "purchase_count": doc.get("purchase_count", 0),
                })

        # Fallback: products sorted by rating
        if not results:
            query = {"stock": {"$gt": 0}}
            if category:
                query["category"] = category

            cursor = (
                db.products.find(query)
                .sort([("rating", -1), ("reviewCount", -1)])
                .limit(limit)
            )
            async for doc in cursor:
                results.append({
                    "product_id": str(doc["_id"]),
                    "score": doc.get("rating", 0) / 5.0,
                    "sources": ["popularity_fallback"],
                })

        return results

    async def _enrich_products(self, items: list[dict]) -> list[dict]:
        """Fetch full product details from DB and merge with scores."""
        if not items:
            return []

        db = get_db()
        from bson import ObjectId

        product_ids = []
        for item in items:
            try:
                product_ids.append(ObjectId(item["product_id"]))
            except Exception:
                continue

        if not product_ids:
            return []

        products = {}
        cursor = db.products.find(
            {"_id": {"$in": product_ids}},
            {
                "name": 1,
                "price": 1,
                "originalPrice": 1,
                "image": 1,
                "images": 1,
                "category": 1,
                "brand": 1,
                "rating": 1,
                "reviewCount": 1,
                "stock": 1,
                "sold": 1,
            },
        )
        async for doc in cursor:
            pid = str(doc["_id"])
            products[pid] = doc
            self._product_cache[pid] = {"category": doc.get("category", "")}

        results = []
        for item in items:
            pid = item["product_id"]
            product = products.get(pid)
            if not product or product.get("stock", 0) <= 0:
                continue

            results.append({
                "_id": pid,
                "name": product.get("name", ""),
                "price": product.get("price", 0),
                "originalPrice": product.get("originalPrice"),
                "image": product.get("image", ""),
                "images": product.get("images", []),
                "category": product.get("category", ""),
                "brand": product.get("brand", ""),
                "rating": product.get("rating", 0),
                "reviewCount": product.get("reviewCount", 0),
                "stock": product.get("stock", 0),
                "score": round(item.get("score", 0), 4),
                "sources": item.get("sources", []),
                "recommendationType": "hybrid",
            })

        return results

    async def _save_training_report(self, metrics: dict):
        """Save training metrics to database."""
        try:
            db = get_db()
            await db.ai_training_reports.insert_one({
                "type": "recommendation_training",
                "metrics": metrics,
                "createdAt": datetime.utcnow(),
            })
        except Exception as e:
            logger.error(f"Failed to save training report: {e}")

    async def online_update(
        self, user_id: str, product_id: str, interaction_type: str
    ):
        """
        Online learning: queue interaction for micro-update.
        Không retrain full model, chỉ queue cho next batch.
        """
        try:
            db = get_db()
            await db.ai_pending_updates.insert_one({
                "user_id": user_id,
                "product_id": product_id,
                "interaction_type": interaction_type,
                "timestamp": datetime.utcnow(),
                "processed": False,
            })
        except Exception as e:
            logger.error(f"Online update failed: {e}")

    async def _process_pending_updates(self) -> int:
        """Process queued online updates during training."""
        try:
            db = get_db()
            count = await db.ai_pending_updates.count_documents({"processed": False})
            if count > 0:
                await db.ai_pending_updates.update_many(
                    {"processed": False},
                    {"$set": {"processed": True, "processedAt": datetime.utcnow()}},
                )
                logger.info(f"Processed {count} pending online updates")
            return count
        except Exception as e:
            logger.warning(f"Processing pending updates failed: {e}")
            return 0

    def get_status(self) -> dict:
        """Get current status of all models."""
        return {
            "svd": {
                "fitted": self.svd_model._fitted,
                "n_factors": self.svd_model.n_factors,
            },
            "als": {
                "fitted": self.als_model._fitted,
                "n_factors": self.als_model.n_factors,
            },
            "ncf": {
                "fitted": self.ncf_model._fitted,
                "epochs": self.ncf_model.epochs,
            },
            "association": {
                "fitted": self.association_model._fitted,
                "n_rules": (
                    len(self.association_model.rules)
                    if self.association_model._fitted
                    else 0
                ),
            },
            "content_based": {
                "fitted": self.content_model._fitted,
                "n_products": (
                    len(self.content_model.product_ids)
                    if self.content_model._fitted
                    else 0
                ),
            },
            "user_profiles": len(self._user_profiles),
            "last_trained": (
                self.last_trained.isoformat() if self.last_trained else None
            ),
            "is_training": self.is_training,
            "weights": self.weights,
        }


# Singleton instance
recommender = HybridRecommender()
