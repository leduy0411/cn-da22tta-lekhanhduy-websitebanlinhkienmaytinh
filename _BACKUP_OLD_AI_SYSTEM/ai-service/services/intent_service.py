"""
Intent Detection Service v2.0 - Enhanced
═══════════════════════════════════════════════════════════════════════════
Phân loại ý định người dùng với Gemini + enhanced regex patterns.

Các intent được hỗ trợ:
  knowledge_question  — câu hỏi kiến thức phần cứng, so sánh concept, giải thích
  product_search      — tìm / gợi ý sản phẩm theo mô tả, ngân sách, use case
  product_price       — hỏi giá / tồn kho sản phẩm cụ thể
  greeting            — chào hỏi, giới thiệu
  help                — yêu cầu hỗ trợ, hướng dẫn sử dụng chatbot
  
Improvements in v2.0:
- Gemini intent detection enabled by default với caching
- More comprehensive regex patterns
- Better handling of ambiguous queries
- Support for multi-intent queries
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache

from google import genai
from loguru import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Intent constants
INTENT_KNOWLEDGE   = "knowledge_question"
INTENT_PRODUCT     = "product_search"
INTENT_PRICE       = "product_price"
INTENT_GREETING    = "greeting"
INTENT_HELP        = "help"

VALID_INTENTS      = {INTENT_KNOWLEDGE, INTENT_PRODUCT, INTENT_PRICE, INTENT_GREETING, INTENT_HELP}

# --------------- Enhanced Regex Rules (Priority Order) ---------------

# Greeting patterns (highest priority for quick response)
_GREETING_PATTERN = re.compile(
    r"^(xin chào|chào|hello|hi|hey|alo|chao|xin chao)\s*[!.]*$",
    re.IGNORECASE,
)

# Help/capability patterns
_HELP_PATTERN = re.compile(
    r"(bạn có thể|bạn giúp|bạn làm được|có thể.*(không|chưa)|giúp tôi.*(được không|nha|nhé)\s*$"
    r"|chatbot.*làm gì|có chức năng|hỗ trợ.*gì|biết làm gì|làm được gì|hướng dẫn)",
    re.IGNORECASE,
)

# Price/stock patterns (high priority)
_PRICE_PATTERN = re.compile(
    r"(^giá|^price|^bao nhiêu tiền|giá.*bao nhiêu|price.*how much"
    r"|bao nhiêu.*tiền|cost.*how much|tồn kho|còn hàng|in stock|có sẵn|availability"
    r"|mấy triệu|mấy k|mấy đồng|giá cả|giá bán)",
    re.IGNORECASE,
)

# Product search patterns (with specific buying intent)
_PRODUCT_PATTERN = re.compile(
    r"(tìm.*cho|gợi ý.*cho|tư vấn.*cho|muốn mua|cần mua|có bán|cho mình xem|mua được"
    r"|dưới \d+|ngân sách|budget|tầm giá.*có|nên chọn|nên mua|hiển thị|liệt kê"
    r"|xem.*laptop|xem.*pc|mua.*laptop|laptop.*gaming|pc.*gaming"
    r"|cho xem.*sản phẩm|show.*product|list.*product"
    r"|tìm kiếm|search.*for|looking for)",
    re.IGNORECASE,
)

# Knowledge/comparison patterns (lower priority - only if no product intent)
_KNOWLEDGE_PATTERN = re.compile(
    r"(^(tại sao|vì sao|why|how does|làm thế nào|cách nào|what is|là gì).*"
    r"|(khác nhau|difference|so sánh|compare|versus|vs).*(?!.*\bmua\b|.*\btìm\b|.*\bgiá\b)"
    r"|giải thích|explain|concept|lý thuyết|theory"
    r"|ưu điểm|nhược điểm|advantage|disadvantage|pros.*cons"
    r"|nên.*hay|tốt hơn.*hay|better.*or).*(?!.*\bmua\b|.*\bgiá\b)",
    re.IGNORECASE,
)

_REGEX_RULES: list[tuple[str, re.Pattern]] = [
    (INTENT_GREETING, _GREETING_PATTERN),
    (INTENT_HELP, _HELP_PATTERN),
    (INTENT_PRICE, _PRICE_PATTERN),
    (INTENT_PRODUCT, _PRODUCT_PATTERN),
    (INTENT_KNOWLEDGE, _KNOWLEDGE_PATTERN),
]


class IntentService:
    """Enhanced intent detection with Gemini + smart regex fallback."""

    def __init__(self) -> None:
        self._gemini_client = None
        self._gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self._use_gemini_intent = os.getenv("USE_GEMINI_INTENT", "true").lower() == "true"
        
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key and self._use_gemini_intent:
            try:
                self._gemini_client = genai.Client(api_key=api_key)
                logger.info("✅ Gemini intent detection enabled")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini client: {e}")
                self._use_gemini_intent = False

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def detect(self, text: str) -> str:
        """Return the intent label for *text*.

        Strategy (v2.0):
        1. Quick regex checks for obvious patterns (greeting, help, price)
        2. Gemini-based detection for ambiguous queries (with LRU caching)
        3. Regex fallback if Gemini fails
        4. Default to knowledge_question when undecided
        """
        if not text or not text.strip():
            return INTENT_GREETING

        text_clean = text.strip()

        # Quick regex check for obvious patterns
        quick_intent = self._quick_regex_check(text_clean)
        if quick_intent:
            logger.info(f"Intent detected (regex): {quick_intent}")
            return quick_intent

        # Use Gemini for ambiguous queries
        if self._gemini_client and self._use_gemini_intent:
            try:
                intent = self._detect_with_gemini_cached(text_clean)
                logger.info(f"Intent detected (Gemini): {intent}")
                return intent
            except Exception as exc:
                logger.warning(f"Gemini intent error, using fallback: {exc}")

        # Full regex fallback
        intent = self._detect_with_regex(text_clean)
        logger.info(f"Intent detected (regex fallback): {intent}")
        return intent

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _quick_regex_check(self, text: str) -> str | None:
        """Fast regex check for obvious intents (greeting, help, price)."""
        if _GREETING_PATTERN.match(text):
            return INTENT_GREETING
        if _HELP_PATTERN.search(text):
            return INTENT_HELP
        if _PRICE_PATTERN.search(text):
            return INTENT_PRICE
        return None

    @lru_cache(maxsize=1000)
    def _detect_with_gemini_cached(self, text: str) -> str:
        """Cached Gemini intent detection to save API quota."""
        return self._detect_with_gemini(text)

    def _detect_with_gemini(self, text: str) -> str:
        """Ask Gemini to classify intent with enhanced prompt."""
        prompt = (
            "You are an expert intent classifier for a Vietnamese computer hardware e-commerce chatbot.\n"
            "Classify the user message into EXACTLY ONE of these intents:\n\n"
            
            "  - knowledge_question  : General hardware knowledge, theory, how-to guides, concept comparisons, "
            "OR asking about chatbot capabilities WITHOUT requesting actual products.\n"
            "    Examples: 'VGA khác CPU thế nào?', 'Tại sao RAM quan trọng?', 'Bạn có thể làm gì?'\n\n"
            
            "  - product_search      : User wants to SEE or BUY specific products. Must have clear intent to get "
            "product recommendations, listings, or searches by use-case/budget.\n"
            "    Examples: 'Tìm laptop gaming cho mình', 'Laptop dưới 15 triệu', 'Có laptop nào tốt?'\n\n"
            
            "  - product_price       : Asking about price or stock of a SPECIFIC named product.\n"
            "    Examples: 'Giá laptop Asus ROG bao nhiêu?', 'Còn hàng RTX 4090 không?'\n\n"
            
            "  - greeting            : Simple greeting without question.\n"
            "    Examples: 'Xin chào', 'Hello', 'Hi'\n\n"
            
            "  - help                : Asking about chatbot features or how to use it.\n"
            "    Examples: 'Bạn giúp được gì?', 'Làm sao để tìm sản phẩm?'\n\n"
            
            "CRITICAL RULES:\n"
            "- 'So sánh laptop A và B' → knowledge_question (comparing concepts)\n"
            "- 'So sánh giá laptop A và B' → product_price (price comparison)\n"
            "- 'Tìm laptop để so sánh' → product_search (wants products)\n"
            "- 'Bạn có thể giúp tìm laptop không' → help (asking capability)\n"
            "- 'Tìm laptop gaming' → product_search (wants products)\n\n"
            
            "Reply with JSON only, no markdown fences:\n"
            '{"intent": "product_search", "confidence": 0.95}\n\n'
            f'User message: "{text}"'
        )
        
        response = self._gemini_client.models.generate_content(
            model=self._gemini_model_name,
            contents=prompt
        )
        raw = (response.text or "").strip()

        # Strip markdown fences if present
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
        """Enhanced regex-based classification with priority order."""
        for intent, pattern in _REGEX_RULES:
            if pattern.search(text):
                return intent
        return INTENT_KNOWLEDGE
