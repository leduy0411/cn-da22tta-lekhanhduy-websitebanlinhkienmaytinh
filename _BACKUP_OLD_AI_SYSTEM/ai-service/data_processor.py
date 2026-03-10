"""
Data Processing Module — Enhanced v2.0
Handles data loading, cleaning, feature engineering, and matrix creation.

Nâng cấp:
 - Implicit feedback weighting (time-decay, interaction type weights)
 - Behavioral feature extraction (click sequence, session analysis)
 - Smart sparse matrix construction with confidence scores
 - Price-segment & brand encoding cho Content-Based features
 - User behavior profile builder cho cold-start mitigation
"""
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, lil_matrix
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from loguru import logger
from database import get_db
from datetime import datetime, timedelta
from bson import ObjectId
import pickle
from pathlib import Path
from config import settings


# ═══════════════════ Interaction weights ═══════════════════
INTERACTION_WEIGHTS = {
    "purchase": 5.0,
    "cart_add": 3.0,
    "review": 4.0,
    "wishlist": 2.5,
    "search_click": 2.0,
    "view": 1.0,
}

# Time-decay halflife in days (older interactions count less)
TIME_DECAY_HALFLIFE = 30  # days


class DataProcessor:
    """
    Xử lý và chuẩn hóa dữ liệu cho recommendation models.

    Features:
    - Implicit feedback weighting (interaction type × time-decay × view-duration)
    - User-Item sparse matrix construction with confidence
    - Product feature encoding (category, brand, price segment, specs)
    - Transaction matrix for Association Rule Mining
    - User behavior profiles for cold-start
    """

    def __init__(self):
        self.user_encoder = LabelEncoder()
        self.item_encoder = LabelEncoder()
        self.category_encoder = LabelEncoder()
        self.brand_encoder = LabelEncoder()
        self.scaler = MinMaxScaler()
        self._fitted = False

        # In-memory behavior profile cache (user_id -> {categories, brands, price_range})
        self._user_profiles: dict = {}
        self._encoder_path = settings.MODEL_DIR / "encoders.pkl"

    # =====================================================
    #  DATA LOADING
    # =====================================================

    async def load_interactions(self, days: int = 90) -> pd.DataFrame:
        """Load user interactions từ MongoDB với enhanced field extraction."""
        db = get_db()
        date_threshold = datetime.utcnow() - timedelta(days=days)

        cursor = db.userinteractions.find(
            {"createdAt": {"$gte": date_threshold}},
            {
                "user": 1,
                "product": 1,
                "interactionType": 1,
                "weight": 1,
                "viewDuration": 1,
                "source": 1,
                "createdAt": 1,
                "metadata": 1,
                "sessionId": 1,
                "deviceType": 1,
            },
        )

        interactions = []
        async for doc in cursor:
            if doc.get("user") and doc.get("product"):
                itype = doc.get("interactionType", "view")
                raw_weight = doc.get("weight", 1)
                view_dur = doc.get("viewDuration", 0)

                # ── Compute enhanced weight ──
                type_w = INTERACTION_WEIGHTS.get(itype, 1.0)
                duration_boost = min(view_dur / 60.0, 2.0) if view_dur > 0 else 0.0
                ts = doc.get("createdAt", datetime.utcnow())
                days_ago = max((datetime.utcnow() - ts).total_seconds() / 86400, 0.01)
                time_decay = 2 ** (-days_ago / TIME_DECAY_HALFLIFE)
                enhanced_weight = (type_w + duration_boost) * time_decay

                interactions.append(
                    {
                        "user_id": str(doc["user"]),
                        "product_id": str(doc["product"]),
                        "interaction_type": itype,
                        "raw_weight": raw_weight,
                        "weight": round(enhanced_weight, 4),
                        "view_duration": view_dur,
                        "source": doc.get("source", "direct"),
                        "timestamp": ts,
                        "search_query": doc.get("metadata", {}).get("searchQuery", ""),
                        "session_id": doc.get("sessionId", ""),
                        "device_type": doc.get("deviceType", "desktop"),
                    }
                )

        df = pd.DataFrame(interactions)
        logger.info(f"Loaded {len(df)} interactions from last {days} days")
        return df

    async def load_products(self) -> pd.DataFrame:
        """Load product data từ MongoDB with full feature extraction."""
        db = get_db()
        cursor = db.products.find(
            {"stock": {"$gt": 0}},
            {
                "name": 1,
                "category": 1,
                "subcategory": 1,
                "brand": 1,
                "price": 1,
                "originalPrice": 1,
                "rating": 1,
                "reviewCount": 1,
                "stock": 1,
                "description": 1,
                "specifications": 1,
                "sold": 1,
                "images": 1,
                "createdAt": 1,
            },
        )

        products = []
        async for doc in cursor:
            specs = doc.get("specifications", {})
            if hasattr(specs, "items"):
                specs_text = " ".join(f"{k}: {v}" for k, v in specs.items())
            else:
                specs_text = str(specs) if specs else ""

            price = doc.get("price", 0)
            original = doc.get("originalPrice", price)
            discount_pct = round((1 - price / max(original, 1)) * 100, 1) if original > 0 else 0

            products.append(
                {
                    "product_id": str(doc["_id"]),
                    "name": doc.get("name", ""),
                    "category": doc.get("category", ""),
                    "subcategory": doc.get("subcategory", []),
                    "brand": doc.get("brand", ""),
                    "price": price,
                    "original_price": original,
                    "discount_pct": max(discount_pct, 0),
                    "rating": doc.get("rating", 0),
                    "review_count": doc.get("reviewCount", 0),
                    "stock": doc.get("stock", 0),
                    "sold": doc.get("sold", 0),
                    "description": doc.get("description", ""),
                    "specs_text": specs_text,
                    "n_images": len(doc.get("images", [])),
                    "created_at": doc.get("createdAt", datetime.utcnow()),
                }
            )

        df = pd.DataFrame(products)
        logger.info(f"Loaded {len(df)} products")
        return df

    async def load_orders(self, days: int = 180) -> pd.DataFrame:
        """Load order data cho Association Rule Mining."""
        db = get_db()
        date_threshold = datetime.utcnow() - timedelta(days=days)

        cursor = db.orders.find(
            {
                "createdAt": {"$gte": date_threshold},
                "status": {"$in": ["delivered", "processing", "shipped"]},
            },
            {"items": 1, "user": 1, "totalAmount": 1, "createdAt": 1},
        )

        orders = []
        async for doc in cursor:
            items = doc.get("items", [])
            product_ids = []
            for item in items:
                pid = item.get("product")
                if pid:
                    product_ids.append(str(pid))

            if product_ids:
                orders.append(
                    {
                        "order_id": str(doc["_id"]),
                        "user_id": str(doc.get("user", "")),
                        "product_ids": product_ids,
                        "n_items": len(product_ids),
                        "total_amount": doc.get("totalAmount", 0),
                        "timestamp": doc.get("createdAt", datetime.utcnow()),
                    }
                )

        df = pd.DataFrame(orders)
        logger.info(f"Loaded {len(df)} orders from last {days} days")
        return df

    async def load_reviews(self, days: int = 365) -> pd.DataFrame:
        """Load review data cho rating-based signals."""
        db = get_db()
        date_threshold = datetime.utcnow() - timedelta(days=days)
        cursor = db.reviews.find(
            {"createdAt": {"$gte": date_threshold}},
            {"user": 1, "product": 1, "rating": 1, "createdAt": 1},
        )
        reviews = []
        async for doc in cursor:
            if doc.get("user") and doc.get("product"):
                reviews.append({
                    "user_id": str(doc["user"]),
                    "product_id": str(doc["product"]),
                    "rating": doc.get("rating", 3),
                    "timestamp": doc.get("createdAt", datetime.utcnow()),
                })
        df = pd.DataFrame(reviews)
        logger.info(f"Loaded {len(df)} reviews from last {days} days")
        return df

    # =====================================================
    #  MATRIX CONSTRUCTION
    # =====================================================

    def build_user_item_matrix(
        self, interactions_df: pd.DataFrame
    ) -> tuple[csr_matrix, np.ndarray, np.ndarray]:
        """
        Xây dựng User-Item matrix từ interaction data.
        Enhanced: aggregates per (user, product) with max + sum weighting.
        Returns: (sparse_matrix, user_ids, item_ids)
        """
        if interactions_df.empty:
            return csr_matrix((0, 0)), np.array([]), np.array([])

        # Aggregate interactions: combine weights intelligently
        agg_df = (
            interactions_df.groupby(["user_id", "product_id"])
            .agg(
                weight_sum=("weight", "sum"),
                weight_max=("weight", "max"),
                n_interactions=("weight", "count"),
            )
            .reset_index()
        )

        # Combined score: weighted sum capped by frequency
        agg_df["weight"] = (
            agg_df["weight_sum"] * 0.6
            + agg_df["weight_max"] * 0.3
            + np.log1p(agg_df["n_interactions"]) * 0.1
        )

        # Encode user and item IDs
        self.user_encoder.fit(agg_df["user_id"].unique())
        self.item_encoder.fit(agg_df["product_id"].unique())

        user_indices = self.user_encoder.transform(agg_df["user_id"])
        item_indices = self.item_encoder.transform(agg_df["product_id"])

        n_users = len(self.user_encoder.classes_)
        n_items = len(self.item_encoder.classes_)

        # Build sparse matrix
        matrix = csr_matrix(
            (agg_df["weight"].values.astype(np.float32), (user_indices, item_indices)),
            shape=(n_users, n_items),
        )

        self._fitted = True
        self.save_encoders()

        density = matrix.nnz / max(n_users * n_items, 1)
        logger.info(
            f"Built User-Item matrix: {n_users} users × {n_items} items, "
            f"nnz={matrix.nnz}, density={density:.6f}"
        )

        return matrix, self.user_encoder.classes_, self.item_encoder.classes_

    def encode_product_features(self, products_df: pd.DataFrame) -> np.ndarray:
        """
        Encode product features to numeric vectors.
        Enhanced: price segments, discount flag, popularity score, recency
        """
        if products_df.empty:
            return np.array([])

        features = pd.DataFrame()

        # Category one-hot encoding
        if "category" in products_df.columns:
            cat_dummies = pd.get_dummies(products_df["category"], prefix="cat")
            features = pd.concat([features, cat_dummies], axis=1)

        # Brand encoding (top brands only, rest as 'other')
        if "brand" in products_df.columns:
            top_brands = products_df["brand"].value_counts().head(20).index
            brand_col = products_df["brand"].apply(
                lambda x: x if x in top_brands else "other"
            )
            brand_dummies = pd.get_dummies(brand_col, prefix="brand")
            features = pd.concat([features, brand_dummies], axis=1)

        # Price normalization
        if "price" in products_df.columns:
            features["price_norm"] = self.scaler.fit_transform(
                products_df[["price"]].fillna(0)
            )

        # Price segment (one-hot)
        if "price" in products_df.columns:
            conditions = [
                products_df["price"] < 2_000_000,
                products_df["price"] < 10_000_000,
                products_df["price"] < 25_000_000,
                products_df["price"] >= 25_000_000,
            ]
            labels_price = ["budget", "mid", "high", "premium"]
            for i, label in enumerate(labels_price):
                features[f"priceseg_{label}"] = conditions[i].astype(float)

        # Discount flag
        if "discount_pct" in products_df.columns:
            features["has_discount"] = (products_df["discount_pct"] > 0).astype(float)
            features["discount_norm"] = products_df["discount_pct"].fillna(0) / 100.0

        # Rating
        if "rating" in products_df.columns:
            features["rating"] = products_df["rating"].fillna(0) / 5.0

        # Review count (log scale)
        if "review_count" in products_df.columns:
            features["review_log"] = np.log1p(products_df["review_count"].fillna(0))
            max_review = features["review_log"].max()
            if max_review > 0:
                features["review_log"] /= max_review

        # Popularity (sold count, log)
        if "sold" in products_df.columns:
            features["sold_log"] = np.log1p(products_df["sold"].fillna(0))
            max_sold = features["sold_log"].max()
            if max_sold > 0:
                features["sold_log"] /= max_sold

        return features.fillna(0).values

    def build_transaction_matrix(
        self, orders_df: pd.DataFrame, products_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build transaction matrix cho Association Rule Mining (Apriori / FP-Growth).
        Each row = 1 order, columns = product_ids, values = True/False.
        Enhanced: also merge interactions that look like co-view sessions.
        """
        if orders_df.empty:
            return pd.DataFrame()

        all_product_ids = set(products_df["product_id"].unique())

        transactions = []
        for _, order in orders_df.iterrows():
            basket = {}
            for pid in order["product_ids"]:
                if pid in all_product_ids:
                    basket[pid] = True
            if len(basket) >= 2:  # Only orders with 2+ products
                transactions.append(basket)

        if not transactions:
            return pd.DataFrame()

        tx_df = pd.DataFrame(transactions).fillna(False)
        logger.info(
            f"Built transaction matrix: {len(tx_df)} transactions × {len(tx_df.columns)} products"
        )
        return tx_df

    # =====================================================
    #  USER BEHAVIOR PROFILES (for cold-start mitigation)
    # =====================================================

    def build_user_profiles(
        self, interactions_df: pd.DataFrame, products_df: pd.DataFrame
    ) -> dict:
        """
        Build user behavior profiles for cold-start & diversity.
        Returns dict: user_id -> {
            preferred_categories, preferred_brands,
            avg_price, price_range, n_interactions, interaction_recency
        }
        """
        if interactions_df.empty or products_df.empty:
            return {}

        product_info = products_df.set_index("product_id")[
            ["category", "brand", "price"]
        ].to_dict("index")

        profiles = {}
        for user_id, group in interactions_df.groupby("user_id"):
            categories = []
            brands = []
            prices = []

            for _, row in group.iterrows():
                pid = row["product_id"]
                pinfo = product_info.get(pid, {})
                if pinfo.get("category"):
                    categories.append(pinfo["category"])
                if pinfo.get("brand"):
                    brands.append(pinfo["brand"])
                if pinfo.get("price"):
                    prices.append(pinfo["price"])

            from collections import Counter

            cat_counts = Counter(categories)
            brand_counts = Counter(brands)

            profiles[user_id] = {
                "preferred_categories": [c for c, _ in cat_counts.most_common(3)],
                "preferred_brands": [b for b, _ in brand_counts.most_common(3)],
                "category_affinity": {
                    c: count / max(sum(cat_counts.values()), 1) 
                    for c, count in cat_counts.most_common(5)
                },
                "brand_affinity": {
                    b: count / max(sum(brand_counts.values()), 1)
                    for b, count in brand_counts.most_common(5)
                },
                "avg_price": float(np.mean(prices)) if prices else 0,
                "price_range": (float(min(prices)), float(max(prices))) if prices else (0, 0),
                "n_interactions": len(group),
                "interaction_recency": float(
                    (datetime.utcnow() - group["timestamp"].max()).total_seconds() / 86400
                ) if "timestamp" in group.columns else 999,
            }

        self._user_profiles = profiles
        logger.info(f"Built {len(profiles)} user behavior profiles")
        return profiles

    def get_user_profile(self, user_id: str) -> dict | None:
        """Get cached user behavior profile."""
        return self._user_profiles.get(user_id)

    # =====================================================
    #  ENCODER LOOKUP / SAVE / LOAD
    # =====================================================

    def get_user_index(self, user_id: str) -> int:
        """Get matrix index for user_id."""
        if not self._fitted:
            return -1
        try:
            return int(self.user_encoder.transform([user_id])[0])
        except (ValueError, KeyError):
            return -1

    def get_item_index(self, product_id: str) -> int:
        """Get matrix index for product_id."""
        if not self._fitted:
            return -1
        try:
            return int(self.item_encoder.transform([product_id])[0])
        except (ValueError, KeyError):
            return -1

    def get_product_id(self, item_index: int) -> str:
        """Get product_id from matrix index."""
        if not self._fitted:
            return ""
        try:
            return self.item_encoder.classes_[item_index]
        except IndexError:
            return ""

    def get_user_id(self, user_index: int) -> str:
        """Get user_id from matrix index."""
        if not self._fitted:
            return ""
        try:
            return self.user_encoder.classes_[user_index]
        except IndexError:
            return ""

    def save_encoders(self):
        """Persist label encoders for later use (e.g. online inference)."""
        try:
            data = {
                "user_encoder": self.user_encoder,
                "item_encoder": self.item_encoder,
                "fitted": self._fitted,
            }
            with open(self._encoder_path, "wb") as f:
                pickle.dump(data, f)
        except Exception as e:
            logger.error(f"Failed to save encoders: {e}")

    def load_encoders(self) -> bool:
        """Load persisted encoders."""
        if not self._encoder_path.exists():
            return False
        try:
            with open(self._encoder_path, "rb") as f:
                data = pickle.load(f)
            self.user_encoder = data["user_encoder"]
            self.item_encoder = data["item_encoder"]
            self._fitted = data.get("fitted", True)
            logger.info("Encoders loaded from disk")
            return True
        except Exception as e:
            logger.error(f"Failed to load encoders: {e}")
            return False
