/**
 * Lean AI Router
 * Zero-shot intent routing via Groq + strict JSON schema.
 *
 * Fast path: route + search/qa directly.
 * Deep path: planner-like flow only for PC build compatibility checks.
 */

const axios = require('axios');
const GroqChatService = require('./GroqChatService');
const SemanticSearchService = require('../SemanticSearchService');
const ConversationMemoryService = require('../ConversationMemoryService');
const RAGPipeline = require('../rag/RAGPipeline');
const PCBuildTool = require('../tools/PCBuildTool');

class AIRouter {
  constructor() {
    this.groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = process.env.GROQ_ROUTER_MODEL || process.env.GROQ_MODEL || 'llama3-8b-8192';
    this.groqApiKey = process.env.GROQ_API_KEY || '';

    this.agents = new Map();
    this.routingLogs = [];
    this.maxLogSize = 500;
  }

  registerAgent(name, agent) {
    if (!agent || typeof agent.execute !== 'function') {
      throw new Error('Agent must expose execute()');
    }

    this.agents.set(name, {
      name,
      agent,
      registeredAt: new Date()
    });
  }

  listAgents() {
    return Array.from(this.agents.keys());
  }

  /**
   * MODULE 1
    * Advanced query extraction for Smart Search Pipeline.
    * Returns strict JSON object:
    * { intent, explicit_filters, semantic_needs }
   */
  async routeQuery(userMessage) {
    const normalizedMessage = this._normalizeUserMessage(userMessage);

    // Hard guard: short standalone greetings must always map to greeting.
    if (this._isGreetingOnly(normalizedMessage)) {
      return {
        intent: 'greeting',
        explicit_filters: {},
        semantic_needs: ''
      };
    }

    if (!this.groqApiKey) {
      return this._fallbackRouteWithoutLLM(userMessage);
    }

    const systemPrompt = [
      'You are an advanced query extractor for a Vietnamese e-commerce chatbot.',
      'Return ONLY one minified JSON object and nothing else.',
      'Output schema exactly:',
      '{"intent":"greeting|product_search|pc_build|general_chat|knowledge_qa","explicit_filters":{},"semantic_needs":""}',
      'Rules:',
      '1) intent="greeting" ONLY when the message is a short standalone greeting without product, price, specs, or action request.',
      '2) Standalone greeting examples: "xin chao", "chao", "hi", "hello", "chao shop", "alo" => MUST be greeting.',
      '3) If the message includes both greeting and shopping intent (e.g. "chao shop tu van laptop 30 trieu"), MUST NOT be greeting. Use product_search/pc_build as appropriate.',
      '4) For any product buying/discovery query, intent must be "product_search".',
      '5) explicit_filters contains only hard constraints that can be converted to structured values.',
      '6) Parse Vietnamese money units to absolute VND integers: "30 triệu", "30 củ", "30tr" => 30000000; "500k" => 500000.',
      '7) If user DOES NOT mention price, DO NOT include maxPrice/minPrice keys in explicit_filters.',
      '8) semantic_needs must capture abstract needs: examples "go em", "choi game muot", "nhe gon", "cho sinh vien IT".',
      '9) Never output markdown, comments, or extra keys.'
    ].join(' ');

    const response = await axios.post(
      `${this.groqBaseUrl}/chat/completions`,
      {
        model: this.groqModel,
        temperature: 0,
        max_tokens: 180,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: String(userMessage || '') }
        ]
      },
      {
        timeout: 12000,
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const raw = response?.data?.choices?.[0]?.message?.content?.trim() || '';
    try {
      const parsed = this._safeParseRouterJson(raw);
      return this._normalizeRouterResult(parsed);
    } catch (error) {
      return this._fallbackRouteWithoutLLM(userMessage);
    }
  }

  async route(message, context = {}) {
    const routingId = this._generateRoutingId();
    const startedAt = Date.now();

    try {
      const routed = await this.routeQuery(message);
      const {
        intent,
        explicit_filters: explicitFilters,
        semantic_needs: semanticNeeds
      } = routed;

      let result;
      switch (intent) {
        case 'greeting':
          result = await this._handleGreetingFast(message);
          break;
        case 'product_search':
          result = await this._handleProductSearchFast(message, routed);
          break;
        case 'knowledge_qa':
          // Fast flow: RAG answer, no planner chain.
          result = await this._handleKnowledgeQAFast(message, context);
          break;
        case 'general_chat':
          // Fast flow: direct chat model.
          result = await this._handleGeneralChatFast(message, context);
          break;
        case 'pc_build':
          // Deep flow: deterministic compatibility checks via tool.
          result = await this._handlePcBuildDeepFlow(message, context);
          break;
        default:
          result = await this._handleGeneralChatFast(message, context);
          break;
      }

      const executionTime = Date.now() - startedAt;
      this._logRouting({
        routingId,
        message,
        intent,
        executionTime,
        success: true,
        timestamp: new Date()
      });

      return {
        success: true,
        routingId,
        intent,
        confidence: 1,
        agent: 'LeanRouter',
        result,
        executionTime,
        metadata: {
          explicit_filters: explicitFilters,
          semantic_needs: semanticNeeds
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startedAt;
      this._logRouting({
        routingId,
        message,
        error: error.message,
        executionTime,
        success: false,
        timestamp: new Date()
      });

      return {
        success: false,
        routingId,
        error: error.message,
        executionTime
      };
    }
  }

  async routeAndProcess(params = {}) {
    const {
      userMessage = '',
      history = [],
      sessionId = null,
      userId = null
    } = params;

    const routed = await this.route(userMessage, {
      sessionId,
      userId,
      conversationHistory: Array.isArray(history) ? history : []
    });

    if (!routed.success) {
      throw new Error(routed.error || 'AI processing failed');
    }

    return {
      text: routed.result?.answer || routed.result?.text || 'Xin lỗi, tôi chưa thể trả lời lúc này.',
      sources: Array.isArray(routed.result?.sources) ? routed.result.sources : [],
      raw: routed
    };
  }

  async routeStreaming(message, context = {}, onChunk) {
    try {
      const routed = await this.route(message, context);
      if (!routed.success) {
        throw new Error(routed.error || 'AI processing failed');
      }

      onChunk?.({
        type: 'result',
        data: routed.result
      });

      return routed.result;
    } catch (error) {
      onChunk?.({
        type: 'error',
        data: { error: error.message }
      });
      throw error;
    }
  }

  async _handleProductSearchFast(userMessage, extracted = {}) {
    const fallbackPrice = this._extractPriceFilters(userMessage);
    const baseFilters = this.sanitizeFilters(extracted.explicit_filters || {});
    const normalizedMin = this._parsePriceToVnd(baseFilters.minPrice);
    const normalizedMax = this._parsePriceToVnd(baseFilters.maxPrice);

    const filters = this.sanitizeFilters({
      maxPrice: normalizedMax !== null ? normalizedMax : fallbackPrice.price_max,
      minPrice: normalizedMin !== null ? normalizedMin : fallbackPrice.price_min,
      category: baseFilters.category || this._inferCategoryFromText(userMessage),
      color: baseFilters.color,
      brand: baseFilters.brand
    });

    const semanticNeeds = (extracted.semantic_needs || '').trim() || userMessage;

    const searchResult = await SemanticSearchService.smartHybridSearch({
      raw_query: userMessage,
      explicit_filters: filters,
      semantic_needs: semanticNeeds
    }, {
      limit: 8
    });

    let products = Array.isArray(searchResult.results) ? searchResult.results : [];
    let matchLevel = searchResult.match_level || 'strict';

    // If strict search returns empty, try a practical fallback: keep category intent but relax price/brand/color.
    if (products.length === 0) {
      const relaxedFallback = await SemanticSearchService.searchProducts({
        keyword: userMessage,
        filters: {
          category: filters.category || null,
          brand: null,
          color: null,
          price_min: null,
          price_max: null
        },
        limit: 6
      });

      const relaxedProducts = Array.isArray(relaxedFallback.products) ? relaxedFallback.products : [];
      if (relaxedProducts.length > 0) {
        products = relaxedProducts;
        matchLevel = 'semantic_only';
      }
    }

    // Re-evaluate with actual returned products: if they satisfy hard filters,
    // classify as strict to avoid misleading "không khớp chính xác" messaging.
    if (products.length > 0 && this._allProductsMatchHardFilters(products, filters)) {
      matchLevel = 'strict';
    }

    const answer = await this._generateSmartSearchReply({
      matchLevel,
      semanticNeeds,
      explicitFilters: filters,
      products
    });

    return {
      answer,
      products,
      productCount: products.length,
      exactMatch: products.length > 0,
      match_level: matchLevel,
      sources: []
    };
  }

  async _generateSmartSearchReply({ matchLevel = 'strict', semanticNeeds = '', explicitFilters = {}, products = [] } = {}) {
    if (!Array.isArray(products) || products.length === 0) {
      return 'Mình chưa tìm thấy mẫu phù hợp trong kho hiện tại. Bạn muốn mình nới tầm giá hoặc đổi tiêu chí để tìm thêm không?';
    }

    const shortlist = products.slice(0, 3);
    const brief = shortlist
      .map((p, i) => {
        const price = Number(p.salePrice || p.price || 0);
        const priceText = Number.isFinite(price) && price > 0
          ? `${price.toLocaleString('vi-VN')} VND`
          : 'chưa có dữ liệu giá';
        const brandText = p.brand ? ` | Hãng: ${p.brand}` : '';
        return `${i + 1}. ${p.name || 'Sản phẩm'} - ${priceText}${brandText}`;
      })
      .join('\n');

    if (matchLevel === 'strict') {
      return `Mình đã tìm được sản phẩm phù hợp theo tiêu chí bạn đưa ra:\n${brief}`;
    }

    if (matchLevel === 'semantic_only') {
      const budgetText = Number.isFinite(explicitFilters?.maxPrice)
        ? ` dưới ${Number(explicitFilters.maxPrice).toLocaleString('vi-VN')} VND`
        : '';
      return `Hiện chưa có mẫu khớp chính xác${budgetText}. Dưới đây là các lựa chọn gần nhất theo dữ liệu kho hiện tại:\n${brief}`;
    }

    return `Hiện chưa có mẫu khớp hoàn toàn với toàn bộ điều kiện. Đây là các lựa chọn gần nhất để bạn so sánh khách quan:\n${brief}`;
  }

  _buildSearchAnswer(searchResult = {}, filters = {}) {
    const hasProducts = Array.isArray(searchResult.products) && searchResult.products.length > 0;
    if (!hasProducts) {
      return 'Mình chưa tìm thấy sản phẩm phù hợp ngay lúc này. Bạn muốn mình nới tầm giá hoặc đổi tiêu chí để tìm rộng hơn không?';
    }

    if (searchResult.mode === 'nearest_price') {
      return 'Mình chưa thấy mẫu khớp hoàn toàn, nên đã chọn các sản phẩm có mức giá gần nhất để bạn tham khảo nhanh.';
    }

    if (searchResult.mode === 'featured_category') {
      return 'Mình đã chọn các sản phẩm nổi bật trong danh mục bạn quan tâm.';
    }

    if (filters.price_max !== null || filters.price_min !== null) {
      return 'Mình đã lọc sản phẩm theo tầm giá bạn yêu cầu.';
    }

    return 'Mình đã tìm được sản phẩm phù hợp theo yêu cầu của bạn.';
  }

  async _handleKnowledgeQAFast(userMessage, context = {}) {
    const rag = await RAGPipeline.generalKnowledge(userMessage, {
      conversationHistory: context.conversationHistory || [],
      maxKnowledgeDocs: 5,
      minSimilarity: 0.3
    });

    return {
      answer: rag.answer,
      sources: rag.sources || [],
      products: rag.products || []
    };
  }

  async _handleGeneralChatFast(userMessage, context = {}) {
    const result = await GroqChatService.generateGeneralChat(userMessage, context.conversationHistory || []);
    const cleanAnswer = this._sanitizeUserFacingText(result.text);
    return {
      answer: cleanAnswer,
      sources: [],
      provider: result.provider,
      model: result.model
    };
  }

  async _handleGreetingFast(userMessage) {
    const fallbackGreeting = 'Chao ban, minh la AI cua TechStore. Minh co the ho tro tim linh kien hoac build PC gi cho ban hom nay?';

    try {
      const result = await GroqChatService.generateGeneralChat(userMessage, [], {
        strictGreetingMode: true
      });

      const cleanAnswer = this._sanitizeUserFacingText(result.text);

      // Safety guard: never pull old context into a pure greeting response.
      if (/\b(tiep tuc|luc truoc|luc nay|30 trieu|nhu truoc|san pham truoc)\b/i.test(this._normalizeUserMessage(cleanAnswer))) {
        return {
          answer: fallbackGreeting,
          sources: [],
          provider: 'router-greeting-guard',
          model: 'rules-v1'
        };
      }

      return {
        answer: cleanAnswer || fallbackGreeting,
        sources: [],
        provider: result.provider,
        model: result.model
      };
    } catch (error) {
      return {
        answer: fallbackGreeting,
        sources: [],
        provider: 'router-greeting-fallback',
        model: 'rules-v1'
      };
    }
  }

  async _handlePcBuildDeepFlow(userMessage, context = {}) {
    const memory = await ConversationMemoryService.getOptimizedHistory(context.sessionId || '', 4);

    const cpu = context?.components?.cpu || null;
    const mainboard = context?.components?.mainboard || null;
    const ram = context?.components?.ram || null;

    if (!cpu || !mainboard || !ram) {
      return {
        answer: [
          'Để check build PC chính xác, bạn gửi giúp mình 3 thông tin: CPU, Mainboard, RAM.',
          memory.summary ? `Tóm tắt ngữ cảnh cũ: ${memory.summary}` : ''
        ].filter(Boolean).join('\n'),
        sources: [
          {
            source: 'pc-build-tool',
            note: 'missing_components'
          }
        ],
        requiredTool: 'PCBuildTool'
      };
    }

    const socketCheck = PCBuildTool.checkSocketCompatibility(cpu, mainboard);
    const ramCheck = PCBuildTool.checkRamBus(cpu, mainboard, ram);

    const allGood = socketCheck.compatible && ramCheck.compatible;

    return {
      answer: allGood
        ? 'Build PC của bạn tương thích theo các kiểm tra bắt buộc (socket và RAM bus).'
        : 'Build PC chưa tương thích hoàn toàn. Mình đã ghi rõ lỗi ở từng mục kiểm tra.',
      sources: [
        { source: 'pc-build-tool', check: 'socket', ...socketCheck },
        { source: 'pc-build-tool', check: 'ram_bus', ...ramCheck }
      ],
      compatibility: {
        compatible: allGood,
        checks: {
          socket: socketCheck,
          ram: ramCheck
        }
      }
    };
  }

  _safeParseRouterJson(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      const first = content.indexOf('{');
      const last = content.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        const jsonSlice = content.slice(first, last + 1);
        return JSON.parse(jsonSlice);
      }
      throw new Error('Router JSON parse failed');
    }
  }

  _normalizeRouterResult(parsed = {}) {
    const allowedIntents = new Set([
      'greeting',
      'product_search',
      'pc_build',
      'general_chat',
      'knowledge_qa'
    ]);
    const intent = allowedIntents.has(parsed.intent) ? parsed.intent : 'general_chat';

    const rawFilters = parsed && typeof parsed.explicit_filters === 'object'
      ? parsed.explicit_filters
      : {};

    const explicitFilters = this.sanitizeFilters({
      maxPrice: this._parsePriceToVnd(rawFilters.maxPrice ?? rawFilters.price_max),
      minPrice: this._parsePriceToVnd(rawFilters.minPrice ?? rawFilters.price_min),
      brand: typeof rawFilters.brand === 'string' ? rawFilters.brand.trim() : undefined,
      category: typeof rawFilters.category === 'string' ? rawFilters.category.trim() : undefined,
      color: typeof rawFilters.color === 'string' ? rawFilters.color.trim() : undefined
    });

    const semanticNeeds = typeof parsed.semantic_needs === 'string'
      ? parsed.semantic_needs.trim()
      : '';

    return {
      intent,
      explicit_filters: explicitFilters,
      semantic_needs: semanticNeeds
    };
  }

  _fallbackRouteWithoutLLM(userMessage = '') {
    const text = this._normalizeUserMessage(userMessage);

    let intent = 'general_chat';
    if (this._isGreetingOnly(text)) {
      intent = 'greeting';
    } else if (/(build\s*pc|cau\s*hinh|tuong\s*thich|socket|ddr4|ddr5|mainboard|cpu|ram)/i.test(text)) {
      intent = 'pc_build';
    } else if (/(tim|mua|laptop|pc|man\s*hinh|chuot|ban\s*phim|ssd|hdd|gia|tu\s*van)/i.test(text)) {
      intent = 'product_search';
    } else if (/(la\s*gi|giai\s*thich|how|what|kien\s*thuc)/i.test(text)) {
      intent = 'knowledge_qa';
    }

    const parsedPrice = this._extractPriceFilters(text);
    const category = this._inferCategoryFromText(text);

    const explicitFilters = this.sanitizeFilters({
      maxPrice: parsedPrice.price_max,
      minPrice: parsedPrice.price_min,
      brand: '',
      category,
      color: ''
    });

    return {
      intent,
      explicit_filters: explicitFilters,
      semantic_needs: String(userMessage || '').trim()
    };
  }

  sanitizeFilters(filters = {}) {
    const entries = Object.entries(filters || {});
    const cleaned = {};

    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          continue;
        }
        cleaned[key] = trimmed;
        continue;
      }

      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) {
          continue;
        }
        cleaned[key] = Math.round(value);
        continue;
      }

      cleaned[key] = value;
    }

    return cleaned;
  }

  _parsePriceToVnd(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    }

    const text = String(value).toLowerCase().trim();
    if (!text) {
      return null;
    }

    const numeric = text.replace(/\./g, '').replace(',', '.');
    const match = numeric.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    if (/(triệu|trieu|tr\b|củ|cu\b|million|m\b)/i.test(text)) {
      return Math.round(amount * 1000000);
    }

    if (/(k\b|ngàn|ngan|nghìn|nghin)/i.test(text)) {
      return Math.round(amount * 1000);
    }

    return Math.round(amount);
  }

  _normalizeUserMessage(text = '') {
    const raw = String(text || '').toLowerCase().trim();
    const withoutDiacritics = this._stripVietnameseDiacritics(raw);

    return withoutDiacritics
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _stripVietnameseDiacritics(text = '') {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  _isGreetingOnly(normalizedText = '') {
    if (!normalizedText) {
      return false;
    }

    const compact = normalizedText
      .replace(/\s+/g, ' ')
      .trim();

    const greetingPatterns = [
      /^(xin chao)( ban| shop| admin)?$/i,
      /^(chao)( ban| shop| admin)?$/i,
      /^(hi|hello|hey)( there)?$/i,
      /^(alo|a lo|helo|heloo|hii+)$/i,
      /^(chao shop|chao admin|chao ban)$|^(xin chao shop|xin chao ban)$/i
    ];

    const hasGreetingShape = greetingPatterns.some((pattern) => pattern.test(compact));
    if (!hasGreetingShape) {
      return false;
    }

    // If user asks to continue previous context, this is not a pure greeting.
    if (/(tiep tuc|luc nay|luc truoc|san pham|gia|mua|tim|tu van|build|pc|laptop|man hinh|cpu|gpu|ram|ssd|hdd)/i.test(compact)) {
      return false;
    }

    return compact.split(' ').length <= 4;
  }

  _hasSpecificSearchFilters(text = '') {
    if (!text) {
      return false;
    }

    return /((dưới|duoi|trên|tren|max|tối\s*đa|toi\s*da|under)\s*\d+)|(từ\s*\d+\s*(đ|vnd|k|tr|triệu)?\s*(đến|den)\s*\d+)|(giá\s*(dưới|tren|tu|từ|max|khoang)?\s*\d+)|(màu|mau|đen|trắng|trang|xám|xam|hồng|hong|đỏ|do|xanh|i\d{1,2}|ryzen\s*\d|rtx\s*\d{3,4}|gtx\s*\d{3,4}|\d+\s*(inch|hz|gb|tb))/i.test(text);
  }

  _inferCategoryFromText(text = '') {
    const map = [
      { key: 'laptop', pattern: /(laptop|notebook)/i },
      { key: 'chuot', pattern: /(chuột|chuot|mouse)/i },
      { key: 'ban phim', pattern: /(bàn\s*phím|ban\s*phim|keyboard)/i },
      { key: 'man hinh', pattern: /(màn\s*hình|man\s*hinh|monitor)/i },
      { key: 'ram', pattern: /\bram\b/i },
      { key: 'ssd', pattern: /\bssd\b/i },
      { key: 'hdd', pattern: /\bhdd\b/i },
      { key: 'cpu', pattern: /\bcpu\b|ryzen|intel\s*core/i },
      { key: 'vga', pattern: /\bvga\b|gpu|rtx|gtx|radeon/i },
      { key: 'pc', pattern: /\bpc\b|desktop|máy\s*tính\s*bàn|may\s*tinh\s*ban/i }
    ];

    const found = map.find((item) => item.pattern.test(text));
    return found ? found.key : '';
  }

  _sanitizeUserFacingText(text = '') {
    return String(text || '')
      .replace(/^\s*\[(?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\]\s*/i, '')
      .replace(/^\s*\((?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\)\s*/i, '')
      .trim();
  }

  _extractPriceFilters(text = '') {
    const normalized = String(text || '').toLowerCase();
    const result = {
      price_min: null,
      price_max: null
    };

    const parseAmount = (value, unit = '') => {
      const n = Number(String(value || '').replace(',', '.'));
      if (!Number.isFinite(n)) {
        return null;
      }

      const normalizedUnit = String(unit || '').toLowerCase();
      if (normalizedUnit.includes('triệu') || normalizedUnit.includes('trieu') || normalizedUnit === 'tr' || normalizedUnit === 'm' || normalizedUnit === 'cu' || normalizedUnit.includes('củ')) {
        return Math.round(n * 1000000);
      }
      if (normalizedUnit === 'k' || normalizedUnit.includes('ngàn') || normalizedUnit.includes('ngan')) {
        return Math.round(n * 1000);
      }
      return Math.round(n);
    };

    const upperBound = normalized.match(/(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?\s*(trở\s*xuống|tro\s*xuong|đổ\s*lại|do\s*lai|hoặc\s*thấp\s*hơn|hoac\s*thap\s*hon|dưới|duoi|under|max|tối\s*đa|toi\s*da)/i);
    if (upperBound) {
      result.price_max = parseAmount(upperBound[1], upperBound[2]);
      return result;
    }

    const lowerBound = normalized.match(/(từ|tu|trên|tren|from|above)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?/i);
    if (lowerBound) {
      result.price_min = parseAmount(lowerBound[2], lowerBound[3]);
    }

    const rangeBound = normalized.match(/(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?\s*(đến|den|to|-)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?/i);
    if (rangeBound) {
      result.price_min = parseAmount(rangeBound[1], rangeBound[2]);
      result.price_max = parseAmount(rangeBound[4], rangeBound[5] || rangeBound[2]);
      if (result.price_min !== null && result.price_max !== null && result.price_min > result.price_max) {
        const tmp = result.price_min;
        result.price_min = result.price_max;
        result.price_max = tmp;
      }
      return result;
    }

    const genericMax = normalized.match(/(?:dưới|duoi|max|tối\s*đa|toi\s*da|under)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?/i);
    if (genericMax) {
      result.price_max = parseAmount(genericMax[1], genericMax[2]);
    }

    const genericMaxWithBudgetWord = normalized.match(/(?:dưới|duoi|max|tối\s*đa|toi\s*da|under)\s*(?:tầm\s*giá|tam\s*gia|mức\s*giá|muc\s*gia|khoảng|khoang)?\s*(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)?/i);
    if (result.price_max === null && genericMaxWithBudgetWord) {
      result.price_max = parseAmount(genericMaxWithBudgetWord[1], genericMaxWithBudgetWord[2]);
      return result;
    }

    const budgetHint = normalized.match(/(?:tầm\s*giá|tam\s*gia|mức\s*giá|muc\s*gia|ngân\s*sách|ngan\s*sach|khoảng|khoang)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|trieu|tr|m|cu|củ|k|ngàn|ngan)/i);
    if (result.price_min === null && result.price_max === null && budgetHint) {
      const budget = parseAmount(budgetHint[1], budgetHint[2]);
      if (Number.isFinite(budget)) {
        result.price_min = Math.round(budget * 0.75);
        result.price_max = budget;
      }
    }

    return result;
  }

  _allProductsMatchHardFilters(products = [], filters = {}) {
    if (!Array.isArray(products) || products.length === 0) {
      return false;
    }

    return products.every((item) => this._isProductMatchingHardFilters(item, filters));
  }

  _isProductMatchingHardFilters(product = {}, filters = {}) {
    const normalize = (v) => this._normalizeUserMessage(String(v || ''));
    const categoryFilter = normalize(filters.category || '');
    const brandFilter = normalize(filters.brand || '');
    const colorFilter = normalize(filters.color || '');

    const productCategory = normalize(product.category || '');
    const productName = normalize(product.name || '');
    const productBrand = normalize(product.brand || '');
    const productColor = normalize(product.color || product?.specifications?.color || '');
    const effectivePrice = Number(product.salePrice ?? product.price);

    if (Number.isFinite(Number(filters.maxPrice)) && Number.isFinite(effectivePrice)) {
      if (effectivePrice > Number(filters.maxPrice)) {
        return false;
      }
    }

    if (Number.isFinite(Number(filters.minPrice)) && Number.isFinite(effectivePrice)) {
      if (effectivePrice < Number(filters.minPrice)) {
        return false;
      }
    }

    if (categoryFilter) {
      const categoryMatched = productCategory.includes(categoryFilter) || productName.includes(categoryFilter);
      if (!categoryMatched) {
        return false;
      }
    }

    if (brandFilter) {
      const brandMatched = productBrand.includes(brandFilter) || productName.includes(brandFilter);
      if (!brandMatched) {
        return false;
      }
    }

    if (colorFilter) {
      const colorMatched = productColor.includes(colorFilter) || productName.includes(colorFilter);
      if (!colorMatched) {
        return false;
      }
    }

    return true;
  }

  _generateRoutingId() {
    return `route_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  _logRouting(entry) {
    this.routingLogs.push(entry);
    if (this.routingLogs.length > this.maxLogSize) {
      this.routingLogs = this.routingLogs.slice(-this.maxLogSize);
    }
  }

  getStats() {
    const total = this.routingLogs.length;
    const success = this.routingLogs.filter((l) => l.success).length;
    return {
      total,
      success,
      failed: total - success,
      successRate: total === 0 ? 1 : success / total
    };
  }

  healthCheck() {
    return {
      router: 'lean',
      groqConfigured: Boolean(this.groqApiKey),
      registeredAgents: this.listAgents().length
    };
  }
}

module.exports = new AIRouter();
