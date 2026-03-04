/**
 * AI Chatbot Service
 * Chatbot AI với khả năng truy vấn database và context-aware
 * 
 * @module services/ai/ChatbotService
 * @description AI Service cho Context-Aware Chatbot
 */

const mongoose = require('mongoose');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const Category = require('../../models/Category');
const ChatbotConversation = require('../../models/ChatbotConversation');
const RecommendationService = require('./RecommendationService');
const SemanticSearchService = require('./SemanticSearchService');
const GeminiService = require('./GeminiService');

class ChatbotService {
  constructor() {
    // Gemini configuration - ALWAYS use Gemini for smarter responses
    this.useGemini = true;
    this.geminiForUnknown = true;
    this.geminiForAll = true; // Use Gemini for ALL responses (smarter but uses more quota)
    this.smartMode = true; // Enable smart AI features
    
    // Intent patterns (regex-based intent classification)
    this.intentPatterns = {
      greeting: [
        /^(xin chào|chào|hello|hi|hey|alo|a lô)/i,
        /^(good morning|good afternoon|good evening)/i
      ],
      farewell: [
        /^(tạm biệt|bye|goodbye|see you|cảm ơn|thanks|thank you|hẹn gặp)/i
      ],
      product_search: [
        /(tìm|search|kiếm|có|bán|muốn mua|cần|tư vấn|muốn xem|cho xem|hiển thị|xem|muốn|show).*(laptop|pc|máy tính|cpu|vga|ram|mainboard|màn hình|monitor|chuột|mouse|bàn phím|keyboard|tai nghe|headphone|headset|loa|speaker|phụ kiện|case|nguồn|tản nhiệt|ổ cứng|ssd|hdd)/i,
        /(laptop|pc|máy tính|cpu|vga|ram|mainboard|màn hình|chuột|bàn phím|tai nghe|headphone|loa|phụ kiện|case|nguồn|tản nhiệt|ổ cứng).*(nào|gì|loại|tất cả|all)/i,
        /(tất cả|all|danh sách|list).*(sản phẩm|product).*(laptop|pc|máy tính|cpu|vga|ram|mainboard|màn hình|chuột|bàn phím|tai nghe|headphone|loa|phụ kiện)/i,
        /^(laptop|pc|máy tính|cpu|vga|ram|mainboard|màn hình|chuột|bàn phím|tai nghe|headphone|loa)$/i
      ],
      product_inquiry: [
        /(thông tin|chi tiết|spec|cấu hình|mô tả).*(sản phẩm|product)/i,
        /(sản phẩm|product).*(này|đó)/i
      ],
      price_inquiry: [
        /(giá|price|bao nhiêu|cost|tiền)/i,
        /(tầm giá|budget|khoảng|từ|đến).*(triệu|tr|k|nghìn)/i
      ],
      stock_check: [
        /(còn hàng|in stock|available|có sẵn|tồn kho)/i,
        /(đặt hàng|pre-order|order)/i
      ],
      order_status: [
        /(đơn hàng|order).*(của tôi|status|tình trạng|ở đâu)/i,
        /(kiểm tra|check|tracking|theo dõi).*(đơn|order)/i
      ],
      order_tracking: [
        /(giao hàng|shipping|delivery|vận chuyển).*(khi nào|bao lâu|mấy ngày)/i
      ],
      payment_help: [
        /(thanh toán|payment|trả tiền|chuyển khoản|COD|ZaloPay)/i
      ],
      shipping_info: [
        /(phí ship|shipping fee|vận chuyển|giao hàng)/i,
        /(giao đến|ship đến|deliver to)/i
      ],
      return_policy: [
        /(đổi|trả|return|refund|hoàn tiền)/i,
        /(bảo hành|warranty)/i
      ],
      warranty_info: [
        /(bảo hành|warranty|guarantee)/i
      ],
      technical_support: [
        /(hỗ trợ|support|giúp|help).*(kỹ thuật|technical|cài đặt|setup)/i,
        /(lỗi|error|bug|không hoạt động|broken)/i
      ],
      product_comparison: [
        /(so sánh|compare|vs|versus|hay hơn|tốt hơn)/i
      ],
      complaint: [
        /(phàn nàn|complaint|không hài lòng|dissatisfied)/i,
        /(tệ|bad|poor|worst)/i
      ],
      feedback: [
        /(góp ý|feedback|đánh giá|review)/i
      ]
    };

    // Quick reply suggestions - Premium Version
    this.quickReplies = {
      greeting: [
        '🎮 Laptop Gaming',
        '💼 PC Văn phòng',
        '📦 Kiểm tra đơn hàng',
        '🎧 Phụ kiện Gaming'
      ],
      product_search: [
        '💻 So sánh sản phẩm',
        '🔥 Sản phẩm HOT',
        '💰 Dưới 15 triệu',
        '🏷️ Đang khuyến mãi'
      ],
      order_status: [
        '📝 Nhập mã đơn hàng',
        '📋 Đơn hàng gần đây',
        '📞 Liên hệ hỗ trợ'
      ],
      after_search: [
        '🔍 Tìm thêm sản phẩm',
        '⚖️ So sánh',
        '💡 Tư vấn thêm'
      ]
    };

    // Response templates - Premium Version
    this.responseTemplates = {
      greeting: [
        'Xin chào! 👋 Tôi là **TechBot AI** - trợ lý thông minh của TechStore. Tôi có thể giúp bạn tìm sản phẩm phù hợp, tư vấn cấu hình, và giải đáp mọi thắc mắc. Bạn cần hỗ trợ gì? 🚀',
        'Chào bạn! 😊 Rất vui được hỗ trợ! Tôi có thể giúp bạn tìm kiếm, so sánh sản phẩm, hoặc kiểm tra đơn hàng. Bạn đang quan tâm đến gì?'
      ],
      farewell: [
        'Cảm ơn bạn! 🙏 Rất vui được hỗ trợ. Nếu cần gì, cứ quay lại nhé! Chúc bạn mua sắm vui vẻ! 🎉',
        'Tạm biệt bạn! 👋 Hy vọng đã giúp được bạn. Chúc bạn một ngày tuyệt vời!'
      ],
      order_not_found: [
        'Hmm, tôi không tìm thấy đơn hàng này 🔍. Bạn có thể kiểm tra lại mã đơn hàng hoặc đăng nhập để xem danh sách đơn hàng của mình.'
      ],
      no_product_found: [
        'Rất tiếc, tôi chưa tìm thấy sản phẩm phù hợp 😅. Bạn có thể thử từ khóa khác hoặc cho tôi biết thêm về nhu cầu của bạn!'
      ],
      fallback: [
        'Tôi cần thêm thông tin để hỗ trợ tốt hơn 🤔. Bạn có thể cho tôi biết cụ thể hơn không?',
        'Hmm, tôi chưa hiểu rõ lắm 💭. Bạn có thể mô tả chi tiết hơn hoặc chọn một gợi ý bên dưới!'
      ]
    };
  }

  // ==================== INTENT CLASSIFICATION ====================

  /**
   * Phân loại intent từ message
   */
  classifyIntent(message) {
    const normalizedMessage = message.toLowerCase().trim();

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          return {
            intent,
            confidence: 0.8,
            pattern: pattern.toString()
          };
        }
      }
    }

    return {
      intent: 'unknown',
      confidence: 0.3,
      pattern: null
    };
  }

  // ==================== ENTITY EXTRACTION ====================

  /**
   * Trích xuất entities từ message
   */
  extractEntities(message) {
    const entities = [];
    const normalizedMessage = message.toLowerCase();

    // Product categories
    const categoryPatterns = {
      'Laptop': /laptop|máy tính xách tay/gi,
      'PC': /pc|máy tính bàn|desktop/gi,
      'CPU': /cpu|processor|vi xử lý/gi,
      'VGA': /vga|card đồ họa|graphics card|card màn hình/gi,
      'RAM': /ram|bộ nhớ/gi,
      'Mainboard': /mainboard|bo mạch chủ|main/gi,
      'Màn hình': /màn hình|monitor|display/gi,
      'Ổ cứng': /ổ cứng|ssd|hdd|nvme/gi,
      'Chuột': /chuột|mouse/gi,
      'Bàn phím': /bàn phím|keyboard/gi,
      'Tai nghe': /tai nghe|headphone|headset/gi,
      'Loa': /loa|speaker/gi
    };

    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(normalizedMessage)) {
        entities.push({
          type: 'category',
          value: category,
          confidence: 0.9
        });
      }
    }

    // Brand names
    const brandPatterns = /(asus|acer|dell|hp|lenovo|msi|gigabyte|samsung|lg|apple|intel|amd|nvidia|corsair|logitech|razer)/gi;
    const brandMatches = normalizedMessage.match(brandPatterns);
    if (brandMatches) {
      brandMatches.forEach(brand => {
        entities.push({
          type: 'brand',
          value: brand.toUpperCase(),
          confidence: 0.95
        });
      });
    }

    // Price range
    const pricePattern = /(\d+)\s*(triệu|tr|m|k|nghìn)/gi;
    let priceMatch;
    while ((priceMatch = pricePattern.exec(normalizedMessage)) !== null) {
      let value = parseInt(priceMatch[1]);
      const unit = priceMatch[2].toLowerCase();
      
      if (unit === 'triệu' || unit === 'tr' || unit === 'm') {
        value *= 1000000;
      } else if (unit === 'k' || unit === 'nghìn') {
        value *= 1000;
      }

      entities.push({
        type: 'price',
        value,
        confidence: 0.85
      });
    }

    // Order number
    const orderPattern = /(ORD-?\d{13,}|[A-Z]{2,3}-?\d{6,})/gi;
    const orderMatch = normalizedMessage.match(orderPattern);
    if (orderMatch) {
      entities.push({
        type: 'order_number',
        value: orderMatch[0].toUpperCase(),
        confidence: 0.95
      });
    }

    return entities;
  }

  // ==================== DATABASE QUERIES ====================

  /**
   * Smart Product Search - Sử dụng Semantic Search + Traditional Search
   * Kết hợp TF-IDF, text search và regex để tìm sản phẩm chính xác nhất
   */
  async searchProducts(query, options = {}) {
    const { limit = 5, category = null, brand = null, maxPrice = null, minPrice = null, useSemanticSearch = true } = options;

    const filter = { stock: { $gt: 0 } };
    
    // Use regex for category matching to handle variations
    if (category) filter.category = new RegExp(category, 'i');
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (maxPrice) filter.price = { ...filter.price, $lte: maxPrice };
    if (minPrice) filter.price = { ...filter.price, $gte: minPrice };

    try {
      // 1. Try Semantic Search first for best relevance
      if (useSemanticSearch && this.smartMode) {
        try {
          const semanticResults = await SemanticSearchService.search(query, {
            limit: limit * 2,
            category,
            brand,
            maxPrice,
            minPrice
          });
          
          if (semanticResults && semanticResults.length > 0) {
            // Filter and enrich results
            const enrichedResults = semanticResults
              .filter(r => r.product.stock > 0)
              .slice(0, limit)
              .map(r => ({
                ...r.product,
                _id: r.product._id,
                relevanceScore: r.score
              }));
            
            if (enrichedResults.length > 0) {
              return enrichedResults;
            }
          }
        } catch (semanticError) {
          console.log('Semantic search fallback to traditional:', semanticError.message);
        }
      }

      // 2. If category is specified, search within that category first
      if (category) {
        const categoryProducts = await Product.find(filter)
          .sort({ rating: -1, reviewCount: -1 })
          .limit(limit)
          .select('name price image images category brand rating stock salePrice description');
        
        if (categoryProducts.length > 0) {
          return categoryProducts;
        }
      }

      // 3. Try text search with MongoDB
      const textSearchResults = await Product.find(
        { ...filter, $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .select('name price image images category brand rating stock salePrice description');

      if (textSearchResults.length > 0) {
        return textSearchResults;
      }

      // 4. Fallback to regex search with multiple patterns
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const regexPatterns = queryWords.map(w => new RegExp(w, 'i'));
      
      const regexFilter = {
        ...filter,
        $or: [
          { name: new RegExp(query, 'i') },
          { description: new RegExp(query, 'i') },
          { brand: new RegExp(query, 'i') },
          { category: new RegExp(query, 'i') },
          // Match any word from query
          ...regexPatterns.map(pattern => ({ name: pattern })),
          ...regexPatterns.map(pattern => ({ brand: pattern }))
        ]
      };

      return Product.find(regexFilter)
        .sort({ rating: -1, reviewCount: -1 })
        .limit(limit)
        .select('name price image images category brand rating stock salePrice description');

    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Smart Search - Tìm kiếm thông minh với Gemini analysis
   */
  async smartSearch(message, userContext = {}) {
    // Use Gemini to analyze the query and extract structured information
    if (this.smartMode && GeminiService.isReady()) {
      try {
        const analysis = await GeminiService.analyzeIntent(message);
        if (analysis) {
          const searchOptions = {
            limit: 5,
            category: this.mapProductTypeToCategory(analysis.entities?.product_type),
            brand: analysis.entities?.brand,
            minPrice: analysis.entities?.price_range?.min,
            maxPrice: analysis.entities?.price_range?.max
          };
          
          // Clean up null values
          Object.keys(searchOptions).forEach(key => {
            if (searchOptions[key] === null || searchOptions[key] === undefined) {
              delete searchOptions[key];
            }
          });
          
          return { products: await this.searchProducts(message, searchOptions), analysis };
        }
      } catch (error) {
        console.log('Smart search fallback:', error.message);
      }
    }
    
    // Fallback to regular search with entity extraction
    const entities = this.extractEntities(message);
    const categoryEntity = entities.find(e => e.type === 'category');
    const brandEntity = entities.find(e => e.type === 'brand');
    const priceEntities = entities.filter(e => e.type === 'price');
    
    const searchOptions = { limit: 5 };
    if (categoryEntity) searchOptions.category = categoryEntity.value;
    if (brandEntity) searchOptions.brand = brandEntity.value;
    if (priceEntities.length > 0) {
      const prices = priceEntities.map(e => e.value).sort((a, b) => a - b);
      searchOptions.minPrice = prices[0];
      if (prices.length > 1) searchOptions.maxPrice = prices[prices.length - 1];
    }
    
    return { products: await this.searchProducts(message, searchOptions), analysis: null };
  }

  /**
   * Map product type from Gemini to database category
   */
  mapProductTypeToCategory(productType) {
    if (!productType) return null;
    
    const mapping = {
      'laptop': 'Laptop',
      'pc': 'PC',
      'cpu': 'CPU',
      'vga': 'VGA',
      'ram': 'RAM',
      'keyboard': 'Bàn phím',
      'mouse': 'Chuột',
      'headphone': 'Tai nghe',
      'speaker': 'Loa',
      'monitor': 'Màn hình',
      'ssd': 'Ổ cứng',
      'hdd': 'Ổ cứng',
      'mainboard': 'Mainboard',
      'case': 'Case',
      'psu': 'Nguồn',
      'cooler': 'Tản nhiệt'
    };
    
    return mapping[productType?.toLowerCase()] || null;
  }

  /**
   * Lấy thông tin đơn hàng
   */
  async getOrderInfo(orderNumber, userId = null) {
    const query = { orderNumber };
    if (userId) query.user = userId;

    const order = await Order.findOne(query)
      .populate('items.product', 'name image')
      .select('orderNumber status totalAmount items customerInfo paymentMethod createdAt deliveredAt');

    return order;
  }

  /**
   * Lấy đơn hàng gần đây của user
   */
  async getUserRecentOrders(userId, limit = 3) {
    return Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('orderNumber status totalAmount createdAt');
  }

  /**
   * Lấy danh sách categories
   */
  async getCategories() {
    return Product.distinct('category');
  }

  // ==================== RESPONSE GENERATION ====================

  /**
   * Tạo response dựa trên intent
   */
  async generateResponse(intent, entities, userContext, message) {
    const response = {
      text: '',
      products: [],
      orders: [],
      quickReplies: [],
      actions: []
    };

    switch (intent) {
      case 'greeting':
        response.text = this.getRandomResponse('greeting');
        response.quickReplies = this.quickReplies.greeting;
        break;

      case 'farewell':
        response.text = this.getRandomResponse('farewell');
        break;

      case 'product_search':
        response.text = await this.handleProductSearch(entities, message, response);
        response.quickReplies = this.quickReplies.product_search;
        break;

      case 'product_inquiry':
        response.text = await this.handleProductInquiry(userContext, response);
        break;

      case 'price_inquiry':
        response.text = await this.handlePriceInquiry(entities, message, response);
        break;

      case 'stock_check':
        response.text = await this.handleStockCheck(entities, userContext, response);
        break;

      case 'order_status':
        response.text = await this.handleOrderStatus(entities, userContext, response);
        response.quickReplies = this.quickReplies.order_status;
        break;

      case 'order_tracking':
        response.text = this.handleOrderTracking();
        break;

      case 'payment_help':
        response.text = this.handlePaymentHelp();
        break;

      case 'shipping_info':
        response.text = this.handleShippingInfo();
        break;

      case 'return_policy':
        response.text = this.handleReturnPolicy();
        break;

      case 'warranty_info':
        response.text = this.handleWarrantyInfo();
        break;

      case 'technical_support':
        response.text = this.handleTechnicalSupport();
        response.actions.push({ type: 'escalate', reason: 'technical_support' });
        break;

      case 'product_comparison':
        response.text = await this.handleProductComparison(entities, message, response);
        break;

      case 'complaint':
        response.text = this.handleComplaint();
        response.actions.push({ type: 'escalate', reason: 'complaint' });
        break;

      default:
        response.text = await this.handleUnknownIntent(message, userContext, response);
        response.quickReplies = this.quickReplies.greeting;
    }

    return response;
  }

  /**
   * Get random response from templates
   */
  getRandomResponse(key) {
    const templates = this.responseTemplates[key];
    if (!templates || templates.length === 0) return '';
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ==================== INTENT HANDLERS ====================

  async handleProductSearch(entities, message, response) {
    const categoryEntity = entities.find(e => e.type === 'category');
    const brandEntity = entities.find(e => e.type === 'brand');
    const priceEntities = entities.filter(e => e.type === 'price');

    let searchOptions = { limit: 5 };
    
    if (categoryEntity) searchOptions.category = categoryEntity.value;
    if (brandEntity) searchOptions.brand = brandEntity.value;
    if (priceEntities.length > 0) {
      const prices = priceEntities.map(e => e.value).sort((a, b) => a - b);
      searchOptions.minPrice = prices[0];
      if (prices.length > 1) searchOptions.maxPrice = prices[prices.length - 1];
      else searchOptions.maxPrice = prices[0] * 1.5;
    }

    // Extract search query
    let searchQuery = message;
    entities.forEach(e => {
      if (e.type !== 'price') {
        searchQuery = searchQuery.replace(new RegExp(e.value, 'gi'), '');
      }
    });
    searchQuery = searchQuery.replace(/tìm|search|kiếm|có|bán|muốn mua|cần|tư vấn/gi, '').trim();

    const products = await this.searchProducts(searchQuery || categoryEntity?.value || '', searchOptions);
    response.products = products;

    if (products.length > 0) {
      const categoryText = categoryEntity ? ` ${categoryEntity.value}` : '';
      const brandText = brandEntity ? ` ${brandEntity.value}` : '';
      // Only return concise text - products will be displayed as cards
      return `Đây là một số sản phẩm${categoryText}${brandText} phù hợp với yêu cầu của bạn. Bạn có thể click vào sản phẩm để xem chi tiết!`;
    }

    return this.getRandomResponse('no_product_found');
  }

  async handleProductInquiry(userContext, response) {
    if (userContext.currentProduct) {
      const product = await Product.findById(userContext.currentProduct)
        .select('name price image images category brand rating stock salePrice description');
      if (product) {
        response.products = [product];
        // Concise text - product details shown in card
        return `Đây là thông tin sản phẩm bạn quan tâm. Bạn có thể click vào để xem chi tiết hoặc hỏi thêm!`;
      }
    }
    return 'Bạn đang muốn hỏi về sản phẩm nào? Hãy cho tôi biết tên hoặc danh mục sản phẩm.';
  }

  async handlePriceInquiry(entities, message, response) {
    const priceEntities = entities.filter(e => e.type === 'price');
    const categoryEntity = entities.find(e => e.type === 'category');

    if (priceEntities.length > 0 || categoryEntity) {
      return this.handleProductSearch(entities, message, response);
    }

    return 'Bạn đang tìm sản phẩm trong tầm giá nào? Hãy cho tôi biết ngân sách và loại sản phẩm bạn cần.';
  }

  async handleStockCheck(entities, userContext, response) {
    if (userContext.currentProduct) {
      const product = await Product.findById(userContext.currentProduct).select('name stock');
      if (product) {
        if (product.stock > 0) {
          return `✅ **${product.name}** hiện còn ${product.stock} sản phẩm trong kho. Bạn có muốn thêm vào giỏ hàng không?`;
        }
        return `❌ **${product.name}** hiện đã hết hàng. Bạn có muốn tôi gợi ý sản phẩm tương tự không?`;
      }
    }
    return 'Bạn muốn kiểm tra tình trạng còn hàng của sản phẩm nào?';
  }

  async handleOrderStatus(entities, userContext, response) {
    const orderEntity = entities.find(e => e.type === 'order_number');

    if (orderEntity) {
      const order = await this.getOrderInfo(orderEntity.value, userContext.isAuthenticated ? userContext.userId : null);
      if (order) {
        response.orders = [order];
        const statusText = {
          'pending': '⏳ Đang chờ xử lý',
          'processing': '🔄 Đang xử lý',
          'shipped': '🚚 Đang giao hàng',
          'delivered': '✅ Đã giao hàng',
          'cancelled': '❌ Đã hủy'
        };
        return `**Đơn hàng ${order.orderNumber}**\n\n📊 Trạng thái: ${statusText[order.status] || order.status}\n💰 Tổng tiền: ${order.totalAmount.toLocaleString()}đ\n📅 Ngày đặt: ${new Date(order.createdAt).toLocaleDateString('vi-VN')}\n📍 Giao đến: ${order.customerInfo?.address}\n\nBạn cần hỗ trợ gì thêm về đơn hàng này?`;
      }
      return this.getRandomResponse('order_not_found');
    }

    if (userContext.isAuthenticated) {
      const recentOrders = await this.getUserRecentOrders(userContext.userId);
      if (recentOrders.length > 0) {
        response.orders = recentOrders;
        return `Đây là các đơn hàng gần đây của bạn:\n\n${recentOrders.map(o => `• ${o.orderNumber} - ${o.status} - ${o.totalAmount.toLocaleString()}đ`).join('\n')}\n\nBạn muốn xem chi tiết đơn hàng nào?`;
      }
      return 'Bạn chưa có đơn hàng nào. Hãy khám phá các sản phẩm của chúng tôi!';
    }

    return 'Vui lòng cung cấp mã đơn hàng để tôi kiểm tra. Hoặc bạn có thể đăng nhập để xem tất cả đơn hàng của mình.';
  }

  handleOrderTracking() {
    return '📦 **Thông tin vận chuyển**\n\n• Nội thành HCM, Hà Nội: 1-2 ngày\n• Các tỉnh lân cận: 2-3 ngày\n• Các tỉnh xa: 3-5 ngày\n\nBạn có thể theo dõi đơn hàng bằng cách cung cấp mã đơn hàng cho tôi.';
  }

  handlePaymentHelp() {
    return '💳 **Phương thức thanh toán**\n\n1. **COD** - Thanh toán khi nhận hàng\n2. **Chuyển khoản ngân hàng**\n3. **ZaloPay** - Thanh toán nhanh chóng\n\nBạn cần hỗ trợ về phương thức thanh toán nào?';
  }

  handleShippingInfo() {
    return '🚚 **Thông tin giao hàng**\n\n• **Miễn phí ship** cho đơn hàng từ 500.000đ\n• Ship nhanh 2h trong nội thành (phụ thu 30.000đ)\n• Giao hàng toàn quốc\n\nBạn cần biết thêm thông tin gì về vận chuyển?';
  }

  handleReturnPolicy() {
    return '🔄 **Chính sách đổi trả**\n\n• Đổi trả trong vòng **7 ngày** nếu sản phẩm lỗi\n• Hoàn tiền **100%** nếu lỗi từ nhà sản xuất\n• Sản phẩm phải còn nguyên seal, đầy đủ phụ kiện\n\nBạn muốn đổi trả sản phẩm nào?';
  }

  handleWarrantyInfo() {
    return '🛡️ **Chính sách bảo hành**\n\n• Laptop, PC: 12-24 tháng\n• Linh kiện: 12-36 tháng\n• Phụ kiện: 6-12 tháng\n\n✅ Bảo hành chính hãng\n✅ Hỗ trợ tận nơi\n✅ Đổi mới nếu lỗi nặng\n\nBạn cần kiểm tra bảo hành sản phẩm nào?';
  }

  handleTechnicalSupport() {
    return '🔧 **Hỗ trợ kỹ thuật**\n\nTôi sẽ chuyển bạn đến đội ngũ kỹ thuật để được hỗ trợ tốt nhất.\n\nTrong khi chờ đợi, bạn có thể:\n• Mô tả chi tiết vấn đề gặp phải\n• Cung cấp model sản phẩm\n• Gửi hình ảnh lỗi (nếu có)\n\n📞 Hotline: 1900 xxxx';
  }

  async handleProductComparison(entities, message, response) {
    const categoryEntity = entities.find(e => e.type === 'category');
    const brandEntities = entities.filter(e => e.type === 'brand');

    if (brandEntities.length >= 2) {
      // Compare products from different brands
      const products = [];
      for (const brand of brandEntities) {
        const product = await Product.findOne({
          brand: new RegExp(brand.value, 'i'),
          category: categoryEntity?.value,
          stock: { $gt: 0 }
        }).sort({ rating: -1 });
        if (product) products.push(product);
      }

      if (products.length >= 2) {
        response.products = products;
        
        // Use Gemini for intelligent comparison
        if (this.useGemini && GeminiService.isReady()) {
          try {
            const geminiComparison = await GeminiService.compareProducts(products);
            if (geminiComparison) {
              return `**So sánh sản phẩm**\n\n${geminiComparison}`;
            }
          } catch (error) {
            console.error('Gemini comparison error:', error);
          }
        }
        
        // Concise text - products displayed as cards below
        return `Đây là ${products.length} sản phẩm để so sánh. Click vào để xem chi tiết từng sản phẩm!`;
      }
    }

    // Try to search for products to compare
    const searchQuery = categoryEntity ? categoryEntity.value : message.replace(/so sánh|compare|vs|versus/gi, '').trim();
    const searchProducts = await this.searchProducts(searchQuery, { limit: 3 });
    if (searchProducts.length > 0) {
      response.products = searchProducts;
      return `Đây là một số sản phẩm liên quan. Bạn muốn so sánh những sản phẩm nào?`;
    }

    return 'Bạn muốn so sánh những sản phẩm nào? Hãy cho tôi biết tên hoặc thương hiệu cụ thể.';
  }

  handleComplaint() {
    return '😔 Chúng tôi rất tiếc khi bạn không hài lòng. Tôi sẽ chuyển phản ánh của bạn đến bộ phận chăm sóc khách hàng ngay.\n\nBạn có thể mô tả chi tiết vấn đề để chúng tôi hỗ trợ tốt hơn:\n• Mã đơn hàng (nếu có)\n• Sản phẩm liên quan\n• Vấn đề gặp phải\n\n📞 Hotline: 1900 xxxx';
  }

  async handleUnknownIntent(message, userContext, response) {
    // SMART MODE: Use Gemini for intelligent understanding
    if (this.smartMode && this.useGemini && GeminiService.isReady()) {
      try {
        // Step 1: Use smartSearch for better product matching
        const { products, analysis } = await this.smartSearch(message, userContext);
        
        // Step 2: Get conversation history for context
        const categories = await this.getCategories();
        
        // Step 3: Build rich context for Gemini
        const richContext = {
          products: products.slice(0, 5),
          categories,
          userInfo: userContext,
          analysis, // Include Gemini's own analysis
          conversationState: userContext.currentState || 'general',
          hasProducts: products.length > 0
        };
        
        // Step 4: Get intelligent response from Gemini
        const geminiResponse = await GeminiService.chat(message, [], richContext);
        
        if (geminiResponse && geminiResponse.text) {
          // Add found products to response
          if (products.length > 0) {
            response.products = products.slice(0, 5);
          }
          
          // Generate smart quick replies based on context
          response.quickReplies = this.generateSmartQuickReplies(analysis, products);
          
          return geminiResponse.text;
        }
      } catch (error) {
        console.error('Smart mode error:', error);
      }
    }

    // FALLBACK: Traditional entity extraction
    const entities = this.extractEntities(message);
    const categoryEntity = entities.find(e => e.type === 'category');
    const brandEntity = entities.find(e => e.type === 'brand');
    const priceEntities = entities.filter(e => e.type === 'price');

    let searchOptions = { limit: 5 };
    if (categoryEntity) searchOptions.category = categoryEntity.value;
    if (brandEntity) searchOptions.brand = brandEntity.value;
    if (priceEntities.length > 0) {
      const prices = priceEntities.map(e => e.value).sort((a, b) => a - b);
      searchOptions.minPrice = prices[0];
      if (prices.length > 1) searchOptions.maxPrice = prices[prices.length - 1];
    }

    const searchQuery = categoryEntity ? categoryEntity.value : message;
    const products = await this.searchProducts(searchQuery, { ...searchOptions, limit: 5 });
    
    if (products.length > 0) {
      response.products = products;
      return `Đây là một số sản phẩm phù hợp với yêu cầu của bạn! Click vào để xem chi tiết.`;
    }

    // Get personalized recommendations
    if (userContext.isAuthenticated) {
      const recommendations = await RecommendationService.getPersonalizedRecommendations(userContext.userId, { limit: 5 });
      if (recommendations.length > 0) {
        response.products = recommendations;
        return `Dựa trên lịch sử của bạn, đây là một số gợi ý:`;
      }
    }

    // Get popular products as last resort
    const popularProducts = await Product.find({ stock: { $gt: 0 } })
      .sort({ rating: -1, reviewCount: -1 })
      .limit(5)
      .select('name price image images category brand rating stock salePrice');
    
    if (popularProducts.length > 0) {
      response.products = popularProducts;
      return `Tôi chưa hiểu rõ yêu cầu của bạn. Đây là một số sản phẩm phổ biến tại TechStore:`;
    }

    return this.getRandomResponse('fallback');
  }

  /**
   * Generate smart quick replies based on context
   */
  generateSmartQuickReplies(analysis, products) {
    const quickReplies = [];
    
    if (analysis) {
      // Based on intent
      if (analysis.intent === 'product_search') {
        quickReplies.push('So sánh sản phẩm');
        quickReplies.push('Xem thêm sản phẩm');
      }
      
      // Based on product type
      if (analysis.entities?.product_type) {
        const productType = analysis.entities.product_type;
        if (productType === 'laptop') {
          quickReplies.push('Laptop gaming', 'Laptop văn phòng');
        } else if (productType === 'pc') {
          quickReplies.push('PC gaming', 'PC đồ họa');
        }
      }
      
      // Price inquiry
      if (!analysis.entities?.price_range?.max) {
        quickReplies.push('Dưới 10 triệu', 'Dưới 20 triệu', 'Trên 30 triệu');
      }
    }
    
    // Default quick replies if none generated
    if (quickReplies.length === 0) {
      quickReplies.push('Tư vấn thêm', 'Xem sản phẩm khác', 'Liên hệ hỗ trợ');
    }
    
    return quickReplies.slice(0, 4);
  }

  // ==================== MAIN CHAT METHOD ====================

  /**
   * Process user message và trả về response
   */
  async chat(sessionId, message, options = {}) {
    const { userId = null, userContext = {} } = options;
    const startTime = Date.now();

    // Get or create conversation
    let conversation = await ChatbotConversation.getOrCreateConversation(sessionId, userId);

    // Update user context
    if (userId && !conversation.userContext.isAuthenticated) {
      conversation.userContext.isAuthenticated = true;
      conversation.user = userId;
      
      // Fetch user data
      const Order = require('../../models/Order');
      const recentOrders = await Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id totalAmount');
      
      conversation.userContext.purchaseHistory = {
        totalOrders: recentOrders.length,
        totalSpent: recentOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        recentOrders: recentOrders.map(o => o._id)
      };
    }

    // Merge provided context
    if (userContext.currentProduct) {
      conversation.userContext.currentProduct = userContext.currentProduct;
    }
    if (userContext.currentCart) {
      conversation.userContext.currentCart = userContext.currentCart;
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    // Classify intent và extract entities
    const intentResult = this.classifyIntent(message);
    const entities = this.extractEntities(message);

    userMessage.intent = intentResult.intent;
    userMessage.intentConfidence = intentResult.confidence;
    userMessage.entities = entities;

    conversation.messages.push(userMessage);

    // Generate response
    const response = await this.generateResponse(
      intentResult.intent,
      entities,
      conversation.userContext,
      message
    );

    const processingTime = Date.now() - startTime;

    // Add assistant message
    const assistantMessage = {
      role: 'assistant',
      content: response.text,
      timestamp: new Date(),
      referencedItems: {
        products: response.products?.map(p => p._id) || [],
        orders: response.orders?.map(o => o._id) || []
      },
      responseMetadata: {
        generationTime: processingTime,
        model: 'rule-based'
      }
    };

    conversation.messages.push(assistantMessage);

    // Update conversation state
    conversation.state.currentState = this.mapIntentToState(intentResult.intent);
    if (response.products?.length > 0) {
      conversation.state.lastRecommendations = response.products.map(p => p._id);
    }

    // Check if needs escalation
    if (response.actions?.some(a => a.type === 'escalate')) {
      conversation.metadata.escalatedToHuman = true;
      conversation.metadata.escalationReason = response.actions.find(a => a.type === 'escalate').reason;
    }

    await conversation.save();

    return {
      text: response.text,
      products: response.products,
      orders: response.orders,
      quickReplies: response.quickReplies,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      sessionId,
      conversationId: conversation._id
    };
  }

  mapIntentToState(intent) {
    const stateMap = {
      'greeting': 'greeting',
      'product_search': 'product_discovery',
      'product_inquiry': 'product_discovery',
      'product_comparison': 'product_comparison',
      'order_status': 'order_inquiry',
      'order_tracking': 'order_inquiry',
      'technical_support': 'support_ticket',
      'farewell': 'farewell'
    };
    return stateMap[intent] || 'general_chat';
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId, limit = 50) {
    const conversation = await ChatbotConversation.findOne({ sessionId })
      .select('messages userContext state')
      .lean();

    if (!conversation) return null;

    return {
      messages: conversation.messages.slice(-limit),
      userContext: conversation.userContext,
      state: conversation.state
    };
  }

  /**
   * End conversation
   */
  async endConversation(sessionId, satisfaction = null) {
    const conversation = await ChatbotConversation.findOne({ sessionId });
    if (!conversation) return null;

    conversation.status = 'completed';
    if (satisfaction) {
      conversation.satisfaction = satisfaction;
    }

    await conversation.save();
    return conversation;
  }
}

module.exports = new ChatbotService();
