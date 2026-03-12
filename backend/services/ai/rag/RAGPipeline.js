/**
 * RAG Pipeline
 * Retrieval-Augmented Generation: retrieve → augment prompt → generate via Gemini
 * 
 * @module services/ai/rag/RAGPipeline
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const VectorSearchService = require('./VectorSearchService');
const Product = require('../../../models/Product');

class RAGPipeline {
  constructor() {
    this.genAI = null;
    this.model = null;
    this._initialize();
  }

  _initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not configured - RAGPipeline disabled');
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    });
    console.log('✅ RAGPipeline initialized');
  }

  /**
   * Full RAG: retrieve knowledge context + generate answer
   * @param {string} query - User question
   * @param {Object} options
   * @returns {Promise<Object>} { answer, sources, products }
   */
  async query(query, options = {}) {
    const {
      pipeline = 'auto', // 'general_knowledge', 'product_rag', 'recommendation', 'auto'
      conversationHistory = [],
      categories = null,
      includeProducts = true,
      maxKnowledgeDocs = 5,
      maxProducts = 5
    } = options;

    // 1. Retrieve knowledge context
    const knowledgeContext = await this._retrieveKnowledge(query, {
      categories,
      limit: maxKnowledgeDocs
    });

    // 2. Retrieve product context (if relevant)
    let productContext = [];
    if (includeProducts) {
      productContext = await this._retrieveProducts(query, { limit: maxProducts });
    }

    // 3. Build augmented prompt
    const augmentedPrompt = this._buildPrompt(query, {
      pipeline,
      knowledgeContext,
      productContext,
      conversationHistory
    });

    // 4. Generate response
    const answer = await this._generate(augmentedPrompt);

    // 5. Collect sources
    const sources = knowledgeContext.map(doc => ({
      source: doc.source,
      category: doc.category,
      similarity: doc.similarity || doc.finalScore,
      snippet: doc.text.substring(0, 150) + '...'
    }));

    return {
      answer,
      sources,
      products: productContext,
      knowledgeDocsUsed: knowledgeContext.length,
      productsUsed: productContext.length,
      pipeline
    };
  }

  /**
   * General Knowledge Pipeline - for science/tech questions
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async generalKnowledge(query, options = {}) {
    return this.query(query, {
      ...options,
      pipeline: 'general_knowledge',
      includeProducts: false,
      categories: ['technology', 'networking', 'programming', 'hardware',
                   'software', 'ai_ml', 'security', 'cloud', 'general']
    });
  }

  /**
   * Product RAG Pipeline - for product-related queries
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async productRAG(query, options = {}) {
    return this.query(query, {
      ...options,
      pipeline: 'product_rag',
      includeProducts: true,
      categories: ['product_spec', 'hardware', 'technology']
    });
  }

  /**
   * Recommendation Pipeline - advice + product suggestions
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async recommendation(query, options = {}) {
    return this.query(query, {
      ...options,
      pipeline: 'recommendation',
      includeProducts: true,
      maxProducts: 8
    });
  }

  // --- Private Methods ---

  /**
   * Retrieve relevant knowledge documents
   */
  async _retrieveKnowledge(query, options = {}) {
    try {
      const results = await VectorSearchService.hybridSearch(query, {
        limit: options.limit || 5,
        minSimilarity: 0.25,
        categories: options.categories
      });
      return results;
    } catch (error) {
      console.warn('Knowledge retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Retrieve relevant products from database
   */
  async _retrieveProducts(query, options = {}) {
    try {
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (keywords.length === 0) return [];

      const regexPattern = keywords
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

      const products = await Product.find({
        $or: [
          { name: { $regex: regexPattern, $options: 'i' } },
          { description: { $regex: regexPattern, $options: 'i' } },
          { brand: { $regex: regexPattern, $options: 'i' } },
          { category: { $regex: regexPattern, $options: 'i' } }
        ],
        stock: { $gt: 0 }
      })
        .select('name brand category price originalPrice rating reviewCount stock image specifications description')
        .sort({ rating: -1, reviewCount: -1 })
        .limit(options.limit || 5)
        .lean();

      return products;
    } catch (error) {
      console.warn('Product retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Build the augmented prompt for Gemini
   */
  _buildPrompt(query, { pipeline, knowledgeContext, productContext, conversationHistory }) {
    let systemInstruction = `**Vai trò**: Bạn là TechStore AI Assistant - trợ lý AI chuyên về khoa học và công nghệ của cửa hàng TechStore.

**Chuyên môn**:
- Tư vấn sản phẩm công nghệ (laptop, PC, linh kiện, phụ kiện)
- Giải thích kiến thức khoa học và công nghệ
- So sánh và đánh giá sản phẩm
- Tư vấn cấu hình và lựa chọn thiết bị
- Trả lời câu hỏi về AI, Machine Learning, lập trình, mạng, bảo mật

**Nguyên tắc**:
1. Trả lời bằng tiếng Việt, thân thiện, chuyên nghiệp
2. Đưa ra giải thích rõ ràng, dễ hiểu
3. Khi có dữ liệu từ cửa hàng, ưu tiên giới thiệu sản phẩm có sẵn
4. Không bịa đặt thông số kỹ thuật - chỉ dùng dữ liệu được cung cấp
5. Format câu trả lời đẹp với markdown (**, ##, •, bảng so sánh)
6. Khi so sánh hoặc tư vấn: giải thích lý do trước, sau đó gợi ý sản phẩm`;

    // Pipeline-specific instructions
    if (pipeline === 'general_knowledge') {
      systemInstruction += `\n\n**Chế độ**: Kiến thức tổng hợp
- Giải thích chi tiết về khoa học và công nghệ
- Đưa ra ví dụ thực tế
- Nếu có tài liệu tham khảo bên dưới, hãy sử dụng chúng`;
    } else if (pipeline === 'product_rag') {
      systemInstruction += `\n\n**Chế độ**: Tư vấn sản phẩm
- Ưu tiên thông tin từ danh sách sản phẩm bên dưới
- Đề xuất sản phẩm cụ thể kèm giá và thông số
- So sánh nếu có nhiều lựa chọn`;
    } else if (pipeline === 'recommendation') {
      systemInstruction += `\n\n**Chế độ**: Tư vấn và đề xuất
- Phân tích nhu cầu của người dùng
- Giải thích ưu nhược điểm của các lựa chọn
- Đề xuất sản phẩm phù hợp nhất kèm lý do
- Hỏi thêm nếu cần thông tin`;
    }

    let prompt = systemInstruction + '\n\n';

    // Add knowledge context
    if (knowledgeContext.length > 0) {
      prompt += '**TÀI LIỆU THAM KHẢO (Knowledge Base)**:\n';
      knowledgeContext.forEach((doc, i) => {
        prompt += `\n--- Tài liệu ${i + 1} [${doc.source}] (${doc.category}) ---\n${doc.text}\n`;
      });
      prompt += '\n';
    }

    // Add product context
    if (productContext.length > 0) {
      prompt += '**SẢN PHẨM CÓ SẴN TRONG CỬA HÀNG**:\n';
      productContext.forEach((p, i) => {
        const specs = p.specifications
          ? Object.entries(p.specifications).map(([k, v]) => `${k}: ${v}`).join(', ')
          : '';
        prompt += `${i + 1}. **${p.name}** (${p.brand}) - ${p.price?.toLocaleString('vi-VN')}đ`;
        prompt += ` | ⭐${p.rating || 0}/5 (${p.reviewCount || 0} đánh giá)`;
        prompt += ` | Kho: ${p.stock > 0 ? 'Còn hàng' : 'Hết hàng'}`;
        if (specs) prompt += ` | ${specs}`;
        if (p.description) prompt += `\n   ${p.description.substring(0, 200)}`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      prompt += '**LỊCH SỬ HỘI THOẠI** (gần nhất):\n';
      const recent = conversationHistory.slice(-6);
      recent.forEach(msg => {
        prompt += `${msg.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    prompt += `**CÂU HỎI MỚI**: ${query}\n\n**TRẢ LỜI** (format đẹp với markdown):`;
    return prompt;
  }

  /**
   * Generate response via Gemini
   */
  async _generate(prompt) {
    if (!this.model) {
      return 'Xin lỗi, hệ thống AI đang tạm thời không khả dụng. Vui lòng thử lại sau.';
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('RAG generation error:', error.message);
      return 'Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.';
    }
  }

  /**
   * Check if pipeline is available
   */
  isAvailable() {
    return this.model !== null;
  }
}

module.exports = new RAGPipeline();
