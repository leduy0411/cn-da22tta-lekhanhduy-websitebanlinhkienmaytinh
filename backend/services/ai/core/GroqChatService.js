/**
 * Groq Chat Service
 * Primary LLM: Groq (Llama 3)
 * Fallback LLM: Gemini (free tier)
 * Includes Circuit Breaker to avoid hammering provider on rate limits/outages
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SemanticSearchService = require('../SemanticSearchService');
const VectorSearchService = require('../rag/VectorSearchService');

const PRODUCT_IMAGE_PLACEHOLDER = 'https://via.placeholder.com/400x400.png?text=TechStore+Chua+Co+Anh';
const IMAGE_CARD_ONLY_REPLY = 'Dạ mời anh/chị xem chi tiết ở các thẻ sản phẩm bên dưới nhé!';
const SALES_CLOSING_LINE = 'Dạ, chi tiết và hình ảnh em đã hiển thị bên dưới ạ.';
const VISION_SYSTEM_PROMPT = `Nhiệm vụ: Bạn là hệ thống trích xuất từ khóa E-commerce thông minh. Hãy nhìn vào ảnh và gọi đích danh món đồ đó.
BẮT BUỘC trả về kết quả bằng TIẾNG VIỆT theo cấu trúc: [Tên loại thiết bị cụ thể] + [Thương hiệu/Model (nếu thấy)].

QUY TẮC TỐI THƯỢNG:
1. KHÔNG GIỚI HẠN DANH MỤC: Nhận diện bất cứ thứ gì trong ảnh (Webcam, Micro, Loa, Cáp sạc, Giá đỡ, Balo laptop, Hub USB...).
2. CẤM DÙNG TỪ CHUNG CHUNG: Tuyệt đối không dùng các từ như 'thiết bị công nghệ', 'đồ điện tử', 'phụ kiện'. Phải gọi đúng tên gốc của món đồ.
3. CẤM LẢM NHẢM: Chỉ trả về DUY NHẤT cụm từ tìm kiếm. Không giải thích, không chấm phẩy.
4. LỌC RÁC: Nếu ảnh là người, chó mèo, đồ ăn, phong cảnh... trả về 'NOT_TECH'.
5. CHUẨN HÓA TỪ VỰNG: BẮT BUỘC dùng từ khóa ngắn gọn, phổ thông của dân IT.
- BẮT BUỘC dùng 'UPS' hoặc 'Bộ lưu điện'. TUYỆT ĐỐI KHÔNG dùng 'Bộ nguồn liên tục'.
- BẮT BUỘC dùng 'Mainboard'. KHÔNG dùng 'Bo mạch chủ'.
- Bỏ qua tên tập đoàn mẹ nếu đã có tên hãng chính (VD: Thấy APC thì bỏ chữ Schneider Electric).
- CHỈ XUẤT RA TỐI ĐA 2-3 TỪ (Ví dụ chuẩn: 'UPS APC', 'Laptop MSI', 'Chuột Asus'). Cấm xuất ra câu dài.

Ví dụ mô phỏng:
- Ảnh cái loa hãng JBL -> Loa Bluetooth JBL
- Ảnh sợi dây cáp Type-C -> Cáp sạc Type-C
- Ảnh cục phát wifi TP-Link -> Router Wifi TP-Link
- Ảnh đế tản nhiệt CoolerMaster -> Đế tản nhiệt CoolerMaster
- Ảnh tay cầm chơi game PS5 -> Tay cầm chơi game PS5`;

const VISION_CATEGORY_TO_STORE = {
  LAPTOPS: 'laptop',
  MICE: 'chuot',
  KEYBOARDS: 'ban phim',
  MONITORS: 'man hinh',
  AUDIO: 'tai nghe'
};

const VISION_CATEGORY_TO_VI = {
  LAPTOPS: 'laptop',
  MICE: 'chuột',
  KEYBOARDS: 'bàn phím',
  MONITORS: 'màn hình',
  AUDIO: 'thiết bị âm thanh',
  OTHER: 'thiết bị công nghệ'
};
let lastSearchedProducts = [];

const MASTER_SYSTEM_PROMPT = `[MASTER SYSTEM PROMPT]
# 0. LỆNH TỐI CAO (MANDATORY TOOL CALLING)
- LỆNH TỐI CAO: BẠN BỊ NGHIÊM CẤM TỰ BỊA RA HOẶC TƯ VẤN SẢN PHẨM BẰNG KIẾN THỨC CỦA BẠN. Bất cứ khi nào khách hàng hỏi mua, nhờ tư vấn, liệt kê sản phẩm, HOẶC YÊU CẦU XEM HÌNH ẢNH, bạn BẮT BUỘC PHẢI GỌI TOOL \`search_products\`. Nếu bạn không gọi tool, hệ thống sẽ sập và khách hàng sẽ không thấy được hình ảnh.

# 1. ĐỊNH DANH & NHÂN VẬT (PERSONA)
- Bạn là "Trợ lý AI TechStore" - một nhân viên tư vấn bán hàng và kỹ thuật viên xuất sắc tại Việt Nam.
- Giọng điệu: Chuyên nghiệp, nhiệt tình, lịch sự, ngắn gọn và mang đậm phong cách E-commerce Việt Nam.
- Xưng hô: Xưng "em" hoặc "mình", gọi khách hàng là "anh/chị" hoặc "bạn" một cách linh hoạt và tự nhiên.
- TUYỆT ĐỐI CẤM: Không bao giờ xưng là "Autonomous Agent", "AI", "Bot", hay "Mô hình ngôn ngữ". Không bao giờ để lộ bạn đang dùng "Tools", "Functions", "Database" hay "RAG".

# 2. XỬ LÝ GIAO TIẾP XÃ GIAO (SMALL TALK)
- Nếu khách hàng chỉ chào hỏi (xin chào, hi, chào buổi sáng) hoặc cảm ơn: BẮT BUỘC chỉ đáp lại tối đa 2 câu thật tự nhiên. 
- Mẫu tham khảo: "Dạ em chào anh/chị ạ! Hôm nay anh/chị cần TechStore tư vấn build PC, mua linh kiện hay hỗ trợ sửa chữa máy tính ạ?"
- NẾU KHÁCH CHỈ CHÀO HỎI (xin chào, hi...): CHỈ ĐƯỢC đáp lại lời chào và hỏi họ cần hỗ trợ gì. TUYỆT ĐỐI CẤM dùng các từ "hình ảnh", "chi tiết bên dưới", "sản phẩm" trong câu trả lời.
- TUYỆT ĐỐI CẤM: Không tự động lôi kịch bản chẩn đoán lỗi ra. Cấm dùng văn phong dịch máy (Ví dụ: Cấm nói "Tại sao tôi có thể giúp bạn hôm nay").

# 3. QUY TẮC SỬ DỤNG CÔNG CỤ (AGENTIC RULES)
- Khi khách HỎI MUA HÀNG (chuột, bàn phím, VGA...): BẮT BUỘC gọi tool \`search_products\`.
- Khi khách HỎI LỖI KỸ THUẬT (máy không lên, màn hình xanh...): BẮT BUỘC gọi tool \`search_technical_knowledge\`.
- NẾU KHÁCH CHỈ CHÀO HỎI BÌNH THƯỜNG: KHÔNG ĐƯỢC GỌI BẤT KỲ TOOL NÀO. Trả lời trực tiếp bằng kiến thức cơ bản của bạn.

# 4. QUY TẮC XỬ LÝ DỮ LIỆU (ANTI-HALLUCINATION)
- Nếu gọi tool sản phẩm mà kết quả trả về RỖNG: Hãy xin lỗi khéo léo và báo tạm hết hàng, hỏi khách có muốn tham khảo mẫu khác không. TUYỆT ĐỐI KHÔNG tự bịa ra sản phẩm không có trong kết quả của tool.
- Nếu tool trả về sản phẩm: Hãy chắt lọc thông tin (Tên, Giá, Điểm nổi bật) và tư vấn một cách hấp dẫn như một người sale thực thụ. Trình bày bằng gạch đầu dòng cho dễ đọc.
- Bám sát tuyệt đối vào dữ liệu tool trả về. Không thêm thắt các tính năng mà sản phẩm không có.

# 5. CẤU TRÚC TRẢ LỜI ĐA Ý ĐỊNH (MULTI-INTENT)
- Nếu khách vừa hỏi lỗi, vừa hỏi mua hàng: Hãy trả lời phần lỗi kỹ thuật trước (ngắn gọn, đưa giải pháp), sau đó mới giới thiệu sản phẩm ở đoạn dưới. Chia bố cục rõ ràng, dễ nhìn.

# 6. QUY TẮC CỐ ĐỊNH CHO PRODUCTION (HARD RULES)
- Bạn là Sale của TechStore. TUYỆT ĐỐI CẤM NÓI XIN LỖI vì không thể gửi ảnh/link. Việc hiển thị ảnh là do UI tự lo, bạn không bị mù.
- Khi tư vấn sản phẩm: Chỉ tóm tắt ngắn gọn và chốt câu: "Dạ, chi tiết và hình ảnh em đã hiển thị bên dưới ạ."
- Nếu khách cố tình đòi xem hình: BẮT BUỘC chỉ đáp đúng 1 câu: "Dạ mời anh/chị xem chi tiết ở các thẻ sản phẩm bên dưới nhé!" (không giải thích thêm).
- TUYỆT ĐỐI CẤM rò rỉ mã code: Không bao giờ được in ra màn hình các thẻ XML như <function>, <tool_call>, mã JSON, hoặc payload tool.
- Chỉ trả lời bằng ngôn ngữ hội thoại tự nhiên, rõ ràng, không dùng markdown ảnh và không in URL trực tiếp.`;

class GroqChatService {
  constructor() {
    this.groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    this.groqVisionModel = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
    this.assetBaseUrl = this.publicBaseUrl.replace(/\/api$/i, '');

    this.geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.geminiModel = null;
    this.geminiFallbackCandidates = [
      this.geminiModelName,
      'gemini-2.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash'
    ];

    // Circuit breaker state
    this.breaker = {
      state: 'CLOSED',
      failureCount: 0,
      failureThreshold: Number(process.env.GROQ_CB_FAILURE_THRESHOLD || 4),
      openTimeoutMs: Number(process.env.GROQ_CB_OPEN_TIMEOUT_MS || 45000),
      nextTryAt: 0
    };

    this.maxRetries = Number(process.env.GROQ_MAX_RETRIES || 1);
    this.retryDelayMs = Number(process.env.GROQ_RETRY_DELAY_MS || 450);
    this.lastProviderError = null;
    this.lastProviderSuccess = null;

    if (this.geminiApiKey) {
      this._initGeminiModel(this.geminiModelName);
    }
  }

  _initGeminiModel(modelName) {
    if (!this.geminiApiKey || !modelName) {
      return false;
    }

    try {
      const gemini = new GoogleGenerativeAI(this.geminiApiKey);
      this.geminiModel = gemini.getGenerativeModel({ model: modelName });
      this.geminiModelName = modelName;
      return true;
    } catch (error) {
      console.error('Gemini fallback init failed:', error.message);
      return false;
    }
  }

  _isGeminiModelNotFoundError(error) {
    const text = String(error?.message || '').toLowerCase();
    return text.includes('404') && (text.includes('model') || text.includes('models/')) && text.includes('not found');
  }

  _nextGeminiCandidate(currentModel) {
    const uniqueCandidates = [];
    const seen = new Set();

    for (const item of this.geminiFallbackCandidates) {
      const normalized = String(item || '').trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      uniqueCandidates.push(normalized);
    }

    for (const candidate of uniqueCandidates) {
      if (candidate !== currentModel) {
        return candidate;
      }
    }

    return null;
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

  _isRetryableGroqError(error) {
    const status = error?.response?.status || error?.status || 0;
    const code = String(error?.code || '').toUpperCase();
    return status === 429 || status >= 500 || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET';
  }

  _recordProviderError(source, error, metadata = {}) {
    const status = error?.response?.status || error?.status || null;
    const code = error?.code || null;
    const providerMessage = error?.response?.data?.error?.message || error?.message || 'unknown_error';

    this.lastProviderError = {
      source,
      message: String(providerMessage),
      status,
      code,
      breakerState: this.breaker.state,
      failureCount: this.breaker.failureCount,
      timestamp: new Date().toISOString(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    };
  }

  _recordProviderSuccess(source, metadata = {}) {
    this.lastProviderSuccess = {
      source,
      breakerState: this.breaker.state,
      timestamp: new Date().toISOString(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    };
  }

  getProviderDiagnostics() {
    return {
      breaker: {
        state: this.breaker.state,
        failureCount: this.breaker.failureCount,
        failureThreshold: this.breaker.failureThreshold,
        openTimeoutMs: this.breaker.openTimeoutMs,
        nextTryAt: this.breaker.nextTryAt || 0
      },
      providers: {
        groqConfigured: Boolean(this.groqApiKey),
        groqModel: this.groqModel,
        geminiConfigured: Boolean(this.geminiModel),
        geminiModel: this.geminiModelName
      },
      lastError: this.lastProviderError,
      lastSuccess: this.lastProviderSuccess,
      timestamp: new Date().toISOString()
    };
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _extractProductsFromFunctionPayload(payloadRaw = '') {
    let parsed;
    try {
      parsed = JSON.parse(String(payloadRaw || '').trim());
    } catch (error) {
      return [];
    }

    const toArray = (value) => (Array.isArray(value) ? value : []);
    const candidates = [];

    if (Array.isArray(parsed)) {
      candidates.push(...parsed);
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.products)) {
        candidates.push(...parsed.products);
      } else if (Array.isArray(parsed.data)) {
        candidates.push(...parsed.data);
      } else if (parsed.product && typeof parsed.product === 'object') {
        candidates.push(parsed.product);
      } else {
        candidates.push(parsed);
      }
    }

    return toArray(candidates)
      .map((item) => ({
        name: String(item?.name || item?.productName || item?.title || '').trim(),
        image: String(item?.image || item?.imageUrl || item?.thumbnail || item?.avatar || '').trim()
      }))
      .filter((item) => item.name && item.image)
      .map((item) => ({
        name: item.name,
        image: this._toAbsoluteImageUrl(item.image)
      }))
      .filter((item) => item.image);
  }

  _postProcessFunctionLeakage(rawText = '') {
    const raw = String(rawText || '');
    if (!raw) {
      return '';
    }

    const functionTagRegex = /<function\s*=\s*search_products\s*>([\s\S]*?)<\/function>/gi;
    const matches = [...raw.matchAll(functionTagRegex)];
    if (matches.length === 0) {
      return raw.trim();
    }

    const products = [];
    for (const match of matches) {
      const payload = match?.[1] || '';
      products.push(...this._extractProductsFromFunctionPayload(payload));
    }

    const uniqueProducts = [];
    const seen = new Set();
    for (const item of products) {
      const key = `${item.name}::${item.image}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProducts.push(item);
      }
    }

    const greetingPrefix = raw
      .replace(functionTagRegex, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (uniqueProducts.length === 0) {
      return greetingPrefix || raw.trim();
    }

    const intro = greetingPrefix || 'Dạ em gửi anh/chị hình ảnh sản phẩm tham khảo:';
    const body = uniqueProducts
      .map((item) => `- ${item.name}\n![${item.name}](${item.image})`)
      .join('\n\n');

    return `${intro}\n\n${body}`.trim();
  }

  _sanitizeResponseText(text = '') {
    const responseText = String(text || '');
    const refusalSignal = /(xin\s*l[oô]i[^\n]{0,140}(kh[oô]ng\s*th[eể]|chua\s*th[eể])\s*(?:ti[eế]p\s*t[uụ]c\s*)?t[iì]m\s*ki[eế]m)|(kh[oô]ng\s*th[eể]\s*t[iì]m\s*th[aấ]y[^\n]{0,120}(ph[uù]\s*h[oợ]p|y[eê]u\s*c[aầ]u))/i;
    const safeRecovery = 'Em chưa đủ dữ liệu để chốt đúng sản phẩm ngay lúc này. Anh/chị cho em thêm ngân sách và loại sản phẩm để em lọc chính xác hơn nhé.';
    const cleanMessage = responseText
      .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, ' ')
      .replace(/<tool_call[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi, ' ')
      .trim();
    let cleanText = cleanMessage.replace(/^(assistant\s*:?\s*)/i, '').trim();
    cleanText = cleanText.replace(/^(Here is the info.*?:\s*)/i, '').trim();
    let cleaned = String(cleanText || '').trim();

    // Guardrail: remove any markdown image hallucination and bare image URLs from model text.
    cleaned = cleaned
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Prevent model from hallucinating inability to show images/links.
    cleaned = cleaned
      .replace(/xin\s*l[oô]i[^.?!\n]*(kh[oô]ng\s*th[eể]|chua\s*th[eể]|kh[oô]ng\s*c[oó]\s*kh[aả]\s*n[aă]ng)[^.?!\n]*(g[uư]i|h[iì]nh|anh|link|url)[^.?!\n]*[.?!]?/gi, '')
      .replace(/m[iì]nh\s*kh[oô]ng\s*th[eể][^.?!\n]*(g[uư]i|h[iì]nh|anh|link|url)[^.?!\n]*[.?!]?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Remove generic dead-end openings so the answer starts with actionable guidance.
    cleaned = cleaned
      .replace(/^\s*Tôi\s+không\s+(?:thể\s+)?tìm\s+thấy\s+thông\s+tin\s+cụ\s+thể[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Mình\s+không\s+(?:thể\s+)?tìm\s+thấy\s+thông\s+tin\s+cụ\s+thể[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Xin\s*lỗi,?\s*nhưng\s*tôi\s*không\s*thể\s*tiếp\s*tục\s*tìm\s*kiếm[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Xin\s*lỗi,?\s*nhưng\s*mình\s*không\s*thể\s*tiếp\s*tục\s*tìm\s*kiếm[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Xin\s*lỗi,?\s*nhưng\s*tôi\s*không\s*thể\s*tìm\s*thấy[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Xin\s*lỗi,?\s*nhưng\s*mình\s*không\s*thể\s*tìm\s*thấy[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Hiện\s+tại\s+tôi\s+chưa\s+có\s+đủ\s+dữ\s+liệu[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Tôi\s+xin\s+lỗi[^.?!]*[.?!]\s*/i, '')
      .trim();

    if (!cleaned && refusalSignal.test(responseText)) {
      return safeRecovery;
    }

    if (refusalSignal.test(cleaned)) {
      return safeRecovery;
    }

    return cleaned || cleanMessage || responseText.trim();
  }

  _normalizeVisionLabel(raw = '') {
    const rawText = String(raw || '').trim();
    if (!rawText) {
      return '';
    }

    let label = rawText
      .replace(/^(assistant\s*:?\s*)/i, '')
      .replace(/^\s*(ten\s*san\s*pham|t[eê]n\s*s[aả]n\s*ph[aẩ]m|product\s*name|s[aả]n\s*ph[aẩ]m)\s*[:\-]\s*/i, '')
      .split(/\r?\n/)[0]
      .replace(/["'`]/g, '')
      .trim();

    label = label
      .replace(/^(day\s*la|đây\s*là|la|là)\s+/i, '')
      .replace(/[.?!]+$/g, '')
      .trim();

    if (!label) {
      return '';
    }

    const compact = label.split(/\s+/).slice(0, 12).join(' ').trim();
    return compact.slice(0, 120);
  }

  _parseVisionStageOutput(raw = '') {
    const text = String(raw || '').trim();
    if (!text) {
      return {
        categoryTag: 'OTHER',
        categoryVi: VISION_CATEGORY_TO_VI.OTHER,
        categoryStore: null,
        brand: '',
        query: '',
        stage5Message: ''
      };
    }

    if (/\bNOT_TECH\b/i.test(text)) {
      return {
        categoryTag: 'OTHER',
        categoryVi: VISION_CATEGORY_TO_VI.OTHER,
        categoryStore: null,
        brand: '',
        query: 'NOT_TECH',
        stage5Message: ''
      };
    }

    const categoryMatches = [...text.matchAll(/\[(LAPTOPS|MICE|KEYBOARDS|MONITORS|AUDIO|OTHER)\]/gi)];
    const hasStructuredStages = /STAGE\s*1/i.test(text) || /STAGE\s*2/i.test(text) || /STAGE\s*3/i.test(text);
    const categoryTag = String(categoryMatches.length > 0
      ? categoryMatches[categoryMatches.length - 1]?.[1]
      : 'OTHER').toUpperCase();

    let query = '';
    if (hasStructuredStages) {
      const stage3Block = text.match(/STAGE\s*3[\s\S]*?(?=STAGE\s*4|$)/i)?.[0] || '';
      const quotedQueryMatch = stage3Block.match(/['"]([^'"\n]{4,160})['"]/);
      const labelledQueryMatch = stage3Block.match(/(?:query|search\s*query)\s*[:\-]\s*([^\n]{3,160})/i);
      query = String(quotedQueryMatch?.[1] || labelledQueryMatch?.[1] || '').trim();
    } else {
      query = this._normalizeVisionLabel(text);
    }

    const stage2Block = text.match(/STAGE\s*2[\s\S]*?(?=STAGE\s*3|$)/i)?.[0] || text;
    const brandMatch = stage2Block.match(/(?:brand|thuong\s*hieu|thương\s*hiệu)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9\-\s]{0,40})/i)
      || stage2Block.match(/\b(Asus|ASUS|Logitech|Razer|MSI|Dell|HP|Lenovo|Acer|Gigabyte|Corsair|Sony|JBL|SteelSeries|HyperX|TP-Link|CoolerMaster)\b/i);
    const brand = String(brandMatch?.[1] || '').trim();

    const stage5Message = hasStructuredStages
      ? String((text.match(/STAGE\s*5[\s\S]*$/i)?.[0] || text).match(/Dạ[^\n]*/i)?.[0] || '').trim()
      : '';

    return {
      categoryTag,
      categoryVi: VISION_CATEGORY_TO_VI[categoryTag] || VISION_CATEGORY_TO_VI.OTHER,
      categoryStore: VISION_CATEGORY_TO_STORE[categoryTag] || null,
      brand,
      query,
      stage5Message
    };
  }

  _buildVisionStage5Message({ recognizedLabel = '', brand = '', categoryVi = '', found = false, stage5Message = '' } = {}) {
    const cleaned = String(stage5Message || '').trim();
    if (cleaned) {
      return cleaned;
    }

    const recognized = String(recognizedLabel || '').trim();
    if (recognized) {
      if (found) {
        return `Dạ, em nhận diện được hình ảnh là ${recognized} và đây là các sản phẩm phù hợp:`;
      }

      return `Dạ, em nhận diện được hình ảnh là ${recognized}, tuy nhiên hiện tại cửa hàng không có sản phẩm này trong kho ạ.`;
    }

    const safeBrand = String(brand || '').trim() || 'một';
    const safeCategory = String(categoryVi || '').trim() || 'sản phẩm công nghệ';

    if (found) {
      return `Dạ, em nhận diện được hình ảnh là một ${safeBrand} ${safeCategory} và đây là các sản phẩm phù hợp:`;
    }

    return `Dạ, em nhận diện được hình ảnh là một ${safeBrand} ${safeCategory}, tuy nhiên hiện tại cửa hàng không có sản phẩm này trong kho ạ.`;
  }

  _setLastSearchedProducts(products = []) {
    lastSearchedProducts = (Array.isArray(products) ? products : []).slice(0, 10);
  }

  _getLastSearchedProducts() {
    return (Array.isArray(lastSearchedProducts) ? lastSearchedProducts : []).slice(0, 10);
  }

  getLastSearchedProducts() {
    return this._getLastSearchedProducts();
  }

  _shouldForceImageCardReply(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /(cho xem hinh|xem hinh|gui hinh|xem anh|hinh anh|anh san pham|show image|show me image)/.test(value);
  }

  _ensureSalesClosingLine(text = '', products = []) {
    const base = String(text || '').trim();
    if (!base) {
      return Array.isArray(products) && products.length > 0 ? SALES_CLOSING_LINE : '';
    }

    if (!Array.isArray(products) || products.length === 0) {
      return base;
    }

    if (base.toLowerCase().includes(SALES_CLOSING_LINE.toLowerCase())) {
      return base;
    }

    return `${base} ${SALES_CLOSING_LINE}`.trim();
  }

  _toAbsoluteImageUrl(rawUrl = '') {
    const value = String(rawUrl || '').trim();
    if (!value) {
      return '';
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (value.startsWith('//')) {
      return `https:${value}`;
    }

    if (value.startsWith('/')) {
      return `${this.assetBaseUrl}${value}`;
    }

    return `${this.assetBaseUrl}/${value}`;
  }

  _normalizeTextForMatch(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _isImageRequest(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /(hinh|anh|image|xem hinh|cho xem hinh|hinh anh|hinh san pham)/.test(value);
  }

  _isProductShoppingIntent(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /(muon mua|can mua|mua|tu van|goi y|de xuat|tham khao|tim san pham|tim pc|tim laptop|tam gia|ngan sach|duoi\s*\d+|tren\s*\d+|bao nhieu tien)/.test(value);
  }

  _isTechnicalSupportIntent(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /(khong len|man hinh xanh|treo may|nong may|qua nhiet|loi wifi|khong ket noi|mat mang|sua loi|khac phuc|chan doan|bao hanh|khong nhan|khong hoat dong|khong sac)/.test(value);
  }

  _isGlobalCatalogIntent(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /(tat ca san pham|toan bo san pham|all products|khong rieng pc|khong chi pc|khong gioi han pc|khong phai chi pc|ca cac san pham khac|tat ca danh muc)/.test(value);
  }

  _sanitizeKeywordForGlobalSearch(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return '';
    }

    return value
      .replace(/\b(pc|desktop|laptop|chuot|mouse|ban phim|keyboard|man hinh|monitor|tai nghe|headphone|ssd|hdd|ram|cpu|vga|gpu)\b/g, ' ')
      .replace(/\b(tat ca san pham|toan bo san pham|all products|khong rieng pc|khong chi pc|khong gioi han pc|khong phai chi pc|ca cac san pham khac|tat ca danh muc)\b/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  _toVndPrice(amountRaw, unitRaw = '') {
    const amount = Number(String(amountRaw || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const unit = String(unitRaw || '').toLowerCase();
    if (/^(ty|ti)$/.test(unit)) {
      return Math.round(amount * 1000000000);
    }
    if (/^(tr|trieu|trieeu|trieeuj|m)$/.test(unit)) {
      return Math.round(amount * 1000000);
    }
    if (/^(k|nghin|ngan)$/.test(unit)) {
      return Math.round(amount * 1000);
    }

    return Math.round(amount);
  }

  _extractPriceConstraintsFromText(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return { min: null, max: null };
    }

    const unitGroup = '(ty|ti|trieu|trieeu|trieeuj|tr|m|k|nghin|ngan)?';
    let min = null;
    let max = null;

    const rangeMatch = value.match(new RegExp(`tu\\s*(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}\\s*(?:den|toi)\\s*(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}`, 'i'));
    if (rangeMatch) {
      const left = this._toVndPrice(rangeMatch[1], rangeMatch[2]);
      const right = this._toVndPrice(rangeMatch[3], rangeMatch[4]);
      if (left !== null && right !== null) {
        min = Math.min(left, right);
        max = Math.max(left, right);
      }
    }

    const minRegex = new RegExp(`(?:tren|hon|tu|toi thieu|it nhat)\\s*(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}`, 'ig');
    let minMatch = minRegex.exec(value);
    while (minMatch) {
      const parsed = this._toVndPrice(minMatch[1], minMatch[2]);
      if (parsed !== null) {
        min = min === null ? parsed : Math.max(min, parsed);
      }
      minMatch = minRegex.exec(value);
    }

    const maxRegex = new RegExp(`(?:duoi|toi da|khong qua|nho hon|it hon)\\s*(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}`, 'ig');
    let maxMatch = maxRegex.exec(value);
    while (maxMatch) {
      const parsed = this._toVndPrice(maxMatch[1], maxMatch[2]);
      if (parsed !== null) {
        max = max === null ? parsed : Math.min(max, parsed);
      }
      maxMatch = maxRegex.exec(value);
    }

    const upwardMatch = value.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}\\s*(?:tro len|len tro len)`, 'i'));
    if (upwardMatch) {
      const parsed = this._toVndPrice(upwardMatch[1], upwardMatch[2]);
      if (parsed !== null) {
        min = min === null ? parsed : Math.max(min, parsed);
      }
    }

    const downwardMatch = value.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitGroup}\\s*(?:tro xuong|do lai)`, 'i'));
    if (downwardMatch) {
      const parsed = this._toVndPrice(downwardMatch[1], downwardMatch[2]);
      if (parsed !== null) {
        max = max === null ? parsed : Math.min(max, parsed);
      }
    }

    if (min !== null && max !== null && min > max) {
      const temp = min;
      min = max;
      max = temp;
    }

    return { min, max };
  }

  _extractFirstMarkdownImage(text = '') {
    const raw = String(text || '');
    const match = raw.match(/!\[[^\]]*\]\(([^)]+)\)/);
    return match ? String(match[1] || '').trim() : '';
  }

  _replaceFirstMarkdownImageUrl(text = '', newUrl = '') {
    const nextUrl = String(newUrl || '').trim();
    if (!nextUrl) {
      return String(text || '');
    }

    return String(text || '').replace(/(!\[[^\]]*\]\()([^)]+)(\))/, `$1${nextUrl}$3`);
  }

  _inferProductCategoryFromText(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return '';
    }

    const rules = [
      { category: 'Tai nghe', pattern: /tai nghe|headphone|earphone|earbuds/ },
      { category: 'Laptop', pattern: /laptop|notebook|macbook/ },
      { category: 'Chuột', pattern: /chuot|mouse/ },
      { category: 'Bàn phím', pattern: /ban phim|keyboard/ },
      { category: 'Màn hình', pattern: /man hinh|monitor/ },
      { category: 'Card đồ họa', pattern: /vga|gpu|card do hoa/ }
    ];

    const matched = rules.find((item) => item.pattern.test(value));
    return matched ? matched.category : '';
  }

  _extractProductHintFromAnswer(text = '') {
    const value = String(text || '');
    const directMatch = value.match(/hinh\s*anh\s*cua\s*([^\n:.!?]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1].trim();
    }

    const markdownAlt = value.match(/!\[([^\]]+)\]/);
    if (markdownAlt && markdownAlt[1]) {
      return markdownAlt[1].trim();
    }

    return '';
  }

  async _enrichImageAnswer({ finalText = '', userMessage = '', aggregatedProducts = [] }) {
    const products = Array.isArray(aggregatedProducts) ? [...aggregatedProducts] : [];
    if (!this._isImageRequest(userMessage)) {
      return {
        text: finalText,
        products
      };
    }

    if (products.length === 0) {
      const categoryHint = this._inferProductCategoryFromText(`${userMessage} ${finalText}`);
      const answerHint = this._extractProductHintFromAnswer(finalText);

      try {
        const fallbackByKeyword = await this._executeAgentTool('search_products', {
          keywords: userMessage,
          sort_by: 'relevance'
        });

        if (Array.isArray(fallbackByKeyword?.data) && fallbackByKeyword.data.length > 0) {
          products.push(...fallbackByKeyword.data);
        }

        if (products.length === 0 && answerHint) {
          const fallbackByAnswerHint = await this._executeAgentTool('search_products', {
            keywords: answerHint,
            category: categoryHint || undefined,
            sort_by: 'relevance'
          });

          if (Array.isArray(fallbackByAnswerHint?.data) && fallbackByAnswerHint.data.length > 0) {
            products.push(...fallbackByAnswerHint.data);
          }
        }

        if (products.length === 0 && categoryHint) {
          const fallbackByCategory = await this._executeAgentTool('search_products', {
            category: categoryHint,
            sort_by: 'relevance'
          });

          if (Array.isArray(fallbackByCategory?.data) && fallbackByCategory.data.length > 0) {
            products.push(...fallbackByCategory.data);
          }
        }
      } catch (error) {
        // Keep the original response if fallback enrichment fails.
      }
    }

    const productWithImage = products.find((p) => p?.imageUrl || p?.image);
    const firstImageUrl = productWithImage?.imageUrl || productWithImage?.image || '';
    if (!firstImageUrl) {
      return {
        text: finalText,
        products
      };
    }

    const existingMarkdownImageUrl = this._extractFirstMarkdownImage(finalText);
    if (existingMarkdownImageUrl) {
      return {
        text: this._replaceFirstMarkdownImageUrl(finalText, firstImageUrl),
        products
      };
    }

    return {
      text: `${String(finalText || '').trim()}\n\n![Hinh anh san pham](${firstImageUrl})`,
      products
    };
  }

  _isUnrelatedRefusal(text = '') {
    const value = this._normalizeTextForMatch(text);
    if (!value) {
      return false;
    }

    return /khong the tra loi|toi khong the tra loi|khong the ho tro|noi dung khong phu hop|moi quan he tinh cam|nguoi lon va tre em|sexual|explicit/.test(
      value
    );
  }

  _compactMessagesForGroq(messages = [], options = {}) {
    const maxChars = Number(options.maxChars || process.env.GROQ_TOOLCALL_MAX_CHARS || 12000);
    const maxPerMessageChars = Number(options.maxPerMessageChars || process.env.GROQ_TOOLCALL_MAX_PER_MESSAGE_CHARS || 1200);
    const safeMessages = Array.isArray(messages) ? messages : [];

    if (safeMessages.length === 0) {
      return [];
    }

    const normalize = (item) => {
      const role = item?.role === 'assistant' || item?.role === 'tool' || item?.role === 'system' ? item.role : 'user';
      const rawContent = typeof item?.content === 'string' ? item.content : '';
      const compactContent = rawContent.length > maxPerMessageChars
        ? `${rawContent.slice(0, maxPerMessageChars)} ...[truncated]`
        : rawContent;

      const normalized = {
        role,
        content: compactContent
      };

      if (Array.isArray(item?.tool_calls) && item.tool_calls.length > 0) {
        normalized.tool_calls = item.tool_calls;
      }
      if (item?.tool_call_id) {
        normalized.tool_call_id = item.tool_call_id;
      }
      if (item?.name) {
        normalized.name = item.name;
      }

      return normalized;
    };

    const head = safeMessages[0]?.role === 'system' ? [normalize(safeMessages[0])] : [];
    const tailSource = safeMessages.slice(head.length).map(normalize);
    const selectedTail = [];
    let used = head.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);

    for (let i = tailSource.length - 1; i >= 0; i -= 1) {
      const candidate = tailSource[i];
      const size = candidate.content?.length || 0;

      if (selectedTail.length === 0 || used + size <= maxChars) {
        selectedTail.unshift(candidate);
        used += size;
      }

      if (used >= maxChars) {
        break;
      }
    }

    return [...head, ...selectedTail];
  }

  async _callGroq(messages, options = {}) {
    if (!this._canUseGroq()) {
      const circuitError = new Error('Groq circuit is OPEN or API key missing');
      this._recordProviderError('groq_chat', circuitError, {
        stage: 'preflight',
        reason: 'circuit_or_key'
      });
      throw circuitError;
    }

    let lastError = null;
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const compactedMessages = this._compactMessagesForGroq(messages, {
          maxChars: process.env.GROQ_CHAT_MAX_CHARS || 10000,
          maxPerMessageChars: process.env.GROQ_CHAT_MAX_PER_MESSAGE_CHARS || 1000
        });

        const response = await axios.post(
          `${this.groqBaseUrl}/chat/completions`,
          {
            model: options.model || this.groqModel,
            temperature: options.temperature ?? 0.2,
            max_tokens: Math.min(options.maxTokens ?? 900, Number(process.env.GROQ_CHAT_MAX_OUTPUT_TOKENS || 512)),
            messages: compactedMessages
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
        this._recordProviderSuccess('groq_chat', {
          model: options.model || this.groqModel
        });
        return {
          provider: 'groq',
          model: options.model || this.groqModel,
          text: this._sanitizeResponseText(text)
        };
      } catch (error) {
        lastError = error;
        this._onGroqFailure(error);
        this._recordProviderError('groq_chat', error, {
          stage: 'request',
          attempt,
          maxAttempts
        });

        const shouldRetry = attempt < maxAttempts && this._isRetryableGroqError(error);
        if (!shouldRetry) {
          break;
        }

        await this._sleep(this.retryDelayMs * attempt);
      }
    }

    const status = lastError?.response?.status || lastError?.status;
    const providerMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Groq request failed';
    const enriched = new Error(`Groq request failed${status ? ` (${status})` : ''}: ${providerMessage}`);
    enriched.status = status;
    this._recordProviderError('groq_chat', enriched, {
      stage: 'final',
      maxAttempts
    });
    throw enriched;
  }

  async _callGeminiFallback(prompt, options = {}) {
    if (!this.geminiModel) {
      const missingGemini = new Error('Gemini fallback is not configured');
      this._recordProviderError('gemini_fallback', missingGemini, {
        stage: 'preflight',
        reason: 'missing_model'
      });
      throw missingGemini;
    }

    try {
      const result = await this.geminiModel.generateContent(prompt);
      const text = result?.response?.text?.()?.trim();

      if (!text) {
        throw new Error('Gemini fallback returned empty response');
      }

      this._recordProviderSuccess('gemini_fallback', {
        model: this.geminiModelName,
        maxTokens: options.maxTokens || null
      });

      return {
        provider: 'gemini-fallback',
        model: this.geminiModelName,
        text: this._sanitizeResponseText(this._sanitizeFallbackPrefix(text))
      };
    } catch (error) {
      if (this._isGeminiModelNotFoundError(error)) {
        const candidate = this._nextGeminiCandidate(this.geminiModelName);
        if (candidate && this._initGeminiModel(candidate)) {
          try {
            const retryResult = await this.geminiModel.generateContent(prompt);
            const retryText = retryResult?.response?.text?.()?.trim();
            if (!retryText) {
              throw new Error('Gemini fallback returned empty response after model switch');
            }

            this._recordProviderSuccess('gemini_fallback', {
              model: this.geminiModelName,
              switchedFromModelNotFound: true,
              maxTokens: options.maxTokens || null
            });

            return {
              provider: 'gemini-fallback',
              model: this.geminiModelName,
              text: this._sanitizeResponseText(this._sanitizeFallbackPrefix(retryText))
            };
          } catch (retryError) {
            this._recordProviderError('gemini_fallback', retryError, {
              stage: 'request_retry_after_model_switch',
              switchedTo: this.geminiModelName
            });
            throw retryError;
          }
        }
      }

      this._recordProviderError('gemini_fallback', error, {
        stage: 'request'
      });
      throw error;
    }
  }

  async _callGroqWithTools(messages, options = {}) {
    if (!this._canUseGroq()) {
      const circuitError = new Error('Groq circuit is OPEN or API key missing');
      this._recordProviderError('groq_tool_call', circuitError, {
        stage: 'preflight',
        reason: 'circuit_or_key'
      });
      throw circuitError;
    }

    let lastError = null;
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const compactedMessages = this._compactMessagesForGroq(messages, {
          maxChars: process.env.GROQ_TOOLCALL_MAX_CHARS || 12000,
          maxPerMessageChars: process.env.GROQ_TOOLCALL_MAX_PER_MESSAGE_CHARS || 1200
        });

        const response = await axios.post(
          `${this.groqBaseUrl}/chat/completions`,
          {
            model: options.model || this.groqModel,
            temperature: options.temperature ?? 0.2,
            max_tokens: Math.min(options.maxTokens ?? 900, Number(process.env.GROQ_TOOLCALL_MAX_OUTPUT_TOKENS || 512)),
            messages: compactedMessages,
            tools: options.tools,
            tool_choice: options.toolChoice || 'auto'
          },
          {
            timeout: options.timeoutMs || 20000,
            headers: {
              Authorization: `Bearer ${this.groqApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        this._onGroqSuccess();
        this._recordProviderSuccess('groq_tool_call', {
          model: options.model || this.groqModel
        });
        return {
          provider: 'groq',
          model: options.model || this.groqModel,
          raw: response?.data || {}
        };
      } catch (error) {
        lastError = error;
        this._onGroqFailure(error);
        this._recordProviderError('groq_tool_call', error, {
          stage: 'request',
          attempt,
          maxAttempts
        });

        const shouldRetry = attempt < maxAttempts && this._isRetryableGroqError(error);
        if (!shouldRetry) {
          break;
        }

        await this._sleep(this.retryDelayMs * attempt);
      }
    }

    const status = lastError?.response?.status || lastError?.status;
    const providerMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Groq request failed';
    const enriched = new Error(`Groq tool-call request failed${status ? ` (${status})` : ''}: ${providerMessage}`);
    enriched.status = status;
    this._recordProviderError('groq_tool_call', enriched, {
      stage: 'final',
      maxAttempts
    });
    throw enriched;
  }

  async _callGroqVision(messages, options = {}) {
    if (!this._canUseGroq()) {
      const circuitError = new Error('Groq circuit is OPEN or API key missing');
      this._recordProviderError('groq_vision', circuitError, {
        stage: 'preflight',
        reason: 'circuit_or_key'
      });
      throw circuitError;
    }

    let lastError = null;
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await axios.post(
          `${this.groqBaseUrl}/chat/completions`,
          {
            model: options.model || this.groqVisionModel,
            temperature: options.temperature ?? 0,
            max_tokens: Math.min(options.maxTokens ?? 80, Number(process.env.GROQ_VISION_MAX_OUTPUT_TOKENS || 80)),
            messages
          },
          {
            timeout: options.timeoutMs || 20000,
            headers: {
              Authorization: `Bearer ${this.groqApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const text = response?.data?.choices?.[0]?.message?.content?.trim();
        if (!text) {
          throw new Error('Groq vision returned empty response');
        }

        this._onGroqSuccess();
        this._recordProviderSuccess('groq_vision', {
          model: options.model || this.groqVisionModel
        });
        return {
          provider: 'groq-vision',
          model: options.model || this.groqVisionModel,
          text
        };
      } catch (error) {
        lastError = error;
        this._onGroqFailure(error);
        this._recordProviderError('groq_vision', error, {
          stage: 'request',
          attempt,
          maxAttempts
        });

        const shouldRetry = attempt < maxAttempts && this._isRetryableGroqError(error);
        if (!shouldRetry) {
          break;
        }

        await this._sleep(this.retryDelayMs * attempt);
      }
    }

    const status = lastError?.response?.status || lastError?.status;
    const providerMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Groq vision request failed';
    const enriched = new Error(`Groq vision request failed${status ? ` (${status})` : ''}: ${providerMessage}`);
    enriched.status = status;
    this._recordProviderError('groq_vision', enriched, {
      stage: 'final',
      maxAttempts
    });
    throw enriched;
  }

  async _runAgentFallbackWithoutGroq({ userMessage = '', aggregatedProducts = [], aggregatedSources = [], toolTrace = [], reason = '' } = {}) {
    const products = Array.isArray(aggregatedProducts) ? [...aggregatedProducts] : [];
    const sources = Array.isArray(aggregatedSources) ? [...aggregatedSources] : [];
    const trace = Array.isArray(toolTrace) ? [...toolTrace] : [];

    if (products.length === 0 && this._isProductShoppingIntent(userMessage)) {
      try {
        const productTool = await this._executeAgentTool('search_products', {
          keywords: userMessage,
          sort_by: 'relevance'
        });

        if (Array.isArray(productTool?.data) && productTool.data.length > 0) {
          products.push(...productTool.data);
        }

        trace.push({
          name: 'search_products',
          args: { keywords: userMessage, sort_by: 'relevance', failoverMode: true },
          total: productTool?.total || 0,
          found: Boolean(productTool?.found)
        });
      } catch (error) {
        trace.push({
          name: 'search_products',
          args: { keywords: userMessage, sort_by: 'relevance', failoverMode: true },
          total: 0,
          found: false
        });
      }
    }

    if (sources.length === 0 && this._isTechnicalSupportIntent(userMessage)) {
      try {
        const technicalTool = await this._executeAgentTool('search_technical_knowledge', {
          topic: userMessage,
          error_symptoms: userMessage
        });

        if (Array.isArray(technicalTool?.data) && technicalTool.data.length > 0) {
          sources.push(...technicalTool.data);
        }

        trace.push({
          name: 'search_technical_knowledge',
          args: { topic: userMessage, error_symptoms: userMessage, failoverMode: true },
          total: technicalTool?.total || 0,
          found: Boolean(technicalTool?.found)
        });
      } catch (error) {
        trace.push({
          name: 'search_technical_knowledge',
          args: { topic: userMessage, error_symptoms: userMessage, failoverMode: true },
          total: 0,
          found: false
        });
      }
    }

    const topProducts = products.slice(0, 10);
    const topSources = sources.slice(0, 6);
    if (topProducts.length > 0) {
      this._setLastSearchedProducts(topProducts);
    }

    const fallbackPrompt = [
      'Bạn là Trợ lý AI TechStore. Trả lời bằng tiếng Việt, ngắn gọn, tự nhiên, tuyệt đối không nhắc đến lỗi hệ thống nội bộ.',
      `Yêu cầu người dùng: ${String(userMessage || '').trim()}`,
      `Lý do failover: ${String(reason || 'provider_unavailable').slice(0, 250)}`,
      `Dữ liệu sản phẩm (JSON): ${JSON.stringify(topProducts)}`,
      `Dữ liệu kỹ thuật (JSON): ${JSON.stringify(topSources)}`,
      'Chỉ dùng dữ liệu ở trên. Nếu dữ liệu ít, hãy hỏi lại nhu cầu chi tiết hơn để lọc chính xác.'
    ].join('\n\n');

    try {
      const fallbackByGemini = await this._callGeminiFallback(fallbackPrompt, {
        maxTokens: 420
      });

      const finalText = this._ensureSalesClosingLine(fallbackByGemini.text, topProducts);
      return {
        provider: fallbackByGemini.provider,
        model: fallbackByGemini.model,
        text: this._sanitizeResponseText(finalText),
        products: topProducts,
        sources: topSources,
        toolTrace: trace
      };
    } catch (fallbackError) {
      const bulletProducts = topProducts
        .slice(0, 4)
        .map((item) => {
          const price = Number(item?.price || 0);
          const priceText = Number.isFinite(price) && price > 0 ? `: ${price.toLocaleString('vi-VN')} VND` : '';
          return `- ${item?.name || 'Sản phẩm'}${priceText}`;
        })
        .join('\n');

      const localText = topProducts.length > 0
        ? `Em gửi nhanh vài gợi ý phù hợp để anh/chị tham khảo:\n\n${bulletProducts}`
        : 'Em chưa đủ dữ liệu để chốt đúng sản phẩm ngay lúc này. Anh/chị cho em thêm ngân sách và loại sản phẩm để em lọc chính xác hơn nhé.';

      return {
        provider: 'agent-fallback-local',
        model: 'rule-based',
        text: this._sanitizeResponseText(localText),
        products: topProducts,
        sources: topSources,
        toolTrace: trace
      };
    }
  }

  async _classifyImageWithVision(imageBase64 = '') {
    const encodedImage = String(imageBase64 || '').trim();
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(encodedImage)) {
      throw new Error('Invalid image payload for vision classification');
    }

    const visionMessages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${VISION_SYSTEM_PROMPT}\n\nAnalyze this image now and follow STAGE 1 to STAGE 5 exactly.`
          },
          {
            type: 'image_url',
            image_url: {
              url: encodedImage
            }
          }
        ]
      }
    ];

    const visionResult = await this._callGroqVision(visionMessages, {
      model: this.groqVisionModel,
      temperature: 0,
      maxTokens: 600,
      timeoutMs: 20000
    });

    const normalized = String(visionResult?.text || '').trim();
    const parsed = this._parseVisionStageOutput(normalized);
    const normalizedLabel = parsed.query || this._normalizeVisionLabel(normalized);
    const inferredNotTech = !normalizedLabel && parsed.categoryTag === 'OTHER';

    return {
      notTech: inferredNotTech,
      label: normalizedLabel,
      category: parsed.categoryStore,
      categoryTag: parsed.categoryTag,
      categoryVi: parsed.categoryVi,
      brand: parsed.brand,
      stage5Message: parsed.stage5Message,
      provider: visionResult.provider,
      model: visionResult.model
    };
  }

  _getAgentTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'search_products',
          description: 'Công cụ tìm kiếm sản phẩm trong Database. BẮT BUỘC PHẢI GỌI công cụ này mỗi khi người dùng có ý định hỏi về sản phẩm, nhờ tư vấn, tìm kiếm đồ công nghệ, hoặc KHI NGƯỜI DÙNG YÊU CẦU XEM HÌNH ẢNH.',
          parameters: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Danh muc san pham can tim, vi du: laptop, chuot, ban phim, man hinh.'
              },
              keywords: {
                type: 'string',
                description: 'Tu khoa tim kiem tu do theo nhu cau nguoi dung, co the gom model, thuong hieu, dac diem.'
              },
              min_price: {
                type: 'number',
                description: 'Gia toi thieu theo VND, de trong neu khong co rang buoc.'
              },
              max_price: {
                type: 'number',
                description: 'Gia toi da theo VND, de trong neu khong co rang buoc.'
              },
              sort_by: {
                type: 'string',
                enum: ['relevance', 'price_asc', 'price_desc', 'rating_desc', 'newest'],
                description: 'Thu tu sap xep ket qua san pham.'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_technical_knowledge',
          description: 'Luc tim tai lieu ky thuat, sua chua, bao hanh tu vector database (RAG Markdown). Dung tool nay khi can huong dan chan doan, cach khac phuc loi, quy trinh bao hanh.',
          parameters: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Chu de ky thuat chinh can tra cuu, vi du: ket noi wifi, qua nhiet laptop, loi pin.'
              },
              error_symptoms: {
                type: 'string',
                description: 'Mo ta trieu chung loi cu the ma nguoi dung gap phai de tim tai lieu sat nhat.'
              }
            },
            required: []
          }
        }
      }
    ];
  }

  async _executeAgentTool(toolName, args = {}) {
    if (toolName === 'search_products') {
      const rawKeywords = String(args.keywords || '').trim();
      const explicitCategory = String(args.category || '').trim();
      const globalCatalogIntent = this._isGlobalCatalogIntent(`${rawKeywords} ${explicitCategory}`);
      const normalizedKeywords = globalCatalogIntent
        ? this._sanitizeKeywordForGlobalSearch(rawKeywords)
        : rawKeywords;
      const categoryValue = globalCatalogIntent ? null : (explicitCategory || null);
      const keywordParts = [normalizedKeywords, categoryValue].filter(Boolean).join(' ').trim();
      const inferredBudget = this._extractPriceConstraintsFromText(keywordParts);
      const explicitMin = Number.isFinite(Number(args.min_price)) ? Number(args.min_price) : null;
      const explicitMax = Number.isFinite(Number(args.max_price)) ? Number(args.max_price) : null;
      const minPrice = explicitMin ?? inferredBudget.min;
      const maxPrice = explicitMax ?? inferredBudget.max;
      const filters = {
        category: categoryValue,
        price_min: minPrice,
        price_max: maxPrice
      };

      const searchResult = await SemanticSearchService.searchProducts({
        keyword: keywordParts,
        filters,
        limit: 10
      });

      const products = Array.isArray(searchResult?.products) ? [...searchResult.products] : [];
      const normalizePrice = (p) => Number(p?.salePrice || p?.price || Number.MAX_SAFE_INTEGER);

      const strictPriceProducts = products.filter((p) => {
        const price = Number(p?.salePrice || p?.price || NaN);
        if (!Number.isFinite(price) || price <= 0) {
          return false;
        }
        if (minPrice !== null && price < Number(minPrice)) {
          return false;
        }
        if (maxPrice !== null && price > Number(maxPrice)) {
          return false;
        }
        return true;
      });

      const effectiveProducts = (minPrice !== null || maxPrice !== null)
        ? strictPriceProducts
        : products;

      switch (args.sort_by) {
        case 'price_asc':
          effectiveProducts.sort((a, b) => normalizePrice(a) - normalizePrice(b));
          break;
        case 'price_desc':
          effectiveProducts.sort((a, b) => normalizePrice(b) - normalizePrice(a));
          break;
        case 'rating_desc':
          effectiveProducts.sort((a, b) => Number(b?.rating || 0) - Number(a?.rating || 0));
          break;
        case 'newest':
          effectiveProducts.sort((a, b) => Number(new Date(b?.createdAt || 0)) - Number(new Date(a?.createdAt || 0)));
          break;
        default:
          break;
      }

      const sanitizedProducts = effectiveProducts.slice(0, 10).map((p) => {
        const rawImage = p?.image || p?.imageUrl || p?.thumbnail || p?.hinh_anh || p?.images?.[0] || '';
        const normalizedImage = this._toAbsoluteImageUrl(rawImage);
        const image = /^https?:\/\//i.test(normalizedImage) ? normalizedImage : PRODUCT_IMAGE_PLACEHOLDER;

        return {
          id: p?._id,
          name: p?.name,
          category: p?.category,
          brand: p?.brand,
          price: p?.salePrice || p?.price || null,
          description: p?.description || '',
          image,
          imageUrl: image,
          productUrl: p?._id ? `/product/${p._id}` : '',
          rating: p?.rating || 0,
          stock: p?.stock ?? null
        };
      });

      if (sanitizedProducts.length > 0) {
        this._setLastSearchedProducts(sanitizedProducts);
      }

      return {
        tool: 'search_products',
        found: sanitizedProducts.length > 0,
        total: sanitizedProducts.length,
        data: sanitizedProducts,
        note: sanitizedProducts.length > 0 ? 'Product search completed.' : 'No products found.'
      };
    }

    if (toolName === 'search_technical_knowledge') {
      const query = [args.topic, args.error_symptoms].filter(Boolean).join(' | ').trim();
      const docs = query
        ? await VectorSearchService.search(query, { limit: 6, minSimilarity: 0.2 })
        : [];

      const normalizedDocs = (Array.isArray(docs) ? docs : []).slice(0, 6).map((d) => ({
        source: d?.source || 'N/A',
        category: d?.category || 'N/A',
        similarity: d?.similarity || d?.finalScore || 0,
        snippet: String(d?.text || '').slice(0, 500)
      }));

      return {
        tool: 'search_technical_knowledge',
        found: normalizedDocs.length > 0,
        total: normalizedDocs.length,
        data: normalizedDocs,
        note: normalizedDocs.length > 0 ? 'Knowledge search completed.' : 'No technical knowledge found.'
      };
    }

    return {
      tool: toolName,
      found: false,
      total: 0,
      data: [],
      note: `Unknown tool: ${toolName}`
    };
  }

  async chatWithAgent(userMessage, conversationHistory = [], options = {}) {
    const trimmedUserMessage = String(userMessage || '').trim();
    const imageBase64 = typeof options?.imageBase64 === 'string' ? options.imageBase64.trim() : '';
    console.log('Image Base64 Received:', !!imageBase64);
    const cleanFinalText = (value = '') => this._sanitizeResponseText(value);
    let effectiveUserMessage = trimmedUserMessage;
    let visionTrace = null;
    let visionQuery = '';

    if (imageBase64) {
      console.log('--> Đang gọi model Vision...');
      try {
        const visionMessages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${VISION_SYSTEM_PROMPT}\n\nAnalyze this image now and follow STAGE 1 to STAGE 5 exactly.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ];

        let visionResult;
        try {
          visionResult = await this._callGroqVision(visionMessages, {
            model: 'llama-3.2-11b-vision-preview',
            temperature: 0,
            maxTokens: 600,
            timeoutMs: 20000
          });
        } catch (visionModelError) {
          const shouldFallbackVisionModel = /decommissioned|not supported|model/i.test(String(visionModelError?.message || ''));
          if (!shouldFallbackVisionModel || !this.groqVisionModel || this.groqVisionModel === 'llama-3.2-11b-vision-preview') {
            throw visionModelError;
          }

          visionResult = await this._callGroqVision(visionMessages, {
            model: this.groqVisionModel,
            temperature: 0,
            maxTokens: 600,
            timeoutMs: 20000
          });
        }

        const visionRaw = String(visionResult?.text || '').trim();
        const parsedVision = this._parseVisionStageOutput(visionRaw);
        visionQuery = parsedVision.query || this._normalizeVisionLabel(visionRaw);
        console.log('--> Kết quả Vision:', visionQuery || '[empty]');

        const visionQueryText = String(visionQuery || '').trim();
        let finalVisionQuery = visionQueryText.toLowerCase();
        finalVisionQuery = finalVisionQuery.replace(/bộ nguồn liên tục/g, 'ups');
        finalVisionQuery = finalVisionQuery.replace(/schneider electric/g, '');
        finalVisionQuery = finalVisionQuery.replace(/bo mạch chủ/g, 'mainboard');
        finalVisionQuery = finalVisionQuery.replace(/\s{2,}/g, ' ').trim();
        console.log('=== TỪ KHÓA ĐÃ LỌC ĐỂ SEARCH DB ===> ', finalVisionQuery);

        if (finalVisionQuery) {
          visionQuery = finalVisionQuery;
        }

        visionTrace = {
          name: 'vision_classification',
          raw: visionRaw,
          label: visionQuery,
          categoryTag: parsedVision.categoryTag,
          category: parsedVision.categoryStore,
          brand: parsedVision.brand,
          stage5Message: parsedVision.stage5Message,
          notTech: !visionQuery && parsedVision.categoryTag === 'OTHER'
        };

        if ((!visionQuery || visionQuery.toUpperCase() === 'NOT_TECH') && parsedVision.categoryTag === 'OTHER') {
          return {
            provider: visionResult?.provider || 'groq-vision',
            model: visionResult?.model || 'llama-3.2-11b-vision-preview',
            text: cleanFinalText('Dạ, hình ảnh này có vẻ không phải là sản phẩm công nghệ bên em đang kinh doanh ạ.'),
            products: [],
            sources: [],
            toolTrace: [visionTrace]
          };
        }

        const directSearch = await this._executeAgentTool('search_products', {
          category: parsedVision.categoryStore || undefined,
          keywords: visionQuery,
          sort_by: 'relevance'
        });

        const directProducts = Array.isArray(directSearch?.data)
          ? directSearch.data.slice(0, 10)
          : [];

        if (directProducts.length > 0) {
          this._setLastSearchedProducts(directProducts);
        }

        const stage5Reply = this._buildVisionStage5Message({
          recognizedLabel: visionQuery,
          brand: parsedVision.brand,
          categoryVi: parsedVision.categoryVi,
          found: directProducts.length > 0,
          stage5Message: parsedVision.stage5Message
        });

        return {
          provider: 'vision-db-bypass',
          model: visionResult?.model || 'llama-3.2-11b-vision-preview',
          text: cleanFinalText(stage5Reply),
          products: directProducts,
          sources: [],
          toolTrace: [
            visionTrace,
            {
              name: 'search_products',
              args: {
                category: parsedVision.categoryStore || undefined,
                keywords: visionQuery,
                sort_by: 'relevance',
                bypassLLM: true
              },
              total: directProducts.length,
              found: directProducts.length > 0
            }
          ]
        };
      } catch (visionError) {
        console.error('--> Vision step failed:', visionError?.message || 'unknown_error');
        visionTrace = {
          name: 'vision_classification',
          failed: true,
          reason: visionError?.message || 'unknown_error'
        };

        return {
          provider: 'groq-vision',
          model: 'llama-3.2-11b-vision-preview',
          text: cleanFinalText('Em chưa phân tích được ảnh ở lần này. Anh/chị thử gửi lại ảnh rõ hơn giúp em nhé.'),
          products: [],
          sources: [],
          toolTrace: [visionTrace]
        };
      }
    }

    // Bắt các câu đòi xem ảnh
    const isAskingForImage = /^(có hình không|đâu|hình đâu|cho xem hình|xem ảnh|hình ảnh đâu|đâu rồi|xem hình)$/i.test(effectiveUserMessage.trim());

    if (isAskingForImage) {
      if (typeof lastSearchedProducts !== 'undefined' && lastSearchedProducts.length > 0) {
        // TRẢ VỀ LUÔN, KHÔNG GỌI GROQ API ĐỂ TRÁNH LỖI!
        return {
          text: cleanFinalText('Dạ, hình ảnh và thông tin chi tiết các sản phẩm anh/chị vừa hỏi đây ạ!'),
          products: lastSearchedProducts
        };
      }

      return {
        text: cleanFinalText('Dạ anh/chị muốn tìm sản phẩm nào ạ? Em sẽ hiển thị hình ảnh ngay cho anh/chị xem.'),
        products: []
      };
    }

    const isSmallTalk = /^(xin chào|chào|hi|hello|alo|dạ|vâng|cảm ơn|bye)$/i.test(effectiveUserMessage);
    if (isSmallTalk) {
      lastSearchedProducts = [];
    }

    const tools = this._getAgentTools();
    const boundedHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .filter((item) => item && typeof item.content === 'string')
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').trim()
      }))
      .filter((item) => item.content);

    const shouldIsolateImageContext = false;
    const normalizedHistory = shouldIsolateImageContext ? [] : boundedHistory;
    const step2VisionSystemPrompt = shouldIsolateImageContext
      ? `Hệ thống Vision vừa nhận diện khách hàng muốn tìm: ${effectiveUserMessage}. LỆNH ÉP BUỘC: Bạn phải gọi tool search_products ngay lập tức với từ khóa này. TUYỆT ĐỐI KHÔNG chào hỏi, KHÔNG yêu cầu khách hàng cung cấp thêm chi tiết.`
      : '';
    const finalUserInstruction = shouldIsolateImageContext
      ? `User vừa upload một hình ảnh. BẮT BUỘC gọi tool search_products ngay lập tức để tìm kiếm sản phẩm phù hợp, không được dùng lịch sử cũ.`
      : effectiveUserMessage;
    const step2ToolChoice = shouldIsolateImageContext
      ? 'required'
      : 'auto';

    const messages = [
      {
        role: 'system',
        content: MASTER_SYSTEM_PROMPT
      },
      ...(step2VisionSystemPrompt ? [{ role: 'system', content: step2VisionSystemPrompt }] : []),
      ...normalizedHistory,
      {
        role: 'user',
        content: finalUserInstruction
      }
    ];

    const aggregatedProducts = [];
    const aggregatedSources = [];
    const toolTrace = visionTrace ? [visionTrace] : [];
    const maxIterations = Number(process.env.AGENT_MAX_ITERATIONS || 6);

    for (let step = 1; step <= maxIterations; step += 1) {
      let turn;
      try {
        turn = await this._callGroqWithTools(messages, {
          tools,
          temperature: 0.2,
          maxTokens: 900,
          toolChoice: step2ToolChoice
        });
      } catch (groqToolError) {
        return this._runAgentFallbackWithoutGroq({
          userMessage: effectiveUserMessage,
          aggregatedProducts,
          aggregatedSources,
          toolTrace,
          reason: groqToolError?.message || 'groq_tool_call_failed'
        });
      }

      const choice = turn?.raw?.choices?.[0] || {};
      const assistantMessage = choice?.message || {};
      const finishReason = choice?.finish_reason || '';
      const toolCalls = Array.isArray(assistantMessage?.tool_calls) ? assistantMessage.tool_calls : [];

      if (toolCalls.length === 0 && finishReason === 'stop') {
        const responseText = String(assistantMessage?.content || '').trim();
        const cleanText = responseText.replace(/^(assistant\s*:?\s*)/i, '').trim();
        const sanitized = this._sanitizeResponseText(cleanText);
        const hasFreshProducts = Array.isArray(aggregatedProducts) && aggregatedProducts.length > 0;
        let activeProductsList = hasFreshProducts
          ? aggregatedProducts.slice(0, 10)
          : [];

        if (!hasFreshProducts && this._isProductShoppingIntent(effectiveUserMessage)) {
          try {
            const fallbackProductSearch = await this._executeAgentTool('search_products', {
              keywords: effectiveUserMessage,
              sort_by: 'relevance'
            });

            const fallbackProducts = Array.isArray(fallbackProductSearch?.data)
              ? fallbackProductSearch.data.slice(0, 10)
              : [];

            if (fallbackProducts.length > 0) {
              activeProductsList = fallbackProducts;
              toolTrace.push({
                name: 'search_products',
                args: { keywords: effectiveUserMessage, sort_by: 'relevance', autoFallback: true },
                total: fallbackProducts.length,
                found: true
              });
            }
          } catch (fallbackError) {
            toolTrace.push({
              name: 'search_products',
              args: { keywords: effectiveUserMessage, sort_by: 'relevance', autoFallback: true },
              total: 0,
              found: false
            });
          }
        }

        if (activeProductsList.length > 0) {
          this._setLastSearchedProducts(activeProductsList);
        }

        let cleanMessage = sanitized;
        if (this._shouldForceImageCardReply(effectiveUserMessage) && activeProductsList.length > 0) {
          cleanMessage = IMAGE_CARD_ONLY_REPLY;
        } else {
          cleanMessage = this._ensureSalesClosingLine(cleanMessage, activeProductsList);
        }

        if (!cleanMessage) {
          throw new Error('Agent returned empty final response');
        }

        const final_llm_text = cleanMessage;
        const final_products = activeProductsList;

        return {
          provider: turn.provider,
          model: turn.model,
          text: cleanFinalText(final_llm_text),
          products: final_products,
          sources: aggregatedSources.slice(0, 10),
          toolTrace
        };
      }

      messages.push({
        role: 'assistant',
        content: assistantMessage?.content || '',
        tool_calls: toolCalls
      });

      if (toolCalls.length === 0) {
        continue;
      }

      for (const tc of toolCalls) {
        const toolName = tc?.function?.name || 'unknown_tool';
        let toolArgs = {};
        try {
          toolArgs = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch (error) {
          toolArgs = {};
        }

        let toolResult;
        try {
          toolResult = await this._executeAgentTool(toolName, toolArgs);
        } catch (toolError) {
          toolResult = {
            tool: toolName,
            found: false,
            total: 0,
            data: [],
            note: `Tool execution error: ${toolError?.message || 'unknown error'}`
          };
        }

        toolTrace.push({ name: toolName, args: toolArgs, total: toolResult.total, found: toolResult.found });

        if (toolName === 'search_products' && Array.isArray(toolResult.data)) {
          aggregatedProducts.push(...toolResult.data);
        }
        if (toolName === 'search_technical_knowledge' && Array.isArray(toolResult.data)) {
          aggregatedSources.push(...toolResult.data);
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc?.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }
    }

    if (Array.isArray(aggregatedProducts) && aggregatedProducts.length > 0) {
      this._setLastSearchedProducts(aggregatedProducts.slice(0, 10));
    }

    const final_llm_text = 'Mình đã thử nhiều vòng truy vấn dữ liệu nhưng chưa gom đủ kết quả ổn định. Bạn có thể nêu lại nhu cầu chính để mình ưu tiên xử lý trước?';
    const final_products = this._getLastSearchedProducts();

    return {
      provider: 'agent-fallback',
      model: this.groqModel,
      text: final_llm_text,
      products: final_products,
      sources: aggregatedSources.slice(0, 10),
      toolTrace
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

  async generateGeneralChat(message, conversationHistory = [], options = {}) {
    const strictGreetingMode = Boolean(options.strictGreetingMode);

    const systemPrompt = [
      MASTER_SYSTEM_PROMPT,
      strictGreetingMode
        ? 'GREETING_MODE: true. Nếu tin nhắn chỉ là lời chào ngắn thì chỉ chào và hỏi 1 câu mở về nhu cầu hiện tại.'
        : 'GREETING_MODE: false.'
    ].join('\n');

    const userPrompt = [
      `Tin nhắn người dùng: ${message}`,
      `Lịch sử gần đây: ${JSON.stringify(conversationHistory.slice(-4))}`,
      `Cờ strictGreetingMode: ${strictGreetingMode ? 'true' : 'false'}`
    ].join('\n');

    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.15,
      maxTokens: 360
    });
  }

  _sanitizeFallbackPrefix(text = '') {
    return String(text || '')
      .replace(/^\s*\[(?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\]\s*/i, '')
      .replace(/^\s*\((?:\s*che\s*do\s*du\s*phong|fallback\s*mode)\)\s*/i, '')
      .trim();
  }

  _logGroqDebugPayload({ userMessage = '', ragContext = [], finalPrompt = [], stage = 'before-call' }) {
    const color = {
      reset: '\x1b[0m',
      cyan: '\x1b[36m',
      yellow: '\x1b[33m',
      magenta: '\x1b[35m',
      green: '\x1b[32m'
    };

    const divider = `${color.cyan}\n==================== GROQ DEBUG (${stage}) ====================${color.reset}`;
    const safeStringify = (value) => {
      try {
        return JSON.stringify(value, null, 2);
      } catch (error) {
        return `[UNSERIALIZABLE_PAYLOAD] ${error?.message || 'unknown error'}`;
      }
    };

    console.log(divider);
    console.log(`${color.yellow}USER_MESSAGE:${color.reset}\n${String(userMessage || '')}`);
    console.log(`${color.magenta}RAG_CONTEXT:${color.reset}\n${safeStringify(ragContext)}`);
    console.log(`${color.green}FINAL_PROMPT:${color.reset}\n${safeStringify(finalPrompt)}`);
    console.log(`${color.cyan}===============================================================\n${color.reset}`);
  }

  async generateRagAnswer({ systemPrompt, userQuestion, contextBlocks = [], conversationHistory = [], requireGroq = true }) {
    const contextText = contextBlocks.length > 0
      ? contextBlocks.map((item, idx) => `[CONTEXT ${idx + 1}]\n${item}`).join('\n\n')
      : '[CONTEXT] Không có dữ liệu truy xuất';

    const userPrompt = [
      `Dựa vào hệ thống kiến thức sau:\n${contextText}`,
      `Hãy trả lời câu hỏi: ${userQuestion}`
    ].join('\n\n');

    const mergedSystemPrompt = [MASTER_SYSTEM_PROMPT, systemPrompt || ''].filter(Boolean).join('\n\n');

    const normalizedHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .filter((item) => item && typeof item.content === 'string')
      .map((item) => {
        const roleRaw = String(item.role || '').toLowerCase();
        const role = roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'user';
        return {
          role,
          content: String(item.content || '').trim()
        };
      })
      .filter((item) => item.content.length > 0)
      .slice(-8);

    const messages = [
      { role: 'system', content: mergedSystemPrompt },
      ...normalizedHistory,
      { role: 'user', content: userPrompt }
    ];

    if (requireGroq) {
      this._logGroqDebugPayload({
        userMessage: userQuestion,
        ragContext: contextBlocks,
        finalPrompt: messages,
        stage: 'generateRagAnswer:first-call'
      });

      return this._callGroq(messages, {
        temperature: 0.1,
        maxTokens: 850
      });
    }

    return this.chat(messages, {
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
