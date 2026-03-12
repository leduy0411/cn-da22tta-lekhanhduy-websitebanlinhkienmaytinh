/**
 * General Chat Agent
 * Handles general conversations not related to products
 * 
 * @module services/ai/agents/GeneralChatAgent
 * @description Specialized agent for general conversations, life questions, and small talk
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeneralChatAgent {
  constructor() {
    this.name = 'GeneralChatAgent';
    this.capabilities = ['general_chat', 'greeting', 'help'];
    
    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }

    console.log('✅ GeneralChatAgent initialized');
  }

  /**
   * Execute agent logic
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Agent response
   */
  async execute(params) {
    const { message, intent, plan, context } = params;
    const intentType = intent.intent;

    try {
      console.log(`💬 GeneralChatAgent executing for intent: ${intentType}`);

      let answer = '';

      switch (intentType) {
        case 'greeting':
          answer = await this._handleGreeting(message, context);
          break;

        case 'help':
          answer = await this._handleHelp(message, context);
          break;

        case 'general_chat':
        default:
          answer = await this._handleGeneralChat(message, context);
          break;
      }

      return {
        answer,
        products: [], // General chat doesn't return products
        intent: intentType,
        source: 'GeneralChatAgent',
        metadata: {
          conversationTurn: context.conversationHistory?.length || 0,
          hasContext: !!context.conversationHistory?.length
        }
      };

    } catch (error) {
      console.error('GeneralChatAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(intentType),
        products: [],
        intent: intentType,
        source: 'GeneralChatAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Handle greeting messages
   * @private
   */
  async _handleGreeting(message, context) {
    const greetings = [
      '👋 **Xin chào!** Tôi là trợ lý AI của TechStore.\n\nTôi có thể giúp bạn:\n\n🔍 **Tìm sản phẩm** - "Laptop gaming dưới 30 triệu"\n\n💡 **Gợi ý** - "Tư vấn PC cho thiết kế"\n\n⚖️ **So sánh** - "RTX 4060 vs RTX 4070"\n\n🛠️ **Build PC** - "Cấu hình PC gaming 40 triệu"\n\n📚 **Hỏi đáp** - "SSD là gì?"\n\nBạn cần tôi giúp gì ạ? 😊',
      
      '👋 **Chào bạn!** Rất vui được hỗ trợ bạn hôm nay.\n\nBạn có thể hỏi tôi về:\n- Sản phẩm công nghệ\n- Tư vấn mua sắm\n- So sánh sản phẩm\n- Kiến thức công nghệ\n\nHoặc chỉ đơn giản là trò chuyện! 😊',
      
      '👋 **Hello!** Tôi là trợ lý AI thông minh của TechStore.\n\nTôi sẵn sàng giúp bạn tìm kiếm, so sánh và tư vấn sản phẩm công nghệ.\n\nHãy cho tôi biết bạn cần gì nhé! 💻'
    ];

    // Return random greeting for variety
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Handle help requests
   * @private
   */
  async _handleHelp(message, context) {
    return `🆘 **Tôi có thể giúp gì cho bạn?**

Dưới đây là những gì tôi có thể làm:

**🔍 Tìm kiếm sản phẩm**
- "Tìm laptop gaming dưới 25 triệu"
- "Có màn hình 27 inch nào tốt không?"
- "Cho tôi xem chuột gaming"

**💡 Tư vấn & Gợi ý**
- "Tư vấn PC cho thiết kế đồ họa"
- "Nên mua laptop nào cho lập trình?"
- "Gợi ý tai nghe trong tầm 2 triệu"

**⚖️ So sánh sản phẩm**
- "So sánh RTX 4060 với RTX 4070"
- "MacBook Air vs ThinkPad X1"
- "SSD vs HDD khác nhau như thế nào?"

**🛠️ Build PC**
- "Build PC gaming 40 triệu"
- "Cấu hình PC workstation cho render"
- "Lắp PC văn phòng giá rẻ"

**📚 Kiến thức công nghệ**
- "GPU là gì?"
- "Giải thích về RAM DDR5"
- "Khác biệt giữa i5 và i7"

**💬 Trò chuyện chung**
- Hỏi về tôi
- Các câu hỏi đời thường
- Tư vấn cuộc sống

Bạn muốn làm gì bây giờ? 😊`;
  }

  /**
   * Handle general chat conversations
   * @private
   */
  async _handleGeneralChat(message, context) {
    if (!this.model) {
      return this._getFallbackResponse('general_chat');
    }

    try {
      // Build conversation context from history
      const conversationContext = this._buildConversationContext(context);

      // Create prompt for general conversation
      const prompt = this._buildGeneralChatPrompt(message, conversationContext);

      console.log('🤖 Calling Gemini for general chat...');
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const answer = response.text();

      console.log('✅ Gemini response received');

      return answer.trim();

    } catch (error) {
      console.error('Error generating general chat response:', error);
      return this._getFallbackResponse('general_chat');
    }
  }

  /**
   * Build conversation context from history
   * @private
   */
  _buildConversationContext(context) {
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      return '';
    }

    let contextText = '\n\n**Lịch sử hội thoại:**\n';
    
    const recentMessages = context.conversationHistory.slice(-5);
    
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? 'Khách hàng' : 'Bạn';
      contextText += `${role}: ${msg.content}\n`;
    });

    return contextText;
  }

  /**
   * Build prompt for general chat
   * @private
   */
  _buildGeneralChatPrompt(message, conversationContext) {
    return `Bạn là trợ lý AI thông minh và thân thiện của **TechStore** - cửa hàng công nghệ hàng đầu Việt Nam.

**Vai trò của bạn:**
- Trợ lý AI có khả năng trò chuyện tự nhiên về nhiều chủ đề
- Có thể tư vấn sản phẩm công nghệ nhưng cũng có thể chat chuyện đời thường
- Thân thiện, hữu ích, và có tính cách ấm áp
- Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin
- Sử dụng emoji phù hợp để tạo sự thân thiện 😊

**Khả năng của bạn:**
✅ Trả lời các câu hỏi về bản thân (bạn là AI của TechStore)
✅ Trò chuyện về đời sống, sức khỏe, ẩm thực, thời tiết
✅ Tư vấn sản phẩm công nghệ (laptop, PC, gaming gear)
✅ Giải thích kiến thức công nghệ
✅ Động viên, an ủi khi khách hàng gặp khó khăn

**Giới hạn:**
❌ Không tư vấn y tế chuyên sâu (nếu hỏi về sức khỏe, nên khuyên gặp bác sĩ)
❌ Không cung cấp thông tin cá nhân của khách hàng khác
❌ Không tham gia chính trị, tôn giáo nhạy cảm
${conversationContext}

**Câu hỏi hiện tại của khách hàng:**
"${message}"

**Hãy trả lời một cách tự nhiên, thân thiện và hữu ích.**

${message.toLowerCase().includes('ăn gì') || message.toLowerCase().includes('sức khỏe') ? '\n**Lưu ý:** Nếu câu hỏi về sức khỏe/ẩm thực, hãy đưa ra gợi ý chung và khuyên nên tham khảo chuyên gia.' : ''}

${message.toLowerCase().includes('bạn là') || message.toLowerCase().includes('ai bạn') || message.toLowerCase().includes('you are') ? '\n**Lưu ý:** Khách hỏi về bạn, hãy giới thiệu bạn là AI trợ lý của TechStore, có khả năng tư vấn công nghệ và trò chuyện thân thiện.' : ''}`;
  }

  /**
   * Get fallback response when AI fails
   * @private
   */
  _getFallbackResponse(intentType) {
    const fallbacks = {
      greeting: '👋 Xin chào! Tôi là trợ lý AI của TechStore. Tôi có thể giúp gì cho bạn hôm nay? 😊',
      
      help: '🆘 Tôi có thể giúp bạn:\n- Tìm sản phẩm công nghệ\n- Tư vấn mua sắm\n- So sánh sản phẩm\n- Giải đáp thắc mắc\n- Trò chuyện thân thiện\n\nBạn muốn làm gì? 😊',
      
      general_chat: 'Tôi là trợ lý AI của TechStore. Tôi có thể giúp bạn tìm kiếm và tư vấn sản phẩm công nghệ, hoặc đơn giản là trò chuyện thân thiện. Bạn có câu hỏi gì không? 😊'
    };

    return fallbacks[intentType] || fallbacks.general_chat;
  }
}

// Export singleton instance
module.exports = new GeneralChatAgent();
