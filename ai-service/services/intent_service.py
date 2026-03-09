"""
Intent Detection Service
Phân loại ý định người dùng dùng Gemini + regex fallback.

Các intent được hỗ trợ:
  knowledge_question  — câu hỏi kiến thức phần cứng (không cần tra hàng)
  product_search      — tìm / gợi ý sản phẩm theo mô tả, ngân sách, dùng để làm gì
  product_price       — hỏi giá / tồn kho sản phẩm cụ thể
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache

import google.generativeai as genai  # type: ignore[import-not-found]
from loguru import logger

INTENT_KNOWLEDGE   = "knowledge_question"
INTENT_PRODUCT     = "product_search"
INTENT_PRICE       = "product_price"
VALID_INTENTS      = {INTENT_KNOWLEDGE, INTENT_PRODUCT, INTENT_PRICE}

# --------------- Regex fallback rules ---------------
# (intent, compiled pattern)
_REGEX_RULES: list[tuple[str, re.Pattern]] = [
    # price / stock
    (INTENT_PRICE, re.compile(
        r"(giá|price|bao nhiêu|cost|tiền|tồn kho|còn hàng|in stock|mấy triệu|mấy k|mấy đồng)",
        re.IGNORECASE,
    )),
    # product search — wants to buy / compare / recommend
    (INTENT_PRODUCT, re.compile(
        r"(tìm|kiếm|gợi ý|recommend|tư vấn|muốn mua|cần mua|có bán|cần|so sánh|compare|nào tốt|nào|ntn"
        r"|dưới \d+|ngân sách|budget|tầm giá|cho mình xem|laptop|pc|gpu|cpu|ram|ssd|màn hình|máy tính"
        r"|monitor|headphone|tai nghe|bàn phím|keyboard|chuột|mouse|chơi game|gaming)",
        re.IGNORECASE,
    )),
]


class IntentService:
    """Detect user intent using Gemini first, regex fallback second."""

    def __init__(self) -> None:
        self._gemini_model = None
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            genai.configure(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            self._gemini_model = genai.GenerativeModel(model_name)

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def detect(self, text: str) -> str:
        """Return the intent label for *text*.

        Strategy:
        1. Try Gemini (structured JSON prompt) — fast & accurate.
        2. Fallback to regex rules if Gemini is not configured or fails.
        3. Default to ``knowledge_question`` when undecided.
        """
        if not text or not text.strip():
            return INTENT_KNOWLEDGE

        if self._gemini_model:
            try:
                return self._detect_with_gemini(text.strip())
            except Exception as exc:  # pragma: no cover
                logger.warning(f"IntentService Gemini error, using regex fallback: {exc}")

        return self._detect_with_regex(text.strip())

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _detect_with_gemini(self, text: str) -> str:
        """Ask Gemini to classify intent. Return validated label."""
        prompt = (
            "You are an intent classifier for a Vietnamese computer hardware e-commerce chatbot.\n"
            "Classify the user message into EXACTLY ONE of these intents:\n"
            "  - knowledge_question  : general hardware knowledge, theory, how-to, comparison concepts\n"
            "  - product_search      : wants product recommendations or searches by use-case / budget\n"
            "  - product_price       : asks about a specific product's price or stock availability\n\n"
            "Reply with JSON only, no markdown, example: {\"intent\": \"product_search\"}\n\n"
            f"User message: \"{text}\""
        )
        response = self._gemini_model.generate_content(prompt)
        raw = (response.text or "").strip()

        # Strip possible markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)

        data = json.loads(raw)
        intent = str(data.get("intent", "")).strip()

        if intent in VALID_INTENTS:
            return intent

        logger.warning(f"IntentService: unexpected label '{intent}', defaulting to knowledge_question")
        return INTENT_KNOWLEDGE

    @staticmethod
    def _detect_with_regex(text: str) -> str:
        """Simple regex-based classification."""
        for intent, pattern in _REGEX_RULES:
            if pattern.search(text):
                return intent
        return INTENT_KNOWLEDGE
