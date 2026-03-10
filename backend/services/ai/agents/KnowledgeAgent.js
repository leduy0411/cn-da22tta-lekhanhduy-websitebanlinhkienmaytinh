/**
 * Knowledge Agent
 * Answers general questions and provides explanations
 * 
 * @module services/ai/agents/KnowledgeAgent
 * @description Specialized agent for knowledge queries and explanations
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class KnowledgeAgent {
  constructor() {
    this.name = 'KnowledgeAgent';
    this.capabilities = ['knowledge_question', 'greeting', 'help', 'explanation'];
    
    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }

    // Knowledge base
    this.knowledgeBase = {
      ssd: {
        definition: 'SSD (Solid State Drive) là ổ cứng thể rắn, sử dụng chip nhớ flash để lưu trữ dữ liệu.',
        advantages: ['Tốc độ đọc/ghi nhanh', 'Không ồn', 'Tiết kiệm điện', 'Độ bền cao'],
        disadvantages: ['Giá cao hơn HDD', 'Tuổi thọ giới hạn theo số lần ghi'],
        types: ['SATA', 'NVMe', 'M.2']
      },
      hdd: {
        definition: 'HDD (Hard Disk Drive) là ổ cứng truyền thống, sử dụng đĩa từ quay để lưu trữ dữ liệu.',
        advantages: ['Giá rẻ', 'Dung lượng lớn', 'Tuổi thọ lâu'],
        disadvantages: ['Tốc độ chậm', 'Dễ hỏng khi va đập', 'Tiêu tốn điện']
      },
      gpu: {
        definition: 'GPU (Graphics Processing Unit) là bộ xử lý đồ họa, chuyên xử lý hình ảnh và video.',
        types: ['Integrated (tích hợp)', 'Dedicated (rời)'],
        brands: ['NVIDIA', 'AMD'],
        usage: ['Gaming', 'Rendering', 'AI/ML', 'Video editing']
      },
      cpu: {
        definition: 'CPU (Central Processing Unit) là bộ xử lý trung tâm, não bộ của máy tính.',
        brands: ['Intel', 'AMD'],
        factors: ['Số nhân (cores)', 'Số luồng (threads)', 'Xung nhịp (clock speed)', 'Cache'],
        usage: ['Gaming', 'Productivity', 'Content creation']
      },
      ram: {
        definition: 'RAM (Random Access Memory) là bộ nhớ tạm, lưu trữ dữ liệu đang sử dụng.',
        types: ['DDR4', 'DDR5'],
        capacities: ['8GB (cơ bản)', '16GB (gaming/làm việc)', '32GB+ (chuyên nghiệp)'],
        speed: ['Tốc độ RAM ảnh hưởng đến hiệu suất tổng thể']
      }
    };
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
      console.log(`📚 KnowledgeAgent executing for intent: ${intentType}`);

      let answer = '';

      switch (intentType) {
        case 'greeting':
          answer = await this._handleGreeting(message, context);
          break;

        case 'help':
          answer = await this._handleHelp(message, context);
          break;

        case 'knowledge_question':
          answer = await this._handleKnowledgeQuestion(message, context);
          break;

        default:
          answer = await this._handleGeneral(message, context);
      }

      return {
        answer,
        intent: intentType,
        source: 'KnowledgeAgent',
        metadata: {
          category: intentType,
          hasContext: !!context.conversationHistory
        }
      };

    } catch (error) {
      console.error('KnowledgeAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(message, intent.intent),
        intent: intent.intent,
        source: 'KnowledgeAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Handle greeting
   * @private
   */
  async _handleGreeting(message, context) {
    const greetings = [
      '👋 Xin chào! Tôi là trợ lý AI của TechStore. Tôi có thể giúp bạn:',
      '🔍 **Tìm kiếm sản phẩm**: "Laptop gaming dưới 30 triệu"',
      '💡 **Gợi ý sản phẩm**: "Tư vấn laptop cho lập trình"',
      '⚖️ **So sánh sản phẩm**: "So sánh RTX 4060 và RTX 4070"',
      '🖥️ **Build PC**: "Build PC gaming 40 triệu"',
      '❓ **Giải đáp thắc mắc**: "SSD là gì?"',
      '',
      'Bạn cần tôi giúp gì ạ? 😊'
    ];

    return greetings.join('\n');
  }

  /**
   * Handle help request
   * @private
   */
  async _handleHelp(message, context) {
    return `🆘 **Hướng dẫn sử dụng**

**1. Tìm kiếm sản phẩm:**
- "Tìm laptop gaming dưới 30 triệu"
- "PC văn phòng giá rẻ"
- "Màn hình 144Hz ASUS"

**2. Gợi ý sản phẩm:**
- "Gợi ý laptop cho sinh viên"
- "Tư vấn PC cho thiết kế đồ họa"
- "Nên mua GPU nào để chơi game?"

**3. So sánh sản phẩm:**
- "So sánh RTX 4060 với RTX 4070"
- "RTX 4080 vs RTX 4090"
- "Khác nhau giữa i7 và Ryzen 7"

**4. Build PC:**
- "Build PC gaming 40 triệu"
- "Cấu hình PC workstation 60 triệu"
- "Lắp PC văn phòng giá rẻ"

**5. Hỏi đáp kiến thức:**
- "SSD là gì?"
- "Khác nhau giữa DDR4 và DDR5"
- "NVMe tốt hơn SATA như thế nào?"

📞 Hotline hỗ trợ: **1900-xxxx**`;
  }

  /**
   * Handle knowledge question
   * @private
   */
  async _handleKnowledgeQuestion(message, context) {
    // Check knowledge base first
    const messageLower = message.toLowerCase();
    let knowledgeResponse = null;

    for (const [topic, info] of Object.entries(this.knowledgeBase)) {
      if (messageLower.includes(topic)) {
        knowledgeResponse = this._formatKnowledgeResponse(topic, info);
        break;
      }
    }

    if (knowledgeResponse) {
      return knowledgeResponse;
    }

    // Use Gemini for complex questions
    if (this.model) {
      try {
        const prompt = `Bạn là chuyên gia công nghệ tại TechStore.

Khách hàng hỏi: "${message}"

Hãy:
1. Giải thích rõ ràng và dễ hiểu
2. Sử dụng ví dụ minh họa
3. So sánh với các khái niệm tương tự (nếu có)
4. Đưa ra lời khuyên thực tế

Trả lời bằng tiếng Việt, ngắn gọn nhưng đầy đủ.`;

        const result = await this.model.generateContent(prompt);
        return result.response.text();

      } catch (error) {
        console.error('Gemini error:', error);
      }
    }

    return this._getFallbackResponse(message, 'knowledge_question');
  }

  /**
   * Handle general queries
   * @private
   */
  async _handleGeneral(message, context) {
    if (this.model) {
      try {
        const prompt = `Bạn là trợ lý AI của TechStore, cửa hàng bán sản phẩm công nghệ.

Khách hàng: "${message}"

Hãy trả lời thân thiện, chuyên nghiệp và hữu ích.

Trả lời bằng tiếng Việt.`;

        const result = await this.model.generateContent(prompt);
        return result.response.text();

      } catch (error) {
        console.error('Gemini error:', error);
      }
    }

    return '💬 Xin lỗi, tôi chưa hiểu rõ yêu cầu của bạn. Bạn có thể nói cụ thể hơn được không?';
  }

  /**
   * Format knowledge base response
   * @private
   */
  _formatKnowledgeResponse(topic, info) {
    let response = `📚 **${topic.toUpperCase()}**\n\n`;
    
    response += `**Định nghĩa:** ${info.definition}\n\n`;

    if (info.advantages) {
      response += `**Ưu điểm:**\n${info.advantages.map(a => `✅ ${a}`).join('\n')}\n\n`;
    }

    if (info.disadvantages) {
      response += `**Nhược điểm:**\n${info.disadvantages.map(d => `❌ ${d}`).join('\n')}\n\n`;
    }

    if (info.types) {
      response += `**Các loại:** ${info.types.join(', ')}\n\n`;
    }

    if (info.brands) {
      response += `**Thương hiệu:** ${info.brands.join(', ')}\n\n`;
    }

    if (info.usage) {
      response += `**Ứng dụng:** ${info.usage.join(', ')}\n\n`;
    }

    if (info.capacities) {
      response += `**Dung lượng phổ biến:**\n${info.capacities.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    response += '💡 Bạn còn thắc mắc gì khác không?';

    return response;
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(message, intent) {
    if (intent === 'greeting') {
      return '👋 Xin chào! Tôi có thể giúp gì cho bạn?';
    }

    if (intent === 'help') {
      return '🆘 Tôi có thể giúp bạn tìm kiếm sản phẩm, so sánh, gợi ý, build PC và giải đáp thắc mắc. Bạn cần gì?';
    }

    return '📚 Tôi sẽ cố gắng tìm hiểu và trả lời câu hỏi của bạn. Vui lòng đợi một chút.';
  }
}

module.exports = new KnowledgeAgent();
