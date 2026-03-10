"""RAG pipeline for product-grounded chatbot answers.

Supports three answer modes driven by IntentService:
  - answer_question()          — RAG: embed → FAISS → Mongo → Gemini  (product_search)
  - answer_price_question()    — direct Mongo text search + price list (product_price)
  - answer_knowledge_question()— pure Gemini, no product retrieval     (knowledge_question)
"""
from __future__ import annotations

import os
import re

from google import genai
from bson import ObjectId
from loguru import logger

from database import get_db
from services.embedding_service import EmbeddingService
from services.vector_store import VectorStore

# ─── System persona injected into every Gemini prompt ──────────────────────
_SYSTEM_PERSONA = (
    "Bạn là chuyên gia tư vấn linh kiện máy tính và laptop tại cửa hàng TechStore. "
    "Hãy trả lời bằng tiếng Việt, ngắn gọn, thân thiện, chuyên nghiệp. "
    "Luôn ưu tiên dữ liệu sản phẩm thực tế từ ngữ cảnh được cung cấp. "
    "Không bịa đặt thông số kỹ thuật, giá cả hoặc tình trạng hàng tồn kho.\n\n"
)


class RAGPipeline:
    """Retrieve product context from FAISS + generate answer with Gemini."""

    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore(index_name="products")
        self.gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")

        self._gemini_client = None
        self._vector_loaded = self.vector_store.load()
        self._init_gemini()

    def _init_gemini(self) -> None:
        if not self.gemini_api_key:
            logger.warning("GEMINI_API_KEY is not configured. Using retrieval-only fallback.")
            return

        try:
            self._gemini_client = genai.Client(api_key=self.gemini_api_key)
            logger.info(f"✅ Gemini AI initialized with model: {self.gemini_model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            self._gemini_client = None

    # ──────────────────────────────────────────────────────────────────── #
    #  Query processing helpers                                            #
    # ──────────────────────────────────────────────────────────────────── #

    @staticmethod
    def _detect_category_filter(question: str) -> set[str]:
        """Detect category constraints from the user query."""
        question_lower = question.lower()
        categories = set()
        
        # Computer/Laptop keywords
        if re.search(r'\b(máy tính|may tinh|computer|laptop|pc|desktop)\b', question_lower):
            if not re.search(r'\b(console|máy chơi game console|gaming console)\b', question_lower):
                categories.add('Laptop')
                categories.add('PC')
        
        # Console keywords (explicitly exclude if "máy tính" is present)
        if re.search(r'\b(console|máy chơi game console|playstation|xbox|nintendo switch)\b', question_lower):
            if not re.search(r'\b(máy tính|computer|laptop|pc)\b', question_lower):
                categories.add('Console')
        
        # VGA/GPU
        if re.search(r'\b(vga|card đồ họa|gpu|graphics card)\b', question_lower):
            categories.add('VGA')
        
        # CPU/Processor
        if re.search(r'\b(cpu|vi xử lý|processor)\b', question_lower):
            categories.add('CPU')
        
        # RAM
        if re.search(r'\b(ram|bộ nhớ)\b', question_lower):
            categories.add('RAM')
        
        # Monitor
        if re.search(r'\b(màn hình|monitor|display)\b', question_lower):
            categories.add('Màn hình')
        
        # Accessories
        if re.search(r'\b(chuột|mouse)\b', question_lower):
            categories.add('Chuột')
        if re.search(r'\b(bàn phím|keyboard)\b', question_lower):
            categories.add('Bàn phím')
        if re.search(r'\b(tai nghe|headphone|headset)\b', question_lower):
            categories.add('Tai nghe')
            
        return categories

    @staticmethod
    def _expand_query_with_category(question: str) -> str:
        """Expand query with category-relevant keywords for better embeddings."""
        question_lower = question.lower()
        expansions = []
        
        # If asking about gaming computers, expand with laptop/PC terms
        if re.search(r'\b(máy tính|computer|laptop|pc).*\b(game|gaming|chơi game)\b', question_lower):
            expansions.append("laptop gaming PC computer máy tính chơi game")
        elif re.search(r'\b(game|gaming|chơi game).*\b(máy tính|computer|laptop|pc)\b', question_lower):
            expansions.append("laptop gaming PC computer máy tính chơi game")
        
        if expansions:
            return f"{question} {' '.join(expansions)}"
        return question

    # ──────────────────────────────────────────────────────────────────── #
    #  MongoDB helpers                                                     #
    # ──────────────────────────────────────────────────────────────────── #

    async def _fetch_products_by_ids(self, product_ids: list[str]) -> list[dict]:
        """Fetch full product documents from MongoDB by ID list (preserving order)."""
        if not product_ids:
            return []

        db = get_db()
        products_by_id: dict[str, dict] = {}

        object_ids = []
        for pid in product_ids:
            try:
                object_ids.append(ObjectId(pid))
            except Exception:
                continue  # skip malformed IDs

        cursor = db.products.find({"_id": {"$in": object_ids}})
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            products_by_id[doc["_id"]] = doc

        # Preserve FAISS relevance order
        return [products_by_id[p] for p in product_ids if p in products_by_id]

    async def _text_search_products(self, query: str, limit: int = 5) -> list[dict]:
        """MongoDB $text search — fast lookup for price/stock queries."""
        db = get_db()
        results = []
        try:
            cursor = db.products.find(
                {"$text": {"$search": query}},
                {"score": {"$meta": "textScore"}},
            ).sort([("score", {"$meta": "textScore"})]).limit(limit)

            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                results.append(doc)
        except Exception as exc:
            logger.warning(f"Text search failed, falling back to regex: {exc}")
            # Regex fallback (slower but guaranteed)
            pattern = re.compile(re.escape(query), re.IGNORECASE)
            cursor = db.products.find(
                {"$or": [{"name": pattern}, {"brand": pattern}]}
            ).limit(limit)
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                results.append(doc)

        return results

    # ──────────────────────────────────────────────────────────────────── #
    #  Context builders                                                    #
    # ──────────────────────────────────────────────────────────────────── #

    def _build_product_context(self, products: list[dict]) -> str:
        """Rich product context block for Gemini prompts."""
        if not products:
            return (
                "Không tìm thấy sản phẩm phù hợp trong cơ sở dữ liệu của cửa hàng. "
                "Hãy tư vấn chung về phần cứng và thừa nhận rằng dữ liệu sản phẩm không có sẵn."
            )

        chunks = []
        for idx, p in enumerate(products, start=1):
            specs = p.get("specifications") or {}
            specs_text = ", ".join(f"{k}: {v}" for k, v in specs.items()) or "N/A"
            stock_label = "Còn hàng" if (p.get("stock") or 0) > 0 else "Hết hàng"
            chunks.append(
                f"[{idx}] ID: {p.get('_id')}\n"
                f"Tên: {p.get('name', '')}\n"
                f"Danh mục: {p.get('category', '')} | Thương hiệu: {p.get('brand', '')}\n"
                f"Giá: {p.get('price', 'N/A'):,} VND | Tồn kho: {p.get('stock', 0)} ({stock_label})\n"
                f"Đánh giá: {p.get('rating', 'N/A')}/5 ({p.get('reviewCount', 0)} lượt)\n"
                f"Mô tả: {p.get('description', '')}\n"
                f"Thông số kỹ thuật: {specs_text}"
            )

        return "\n\n".join(chunks)

    @staticmethod
    def _build_price_lines(products: list[dict]) -> str:
        """One-line price summary per product for price-query answers."""
        if not products:
            return "Không tìm thấy sản phẩm trong cơ sở dữ liệu."

        lines = []
        for p in products:
            stock_label = "Còn hàng" if (p.get("stock") or 0) > 0 else "Hết hàng"
            price = p.get("price")
            price_str = f"{price:,} VND" if price is not None else "Liên hệ"
            lines.append(
                f"• **{p.get('name')}** ({p.get('brand', '')}): {price_str} — {stock_label}"
            )
        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────────────── #
    #  Gemini call helpers                                                 #
    # ──────────────────────────────────────────────────────────────────── #

    def _call_gemini(self, prompt: str) -> str:
        """Call Gemini and return stripped text. Raises if client not ready."""
        if not self._gemini_client:
            raise RuntimeError("Gemini client is not configured")
        result = self._gemini_client.models.generate_content(
            model=self.gemini_model_name,
            contents=prompt
        )
        return (result.text or "").strip()

    # ──────────────────────────────────────────────────────────────────── #
    #  Public answer methods                                               #
    # ──────────────────────────────────────────────────────────────────── #

    async def answer_question(self, question: str, top_k: int = 5) -> dict:
        """
        RAG path — used for **product_search** intent.
        Embed → FAISS → Mongo → Gemini with product context.
        """
        if not question or not question.strip():
            raise ValueError("Question cannot be empty")

        # 1. Detect category filters and expand query
        category_filter = self._detect_category_filter(question)
        expanded_query = self._expand_query_with_category(question)
        
        logger.info(f"Query: {question} | Expanded: {expanded_query} | Categories: {category_filter}")

        # 2. Embed query (use expanded version for better semantic matching)
        query_vector = self.embedding_service.embed_query(expanded_query)

        # 3. FAISS vector search (retrieve more candidates for filtering)
        search_k = top_k * 5 if category_filter else top_k  # Increased multiplier to 5
        hits = self.vector_store.search(query_vector, top_k=search_k)
        product_ids = [h["product_id"] for h in hits]

        # 4. Fetch full documents
        all_products = await self._fetch_products_by_ids(product_ids)
        
        # 5. Apply category filter if detected
        if category_filter:
            filtered = [
                p for p in all_products 
                if p.get('category') in category_filter
            ]
            logger.info(f"Filtered {len(all_products)} → {len(filtered)} products by categories: {category_filter}")
            
            # Fallback: if filtering returns nothing, use all products (better than empty)
            if filtered:
                products = filtered[:top_k]
            else:
                logger.warning("Category filtering returned 0 products, using unfiltered results")
                products = all_products[:top_k]
        else:
            products = all_products[:top_k]
        
        context_text = self._build_product_context(products)

        # 6. No Gemini → retrieval-only fallback
        if not self._gemini_client:
            return {
                "answer": self._retrieval_only_answer(question, products),
                "retrieved_products": products,
                "source": "retrieval_only",
            }

        # 7. Gemini with product context
        prompt = (
            f"{_SYSTEM_PERSONA}"
            "Hướng dẫn:\n"
            "- Dựa vào ngữ cảnh sản phẩm bên dưới để trả lời câu hỏi của khách hàng.\n"
            "- Gợi ý sản phẩm phù hợp nhất với yêu cầu của họ.\n"
            "- Giải thích ngắn gọn lý do lựa chọn.\n"
            "- KHÔNG bịa đặt thông số hay giá cả ngoài ngữ cảnh đã cung cấp.\n\n"
            f"Câu hỏi: {question}\n\n"
            f"Ngữ cảnh sản phẩm từ cơ sở dữ liệu:\n{context_text}"
        )

        answer = self._call_gemini(prompt)
        return {"answer": answer, "retrieved_products": products, "source": "gemini_rag"}

    async def answer_price_question(self, question: str, top_k: int = 5) -> dict:
        """
        Price/stock path — used for **product_price** intent.
        MongoDB text search → return price list + Gemini summary.
        """
        if not question or not question.strip():
            raise ValueError("Question cannot be empty")

        # Direct text search (more precise than FAISS for named products)
        products = await self._text_search_products(question, limit=top_k)

        # Build concise price block
        price_lines = self._build_price_lines(products)

        if not self._gemini_client:
            # Return raw price table without LLM
            header = "Dưới đây là thông tin giá sản phẩm tìm thấy trong cửa hàng:\n\n"
            return {
                "answer": header + price_lines,
                "retrieved_products": products,
                "source": "price_lookup",
            }

        prompt = (
            f"{_SYSTEM_PERSONA}"
            "Hướng dẫn:\n"
            "- Trả lời câu hỏi về giá cả / tình trạng hàng tồn kho dựa trên dữ liệu bên dưới.\n"
            "- Liệt kê rõ ràng tên sản phẩm, giá và tình trạng kho.\n"
            "- Nếu có nhiều sản phẩm, sắp xếp từ rẻ đến đắt.\n"
            "- Không thêm thông tin giá nào ngoài dữ liệu được cung cấp.\n\n"
            f"Câu hỏi: {question}\n\n"
            f"Dữ liệu giá từ cơ sở dữ liệu:\n{price_lines}"
        )

        answer = self._call_gemini(prompt)
        return {"answer": answer, "retrieved_products": products, "source": "price_lookup"}

    async def answer_knowledge_question(self, question: str) -> dict:
        """
        Knowledge path — used for **knowledge_question** intent.
        Enhanced Gemini with chain-of-thought reasoning for better answers.
        
        v2.0 Improvements:
        - Better prompt engineering with chain-of-thought
        - Encourages structured, comprehensive answers
        - Includes hardware-specific context when relevant
        """
        if not question or not question.strip():
            raise ValueError("Question cannot be empty")

        if not self._gemini_client:
            return {
                "answer": (
                    "Xin lỗi, tôi chưa được cấu hình Gemini API key nên chưa thể trả lời "
                    "câu hỏi kiến thức. Vui lòng liên hệ nhân viên hỗ trợ."
                ),
                "retrieved_products": [],
                "source": "knowledge_fallback",
            }

        # Enhanced prompt with chain-of-thought reasoning
        prompt = (
            f"{_SYSTEM_PERSONA}"
            "**Vai trò**: Bạn là chuyên gia phần cứng máy tính với kiến thức sâu rộng.\n\n"
            
            "**Hướng dẫn trả lời**:\n"
            "1. **Hiểu câu hỏi**: Xác định chính xác điều người dùng muốn biết\n"
            "2. **Giải thích rõ ràng**: Dùng thuật ngữ dễ hiểu, ví dụ thực tế\n"
            "3. **Cấu trúc logic**: Chia nhỏ thành điểm nếu có nhiều khía cạnh\n"
            "4. **Tương quan thực tế**: Liên hệ với use case thực tế nếu phù hợp\n"
            "5. **Khuyến nghị hành động**: Kết thúc bằng gợi ý cụ thể nếu có thể\n\n"
            
            "**Lưu ý quan trọng**:\n"
            "- Trả lời chính xác dựa trên kiến thức về phần cứng máy tính\n"
            "- Nếu câu hỏi về so sánh, nêu rõ ưu/nhược điểm từng bên\n"
            "- Nếu câu hỏi mơ hồ, đưa ra giả định hợp lý và giải thích\n"
            "- Không bịa đặt thông tin kỹ thuật\n"
            "- Có thể gợi ý khách hàng xem sản phẩm tại cửa hàng nếu phù hợp\n\n"
            
            "**Ví dụ câu trả lời tốt**:\n"
            "Q: 'VGA khác CPU thế nào?'\n"
            "A: 'VGA (card đồ họa) và CPU (bộ xử lý trung tâm) là 2 linh kiện khác nhau:\n\n"
            "**CPU (Bộ xử lý)**:\n"
            "- Xử lý các tính toán chung của hệ thống\n"
            "- Quan trọng cho đa nhiệm, lập trình, xử lý văn phòng\n"
            "- VD: Intel Core i7, AMD Ryzen 7\n\n"
            "**VGA (Card đồ họa)**:\n"
            "- Chuyên xử lý đồ họa, render hình ảnh\n"
            "- Quan trọng cho gaming, thiết kế 3D, video editing\n"
            "- VD: NVIDIA RTX 4070, AMD RX 7800 XT\n\n"
            "💡 **Gợi ý**: Nếu bạn chơi game/đồ họa nhiều, ưu tiên nâng cấp VGA. "
            "Nếu làm việc văn phòng/lập trình, ưu tiên CPU tốt.'\n\n"
            
            f"**Câu hỏi từ khách hàng**: {question}\n\n"
            "**Trả lời chi tiết**:"
        )

        try:
            answer = self._call_gemini(prompt)
            
            # Post-process: ensure answer quality
            if len(answer.strip()) < 50:
                # Answer too short, might be error or refusal
                answer += (
                    "\n\nNếu bạn muốn tìm sản phẩm cụ thể, hãy cho tôi biết "
                    "nhu cầu và ngân sách của bạn nhé!"
                )
            
            return {
                "answer": answer,
                "retrieved_products": [],
                "source": "knowledge_gemini_enhanced"
            }
        except Exception as e:
            logger.error(f"Gemini call failed for knowledge question: {e}")
            return {
                "answer": (
                    f"Xin lỗi, tôi đang gặp sự cố xử lý câu hỏi này. "
                    f"Bạn có thể:\n"
                    f"• Hỏi câu hỏi khác\n"
                    f"• Tìm kiếm sản phẩm cụ thể\n"
                    f"• Liên hệ nhân viên hỗ trợ để được tư vấn tốt nhất"
                ),
                "retrieved_products": [],
                "source": "knowledge_error_fallback",
            }

    # ──────────────────────────────────────────────────────────────────── #
    #  Fallback                                                            #
    # ──────────────────────────────────────────────────────────────────── #

    @staticmethod
    def _retrieval_only_answer(question: str, products: list[dict]) -> str:
        """Provide a basic answer when Gemini is unavailable (retrieval-only mode)."""
        if not products:
            return (
                "Hiện tôi chưa tìm thấy sản phẩm phù hợp trong cơ sở dữ liệu. "
                "Bạn có thể hỏi lại với tên sản phẩm, thương hiệu hoặc tầm giá cụ thể hơn."
            )

        lines = ["Tôi đã tìm thấy một số sản phẩm liên quan trong cửa hàng:"]
        for p in products[:5]:
            stock_label = "Còn hàng" if (p.get("stock") or 0) > 0 else "Hết hàng"
            price = p.get("price")
            price_str = f"{price:,} VND" if price is not None else "Liên hệ"
            lines.append(
                f"• {p.get('name')} ({p.get('brand', 'N/A')}) — {price_str} | {stock_label}"
            )
        lines.append("\n(Đang chạy ở chế độ retrieval-only — Gemini API key chưa được cấu hình.)")
        return "\n".join(lines)
