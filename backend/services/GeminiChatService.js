const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const GEMINI_SYSTEM_INSTRUCTION = [
  'Bạn là Trợ lý AI của TechStore. Nhiệm vụ của bạn là tư vấn, tìm kiếm và thêm vào giỏ hàng.',
  'KHI USER GỬI ẢNH: Bạn phải tự động nhận diện và gọi tool search_products NGAY LẬP TỨC.',
  "TỪ VỰNG ÉP BUỘC KHI GỌI TOOL: Luôn dùng [Loại thiết bị] + [Thương hiệu] (VD: 'Laptop MSI', 'Chuột Logitech', 'UPS APC', 'Mainboard Asus'). Tuyệt đối không dùng các từ chung chung như 'thiết bị công nghệ', không dịch 'UPS' thành 'Bộ nguồn liên tục'.",
  "KỊCH BẢN XỬ LÝ KẾT QUẢ TÌM KIẾM (BẮT BUỘC TUÂN THỦ):\n1. TRƯỜNG HỢP CÓ HÀNG (Tool trả về data sản phẩm): Báo giá và mời khách thêm vào giỏ hàng.\n2. TRƯỜNG HỢP KHÔNG CÓ HÀNG (Tool trả về status: 'not_found'):\n   - BƯỚC A (Ghi nhận): Vẫn phải cho khách biết bạn đã nhận diện đúng ảnh. (VD: 'Dạ, em thấy mình đang tìm Chuột Asus TUF...').\n   - BƯỚC B (Nói khéo): Thông báo hết hàng một cách lịch sự. (VD: '...tuy nhiên hiện tại mẫu này bên em đang tạm hết hàng / không kinh doanh ạ.').\n   - BƯỚC C (Bẻ lái/Cross-sell): Gợi ý khách sang sản phẩm khác cùng loại. (VD: 'Anh/chị có muốn em tìm thử các mẫu chuột Gaming khác của Logitech hay Razer không ạ?').\n   - LỆNH TỬ HÌNH: TUYỆT ĐỐI KHÔNG mời thêm vào giỏ hàng, KHÔNG tự bịa ra giá tiền khi hệ thống báo 'not_found'."
].join('\n');

class GeminiChatService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.isInitialized = false;
    this.lastSearchedProducts = [];
    this.tools = this._buildToolDeclarations();
    this.initialize();
  }

  initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.isInitialized = false;
      console.error('GEMINI_API_KEY is missing');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION
      });
      this.isInitialized = true;
      console.log(`Gemini initialized with model: ${this.modelName}`);
    } catch (error) {
      this.isInitialized = false;
      console.error('Gemini initialization failed:', error.message);
    }
  }

  isReady() {
    return this.isInitialized && !!this.model;
  }

  getProviderDiagnostics() {
    return {
      provider: 'gemini',
      model: this.modelName,
      ready: this.isReady(),
      hasApiKey: Boolean(process.env.GEMINI_API_KEY)
    };
  }

  getLastSearchedProducts() {
    return Array.isArray(this.lastSearchedProducts) ? this.lastSearchedProducts : [];
  }

  _buildToolDeclarations() {
    return [
      {
        functionDeclarations: [
          {
            name: 'search_products',
            description: 'Tìm sản phẩm trong database theo cụm từ khóa có cấu trúc [Loại thiết bị] + [Thương hiệu].',
            parameters: {
              type: 'object',
              properties: {
                keyword: {
                  type: 'string',
                  description: "Từ khóa bắt buộc theo mẫu ví dụ: 'Laptop MSI', 'Chuột Logitech', 'UPS APC', 'Mainboard Asus'."
                },
                limit: {
                  type: 'number',
                  description: 'Số lượng sản phẩm tối đa trả về (1-10).'
                },
                category: {
                  type: 'string',
                  description: 'Danh mục sản phẩm nếu có.'
                },
                brand: {
                  type: 'string',
                  description: 'Thương hiệu nếu có.'
                }
              },
              required: ['keyword']
            }
          },
          {
            name: 'add_to_cart_by_ai',
            description: 'Thêm sản phẩm vào giỏ hàng theo productId hoặc productName trong phiên hiện tại.',
            parameters: {
              type: 'object',
              properties: {
                productId: {
                  type: 'string',
                  description: 'MongoDB ObjectId của sản phẩm.'
                },
                productName: {
                  type: 'string',
                  description: 'Tên sản phẩm để tìm và thêm vào giỏ khi không có productId.'
                },
                quantity: {
                  type: 'number',
                  description: 'Số lượng cần thêm vào giỏ.'
                }
              }
            }
          }
        ]
      }
    ];
  }

  async chatWithTools({ message = '', imageBase64 = '', history = [], sessionId = '', userId = null } = {}) {
    if (!this.isReady()) {
      throw new Error('Gemini service not initialized');
    }

    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      throw new Error('User message is empty');
    }

    const contents = this._buildConversationContents({
      message: normalizedMessage,
      imageBase64,
      history
    });

    const toolTrace = [];
    const collectedProducts = [];
    let finalText = '';

    for (let turn = 0; turn < 6; turn += 1) {
      const result = await this.model.generateContent({
        contents,
        tools: this.tools
      });
      const response = result?.response;
      const functionCalls = typeof response?.functionCalls === 'function'
        ? response.functionCalls() || []
        : [];

      if (!Array.isArray(functionCalls) || functionCalls.length === 0) {
        finalText = String(response?.text?.() || '').trim();
        break;
      }

      for (const call of functionCalls) {
        const name = String(call?.name || '').trim();
        const args = call?.args && typeof call.args === 'object' ? call.args : {};

        contents.push({
          role: 'model',
          parts: [{ functionCall: { name, args } }]
        });

        const toolResult = await this._executeFunctionCall(name, args, {
          sessionId,
          userId
        });

        if (name === 'search_products' && Array.isArray(toolResult?.products)) {
          for (const p of toolResult.products) {
            collectedProducts.push(p);
          }
          this.lastSearchedProducts = toolResult.products.slice(0, 10);
        }

        toolTrace.push({
          name,
          arguments: args,
          result: toolResult
        });

        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name,
              response: {
                result: toolResult
              }
            }
          }]
        });
      }
    }

    if (!finalText) {
      finalText = 'Mình đã xử lý yêu cầu nhưng chưa tạo được phản hồi tự nhiên. Vui lòng thử lại với mô tả ngắn hơn.';
    }

    return {
      text: finalText,
      products: this._dedupeProducts(collectedProducts).slice(0, 8),
      provider: 'gemini',
      model: this.modelName,
      toolTrace
    };
  }

  async generateResponse(userMessage, productContext = [], chatHistory = []) {
    if (!this.isReady()) {
      throw new Error('Gemini service not initialized');
    }

    try {
      const prompt = this._buildPrompt(userMessage, productContext, chatHistory);
      const result = await this.model.generateContent(prompt);
      return {
        success: true,
        answer: String(result?.response?.text?.() || '').trim(),
        productContext: productContext.length,
        source: 'gemini'
      };
    } catch (error) {
      return {
        success: false,
        answer: this._getFallbackResponse(userMessage, productContext),
        productContext: productContext.length,
        source: 'fallback',
        error: error.message
      };
    }
  }

  async generateRagAnswer({ systemPrompt, userQuestion, contextBlocks = [], conversationHistory = [] }) {
    if (!this.isReady()) {
      throw new Error('Gemini service not initialized');
    }

    try {
      const contextText = contextBlocks
        .map((block, idx) => {
          const source = block?.metadata?.source || 'unknown_source';
          return `[Context ${idx + 1} | ${source}]\n${block?.content || ''}`;
        })
        .join('\n\n');

      const historyText = (conversationHistory || [])
        .slice(-6)
        .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content || ''}`)
        .join('\n');

      const prompt = [
        systemPrompt || 'Bạn là trợ lý AI của TechStore.',
        '',
        '=== NGỮ CẢNH TRUY XUẤT (RAG) ===',
        contextText || 'Không có ngữ cảnh truy xuất.',
        '',
        '=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY ===',
        historyText || 'Không có.',
        '',
        '=== CÂU HỎI KHÁCH HÀNG ===',
        userQuestion,
        '',
        'Hãy trả lời dựa trên ngữ cảnh ở trên. Nếu thiếu dữ liệu thì nêu rõ phần thiếu, không suy diễn.'
      ].join('\n');

      const result = await this.model.generateContent(prompt);
      const answer = result?.response?.text?.();

      return {
        success: true,
        answer: String(answer || '').trim(),
        source: 'gemini_local_chroma_rag'
      };
    } catch (error) {
      return {
        success: false,
        answer: this._getFallbackResponse(userQuestion, []),
        source: 'fallback',
        error: error.message
      };
    }
  }

  _buildConversationContents({ message, imageBase64, history }) {
    const contents = [];
    const normalizedHistory = Array.isArray(history) ? history : [];

    for (const item of normalizedHistory.slice(-8)) {
      const role = item?.role === 'assistant' || item?.role === 'model' ? 'model' : 'user';
      const text = String(item?.content || '').trim();
      if (!text) {
        continue;
      }
      contents.push({ role, parts: [{ text }] });
    }

    const userParts = [];
    if (message) {
      userParts.push({ text: message });
    }

    const imagePart = this._toInlineImagePart(imageBase64);
    if (imagePart) {
      userParts.push(imagePart);
      userParts.push({
        text: 'Ảnh đã được gửi. Hãy nhận diện sản phẩm và gọi tool search_products ngay lập tức với cụm [Loại thiết bị] + [Thương hiệu].'
      });
    }

    contents.push({ role: 'user', parts: userParts });
    return contents;
  }

  _toInlineImagePart(imageBase64 = '') {
    const raw = String(imageBase64 || '').trim();
    if (!raw) {
      return null;
    }

    const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return null;
    }

    return {
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    };
  }

  async _executeFunctionCall(name, args, context = {}) {
    if (name === 'search_products') {
      return this._toolSearchProducts(args);
    }

    if (name === 'add_to_cart_by_ai') {
      return this._toolAddToCart(args, context);
    }

    return {
      success: false,
      error: `Unsupported tool: ${name}`
    };
  }

  _sanitizeToolKeyword(input = '') {
    return String(input || '')
      .replace(/bộ\s*nguồn\s*liên\s*tục/gi, 'UPS')
      .replace(/schneider\s*electric/gi, '')
      .replace(/bo\s*mạch\s*chủ/gi, 'Mainboard')
      .replace(/bo\s*mach\s*chu/gi, 'Mainboard')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async _toolSearchProducts(args = {}) {
    const limit = Math.max(1, Math.min(Number(args?.limit) || 6, 10));
    const keyword = this._sanitizeToolKeyword(args?.keyword || '');
    if (!keyword) {
      return {
        success: false,
        error: 'keyword is required'
      };
    }

    // Intentionally ignore category/brand from tool arguments.
    // Query only by keyword terms on product name with match-all-words behavior.
    const searchTerms = keyword.trim().split(/\s+/).filter((term) => term.length > 0);
    const andConditions = searchTerms.map((term) => ({
      name: { $regex: term, $options: 'i' }
    }));
    const query = { $and: andConditions };

    const matchedProducts = await Product.find(query)
      .select('_id name description category brand price salePrice image imageUrl images stock')
      .sort({ sold: -1, rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const finalProducts = (Array.isArray(matchedProducts) ? matchedProducts : [])
      .map((item) => this._mapProduct(item));

    this.lastSearchedProducts = finalProducts.slice(0, 10);

    if (finalProducts.length === 0) {
      return JSON.stringify({
        status: 'not_found',
        message: 'Không có sản phẩm này trong kho',
        search_keyword: keyword
      });
    }

    return {
      success: true,
      keyword,
      count: finalProducts.length,
      products: finalProducts
    };
  }

  async _toolAddToCart(args = {}, context = {}) {
    const quantity = Math.max(1, Number(args?.quantity) || 1);
    const sessionId = String(context?.sessionId || '').trim();
    const userId = context?.userId ? String(context.userId).trim() : '';

    let product = null;
    const requestedProductId = String(args?.productId || '').trim();
    const requestedProductName = String(args?.productName || '').trim();

    if (requestedProductId && mongoose.Types.ObjectId.isValid(requestedProductId)) {
      product = await Product.findById(requestedProductId).lean();
    }

    if (!product && requestedProductName) {
      const found = await this._toolSearchProducts({ keyword: requestedProductName, limit: 1 });
      const first = Array.isArray(found?.products) ? found.products[0] : null;
      if (first?.id && mongoose.Types.ObjectId.isValid(first.id)) {
        product = await Product.findById(first.id).lean();
      }
    }

    if (!product) {
      return {
        success: false,
        error: 'Không tìm thấy sản phẩm để thêm vào giỏ hàng.'
      };
    }

    const identifier = mongoose.Types.ObjectId.isValid(userId)
      ? { userId: userId }
      : { sessionId };

    if (!identifier.userId && !identifier.sessionId) {
      return {
        success: false,
        error: 'Thiếu session để thêm vào giỏ hàng.'
      };
    }

    let cart = await Cart.findOne(identifier);
    if (!cart) {
      cart = new Cart({
        ...identifier,
        items: [],
        totalAmount: 0
      });
    }

    const existingIndex = cart.items.findIndex((item) => String(item.product) === String(product._id));
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity
      });
    }

    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((sum, item) => {
      const price = Number(item?.product?.price) || 0;
      return sum + price * (Number(item.quantity) || 0);
    }, 0);

    await cart.save();

    return {
      success: true,
      cartId: String(cart._id),
      totalAmount: Number(cart.totalAmount) || 0,
      totalItems: cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      addedProduct: this._mapProduct(product),
      quantityAdded: quantity
    };
  }

  _mapProduct(item = {}) {
    const id = item?._id?.toString?.() || item?.id || null;
    return {
      id,
      name: item?.name || 'Sản phẩm',
      brand: item?.brand || '',
      category: item?.category || '',
      price: Number(item?.salePrice || item?.price || 0),
      stock: Number(item?.stock || 0),
      imageUrl: item?.imageUrl || item?.image || (Array.isArray(item?.images) ? item.images[0] : null) || null,
      productUrl: id ? `/product/${id}` : null
    };
  }

  _dedupeProducts(products = []) {
    const seen = new Set();
    const output = [];
    for (const item of Array.isArray(products) ? products : []) {
      const key = `${String(item?.id || '').toLowerCase()}::${String(item?.name || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push(item);
      }
    }
    return output;
  }

  _buildPrompt(userMessage, productContext, chatHistory) {
    let prompt = 'Bạn là trợ lý AI thông minh của TechStore. Trả lời bằng tiếng Việt ngắn gọn, chính xác.\n\n';
    if (Array.isArray(productContext) && productContext.length > 0) {
      prompt += 'SẢN PHẨM LIÊN QUAN:\n';
      productContext.slice(0, 6).forEach((product, idx) => {
        prompt += `${idx + 1}. ${product?.name || 'Sản phẩm'} | ${product?.brand || 'N/A'} | Giá: ${this._formatPrice(product?.price)}\n`;
      });
      prompt += '\n';
    }

    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      prompt += 'LỊCH SỬ GẦN ĐÂY:\n';
      chatHistory.slice(-5).forEach((msg) => {
        const role = msg?.role === 'user' ? 'Khách' : 'AI';
        prompt += `${role}: ${msg?.content || ''}\n`;
      });
      prompt += '\n';
    }

    prompt += `CÂU HỎI: ${String(userMessage || '').trim()}`;
    return prompt;
  }

  _formatPrice(price) {
    if (!price || Number.isNaN(Number(price))) {
      return 'Liên hệ';
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(Number(price));
  }

  _getFallbackResponse() {
    return 'Xin lỗi, hệ thống AI đang tạm thời bận. Bạn vui lòng thử lại trong ít giây.';
  }
}

module.exports = new GeminiChatService();
