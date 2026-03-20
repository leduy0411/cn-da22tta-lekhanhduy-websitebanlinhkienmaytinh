/**
 * Groq Chat Service
 * Primary LLM: Groq (Llama 3)
 * Fallback LLM: Gemini (free tier)
 * Includes Circuit Breaker to avoid hammering provider on rate limits/outages
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MASTER_SYSTEM_PROMPT = [
  'RULE ƯU TIÊN CAO NHẤT (SMALL TALK): Khi khách hàng chỉ gửi câu chào cơ bản như "xin chào", "hello", "chào em", "hi", CHỈ ĐƯỢC chào lại ngắn gọn, thân thiện và hỏi họ cần hỗ trợ tư vấn mua hàng hay sửa chữa. TUYỆT ĐỐI KHÔNG tự động hỏi thông tin cấu hình, không yêu cầu mô tả triệu chứng lỗi, không hỏi thời điểm lỗi và không đưa ra các bước sửa chữa khi khách chưa nêu vấn đề cụ thể.',
  'LƯU Ý BẮT BUỘC: Rule small-talk ở trên chỉ áp dụng khi tin nhắn là lời chào đơn thuần. Nếu người dùng có yêu cầu rõ ràng (ví dụ: hướng dẫn sửa laptop, tư vấn mua hàng, so sánh sản phẩm), phải trả lời trực tiếp yêu cầu đó, KHÔNG được dùng lại mẫu câu chào mặc định.',
  'RÀNG BUỘC PHÂN BIỆT: Nếu tin nhắn chứa động từ hành động như "hướng dẫn", "sửa", "tư vấn", "so sánh", "mua", "khắc phục", thì đây KHÔNG phải small-talk. Trong trường hợp này phải đi thẳng vào nội dung yêu cầu ngay ở câu đầu tiên.',
  'VÍ DỤ: Input "bạn hướng dẫn tôi sửa laptop được không" -> Output phải bắt đầu bằng hướng dẫn sửa laptop, không bắt đầu bằng câu chào xã giao.',
  'Bạn là trợ lý kỹ thuật của TechStore.',
  'Mục tiêu: trả lời đúng trọng tâm, dễ làm theo, ưu tiên tiếng Việt tự nhiên.',
  'BẮT BUỘC NGÔN NGỮ: Luôn trả lời bằng tiếng Việt có dấu đầy đủ (Unicode chuẩn), không viết kiểu không dấu.',
  'Nếu có context truy xuất (RAG), ưu tiên bám sát context và không bịa thông tin ngoài context.',
  'Nếu dữ liệu chưa đủ, nêu rõ phần còn thiếu và hỏi tối đa 1-2 câu làm rõ.',
  'KHI NGƯỜI DÙNG MUỐN SỬA CHỮA NHƯNG CHƯA NÊU ĐỦ TRIỆU CHỨNG: vẫn phải đưa checklist chẩn đoán ban đầu 4-6 bước (từ dễ đến khó) có thể làm ngay, sau đó chỉ hỏi thêm 1 câu ngắn để khoanh vùng.',
  'Không được trả lời kiểu bế tắc như "không tìm thấy thông tin cụ thể" hoặc yêu cầu người dùng mô tả lại từ đầu khi vẫn có thể hướng dẫn chẩn đoán cơ bản.',
  'Nếu người dùng đã cung cấp triệu chứng lỗi (ví dụ: "lỗi màn hình", "màn hình đen", "nhấp nháy"), không hỏi lại triệu chứng lần nữa; chuyển ngay sang hướng dẫn xử lý theo từng bước phù hợp với triệu chứng đó.',
  'Với câu hỏi lỗi máy tính, ưu tiên quy trình chẩn đoán theo từng bước từ dễ đến khó.',
  'Áp dụng cho MỌI nhóm lỗi, không chỉ màn hình: nguồn/sạc, pin, nhiệt độ/quạt, bàn phím/touchpad, Wi-Fi/Bluetooth, âm thanh/camera, hiệu năng chậm/đơ, lỗi hệ điều hành/BSOD.',
  'Không dùng cùng một checklist chung cho mọi lỗi; phải tùy biến checklist theo triệu chứng chính mà người dùng nêu.',
  'Khi có rủi ro mất dữ liệu hoặc can thiệp phần cứng, cần cảnh báo ngắn gọn trước khi hướng dẫn.',
  'Không dùng câu mở đầu kiểu "Tôi xin lỗi vì lỗi tạm thời của mình" hoặc các biến thể tương tự.',
  'Tránh xin lỗi chung chung; thay bằng hành động cụ thể người dùng có thể làm ngay.'
].join('\n');

class GroqChatService {
  constructor() {
    this.groqBaseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
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

    this.maxRetries = Number(process.env.GROQ_MAX_RETRIES || 1);
    this.retryDelayMs = Number(process.env.GROQ_RETRY_DELAY_MS || 450);

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

  _isRetryableGroqError(error) {
    const status = error?.response?.status || error?.status || 0;
    const code = String(error?.code || '').toUpperCase();
    return status === 429 || status >= 500 || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET';
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _sanitizeResponseText(text = '') {
    let cleaned = String(text || '').trim();

    // Remove generic dead-end openings so the answer starts with actionable guidance.
    cleaned = cleaned
      .replace(/^\s*Tôi\s+không\s+(?:thể\s+)?tìm\s+thấy\s+thông\s+tin\s+cụ\s+thể[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Mình\s+không\s+(?:thể\s+)?tìm\s+thấy\s+thông\s+tin\s+cụ\s+thể[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Hiện\s+tại\s+tôi\s+chưa\s+có\s+đủ\s+dữ\s+liệu[^.?!]*[.?!]\s*/i, '')
      .replace(/^\s*Tôi\s+xin\s+lỗi[^.?!]*[.?!]\s*/i, '')
      .trim();

    return cleaned || String(text || '').trim();
  }

  _normalizeTextForMatch(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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

  _buildChecklistTemplate(issueType = 'general_hardware') {
    const templates = {
      power_boot: [
        'Bước 1: Kiểm tra nguồn, adapter, ổ cắm và đèn báo nguồn.',
        'Bước 2: Hard reset (giữ nút nguồn 15 giây), sau đó thử bật lại.',
        'Bước 3: Rút toàn bộ ngoại vi, khởi động tối thiểu chỉ với sạc.',
        'Bước 4: Nếu không vào được hệ điều hành, kiểm tra BIOS/boot order.',
        'Bước 5: Nếu vẫn thất bại, đề xuất kiểm tra phần cứng tại trung tâm.'
      ],
      display: [
        'Bước 1: Kiểm tra độ sáng, phím tắt màn hình và cáp màn ngoài.',
        'Bước 2: Thử xuất màn ngoài để tách lỗi panel với GPU.',
        'Bước 3: Cài lại/cập nhật driver đồ họa và tần số quét.',
        'Bước 4: Kiểm tra dấu hiệu sọc/nhấp nháy/thêm vệt ở panel.',
        'Bước 5: Nếu nghi hỏng panel/cáp, đề xuất kiểm tra phần cứng.'
      ],
      battery_charging: [
        'Bước 1: Kiểm tra cổng sạc, cáp sạc, adapter đúng công suất.',
        'Bước 2: Kiểm tra tình trạng pin và chu kỳ sạc trong hệ điều hành.',
        'Bước 3: Hiệu chỉnh pin và cập nhật firmware/driver quản lý pin.',
        'Bước 4: Thử adapter khác chuẩn để loại trừ lỗi bộ sạc.',
        'Bước 5: Nếu pin chai/mạnh xuống cấp, đề xuất thay pin.'
      ],
      thermal_fan: [
        'Bước 1: Kiểm tra nhiệt độ CPU/GPU và tiến trình nền.',
        'Bước 2: Vệ sinh khe gió, quạt và đảm bảo thoáng khí.',
        'Bước 3: Giảm tải nền/startup apps và cập nhật BIOS nếu cần.',
        'Bước 4: Kiểm tra tốc độ quạt và tiếng ồn bất thường.',
        'Bước 5: Nếu vẫn quá nhiệt, cân nhắc thay keo tản nhiệt.'
      ],
      keyboard_touchpad: [
        'Bước 1: Kiểm tra Fn Lock/Num Lock và cài đặt ngôn ngữ bàn phím.',
        'Bước 2: Thử bàn phím/chuột ngoài để khoanh vùng phần cứng.',
        'Bước 3: Gỡ và cài lại driver HID/keyboard/touchpad.',
        'Bước 4: Kiểm tra nút touchpad enable/disable.',
        'Bước 5: Nếu liệt phím cố định, cần kiểm tra bàn phím phần cứng.'
      ],
      network: [
        'Bước 1: Khởi động lại router và adapter mạng.',
        'Bước 2: Forget Wi-Fi rồi kết nối lại, kiểm tra IP/DNS.',
        'Bước 3: Cập nhật driver WLAN/LAN và tắt tiết kiệm điện cho adapter.',
        'Bước 4: Test bằng mạng khác để loại trừ lỗi nhà mạng/router.',
        'Bước 5: Nếu vẫn mất kết nối, reset stack mạng hệ điều hành.'
      ],
      audio_camera: [
        'Bước 1: Kiểm tra output/input mặc định và quyền truy cập app.',
        'Bước 2: Test bằng ứng dụng hệ thống (camera/sound recorder).',
        'Bước 3: Gỡ và cài lại driver audio/camera.',
        'Bước 4: Kiểm tra mute/privacy switch trên thiết bị.',
        'Bước 5: Nếu vẫn lỗi, thử tài khoản hệ điều hành khác để đối chiếu.'
      ],
      performance_os: [
        'Bước 1: Kiểm tra CPU/RAM/Disk usage và startup apps.',
        'Bước 2: Dọn dẹp dung lượng, tắt app nền, cập nhật hệ điều hành.',
        'Bước 3: Quét malware và kiểm tra tính toàn vẹn hệ thống.',
        'Bước 4: Kiểm tra ổ cứng (SMART/CHKDSK) và bộ nhớ RAM.',
        'Bước 5: Nếu BSOD/treo lặp lại, thử Safe Mode và đọc mã lỗi.'
      ],
      general_hardware: [
        'Bước 1: Xác định triệu chứng chính và thời điểm xuất hiện.',
        'Bước 2: Kiểm tra nguồn, nhiệt độ, kết nối và thay đổi gần đây.',
        'Bước 3: Thử từng bước chẩn đoán từ dễ đến khó, ghi lại kết quả.',
        'Bước 4: Loại trừ yếu tố phần mềm bằng cập nhật driver/hệ điều hành.',
        'Bước 5: Nếu vẫn không ổn định, đề xuất kiểm tra phần cứng.'
      ]
    };

    return templates[issueType] || templates.general_hardware;
  }

  _buildDeterministicTroubleshootingFallback(userQuestion = '', issueProfile = { type: 'general_hardware', hints: [] }) {
    const hints = Array.isArray(issueProfile?.hints) ? issueProfile.hints.slice(0, 3) : [];
    const lines = hints.length > 0
      ? hints.map((h, idx) => `${idx + 1}. ${h}`).join('\n')
      : ['1. kiểm tra nguồn và kết nối cơ bản', '2. khởi động lại thiết bị và cập nhật driver', '3. ghi lại dấu hiệu lỗi để khoanh vùng'].join('\n');

    return {
      provider: 'groq-safe-fallback',
      model: this.groqModel,
      text: [
        `Nhận định nhanh: vấn đề có khả năng thuộc nhóm ${issueProfile?.type || 'general_hardware'}.`,
        'Checklist xử lý ban đầu:',
        lines,
        `Câu hỏi khoanh vùng tiếp theo: Bạn mô tả thêm khi nào lỗi xuất hiện và tần suất lỗi với trường hợp "${String(userQuestion || '').slice(0, 120)}"?`
      ].join('\n')
    };
  }

  _inferIssueProfile(userQuestion = '', conversationHistory = []) {
    const historyText = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .slice(-8)
      .map((item) => String(item?.content || ''))
      .join(' ');

    const fullText = this._normalizeTextForMatch(`${String(userQuestion || '')} ${historyText}`);

    const profiles = [
      {
        type: 'power_boot',
        test: /(khong len nguon|khong bat len|khong khoi dong|sap nguon|tat dot ngot|khong vao duoc win|boot|bios|no power)/,
        hints: [
          'kiem tra adapter, day sac, o cam, pin va den bao nguon',
          'thu hard reset (giu nut nguon 15 giay) roi bat lai',
          'thu rut ngoai vi, chi de lai sac va khoi dong toi thieu'
        ]
      },
      {
        type: 'display',
        test: /(man hinh|den man|soc man|nhap nhay|flicker|khong len hinh|vo man|backlight)/,
        hints: [
          'kiem tra do sang, phim tat man hinh, va day cap man ngoai',
          'thu xuat man hinh ngoai de tach loi panel va gpu',
          'cap nhat driver do hoa va kiem tra tan so quet'
        ]
      },
      {
        type: 'battery_charging',
        test: /(pin|chai pin|sut pin|khong sac|sac khong vao|battery|adapter nong)/,
        hints: [
          'kiem tra cong sac, adapter dung cong suat, va tinh trang cap',
          'kiem tra health pin trong he dieu hanh va chu ky sac',
          'thu hieu chinh pin va cap nhat firmware/driver pin'
        ]
      },
      {
        type: 'thermal_fan',
        test: /(nong|qua nhiet|quat keu|fan keu|tu dong tat|throttling|nhiet do cao)/,
        hints: [
          've sinh khe tan nhiet, kiem tra quat va luong gio',
          'giam tai nen, kiem tra tien trinh ngam cpu/gpu cao',
          'can nhac thay keo tan nhiet neu may da su dung lau'
        ]
      },
      {
        type: 'keyboard_touchpad',
        test: /(ban phim|liet phim|phim khong an|touchpad|chuot cam ung|double key)/,
        hints: [
          'kiem tra phim fn lock, num lock va cai dat input',
          'thu ban phim/touchpad ngoai de khoanh vung phan cung',
          'go va cai lai driver hid/keyboard/touchpad'
        ]
      },
      {
        type: 'network',
        test: /(wifi|bluetooth|mang cham|mat mang|khong vao mang|disconnect|khong bat duoc wifi)/,
        hints: [
          'khoi dong lai adapter mang va router',
          'forget mang wifi roi ket noi lai, kiem tra ip/dns',
          'cap nhat driver wlan/lan va tat che do tiet kiem dien cho adapter'
        ]
      },
      {
        type: 'audio_camera',
        test: /(khong co tieng|mat am thanh|re|mic khong nhan|camera khong len|webcam)/,
        hints: [
          'kiem tra output/input mac dinh va quyen truy cap app',
          'test bang ung dung he thong (sound recorder/camera)',
          'go va cai lai driver audio/camera'
        ]
      },
      {
        type: 'performance_os',
        test: /(lag|cham|do|treo|freeze|man hinh xanh|bsod|crash|full disk|ram day)/,
        hints: [
          'kiem tra cpu/ram/disk usage va startup apps',
          'kiem tra o cung (smart/chkdsk) va bo nho ram',
          'cap nhat he dieu hanh, driver, va quet malware'
        ]
      }
    ];

    const matched = profiles.find((p) => p.test.test(fullText));
    if (matched) {
      return matched;
    }

    return {
      type: 'general_hardware',
      hints: [
        'xac dinh trieu chung chinh, thoi diem xay ra, va tan suat',
        'kiem tra nguon, nhiet do, cap ket noi, va thay doi gan day',
        'thuc hien cac buoc chan doan tu de den kho va ghi lai ket qua tung buoc'
      ]
    };
  }

  _isTroubleshootingRequest(userQuestion = '', conversationHistory = []) {
    const historyText = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .slice(-6)
      .map((item) => String(item?.content || ''))
      .join(' ');

    const fullText = this._normalizeTextForMatch(`${String(userQuestion || '')} ${historyText}`);
    return /(sua|khac phuc|chan doan|hu|hong|loi|khong len|man hinh|pin|sac|nong|quat|wifi|bluetooth|ban phim|touchpad|camera|am thanh|lag|treo|freeze|bsod|crash|may tinh van de|laptop van de)/.test(fullText);
  }

  async _callGroq(messages, options = {}) {
    if (!this._canUseGroq()) {
      throw new Error('Groq circuit is OPEN or API key missing');
    }

    let lastError = null;
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
          text: this._sanitizeResponseText(text)
        };
      } catch (error) {
        lastError = error;
        this._onGroqFailure(error);

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
    throw enriched;
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
      text: this._sanitizeResponseText(this._sanitizeFallbackPrefix(text))
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

  async generateRagAnswer({ systemPrompt, userQuestion, contextBlocks = [], conversationHistory = [], requireGroq = true }) {
    const contextText = contextBlocks.length > 0
      ? contextBlocks.map((item, idx) => `[CONTEXT ${idx + 1}]\n${item}`).join('\n\n')
      : '[CONTEXT] Không có dữ liệu truy xuất';

    const issueProfile = this._inferIssueProfile(userQuestion, conversationHistory);
    const troubleshootingMode = this._isTroubleshootingRequest(userQuestion, conversationHistory);

    const checklistTemplate = this._buildChecklistTemplate(issueProfile.type);

    const userPrompt = [
      `Dựa vào hệ thống kiến thức sau:\n${contextText}`,
      `Hãy trả lời câu hỏi: ${userQuestion}`,
      troubleshootingMode
        ? `Nhom loi du doan: ${issueProfile.type}`
        : 'Che do hien tai: normal_chat',
      troubleshootingMode
        ? `Huong dan dac thu uu tien: ${issueProfile.hints.join('; ')}`
        : 'Neu day la loi chao hoac hoi chung, tra loi tu nhien, ngan gon, dung ngu canh.',
      troubleshootingMode
        ? `Template checklist bat buoc theo nhom loi:\n${checklistTemplate.join('\n')}`
        : 'Khong can checklist ky thuat neu nguoi dung chi chao hoi.',
      troubleshootingMode
        ? 'Nếu context không đủ chi tiết cho ca cụ thể, vẫn đưa checklist chẩn đoán thực tế để người dùng làm ngay, không trả lời chung chung.'
        : 'Khong chuyen sang checklist ky thuat neu nguoi dung chua neu van de ky thuat.',
      troubleshootingMode
        ? 'Checklist phai phu hop voi nhom loi du doan o tren, tranh lap lai checklist tong quat khong lien quan.'
        : 'Uu tien hoi dap dung y nguoi dung va giu giong tu nhien.',
      troubleshootingMode
        ? 'Ưu tiên cấu trúc: (1) nhận định nhanh, (2) checklist hành động theo nhóm lỗi, (3) 1 câu hỏi khoanh vùng tiếp theo.'
        : 'Neu la loi chao, chi can chao lai va hoi nhu cau ngan gon.'
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
      const first = await this._callGroq(messages, {
        temperature: 0.1,
        maxTokens: 850
      });

      if (!troubleshootingMode || !this._isUnrelatedRefusal(first.text)) {
        return first;
      }

      const retryMessages = [
        {
          role: 'system',
          content:
            `${mergedSystemPrompt}\n\nBAT BUOC: Day la yeu cau ho tro ky thuat may tinh thong thuong. Neu khong co noi dung nguy hai ro rang, khong duoc tu choi chung chung; hay dua huong dan chan doan cu the.`
        },
        ...normalizedHistory,
        { role: 'user', content: userPrompt }
      ];

      const retried = await this._callGroq(retryMessages, {
        temperature: 0.1,
        maxTokens: 850
      });

      if (this._isUnrelatedRefusal(retried.text)) {
        return this._buildDeterministicTroubleshootingFallback(userQuestion, issueProfile);
      }

      return retried;
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
