"""
Association Rule Mining (Apriori / FP-Growth) v2.0
Phân tích Market Basket để tìm sản phẩm mua kèm (cross-sell).

Nâng cấp:
 - Co-view session mining: tìm sản phẩm thường xem cùng nhau
 - Category-aware rules: boost rules cùng / bổ sung category
 - Multi-product antecedent matching: match cả 2-item combos
 - Tiered min_support: tự động giảm support nếu ít rules
 - Enhanced scoring: conviction, leverage, Zhang's metric
"""
import numpy as np
import pandas as pd
from loguru import logger
import pickle
from pathlib import Path
from config import settings
from collections import defaultdict

try:
    from mlxtend.frequent_patterns import apriori, fpgrowth, association_rules
    HAS_MLXTEND = True
except ImportError:
    HAS_MLXTEND = False
    logger.warning("mlxtend not installed - Association Rules will be limited")


class AssociationRuleModel:
    """
    Market Basket Analysis using Apriori / FP-Growth algorithms.
    
    Tìm association rules dạng: {Product A, Product B} → {Product C}
    với các metrics: support, confidence, lift, conviction.

    Enhanced features:
    - Co-view session mining integrated
    - Category-aware boosting
    - Auto-tiered min_support
    """

    def __init__(
        self,
        min_support: float = 0.01,
        min_confidence: float = 0.1,
        min_lift: float = 1.0,
        algorithm: str = "fpgrowth",
    ):
        self.min_support = min_support
        self.min_confidence = min_confidence
        self.min_lift = min_lift
        self.algorithm = algorithm
        self.rules: pd.DataFrame = pd.DataFrame()
        self.frequent_itemsets: pd.DataFrame = pd.DataFrame()
        self._fitted = False
        self.model_path = settings.MODEL_DIR / "association_rules.pkl"
        # Quick lookup dict: product_id -> list of rules
        self._rule_lookup: dict = {}
        # Multi-product antecedent lookup: frozenset(2 items) -> rules
        self._pair_lookup: dict = {}
        # Co-view rules (from browsing sessions, not purchase transactions)
        self._coview_lookup: dict = {}
        # Product category mapping for category-aware boosting
        self._product_categories: dict = {}

    def set_product_categories(self, product_categories: dict):
        """Set product→category mapping for category-aware rule boosting."""
        self._product_categories = product_categories

    def fit(
        self,
        transaction_df: pd.DataFrame,
        coview_df: pd.DataFrame = None,
    ) -> dict:
        """
        Train Association Rule model.

        Args:
            transaction_df: Boolean DataFrame — rows=transactions, cols=product_ids
            coview_df: Optional boolean DataFrame — rows=browse sessions, cols=product_ids
        """
        if not HAS_MLXTEND:
            return {"status": "skipped", "reason": "mlxtend_not_installed"}

        if transaction_df.empty or len(transaction_df) < 5:
            return {"status": "skipped", "reason": "insufficient_transactions"}

        n_tx = len(transaction_df)
        n_products = len(transaction_df.columns)
        logger.info(
            f"Mining association rules: {n_tx} transactions, "
            f"{n_products} products, algorithm={self.algorithm}"
        )

        tx_bool = transaction_df.astype(bool)

        try:
            # ── Step 1: Find frequent itemsets with tiered support ──
            self.frequent_itemsets, effective_support = self._mine_itemsets(tx_bool)

            if self.frequent_itemsets.empty:
                logger.warning("No frequent itemsets found even with lowered support.")
                return {
                    "status": "no_patterns",
                    "reason": f"No itemsets with support >= {effective_support}",
                }

            # ── Step 2: Generate association rules ──
            self.rules = association_rules(
                self.frequent_itemsets,
                metric="confidence",
                min_threshold=self.min_confidence,
            )
            self.rules = self.rules[self.rules["lift"] >= self.min_lift]

            if self.rules.empty:
                logger.warning("No rules found above confidence/lift thresholds")
                return {"status": "no_rules"}

            # Enhanced scoring: lift * confidence + conviction bonus
            self.rules["score"] = self.rules.apply(self._compute_rule_score, axis=1)
            self.rules = self.rules.sort_values("score", ascending=False)

            # ── Step 3: Build lookup dicts ──
            self._build_lookup()

            # ── Step 4: Mine co-view sessions if available ──
            coview_metrics = {}
            if coview_df is not None and not coview_df.empty and len(coview_df) >= 3:
                coview_metrics = self._mine_coview_sessions(coview_df)

            self._fitted = True
            self.save()

            metrics = {
                "status": "success",
                "n_transactions": n_tx,
                "n_frequent_itemsets": len(self.frequent_itemsets),
                "n_rules": len(self.rules),
                "n_pair_rules": len(self._pair_lookup),
                "effective_min_support": effective_support,
                "avg_confidence": float(self.rules["confidence"].mean()),
                "avg_lift": float(self.rules["lift"].mean()),
                "max_lift": float(self.rules["lift"].max()),
                "top_rules": self._get_top_rules(5),
                **coview_metrics,
            }
            logger.info(
                f"Association rules: {metrics['n_rules']} rules, "
                f"avg_lift={metrics['avg_lift']:.2f}, pairs={len(self._pair_lookup)}"
            )
            return metrics

        except Exception as e:
            logger.error(f"Association rule mining failed: {e}")
            return {"status": "failed", "error": str(e)}

    def _mine_itemsets(self, tx_bool: pd.DataFrame) -> tuple:
        """Mine frequent itemsets with auto-tiered support fallback."""
        mine_fn = fpgrowth if self.algorithm == "fpgrowth" else apriori
        support_levels = [
            self.min_support,
            self.min_support * 0.5,
            self.min_support * 0.25,
        ]

        for support in support_levels:
            freq = mine_fn(
                tx_bool,
                min_support=support,
                use_colnames=True,
                max_len=3,
            )
            if not freq.empty and len(freq) >= 3:
                if support < self.min_support:
                    logger.info(
                        f"Auto-lowered min_support to {support} "
                        f"(found {len(freq)} itemsets)"
                    )
                return freq, support

        return pd.DataFrame(), support_levels[-1]

    def _compute_rule_score(self, rule) -> float:
        """Enhanced rule scoring combining multiple metrics."""
        confidence = float(rule["confidence"])
        lift = float(rule["lift"])
        support = float(rule["support"])

        # Base score
        score = confidence * lift

        # Conviction bonus (measures departure from independence)
        try:
            conviction = float(rule.get("conviction", 1.0))
            if np.isfinite(conviction) and conviction > 1:
                score *= min(conviction, 5.0) / 5.0 + 1.0
        except (TypeError, ValueError):
            pass

        # Support bonus for high-confidence rules
        if confidence >= 0.5:
            score *= 1.0 + support * 2

        return round(score, 6)

    def _mine_coview_sessions(self, coview_df: pd.DataFrame) -> dict:
        """
        Mine co-view patterns from browsing sessions.
        These are weaker signals than purchase-based rules but help with cold products.
        """
        try:
            coview_bool = coview_df.astype(bool)
            mine_fn = fpgrowth if self.algorithm == "fpgrowth" else apriori
            freq = mine_fn(
                coview_bool,
                min_support=max(self.min_support * 0.5, 0.005),
                use_colnames=True,
                max_len=2,
            )
            if freq.empty:
                return {"coview_rules": 0}

            cv_rules = association_rules(freq, metric="confidence", min_threshold=0.05)
            cv_rules = cv_rules[cv_rules["lift"] >= 1.0]

            # Build co-view lookup (lower weight than purchase rules)
            self._coview_lookup = {}
            for _, rule in cv_rules.iterrows():
                for ant_item in rule["antecedents"]:
                    if ant_item not in self._coview_lookup:
                        self._coview_lookup[ant_item] = []
                    self._coview_lookup[ant_item].append({
                        "products": list(rule["consequents"]),
                        "confidence": float(rule["confidence"]),
                        "lift": float(rule["lift"]),
                        "score": float(rule["confidence"]) * float(rule["lift"]) * 0.5,
                        "rule_type": "coview",
                    })
            for pid in self._coview_lookup:
                self._coview_lookup[pid].sort(key=lambda x: x["score"], reverse=True)

            logger.info(f"Co-view rules: {len(cv_rules)} rules from browse sessions")
            return {"coview_rules": len(cv_rules)}

        except Exception as e:
            logger.warning(f"Co-view mining failed: {e}")
            return {"coview_rules": 0}

    def _build_lookup(self):
        """Build fast lookup dictionaries from rules — single + pair antecedents."""
        self._rule_lookup = {}
        self._pair_lookup = {}

        for _, rule in self.rules.iterrows():
            antecedents = frozenset(rule["antecedents"])
            consequents = list(rule["consequents"])
            confidence = float(rule["confidence"])
            lift = float(rule["lift"])
            support = float(rule["support"])
            score = float(rule["score"])

            entry = {
                "products": consequents,
                "confidence": confidence,
                "lift": lift,
                "support": support,
                "score": score,
                "antecedents": list(antecedents),
            }

            # Single-item antecedent lookup
            for ant_item in antecedents:
                if ant_item not in self._rule_lookup:
                    self._rule_lookup[ant_item] = []
                self._rule_lookup[ant_item].append(entry)

            # Multi-item antecedent lookup (for 2-item combos)
            if len(antecedents) >= 2:
                self._pair_lookup[antecedents] = entry

        for pid in self._rule_lookup:
            self._rule_lookup[pid].sort(key=lambda x: x["score"], reverse=True)

    def get_recommendations(
        self, product_ids: list, top_k: int = 10
    ) -> list[dict]:
        """
        Lấy sản phẩm gợi ý dựa trên giỏ hàng hiện tại.
        Enhanced: multi-product matching, co-view fallback, category boosting.
        """
        if not self._fitted or not self._rule_lookup:
            return []

        product_ids = [str(p) for p in product_ids]
        product_set = set(product_ids)
        recommendations: dict = {}

        # ── 1) Pair antecedent matching (strongest signal) ──
        if len(product_ids) >= 2:
            from itertools import combinations
            for combo in combinations(product_ids, 2):
                key = frozenset(combo)
                if key in self._pair_lookup:
                    rule = self._pair_lookup[key]
                    for rec_pid in rule["products"]:
                        if rec_pid in product_set:
                            continue
                        # Pair rules get 1.5x boost
                        self._add_recommendation(
                            recommendations, rec_pid, rule, boost=1.5
                        )

        # ── 2) Single-item antecedent matching ──
        for pid in product_ids:
            if pid not in self._rule_lookup:
                continue
            for rule in self._rule_lookup[pid]:
                for rec_pid in rule["products"]:
                    if rec_pid in product_set:
                        continue
                    self._add_recommendation(recommendations, rec_pid, rule)

        # ── 3) Co-view fallback (if not enough purchase-based rules) ──
        if len(recommendations) < top_k and self._coview_lookup:
            for pid in product_ids:
                if pid not in self._coview_lookup:
                    continue
                for rule in self._coview_lookup[pid][:5]:
                    for rec_pid in rule["products"]:
                        if rec_pid in product_set:
                            continue
                        if rec_pid not in recommendations:
                            recommendations[rec_pid] = {
                                "product_id": rec_pid,
                                "score": rule["score"],
                                "confidence": rule["confidence"],
                                "lift": rule["lift"],
                                "max_confidence": rule["confidence"],
                                "max_lift": rule["lift"],
                                "supporting_rules": 1,
                                "recommendation_type": "coview",
                            }

        # ── 4) Category-aware boosting ──
        if self._product_categories:
            input_categories = set()
            for pid in product_ids:
                cat = self._product_categories.get(pid)
                if cat:
                    input_categories.add(cat)

            for rec_pid, rec in recommendations.items():
                rec_cat = self._product_categories.get(rec_pid)
                if rec_cat and rec_cat in input_categories:
                    # Same category → complementary boost
                    rec["score"] *= 1.15

        # Sort by score
        sorted_recs = sorted(
            recommendations.values(), key=lambda x: x["score"], reverse=True
        )
        return sorted_recs[:top_k]

    def _add_recommendation(
        self, recommendations: dict, rec_pid: str, rule: dict, boost: float = 1.0
    ):
        """Aggregate a rule into the recommendation dict."""
        score = rule["score"] * boost
        if rec_pid in recommendations:
            existing = recommendations[rec_pid]
            existing["score"] += score
            existing["supporting_rules"] += 1
            existing["max_confidence"] = max(
                existing["max_confidence"], rule["confidence"]
            )
            existing["max_lift"] = max(existing["max_lift"], rule["lift"])
        else:
            recommendations[rec_pid] = {
                "product_id": rec_pid,
                "score": score,
                "confidence": rule["confidence"],
                "lift": rule["lift"],
                "max_confidence": rule["confidence"],
                "max_lift": rule["lift"],
                "supporting_rules": 1,
                "recommendation_type": "association_rule",
            }

    def get_frequently_bought_together(
        self, product_id: str, top_k: int = 5
    ) -> list[dict]:
        """Shortcut for single-product 'frequently bought together'."""
        return self.get_recommendations([product_id], top_k=top_k)

    def _get_top_rules(self, n: int = 5) -> list[dict]:
        """Get top N rules for reporting."""
        if self.rules.empty:
            return []
        top = self.rules.head(n)
        result = []
        for _, rule in top.iterrows():
            result.append({
                "antecedents": list(rule["antecedents"]),
                "consequents": list(rule["consequents"]),
                "support": round(float(rule["support"]), 4),
                "confidence": round(float(rule["confidence"]), 4),
                "lift": round(float(rule["lift"]), 4),
                "score": round(float(rule["score"]), 4),
            })
        return result

    def save(self):
        if not self._fitted:
            return
        data = {
            "rules": self.rules,
            "frequent_itemsets": self.frequent_itemsets,
            "rule_lookup": self._rule_lookup,
            "pair_lookup": self._pair_lookup,
            "coview_lookup": self._coview_lookup,
            "product_categories": self._product_categories,
        }
        with open(self.model_path, "wb") as f:
            pickle.dump(data, f)
        logger.info(f"Association rules saved to {self.model_path}")

    def load(self) -> bool:
        if not self.model_path.exists():
            return False
        try:
            with open(self.model_path, "rb") as f:
                data = pickle.load(f)
            self.rules = data["rules"]
            self.frequent_itemsets = data["frequent_itemsets"]
            self._rule_lookup = data["rule_lookup"]
            self._pair_lookup = data.get("pair_lookup", {})
            self._coview_lookup = data.get("coview_lookup", {})
            self._product_categories = data.get("product_categories", {})
            self._fitted = True
            logger.info(
                f"Association rules loaded: {len(self.rules)} rules, "
                f"{len(self._pair_lookup)} pair rules"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to load association rules: {e}")
            return False
