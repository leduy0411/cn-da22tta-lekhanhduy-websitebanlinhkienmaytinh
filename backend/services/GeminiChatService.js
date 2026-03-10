/**
 * Gemini Chat Service - Direct Integration
 * ════════════════════════════════════════════════════════════════
 * Gọi trực tiếp Google Gemini API cho chatbot với RAG support.
 * 
 * @module services/GeminiChatService
 * @author AI Expert Team
 * @version 2.0
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiChatService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize Gemini AI với API key từ environment
   */
  initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not configured in .env');
      this.isInitialized = false;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Try gemini-pro first, fallback to others
      const modelName = process.env.GEMINI_MODEL || 'gemini-pro';
      this.model = this.genAI.getGenerativeModel({ 
        model: modelName
      });
      this.isInitialized = true;
      console.log(`✅ Gemini Chat Service initialized with model: ${modelName}`);
    } catch (error) {
      console.error('❌ Failed to initialize Gemini:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Generate chat response với context từ RAG
   * 
   * @param {string} userMessage - Tin nhắn từ user
   * @param {Array} productContext - Danh sách sản phẩm liên quan (RAG)
   * @param {Array} chatHistory - Lịch sử chat (optional)
   * @returns {Promise<Object>} Response với answer và metadata
   */
  async generateResponse(userMessage, productContext = [], chatHistory = []) {
    if (!this.isReady()) {
      throw new Error('Gemini service not initialized');
    }

    try {
      console.log('🔵 Calling Gemini API with model:', this.model.model);
      
      // Build prompt với system instruction + product context
      const prompt = this._buildPrompt(userMessage, productContext, chatHistory);
      console.log('📝 Prompt length:', prompt.length);

      // Call Gemini API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const result = await this.model.generateContent(prompt);
      clearTimeout(timeoutId);
      
      const response = result.response;
      const answer = response.text();
      
      console.log('✅ Gemini response received, length:', answer.length);

      return {
        success: true,
        answer: answer.trim(),
        productContext: productContext.length,
        source: 'gemini_rag'
      };

    } catch (error) {
      console.error('❌ Gemini API error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // Fallback response
      return {
        success: false,
        answer: this._getFallbackResponse(userMessage, productContext),
        productContext: productContext.length,
        source: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * Generate streaming response (for real-time typing effect)
   * 
   * @param {string} userMessage 
   * @param {Array} productContext 
   * @param {Array} chatHistory 
   * @returns {AsyncIterator} Stream of text chunks
   */
  async *generateStreamingResponse(userMessage, productContext = [], chatHistory = []) {
    if (!this.isReady()) {
      yield { error: 'Gemini service not initialized' };
      return;
    }

    try {
      const prompt = this._buildPrompt(userMessage, productContext, chatHistory);
      const result = await this.model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { text, done: false };
        }
      }

      yield { done: true };

    } catch (error) {
      console.error('Streaming error:', error);
      yield { error: error.message };
    }
  }

  /**
   * Build prompt với RAG context
   * @private
   */
  _buildPrompt(userMessage, productContext, chatHistory) {
    let prompt = `**Vai trò**: Bạn là trợ lý AI thông minh của TechStore - cửa hàng bán linh kiện máy tính và laptop.

**Nhiệm vụ**:
- Tư vấn sản phẩm phù hợp với nhu cầu khách hàng
- Giải đáp thắc mắc về công nghệ, cấu hình
- So sánh sản phẩm và đưa ra khuyến nghị
- Hỗ trợ quyết định mua hàng

**Nguyên tắc**:
1. Trả lời bằng tiếng Việt, thân thiện, chuyên nghiệp
2. Ưu tiên sản phẩm có sẵn trong cửa hàng (context bên dưới)
3. Đưa ra khuyến nghị cụ thể kèm lý do
4. Không bịa đặt thông số kỹ thuật
5. Format câu trả lời đẹp với markdown (**, ##, •)

`;

    // Add product context (RAG)
    if (productContext && productContext.length > 0) {
      prompt += `\n**SẢN PHẨM CÓ SẴN TRONG CỬA HÀNG**:\n\n`;
      productContext.forEach((product, idx) => {
        prompt += `${idx + 1}. **${product.name}** (${product.brand || 'N/A'})\n`;
        prompt += `   - Giá: ${this._formatPrice(product.price)}\n`;
        prompt += `   - Tồn kho: ${product.stock > 0 ? 'Còn hàng' : 'Hết hàng'}\n`;
        prompt += `   - Đánh giá: ${product.rating || 'N/A'}/5 (${product.reviewCount || 0} reviews)\n`;
        
        if (product.specifications) {
          const specs = Object.entries(product.specifications).slice(0, 3);
          if (specs.length > 0) {
            prompt += `   - Specs: ${specs.map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
          }
        }
        
        if (product.description) {
          prompt += `   - Mô tả: ${product.description.substring(0, 150)}...\n`;
        }
        prompt += `\n`;
      });
    }

    // Add chat history
    if (chatHistory && chatHistory.length > 0) {
      prompt += `\n**LỊCH SỬ HỘI THOẠI** (${chatHistory.length} tin gần nhất):\n`;
      chatHistory.slice(-5).forEach(msg => {
        prompt += `${msg.role === 'user' ? 'Khách hàng' : 'Bạn'}: ${msg.content}\n`;
      });
      prompt += `\n`;
    }

    // Add user message
    prompt += `\n**CÂU HỎI MỚI**:\n${userMessage}\n\n`;
    prompt += `**TRẢ LỜI** (format đẹp với markdown, cụ thể, dễ hiểu):`;

    return prompt;
  }

  /**
   * Format price to VND
   * @private
   */
  _formatPrice(price) {
    if (!price || isNaN(price)) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  /**
   * Fallback response khi Gemini fail
   * @private
   */
  _getFallbackResponse(userMessage, productContext) {
    const lowerMsg = userMessage.toLowerCase();
    
    // Check intent
    const isGreeting = /^(xin chào|chào|hello|hi|hey)/i.test(lowerMsg);
    const isHelp = /(giúp|tư vấn|hỗ trợ)/i.test(lowerMsg);
    const isPriceQuery = /(giá|bao nhiêu|cost|price)/i.test(lowerMsg);
    const isComparison = /(so sánh|compare)/i.test(lowerMsg);
    
    // Greeting response
    if (isGreeting) {
      return `👋 **Xin chào!** Tôi là AI trợ lý của TechStore.\n\n` +
             `Tôi có thể giúp bạn:\n` +
             `- 🔍 Tìm kiếm sản phẩm\n` +
             `- 💰 Tư vấn giá cả\n` +
             `- 📊 So sánh cấu hình\n` +
             `- 💡 Gợi ý sản phẩm phù hợp\n\n` +
             `Bạn đang tìm sản phẩm nào?`;
    }
    
    // Has products context
    if (productContext && productContext.length > 0) {
      const products = productContext.slice(0, 3);
      let response = '';
      
      if (isPriceQuery) {
        response = `💰 **Thông tin giá sản phẩm:**\n\n`;
      } else if (isComparison) {
        response = `📊 **So sánh sản phẩm:**\n\n`;
      } else {
        response = `🛍️ **Gợi ý sản phẩm cho bạn:**\n\n`;
      }
      
      products.forEach((p, idx) => {
        response += `**${idx + 1}. ${p.name}**\n`;
        if (p.brand) response += `   📦 Thương hiệu: ${p.brand}\n`;
        response += `   💵 Giá: ${this._formatPrice(p.price)}\n`;
        response += `   ${p.stock > 0 ? '✅ Còn hàng' : '❌ Hết hàng'}`;
        if (p.rating) response += ` • ⭐ ${p.rating}/5`;
        response += `\n\n`;
      });

      if (isHelp) {
        response += `\n💡 **Lời khuyên:**\n`;
        response += `- So sánh cấu hình trước khi mua\n`;
        response += `- Kiểm tra đánh giá từ người dùng\n`;
        response += `- Liên hệ tư vấn viên nếu cần hỗ trợ thêm\n`;
      }
      
      response += `\n📞 *Cần tư vấn chi tiết? Liên hệ hotline: 1900 xxxx*`;
      return response;
    }

    // No products - general response
    return `🤖 **Xin lỗi, tôi đang được nâng cấp!**\n\n` +
           `Hiện tại tôi có thể:\n` +
           `- ✅ Tìm kiếm sản phẩm trong kho\n` +
           `- ✅ Hiển thị thông tin giá và tồn kho\n` +
           `- ✅ Gợi ý sản phẩm phù hợp\n\n` +
           `Bạn có thể:\n` +
           `1. Tìm kiếm theo tên sản phẩm\n` +
           `2. Tìm theo thương hiệu (ASUS, MSI, Dell...)\n` +
           `3. Tìm theo loại (laptop gaming, PC văn phòng...)\n\n` +
           `💬 Hoặc liên hệ nhân viên hỗ trợ: **1900 xxxx**`;
  }
}

// Export singleton instance
module.exports = new GeminiChatService();
