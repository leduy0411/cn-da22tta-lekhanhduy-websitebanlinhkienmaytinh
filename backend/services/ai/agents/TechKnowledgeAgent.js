/**
 * Tech Knowledge Agent
 * Handles science & technology questions using RAG pipeline
 * 
 * Capabilities:
 * - Answer technical questions using knowledge base + LLM
 * - Explain scientific/tech concepts with RAG context
 * - Provide detailed explanations about hardware, software, networking, AI, etc.
 * 
 * @module services/ai/agents/TechKnowledgeAgent
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const RAGPipeline = require('../rag/RAGPipeline');
const VectorSearchService = require('../rag/VectorSearchService');

class TechKnowledgeAgent {
  constructor() {
    this.name = 'TechKnowledgeAgent';
    this.genAI = null;
    this.model = null;

    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }

    // Category mapping for intent→knowledge category
    this.topicCategories = {
      'machine learning': ['ai_ml', 'programming', 'technology'],
      'deep learning': ['ai_ml', 'programming'],
      'neural network': ['ai_ml'],
      'ai': ['ai_ml', 'technology'],
      'gpu': ['hardware', 'technology'],
      'cpu': ['hardware', 'technology'],
      'ram': ['hardware'],
      'ssd': ['hardware'],
      'networking': ['networking', 'security'],
      'programming': ['programming', 'software'],
      'security': ['security', 'networking'],
      'cloud': ['cloud', 'technology'],
      'database': ['programming', 'technology'],
      'linux': ['software', 'technology'],
      'hardware': ['hardware', 'technology'],
      'default': ['technology', 'hardware', 'programming', 'ai_ml', 'networking', 'security', 'software', 'general']
    };

    console.log('✅ TechKnowledgeAgent initialized');
  }

  /**
   * Execute the agent
   * @param {Object} params - { message, intent, plan, context }
   * @returns {Promise<Object>}
   */
  async execute({ message, intent, plan, context }) {
    try {
      console.log(`🔬 TechKnowledgeAgent processing: "${message.substring(0, 80)}..."`);

      // 1. Determine relevant knowledge categories
      const categories = this._detectCategories(message);

      // 2. Search knowledge base via RAG
      let knowledgeDocs = [];
      try {
        knowledgeDocs = await VectorSearchService.hybridSearch(message, {
          limit: 5,
          minSimilarity: 0.25,
          categories
        });
      } catch (err) {
        console.warn('Knowledge search failed, using LLM only:', err.message);
      }

      // 3. Generate response using Gemini with RAG context
      const answer = await this._generateResponse(message, {
        knowledgeDocs,
        conversationHistory: context.conversationHistory || [],
        intent
      });

      // 4. Collect sources
      const sources = knowledgeDocs.map(doc => ({
        source: doc.source,
        category: doc.category,
        similarity: (doc.finalScore || doc.similarity || 0).toFixed(3),
        snippet: doc.text.substring(0, 120) + '...'
      }));

      return {
        answer,
        type: 'technical_knowledge',
        sources,
        knowledgeDocsUsed: knowledgeDocs.length,
        ragUsed: knowledgeDocs.length > 0,
        products: []
      };

    } catch (error) {
      console.error('TechKnowledgeAgent error:', error);
      return {
        answer: this._getFallback(message),
        type: 'technical_knowledge',
        sources: [],
        knowledgeDocsUsed: 0,
        ragUsed: false,
        products: []
      };
    }
  }

  /**
   * Generate response using Gemini + RAG context
   */
  async _generateResponse(message, { knowledgeDocs, conversationHistory, intent }) {
    if (!this.model) {
      return this._getFallback(message);
    }

    let prompt = `**Vai trò**: Bạn là TechStore AI - chuyên gia khoa học và công nghệ.
Bạn có kiến thức sâu rộng về: phần cứng máy tính, phần mềm, lập trình, AI/ML, mạng, bảo mật, cloud.

**Nguyên tắc**:
1. Giải thích rõ ràng, dễ hiểu, có ví dụ thực tế
2. Trả lời bằng tiếng Việt, chuyên nghiệp
3. Sử dụng kiến thức từ tài liệu tham khảo nếu có
4. Format đẹp với markdown (##, **, •, bảng)
5. Nếu câu hỏi liên quan đến sản phẩm, gợi ý xem thêm tại TechStore
6. Không bịa đặt thông số kỹ thuật\n\n`;

    // Add RAG context
    if (knowledgeDocs.length > 0) {
      prompt += '**TÀI LIỆU THAM KHẢO (từ Knowledge Base)**:\n';
      knowledgeDocs.forEach((doc, i) => {
        prompt += `\n--- Tài liệu ${i + 1} [${doc.source}] ---\n${doc.text}\n`;
      });
      prompt += '\n---\nHãy sử dụng thông tin từ tài liệu trên để trả lời chính xác.\n\n';
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      prompt += '**LỊCH SỬ HỘI THOẠI**:\n';
      const recent = conversationHistory.slice(-4);
      recent.forEach(msg => {
        prompt += `${msg.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    prompt += `**CÂU HỎI**: ${message}\n\n**TRẢ LỜI CHI TIẾT** (giải thích rõ ràng, dễ hiểu):`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini generation error:', error.message);
      return this._getFallback(message);
    }
  }

  /**
   * Detect relevant knowledge categories from message
   */
  _detectCategories(message) {
    const lower = message.toLowerCase();
    const matched = new Set();

    for (const [keyword, cats] of Object.entries(this.topicCategories)) {
      if (keyword === 'default') continue;
      if (lower.includes(keyword)) {
        cats.forEach(c => matched.add(c));
      }
    }

    if (matched.size === 0) {
      return this.topicCategories.default;
    }

    return Array.from(matched);
  }

  /**
   * Fallback response when Gemini is unavailable
   */
  _getFallback(message) {
    return `Cảm ơn câu hỏi của bạn! Đây là một chủ đề thú vị về khoa học và công nghệ. 

Hiện tại tôi đang gặp khó khăn trong việc xử lý câu hỏi này. Bạn có thể:

• **Thử lại sau** - Hệ thống AI đang được cập nhật
• **Đặt câu hỏi đơn giản hơn** - Ví dụ: "GPU là gì?" hoặc "So sánh DDR4 và DDR5"
• **Hỏi về sản phẩm** - Tôi có thể tư vấn laptop, PC, linh kiện tại TechStore

Bạn cần giúp gì khác không? 😊`;
  }
}

module.exports = new TechKnowledgeAgent();
