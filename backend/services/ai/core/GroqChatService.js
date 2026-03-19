/**
 * Groq Chat Service
 * Primary LLM: Groq (Llama 3)
 * Fallback LLM: Gemini (free tier)
 * Includes Circuit Breaker to avoid hammering provider on rate limits/outages
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GroqChatService {
  constructor() {
    this.groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';
    this.groqApiKey = process.env.GROQ_API_KEY || '';

    this.geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.geminiModel = null;

    // Circuit breaker state
    this.breaker = {
      state: 'CLOSED',
      failureCount: 0,
      failureThreshold: Number(process.env.GROQ_CB_FAILURE_THRESHOLD || 4),
      openTimeoutMs: Number(process.env.GROQ_CB_OPEN_TIMEOUT_MS || 45000),
      nextTryAt: 0
    };

    if (this.geminiApiKey) {
      try {
        const gemini = new GoogleGenerativeAI(this.geminiApiKey);
        this.geminiModel = gemini.getGenerativeModel({ model: this.geminiModelName });
      } catch (error) {
        console.error('Gemini fallback init failed:', error.message);
      }
    }
  }

  isGroqAvailable() {
    return Boolean(this.groqApiKey);
  }

  _canUseGroq() {
    if (!this.isGroqAvailable()) {
      return false;
    }

    if (this.breaker.state === 'OPEN') {
      if (Date.now() >= this.breaker.nextTryAt) {
        this.breaker.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    return true;
  }

  _onGroqSuccess() {
    this.breaker.failureCount = 0;
    this.breaker.state = 'CLOSED';
    this.breaker.nextTryAt = 0;
  }

  _onGroqFailure(error) {
    const status = error?.response?.status || 0;
    const isRateLimit = status === 429;
    const isServerError = status >= 500;
    const isNetworkError = !status;

    if (isRateLimit || isServerError || isNetworkError) {
      this.breaker.failureCount += 1;
    }

    if (this.breaker.failureCount >= this.breaker.failureThreshold) {
      this.breaker.state = 'OPEN';
      this.breaker.nextTryAt = Date.now() + this.breaker.openTimeoutMs;
    }
  }

  async _callGroq(messages, options = {}) {
    if (!this._canUseGroq()) {
      throw new Error('Groq circuit is OPEN or API key missing');
    }

    try {
      const response = await axios.post(
        `${this.groqBaseUrl}/chat/completions`,
        {
          model: options.model || this.groqModel,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 900,
          messages
        },
        {
          timeout: options.timeoutMs || 15000,
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const text = response?.data?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error('Groq returned empty response');
      }

      this._onGroqSuccess();
      return {
        provider: 'groq',
        model: options.model || this.groqModel,
        text
      };
    } catch (error) {
      this._onGroqFailure(error);
      throw error;
    }
  }

  async _callGeminiFallback(prompt, options = {}) {
    if (!this.geminiModel) {
      throw new Error('Gemini fallback is not configured');
    }

    const result = await this.geminiModel.generateContent(prompt);
    const text = result?.response?.text?.()?.trim();

    if (!text) {
      throw new Error('Gemini fallback returned empty response');
    }

    return {
      provider: 'gemini-fallback',
      model: this.geminiModelName,
      text: this._sanitizeFallbackPrefix(text)
    };
  }

  async chat(messages, options = {}) {
    try {
      return await this._callGroq(messages, options);
    } catch (primaryError) {
      try {
        const fallbackPrompt = messages
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join('\n\n');
        return await this._callGeminiFallback(fallbackPrompt, options);
      } catch (fallbackError) {
        const reason = primaryError?.message || 'Groq failed';
        throw new Error(`All providers failed. Primary: ${reason}. Fallback: ${fallbackError.message}`);
      }
    }
  }

  async detectIntent(message, conversationHistory = []) {
    const systemPrompt = [
      'You are an intent classifier for an e-commerce chatbot.',
      'Output ONLY strict JSON without markdown.',
      'Allowed intents: greeting, product_search, recommendation, comparison, pc_build, product_details, price_inquiry, knowledge_question, technical_question, order_status, help, general_chat, unknown.',
      'JSON schema: {"intent":"...","confidence":0-1,"reasoning":"short"}'
    ].join(' ');

    const userPrompt = JSON.stringify({
      message,
      conversationHistory: conversationHistory.slice(-4)
    });

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0,
      maxTokens: 180
    });

    try {
      const parsed = JSON.parse(response.text);
      return {
        ...parsed,
        provider: response.provider,
        model: response.model
      };
    } catch (parseError) {
      throw new Error(`Intent parse failed: ${parseError.message}`);
    }
  }

  async generateGeneralChat(message, conversationHistory = [], options = {}) {
    const strictGreetingMode = Boolean(options.strictGreetingMode);

    const systemPrompt = [
      'Bạn là trợ lý AI cho sàn E-commerce linh kiện PC.',
      'Trả lời ngắn gọn, lịch sự, tiếng Việt tự nhiên, khách quan.',
      'Nếu câu hỏi mơ hồ, hỏi lại 1 câu rõ nhu cầu mua hàng.',
      'NGUYÊN TẮC CHÍNH XÁC: Chỉ khẳng định những gì có dữ liệu rõ ràng trong câu hỏi hoặc lịch sử gần đây.',
      'Nếu thiếu dữ liệu, phải nói rõ "mình chưa có đủ dữ liệu để kết luận" và nêu chính xác thông tin còn thiếu.',
      'Không suy đoán thông số, giá, tồn kho, tính năng nếu không có dữ liệu.',
      'Không dùng văn phong cảm tính hoặc phóng đại. Ưu tiên câu ngắn, rõ, đúng trọng tâm.',
      'QUY TẮC NGỮ CẢNH QUAN TRỌNG: Lịch sử chỉ để hiểu bối cảnh, KHÔNG được tự ý kéo khách quay lại luồng cũ.',
      'KHÔNG được chủ động nhắc lại sản phẩm/giá cũ (ví dụ ngân sách 30 triệu) nếu người dùng chưa yêu cầu tiếp tục.',
      'Chỉ được nhắc ngữ cảnh cũ khi người dùng nói rõ ý tiếp tục như: "tìm tiếp", "tiếp tục", "sản phẩm lúc nãy".',
      strictGreetingMode
        ? 'GREETING MODE CỨNG: Nếu tin nhắn chỉ là lời chào ngắn (xin chào/chào/hi/hello/chào shop) thì CHỈ được: chào lại thân thiện + giới thiệu ngắn "AI TechStore" + hỏi đúng 1 câu mở về nhu cầu hiện tại. Tuyệt đối không nhắc lịch sử cũ.'
        : 'Nếu người dùng chỉ chào, trả lời theo mẫu chào thân thiện, giới thiệu ngắn và hỏi một câu mở về nhu cầu hiện tại.'
    ].join(' ');

    const userPrompt = [
      `Tin nhắn người dùng: ${message}`,
      `Lịch sử gần đây: ${JSON.stringify(conversationHistory.slice(-4))}`,
      `Cờ strictGreetingMode: ${strictGreetingMode ? 'true' : 'false'}`
    ].join('\n');

    try {
      const result = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.15,
        maxTokens: 360
      });

      return result;
    } catch (error) {
      // Degrade gracefully when all LLM providers are unavailable/rate-limited.
      const localText = this._buildLocalGeneralChatFallback(message, conversationHistory, options);
      return {
        provider: 'local-fallback',
        model: 'rules-v1',
        text: this._sanitizeFallbackPrefix(localText),
        degraded: true,
        error: error?.message || 'All providers failed'
      };
    }
  }

  _sanitizeFallbackPrefix(text = '') {
    return String(text || '')
      .replace(/^\s*\[(?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\]\s*/i, '')
      .replace(/^\s*\((?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\)\s*/i, '')
      .trim();
  }

  _buildLocalGeneralChatFallback(message, conversationHistory = [], options = {}) {
    const text = String(message || '').trim();
    const normalized = text.toLowerCase();
    const strictGreetingMode = Boolean(options.strictGreetingMode);

    if (!text) {
      return 'Mình sẵn sàng hỗ trợ bạn chọn linh kiện/phụ kiện phù hợp. Bạn cần tìm sản phẩm nào và tầm giá bao nhiêu ạ?';
    }

    if (/^(xin chào|chào|hello|hi|hey)\b/i.test(normalized)) {
      return 'Xin chào bạn. Mình có thể hỗ trợ tìm sản phẩm theo nhu cầu, tầm giá, thương hiệu hoặc so sánh cấu hình. Bạn đang quan tâm dòng nào ạ?';
    }

    if (strictGreetingMode) {
      return 'Chào bạn, mình là AI của TechStore. Mình có thể hỗ trợ tìm kiếm linh kiện hay build PC gì cho bạn hôm nay?';
    }

    if (/(giá|bao nhiêu|tầm giá|ngân sách|budget)/i.test(normalized)) {
      return 'Để mình tư vấn đúng hơn, bạn cho mình biết ngân sách dự kiến và loại sản phẩm (laptop, PC, màn hình, RAM, SSD...) nhé.';
    }

    if (/(so sánh|compare|khác nhau|nên chọn)/i.test(normalized)) {
      return 'Mình có thể giúp bạn so sánh chi tiết. Bạn gửi giúp mình 2-3 mã sản phẩm hoặc tên model cụ thể để mình phân tích nhanh nhé.';
    }

    return 'Mình chưa có đủ dữ liệu để kết luận chính xác ngay. Bạn có thể nêu rõ model sản phẩm, mức ngân sách, hoặc tiêu chí quan trọng để mình trả lời khách quan hơn.';
  }

  async generateRagAnswer({ systemPrompt, userQuestion, contextBlocks = [], conversationHistory = [] }) {
    const contextText = contextBlocks.length > 0
      ? contextBlocks.map((item, idx) => `[CONTEXT ${idx + 1}]\n${item}`).join('\n\n')
      : '[CONTEXT] Không có dữ liệu truy xuất';

    const userPrompt = [
      `Câu hỏi: ${userQuestion}`,
      'Lịch sử hội thoại gần nhất:',
      JSON.stringify(conversationHistory.slice(-4)),
      '',
      'Ngữ cảnh truy xuất:',
      contextText
    ].join('\n');

    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.1,
      maxTokens: 850
    });
  }

  getHealth() {
    return {
      groqConfigured: this.isGroqAvailable(),
      geminiFallbackConfigured: Boolean(this.geminiModel),
      circuitBreaker: {
        state: this.breaker.state,
        failureCount: this.breaker.failureCount,
        nextTryAt: this.breaker.nextTryAt
      }
    };
  }
}

module.exports = new GroqChatService();
