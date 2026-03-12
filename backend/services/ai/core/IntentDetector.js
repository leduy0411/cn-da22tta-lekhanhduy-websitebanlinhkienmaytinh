/**
 * Intent Detector
 * Analyzes user messages to determine intent and extract entities
 * 
 * @module services/ai/core/IntentDetector
 * @description Advanced intent detection with entity extraction and confidence scoring
 */

class IntentDetector {
  constructor() {
    // Intent patterns với regex và keywords
    this.intentPatterns = {
      greeting: {
        patterns: [
          /^(xin chào|chào|hello|hi|hey|good morning|good afternoon|good evening)/i,
          /^(chào bạn|chào shop|chào admin|dạ chào)/i
        ],
        keywords: ['xin chào', 'chào', 'hello', 'hi', 'hey'],
        confidence: 0.95
      },

      product_search: {
        patterns: [
          /(tìm|tìm kiếm|search|cho tôi|có|cần|muốn|xem)\s+(.*?)(laptop|pc|máy tính|màn hình|bàn phím|chuột|tai nghe|gpu|cpu|ram|ssd|hdd)/i,
          /(laptop|pc|máy tính|màn hình|monitor|gpu|cpu|ram|ssd).*?(giá|price|bao nhiêu|có|nào|gì)/i,
          /^(laptop|pc|máy tính|màn hình|gpu|cpu|ram|ssd|hdd|bàn phím|chuột|tai nghe)/i
        ],
        keywords: ['tìm', 'tìm kiếm', 'search', 'cho tôi', 'có', 'xem', 'laptop', 'pc', 'màn hình', 'gpu', 'cpu'],
        categories: ['laptop', 'pc', 'máy tính', 'màn hình', 'monitor', 'gpu', 'cpu', 'ram', 'ssd', 'hdd', 'bàn phím', 'chuột', 'tai nghe', 'gaming', 'workstation'],
        confidence: 0.9
      },

      recommendation: {
        patterns: [
          /(gợi ý|recommend|suggest|tư vấn|giới thiệu|nên|đề xuất)/i,
          /(phù hợp|suitable|good for|tốt cho|dùng cho)/i,
          /(nên mua|nên chọn|nên lấy)/i
        ],
        keywords: ['gợi ý', 'recommend', 'tư vấn', 'giới thiệu', 'nên', 'phù hợp', 'nên mua'],
        confidence: 0.85
      },

      comparison: {
        patterns: [
          /(so sánh|compare|vs|versus)/i,
          /(khác nhau|difference|khác gì|khác biệt)/i,
          /(tốt hơn|better|hơn)/i,
          /(.+?)\s+(vs|và|so với|with)\s+(.+)/i
        ],
        keywords: ['so sánh', 'compare', 'vs', 'versus', 'khác nhau', 'difference', 'tốt hơn'],
        confidence: 0.95
      },

      pc_build: {
        patterns: [
          /(build|xây dựng|lắp|lắp ráp)\s+pc/i,
          /PC\s+(gaming|workstation|văn phòng|office)/i,
          /(cấu hình|config|configuration)\s+pc/i,
          /(build|cấu hình).*?(\d+)\s*(triệu|million|tr|M)/i
        ],
        keywords: ['build pc', 'lắp pc', 'cấu hình pc', 'build gaming', 'build workstation'],
        confidence: 0.9
      },

      product_details: {
        patterns: [
          /(thông số|specs|specification|cấu hình|chi tiết|details)/i,
          /(review|đánh giá|test).*?(product|sản phẩm)/i
        ],
        keywords: ['thông số', 'specs', 'cấu hình', 'chi tiết', 'review', 'đánh giá'],
        confidence: 0.8
      },

      price_inquiry: {
        patterns: [
          /(giá|price|bao nhiêu|how much)/i,
          /(giá cả|pricing|chi phí|cost)/i
        ],
        keywords: ['giá', 'price', 'bao nhiêu', 'cost'],
        confidence: 0.85
      },

      knowledge_question: {
        patterns: [
          /(là gì|what is|nghĩa là|có nghĩa)/i,
          /(khác nhau|difference|so sánh).*(ntn|như thế nào|thế nào)/i,
          /(giải thích|explain|cho biết)/i,
          /^(ssd|hdd|gpu|cpu|ram|psu|motherboard).*?(là gì|what)/i
        ],
        keywords: ['là gì', 'what is', 'giải thích', 'explain', 'khác nhau như thế nào'],
        confidence: 0.8
      },

      technical_question: {
        patterns: [
          /(hoạt động|hoat dong|work|works|how does|nguyên lý|nguyen ly|nguyên tắc|cơ chế|co che)/i,
          /(machine learning|deep learning|neural network|ai|trí tuệ nhân tạo|tri tue nhan tao)/i,
          /(algorithm|thuật toán|thuat toan|mô hình|mo hinh|model|framework)/i,
          /(networking|tcp|udp|http|dns|firewall|vpn|protocol|giao thức|giao thuc)/i,
          /(programming|lập trình|lap trinh|code|coding|python|javascript|java|c\+\+|rust)/i,
          /(blockchain|cloud|devops|docker|kubernetes|microservice)/i,
          /(encryption|mã hóa|ma hoa|bảo mật|bao mat|security|hacking|cyber)/i,
          /(database|cơ sở dữ liệu|co so du lieu|sql|nosql|mongodb|redis)/i,
          /(ray tracing|dlss|fsr|cuda|tensor|vram|overclock|benchmark)/i,
          /(linux|windows|macos|operating system|hệ điều hành|he dieu hanh)/i,
          /.+\s+(la gi|là gì|hoat dong|hoạt động)\s*\??$/i,
          /(giai thich|giải thích|explain).+?(cong nghe|công nghệ|ky thuat|kỹ thuật)/i
        ],
        keywords: [
          'machine learning', 'deep learning', 'neural network', 'ai',
          'hoạt động', 'hoat dong', 'nguyên lý', 'nguyen ly', 'how does', 'how do',
          'algorithm', 'thuật toán', 'thuat toan', 'blockchain', 'cloud computing',
          'programming', 'lập trình', 'lap trinh', 'networking', 'protocol',
          'encryption', 'mã hóa', 'ma hoa', 'database', 'ray tracing',
          'dlss', 'fsr', 'cuda', 'overclock', 'benchmark',
          'linux', 'docker', 'kubernetes', 'devops', 'api',
          'la gi', 'là gì', 'giai thich', 'giải thích'
        ],
        confidence: 0.85,
        description: 'Technical/scientific questions about technology, CS, engineering'
      },

      order_status: {
        patterns: [
          /(đơn hàng|order).*?(status|trạng thái|đang ở đâu)/i,
          /(track|theo dõi).*?(đơn|order)/i
        ],
        keywords: ['đơn hàng', 'order status', 'theo dõi đơn'],
        confidence: 0.9
      },

      help: {
        patterns: [
          /^(help|giúp|hỗ trợ|support)/i,
          /(làm sao|how to|cách|how can)/i
        ],
        keywords: ['help', 'giúp', 'hỗ trợ', 'support', 'làm sao'],
        confidence: 0.85
      },

      general_chat: {
        patterns: [
          /(bạn là ai|bạn là gì|you are|who are you|bạn tên gì)/i,
          /(có phải ai|có phải là|are you)/i,
          /(hôm nay|today|thời tiết|weather|ăn gì|eat what)/i,
          /(mệt|tired|buồn|sad|vui|happy|cảm thấy|feel)/i,
          /(kể cho|tell me|nói cho|talk about)/i,
          /(bạn nghĩ gì|what do you think|ý kiến|opinion)/i,
          /(khỏe không|how are you|bạn thế nào|dạo này)/i
        ],
        keywords: ['bạn là ai', 'có phải', 'hôm nay', 'thời tiết', 'ăn gì', 'kể cho', 'bạn nghĩ', 'khỏe không'],
        confidence: 0.8,
        description: 'General conversation not related to products or shopping'
      }
    };

    // Entity extraction patterns
    this.entityPatterns = {
      price: {
        range: /(\d+)\s*-\s*(\d+)\s*(triệu|tr|million|M|k|ngàn)/gi,
        max: /(dưới|under|max|tối đa|không quá)\s*(\d+)\s*(triệu|tr|million|M|k|ngàn)/gi,
        min: /(trên|over|min|tối thiểu|từ)\s*(\d+)\s*(triệu|tr|million|M|k|ngàn)/gi,
        exact: /(\d+)\s*(triệu|tr|million|M|k|ngàn)/gi
      },
      
      category: {
        laptop: /(laptop|máy tính xách tay)/gi,
        pc: /(pc|máy tính để bàn|desktop)/gi,
        monitor: /(màn hình|monitor|screen)/gi,
        gpu: /(gpu|card đồ họa|vga|graphics card)/gi,
        cpu: /(cpu|processor|bộ xử lý)/gi,
        ram: /(ram|memory|bộ nhớ)/gi,
        storage: /(ssd|hdd|ổ cứng|storage)/gi,
        peripherals: /(bàn phím|chuột|tai nghe|keyboard|mouse|headset)/gi
      },

      brand: {
        patterns: /(asus|msi|dell|hp|acer|lenovo|gigabyte|apple|microsoft|razer|logitech|corsair|kingston|samsung|western digital|seagate|intel|amd|nvidia)/gi
      },

      specs: {
        cpu: /(i3|i5|i7|i9|ryzen 3|ryzen 5|ryzen 7|ryzen 9)/gi,
        gpu: /(rtx\s*\d{4}|gtx\s*\d{4}|rx\s*\d{4})/gi,
        ram: /(\d+gb|8gb|16gb|32gb|64gb)\s*(ram|memory)/gi,
        storage: /(\d+gb|256gb|512gb|1tb|2tb)\s*(ssd|hdd)/gi
      },

      purpose: {
        gaming: /(gaming|game|chơi game|stream)/gi,
        workstation: /(workstation|render|edit|thiết kế|đồ họa)/gi,
        office: /(văn phòng|office|làm việc|học tập)/gi,
        programming: /(lập trình|code|coding|developer|dev)/gi
      }
    };
  }

  /**
   * Detect intent and extract entities from user message
   * @param {string} message - User message
   * @param {Array} conversationHistory - Previous messages for context
   * @returns {Promise<Object>} Intent detection result
   */
  async detect(message, conversationHistory = []) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      return {
        intent: 'unknown',
        confidence: 0,
        entities: {},
        reasoning: 'Empty or invalid message'
      };
    }

    const normalizedMessage = message.trim().toLowerCase();

    // 1. Detect primary intent
    const intentScores = {};
    let maxScore = 0;
    let primaryIntent = 'unknown';

    for (const [intent, config] of Object.entries(this.intentPatterns)) {
      let score = 0;

      // Pattern matching
      for (const pattern of config.patterns) {
        if (pattern.test(normalizedMessage)) {
          score += config.confidence;
          break;
        }
      }

      // Keyword matching
      const keywordMatches = config.keywords.filter(keyword => 
        normalizedMessage.includes(keyword.toLowerCase())
      );
      score += keywordMatches.length * 0.1;

      // Category specific for product_search
      if (intent === 'product_search' && config.categories) {
        const categoryMatches = config.categories.filter(cat => 
          normalizedMessage.includes(cat.toLowerCase())
        );
        score += categoryMatches.length * 0.15;
      }

      intentScores[intent] = Math.min(score, 1.0);

      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }

    // 2. Extract entities
    const entities = this._extractEntities(message);

    // 3. Refine intent based on entities
    primaryIntent = this._refineIntent(primaryIntent, entities, intentScores);

    // 4. Generate reasoning
    const reasoning = this._generateReasoning(primaryIntent, entities, intentScores);

    return {
      intent: primaryIntent,
      confidence: intentScores[primaryIntent] || 0,
      secondaryIntents: this._getSecondaryIntents(intentScores, primaryIntent),
      entities,
      reasoning,
      allScores: intentScores
    };
  }

  /**
   * Extract entities from message
   * @private
   */
  _extractEntities(message) {
    const entities = {};

    // Extract price information
    entities.price = this._extractPrice(message);

    // Extract category
    entities.category = this._extractCategory(message);

    // Extract brand
    entities.brand = this._extractBrand(message);

    // Extract specifications
    entities.specs = this._extractSpecs(message);

    // Extract purpose
    entities.purpose = this._extractPurpose(message);

    // Extract product names (if comparing)
    entities.products = this._extractProductNames(message);

    return entities;
  }

  /**
   * Extract price information
   * @private
   */
  _extractPrice(message) {
    const price = {};
    const normalizedMessage = message.toLowerCase();

    // Price range: "20-30 triệu"
    const rangeMatch = normalizedMessage.match(/(\d+)\s*-\s*(\d+)\s*(triệu|tr|million|m)/i);
    if (rangeMatch) {
      price.min = this._normalizePrice(rangeMatch[1], rangeMatch[3]);
      price.max = this._normalizePrice(rangeMatch[2], rangeMatch[3]);
      price.type = 'range';
      return price;
    }

    // Max price: "dưới 30 triệu"
    const maxMatch = normalizedMessage.match(/(dưới|under|max|tối đa|không quá)\s*(\d+\.?\d*)\s*(triệu|tr|million|m|k|ngàn)/i);
    if (maxMatch) {
      price.max = this._normalizePrice(maxMatch[2], maxMatch[3]);
      price.type = 'max';
      return price;
    }

    // Min price: "trên 20 triệu"
    const minMatch = normalizedMessage.match(/(trên|over|min|tối thiểu|từ)\s*(\d+\.?\d*)\s*(triệu|tr|million|m|k|ngàn)/i);
    if (minMatch) {
      price.min = this._normalizePrice(minMatch[2], minMatch[3]);
      price.type = 'min';
      return price;
    }

    // Exact price: "25 triệu"
    const exactMatch = normalizedMessage.match(/(\d+\.?\d*)\s*(triệu|tr|million|m)/i);
    if (exactMatch) {
      const amount = this._normalizePrice(exactMatch[1], exactMatch[2]);
      price.min = amount * 0.9; // 10% flexibility
      price.max = amount * 1.1;
      price.exact = amount;
      price.type = 'exact';
      return price;
    }

    return null;
  }

  /**
   * Normalize price to VND
   * @private
   */
  _normalizePrice(amount, unit) {
    const num = parseFloat(amount);
    const unitLower = unit.toLowerCase();

    if (unitLower.includes('triệu') || unitLower.includes('tr') || unitLower === 'm') {
      return num * 1000000;
    } else if (unitLower === 'k' || unitLower.includes('ngàn')) {
      return num * 1000;
    }

    return num;
  }

  /**
   * Extract category
   * @private
   */
  _extractCategory(message) {
    const categories = [];
    const normalizedMessage = message.toLowerCase();

    for (const [category, pattern] of Object.entries(this.entityPatterns.category)) {
      if (pattern.test(normalizedMessage)) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : null;
  }

  /**
   * Extract brand
   * @private
   */
  _extractBrand(message) {
    const brandMatches = message.match(this.entityPatterns.brand.patterns);
    if (brandMatches) {
      return [...new Set(brandMatches.map(b => b.toUpperCase()))];
    }
    return null;
  }

  /**
   * Extract specifications
   * @private
   */
  _extractSpecs(message) {
    const specs = {};

    for (const [specType, pattern] of Object.entries(this.entityPatterns.specs)) {
      const matches = message.match(pattern);
      if (matches) {
        specs[specType] = matches.map(m => m.trim());
      }
    }

    return Object.keys(specs).length > 0 ? specs : null;
  }

  /**
   * Extract purpose
   * @private
   */
  _extractPurpose(message) {
    const normalizedMessage = message.toLowerCase();

    for (const [purpose, pattern] of Object.entries(this.entityPatterns.purpose)) {
      if (pattern.test(normalizedMessage)) {
        return purpose;
      }
    }

    return null;
  }

  /**
   * Extract product names for comparison
   * @private
   */
  _extractProductNames(message) {
    // Split by comparison keywords
    const comparisonMatch = message.match(/(.+?)\s+(vs|và|so với|with|versus)\s+(.+)/i);
    if (comparisonMatch) {
      return [
        comparisonMatch[1].trim(),
        comparisonMatch[3].trim()
      ];
    }

    return null;
  }

  /**
   * Refine intent based on entities
   * @private
   */
  _refineIntent(primaryIntent, entities, intentScores) {
    // If searching with comparison keywords, change to comparison
    if (entities.products && entities.products.length >= 2) {
      return 'comparison';
    }

    // If message is a technical/knowledge question about a product category,
    // prioritize technical_question over product_search
    if (primaryIntent === 'product_search' && intentScores.technical_question > 0.5) {
      return 'technical_question';
    }
    if (primaryIntent === 'product_search' && intentScores.knowledge_question > 0.5) {
      return 'knowledge_question';
    }

    // If asking to build PC with budget
    if (entities.price && primaryIntent === 'product_search') {
      if (entities.purpose === 'gaming' || entities.category?.includes('pc')) {
        if (intentScores.pc_build && intentScores.pc_build > 0.5) {
          return 'pc_build';
        }
      }
    }

    // If asking for recommendation with specific purpose
    if (entities.purpose && !entities.price && primaryIntent === 'product_search') {
      if (intentScores.recommendation > 0.5) {
        return 'recommendation';
      }
    }

    return primaryIntent;
  }

  /**
   * Get secondary intents
   * @private
   */
  _getSecondaryIntents(intentScores, primaryIntent) {
    const sorted = Object.entries(intentScores)
      .filter(([intent]) => intent !== primaryIntent)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .filter(([, score]) => score > 0.3)
      .map(([intent, score]) => ({ intent, score }));

    return sorted;
  }

  /**
   * Generate reasoning explanation
   * @private
   */
  _generateReasoning(intent, entities, scores) {
    const reasons = [];

    reasons.push(`Detected intent: ${intent} (confidence: ${(scores[intent] * 100).toFixed(1)}%)`);

    if (entities.category) {
      reasons.push(`Category: ${entities.category.join(', ')}`);
    }

    if (entities.price) {
      if (entities.price.type === 'range') {
        reasons.push(`Price range: ${entities.price.min.toLocaleString()} - ${entities.price.max.toLocaleString()} VND`);
      } else if (entities.price.type === 'max') {
        reasons.push(`Max price: ${entities.price.max.toLocaleString()} VND`);
      } else if (entities.price.type === 'min') {
        reasons.push(`Min price: ${entities.price.min.toLocaleString()} VND`);
      }
    }

    if (entities.brand) {
      reasons.push(`Brands: ${entities.brand.join(', ')}`);
    }

    if (entities.purpose) {
      reasons.push(`Purpose: ${entities.purpose}`);
    }

    if (entities.products) {
      reasons.push(`Comparing: ${entities.products.join(' vs ')}`);
    }

    return reasons.join(' | ');
  }
}

module.exports = new IntentDetector();
