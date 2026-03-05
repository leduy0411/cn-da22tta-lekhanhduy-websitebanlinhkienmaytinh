/**
 * Google Gemini AI Service
 * Tích hợp Google Gemini để xử lý ngôn ngữ tự nhiên
 * 
 * @module services/ai/GeminiService
 * @description AI Service cho Google Gemini Integration
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
    this.quotaExhausted = false; // Track quota status
    this.initializeGemini();
    this.initializeFallbackResponses();
  }

  /**
   * Khởi tạo fallback responses khi hết quota
   */
  initializeFallbackResponses() {
    this.fallbackPatterns = [
      // Chào hỏi
      {
        patterns: [/^(xin chào|chào|hello|hi|hey|alo)/i],
        responses: [
          'Xin chào! 👋 Tôi là Gemini AI - trợ lý thông minh của TechStore được hỗ trợ bởi Google AI. Tôi có thể giúp bạn tìm kiếm sản phẩm, kiểm tra đơn hàng, hoặc giải đáp thắc mắc. Bạn cần hỗ trợ gì?',
          'Chào bạn! 😊 Tôi là Gemini AI, rất vui được hỗ trợ bạn. Bạn đang tìm sản phẩm gì hoặc cần giúp đỡ gì?',
          'Hello! 👋 Chào mừng bạn đến TechStore. Tôi là Gemini AI - có thể giúp gì cho bạn hôm nay?'
        ]
      },
      // Tạm biệt
      {
        patterns: [/^(tạm biệt|bye|goodbye|cảm ơn|thanks|thank you|hẹn gặp)/i],
        responses: [
          'Cảm ơn bạn đã ghé TechStore! 🙏 Hẹn gặp lại bạn!',
          'Chúc bạn một ngày tốt lành! 😊 Nếu cần hỗ trợ, đừng ngại liên hệ Gemini AI nhé!',
          'Tạm biệt bạn! 👋 Cảm ơn đã sử dụng dịch vụ của TechStore!'
        ]
      },
      // Hỏi giá
      {
        patterns: [/(giá|bao nhiêu|price|cost|tiền)/i],
        responses: [
          'Để xem giá chính xác, bạn có thể:\n• Tìm kiếm sản phẩm trên website\n• Cho tôi biết tên sản phẩm cụ thể\n• Xem danh mục sản phẩm\n\nGiá thường xuyên có khuyến mãi nên hãy kiểm tra trực tiếp để có giá tốt nhất! 💰',
          'Giá sản phẩm được cập nhật thường xuyên trên website. Bạn có thể cho tôi biết sản phẩm cụ thể hoặc tìm trong danh mục để xem giá chi tiết! 🛒'
        ]
      },
      // Laptop
      {
        patterns: [/laptop/i],
        responses: [
          '💻 TechStore có nhiều dòng laptop:\n• **Gaming**: MSI, ASUS ROG, Acer Nitro\n• **Văn phòng**: Dell, HP, Lenovo ThinkPad\n• **Đồ họa**: MacBook, ASUS ProArt\n\nBạn cần laptop cho mục đích gì và ngân sách khoảng bao nhiêu?',
          'Bạn đang tìm laptop! 💻 Cho tôi biết:\n• Mục đích sử dụng (gaming, văn phòng, thiết kế)?\n• Ngân sách?\n• Thương hiệu yêu thích?\n\nĐể tôi tư vấn phù hợp nhất!'
        ]
      },
      // PC/Máy tính
      {
        patterns: [/(pc|máy tính|desktop|case)/i],
        responses: [
          '🖥️ TechStore có PC đa dạng:\n• **Gaming PC**: Cấu hình cao, RTX series\n• **Workstation**: Cho đồ họa, render\n• **PC văn phòng**: Giá tốt, ổn định\n\nBạn muốn PC cho mục đích gì?',
          'Bạn quan tâm đến PC! 🖥️ Chúng tôi có cả PC build sẵn và linh kiện để tự build. Bạn muốn loại nào?'
        ]
      },
      // VGA/Card đồ họa
      {
        patterns: [/(vga|card|gpu|đồ họa|nvidia|rtx|gtx|radeon)/i],
        responses: [
          '🎮 Card đồ họa tại TechStore:\n• **NVIDIA**: RTX 4090, 4080, 4070, 4060\n• **AMD**: RX 7900, 7800, 7600\n\nBạn cần card cho gaming hay đồ họa chuyên nghiệp?',
          'VGA là linh kiện hot! 🔥 Cho tôi biết ngân sách và mục đích sử dụng để tôi tư vấn card phù hợp.'
        ]
      },
      // CPU
      {
        patterns: [/(cpu|processor|vi xử lý|intel|amd|ryzen)/i],
        responses: [
          '⚡ CPU phổ biến:\n• **Intel**: Core i5, i7, i9 thế hệ 14\n• **AMD**: Ryzen 5, 7, 9 series 7000\n\nBạn cần CPU cho gaming, làm việc hay cả hai?',
          'Bạn đang tìm CPU! Để tư vấn tốt nhất, cho tôi biết:\n• Mục đích: Gaming / Render / Văn phòng?\n• Ngân sách?\n• Đã có mainboard chưa (để check socket)?'
        ]
      },
      // RAM
      {
        patterns: [/ram/i],
        responses: [
          '💾 RAM tại TechStore:\n• DDR4: 8GB, 16GB, 32GB\n• DDR5: 16GB, 32GB, 64GB\n• Các hãng: Corsair, Kingston, G.Skill\n\nBạn cần RAM cho laptop hay PC desktop?',
          'RAM là yếu tố quan trọng! 💾 Cho tôi biết máy tính của bạn dùng DDR4 hay DDR5 để tôi tư vấn.'
        ]
      },
      // Màn hình
      {
        patterns: [/(màn hình|monitor|display)/i],
        responses: [
          '🖥️ Màn hình đa dạng:\n• **Gaming**: 144Hz, 165Hz, 240Hz\n• **Đồ họa**: 4K, IPS, 100% sRGB\n• **Văn phòng**: Full HD, 60Hz\n\nKích thước và mục đích sử dụng của bạn là gì?',
          'Bạn tìm màn hình! 🖥️ Cho tôi biết:\n• Kích thước (24", 27", 32"...)?\n• Mục đích (gaming, thiết kế, văn phòng)?\n• Ngân sách?'
        ]
      },
      // Chuột
      {
        patterns: [/(chuột|mouse)/i],
        responses: [
          '🖱️ Chuột tại TechStore:\n• **Gaming**: Logitech G, Razer, SteelSeries\n• **Wireless**: Logitech MX Master\n• **Văn phòng**: Logitech, Microsoft\n\nBạn cần chuột có dây hay không dây?',
          'Chuột gaming hay văn phòng? 🖱️ Gaming thì Logitech G502, Razer DeathAdder rất hot. Văn phòng thì MX Master series cực êm!'
        ]
      },
      // Bàn phím
      {
        patterns: [/(bàn phím|keyboard)/i],
        responses: [
          '⌨️ Bàn phím đa dạng:\n• **Cơ**: Cherry MX, Gateron switches\n• **Gaming**: RGB, hot-swap\n• **Văn phòng**: Membrane, êm ái\n\nBạn thích phím cơ hay membrane?',
          'Bàn phím! ⌨️ Bạn muốn:\n• Full-size hay TKL/65%?\n• Có dây hay wireless?\n• Gaming hay văn phòng?'
        ]
      },
      // Tai nghe
      {
        patterns: [/(tai nghe|headphone|headset|earphone)/i],
        responses: [
          '🎧 Tai nghe tại TechStore:\n• **Gaming**: HyperX, SteelSeries, Razer\n• **Audiophile**: Sony, Audio-Technica\n• **True Wireless**: AirPods, Sony WF\n\nBạn cần tai nghe cho gaming hay nghe nhạc?',
          'Tai nghe! 🎧 Gaming headset hay tai nghe bluetooth? Cho tôi biết ngân sách để tư vấn tốt nhất!'
        ]
      },
      // Đơn hàng
      {
        patterns: [/(đơn hàng|order|kiểm tra đơn|tracking)/i],
        responses: [
          '📦 Để kiểm tra đơn hàng:\n1. Đăng nhập tài khoản\n2. Vào mục "Đơn hàng của tôi"\n3. Xem trạng thái đơn hàng\n\nHoặc cung cấp mã đơn hàng để tôi kiểm tra giúp bạn!',
          'Bạn muốn kiểm tra đơn hàng! 📦 Vui lòng cho tôi mã đơn hàng hoặc đăng nhập để xem trong "Đơn hàng của tôi".'
        ]
      },
      // Thanh toán
      {
        patterns: [/(thanh toán|payment|trả tiền|chuyển khoản|cod|zalopay)/i],
        responses: [
          '💳 Phương thức thanh toán:\n• **COD**: Thanh toán khi nhận hàng\n• **Chuyển khoản**: Ngân hàng nội địa\n• **ZaloPay**: Ví điện tử, nhanh chóng\n\nBạn muốn thanh toán bằng cách nào?',
          'TechStore hỗ trợ nhiều hình thức thanh toán: COD, chuyển khoản ngân hàng và ZaloPay. 💳 Bạn chọn cách nào thuận tiện nhất!'
        ]
      },
      // Giao hàng/Ship
      {
        patterns: [/(giao hàng|ship|vận chuyển|delivery|phí ship)/i],
        responses: [
          '🚚 Chính sách giao hàng:\n• **Miễn phí ship**: Đơn từ 500.000đ\n• **Nội thành**: 1-2 ngày\n• **Tỉnh thành khác**: 3-5 ngày\n\nGiao hàng toàn quốc!',
          'Giao hàng nhanh chóng! 🚚\n• Free ship cho đơn từ 500k\n• Nội thành: 1-2 ngày\n• Tỉnh: 3-5 ngày\n\nBạn ở khu vực nào?'
        ]
      },
      // Bảo hành
      {
        patterns: [/(bảo hành|warranty|guarantee)/i],
        responses: [
          '🛡️ Chính sách bảo hành:\n• Bảo hành chính hãng: 12-36 tháng\n• 1 đổi 1 trong 7 ngày đầu\n• Hỗ trợ kỹ thuật miễn phí\n\nMỗi sản phẩm có thời gian bảo hành khác nhau, bạn cần tra cứu sản phẩm cụ thể!',
          'Bảo hành tại TechStore! 🛡️ Tất cả sản phẩm đều được bảo hành chính hãng. Thời gian từ 12-36 tháng tùy sản phẩm.'
        ]
      },
      // Đổi trả
      {
        patterns: [/(đổi|trả|return|refund|hoàn)/i],
        responses: [
          '🔄 Chính sách đổi trả:\n• Đổi trả trong 7 ngày nếu lỗi từ nhà sản xuất\n• Sản phẩm nguyên seal, chưa qua sử dụng\n• Hoàn tiền trong 3-5 ngày làm việc\n\nBạn cần đổi trả sản phẩm nào?',
          'Đổi trả trong vòng 7 ngày! 🔄 Sản phẩm cần nguyên vẹn và có hóa đơn. Bạn gặp vấn đề gì với sản phẩm?'
        ]
      },
      // Khuyến mãi
      {
        patterns: [/(khuyến mãi|giảm giá|sale|discount|voucher|coupon|mã giảm)/i],
        responses: [
          '🎉 Khuyến mãi tại TechStore:\n• Flash sale hàng ngày\n• Giảm giá theo combo\n• Voucher cho thành viên mới\n\nXem trang khuyến mãi để cập nhật ưu đãi mới nhất!',
          'Săn sale! 🎉 TechStore thường có flash sale và mã giảm giá. Check trang chủ hoặc đăng ký nhận thông báo để không bỏ lỡ!'
        ]
      },
      // Gaming
      {
        patterns: [/gaming/i],
        responses: [
          '🎮 Đồ gaming tại TechStore:\n• Laptop gaming: MSI, ASUS ROG, Acer\n• PC gaming: RTX 4000 series\n• Gear: Chuột, bàn phím, tai nghe gaming\n\nBạn cần setup gaming như thế nào?',
          'Gaming gear! 🎮 Bạn cần tư vấn laptop gaming, PC gaming, hay phụ kiện gaming?'
        ]
      },
      // Hỗ trợ/Giúp đỡ
      {
        patterns: [/(hỗ trợ|support|giúp|help|liên hệ|hotline)/i],
        responses: [
          '📞 Hỗ trợ khách hàng:\n• Hotline: 1900 xxxx\n• Email: support@techstore.vn\n• Chat: Ngay tại đây!\n\nTôi có thể giúp gì cho bạn?',
          'Tôi sẵn sàng hỗ trợ! 🙋 Bạn có thể hỏi về sản phẩm, đơn hàng, hoặc bất kỳ vấn đề gì. Nếu cần hỗ trợ kỹ thuật chuyên sâu, hotline: 1900 xxxx'
        ]
      }
    ];

    // General knowledge fallback patterns (for when Gemini API is unavailable)
    this.generalFallbackPatterns = [
      {
        patterns: [/^(tại sao|vì sao|why)/i],
        responses: [
          'Đây là câu hỏi hay! 🤔 Hiện tại tôi đang gặp sự cố kết nối với hệ thống AI. Bạn có thể thử lại sau hoặc hỏi tôi về sản phẩm công nghệ tại TechStore.',
          'Câu hỏi thú vị! 💡 Tôi cần kết nối với Gemini AI để trả lời câu hỏi này. Vui lòng thử lại sau nhé!'
        ]
      },
      {
        patterns: [/(code|lập trình|programming|python|javascript|java)/i],
        responses: [
          'Bạn đang hỏi về lập trình! 💻 Tôi có thể hỗ trợ code khi kết nối ổn định. Trong khi chờ, bạn có muốn xem laptop/PC phù hợp cho lập trình không?',
          'Câu hỏi về coding! 🖥️ Tôi cần kết nối với AI để hỗ trợ chi tiết. Thử lại sau hoặc hỏi về thiết bị lập trình nhé!'
        ]
      },
      {
        patterns: [/(dịch|translate|tiếng anh|english)/i],
        responses: [
          'Bạn cần dịch thuật! 🌐 Tôi có thể hỗ trợ khi kết nối ổn định. Vui lòng thử lại sau!',
          'Dịch thuật cần AI hỗ trợ! 📝 Hiện tôi đang gặp sự cố kết nối. Thử lại sau nhé!'
        ]
      },
      {
        patterns: [/(tính|calculate|toán|math)/i],
        responses: [
          'Bạn cần tính toán! 🔢 Với phép tính phức tạp, tôi cần kết nối AI. Thử lại sau hoặc dùng máy tính nhé!',
          'Câu hỏi toán học! 📊 Tôi có thể giải khi kết nối ổn định. Vui lòng thử lại!'
        ]
      }
    ];

    // Default fallback khi không match được pattern nào
    this.defaultFallbacks = [
      'Tôi là Gemini AI - trợ lý thông minh của TechStore! 🤖 Tôi có thể:\n• Hỏi đáp kiến thức tổng quát\n• Tư vấn sản phẩm công nghệ\n• Kiểm tra đơn hàng\n• Và nhiều hơn nữa!\n\nBạn cần hỗ trợ gì?',
      'Xin chào! 😊 Tôi là Gemini AI có thể trả lời nhiều loại câu hỏi. Bạn có thể hỏi về:\n• Kiến thức chung\n• Sản phẩm công nghệ\n• Lập trình, code\n• Hoặc bất kỳ điều gì!\n\nBạn muốn hỏi gì?',
      'Tôi sẵn sàng hỗ trợ bạn! 🚀 Hãy cho tôi biết bạn cần gì:\n• Tư vấn sản phẩm?\n• Câu hỏi kiến thức?\n• Kiểm tra đơn hàng?\n• Hoặc trò chuyện thôi! 😄'
    ];
  }

  /**
   * Tìm fallback response phù hợp với message
   */
  getFallbackResponse(message) {
    // First check store-related patterns
    for (const fallback of this.fallbackPatterns) {
      for (const pattern of fallback.patterns) {
        if (pattern.test(message)) {
          // Random chọn 1 response
          const responses = fallback.responses;
          return responses[Math.floor(Math.random() * responses.length)];
        }
      }
    }
    
    // Then check general knowledge patterns
    for (const fallback of this.generalFallbackPatterns) {
      for (const pattern of fallback.patterns) {
        if (pattern.test(message)) {
          const responses = fallback.responses;
          return responses[Math.floor(Math.random() * responses.length)];
        }
      }
    }
    
    // Không match được, trả về default
    return this.defaultFallbacks[Math.floor(Math.random() * this.defaultFallbacks.length)];
  }

  /**
   * Thử trả lời câu hỏi chung locally (không cần API)
   * Hỗ trợ tính toán đơn giản, câu hỏi cơ bản
   */
  tryAnswerLocally(message) {
    const normalizedMessage = message.toLowerCase().trim();
    
    // 1. Xử lý phép tính đơn giản
    const mathResult = this.calculateMath(message);
    if (mathResult !== null) {
      return `Kết quả: **${mathResult}** 🧮`;
    }
    
    // 2. Các câu hỏi có thể trả lời không cần AI
    const simpleAnswers = [
      {
        patterns: [/^(1\s*\+\s*1|một cộng một)/i],
        answer: '1 + 1 = **2** 🧮'
      },
      {
        patterns: [/bạn là ai|you are|ai đang nói/i],
        answer: 'Tôi là **Gemini AI** - trợ lý thông minh được hỗ trợ bởi Google AI, hoạt động trên TechStore! 🤖 Tôi có thể giúp bạn tìm sản phẩm, trả lời câu hỏi, và nhiều hơn nữa!'
      },
      {
        patterns: [/bạn tên (là )?gì|tên của bạn/i],
        answer: 'Tôi là **Gemini AI** 🤖 - trợ lý AI thông minh của TechStore!'
      },
      {
        patterns: [/mấy giờ|what time|giờ hiện tại/i],
        answer: `Bây giờ là **${new Date().toLocaleTimeString('vi-VN')}** ⏰`
      },
      {
        patterns: [/hôm nay (là )?ngày (mấy|bao nhiêu)|today.*date|ngày hôm nay/i],
        answer: `Hôm nay là **${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}** 📅`
      },
      {
        patterns: [/hello|hi|xin chào/i],
        answer: 'Xin chào! 👋 Tôi là Gemini AI - rất vui được trò chuyện với bạn! Bạn cần giúp gì?'
      },
      {
        patterns: [/cảm ơn|thank you|thanks/i],
        answer: 'Không có gì! 😊 Rất vui được giúp bạn. Bạn còn cần hỗ trợ gì nữa không?'
      },
      {
        patterns: [/khỏe không|how are you|bạn có khỏe/i],
        answer: 'Tôi luôn sẵn sàng phục vụ bạn! 😊 Cảm ơn bạn đã hỏi thăm. Bạn cần giúp gì hôm nay?'
      }
    ];
    
    for (const qa of simpleAnswers) {
      for (const pattern of qa.patterns) {
        if (pattern.test(normalizedMessage)) {
          return qa.answer;
        }
      }
    }
    
    return null; // Không thể trả lời locally
  }

  /**
   * Tính toán phép tính đơn giản
   */
  calculateMath(message) {
    try {
      // Extract math expression from message
      // Support: 1+1, 2*3, 10/2, 5-3, 2^3
      const patterns = [
        /(\d+(?:\.\d+)?)\s*([\+\-\*\/\^])\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(cộng|trừ|nhân|chia|mũ)\s*(\d+(?:\.\d+)?)/i
      ];
      
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          const num1 = parseFloat(match[1]);
          let operator = match[2].toLowerCase();
          const num2 = parseFloat(match[3]);
          
          // Convert Vietnamese operators
          const opMap = {
            'cộng': '+', 'trừ': '-', 'nhân': '*', 'chia': '/', 'mũ': '^'
          };
          if (opMap[operator]) operator = opMap[operator];
          
          let result;
          switch (operator) {
            case '+': result = num1 + num2; break;
            case '-': result = num1 - num2; break;
            case '*': result = num1 * num2; break;
            case '/': 
              if (num2 === 0) return 'Không thể chia cho 0! ❌';
              result = num1 / num2; 
              break;
            case '^': result = Math.pow(num1, num2); break;
            default: return null;
          }
          
          // Format result nicely
          if (Number.isInteger(result)) {
            return `${num1} ${operator} ${num2} = ${result}`;
          } else {
            return `${num1} ${operator} ${num2} = ${result.toFixed(4).replace(/\.?0+$/, '')}`;
          }
        }
      }
      
      return null; // Not a math expression
    } catch (error) {
      console.error('Math calculation error:', error);
      return null;
    }
  }

  /**
   * Fallback response cho câu hỏi chung khi Gemini không available
   */
  getGeneralQuestionFallback(message) {
    // Try local answer first
    const localAnswer = this.tryAnswerLocally(message);
    if (localAnswer) return localAnswer;
    
    // Generic response for general questions
    return `Xin lỗi, tôi đang gặp sự cố kết nối với hệ thống AI nên chưa thể trả lời câu hỏi này. 😅\n\nTuy nhiên, tôi vẫn có thể giúp bạn:\n• 🛒 Tìm kiếm sản phẩm công nghệ\n• 📦 Kiểm tra đơn hàng\n• 💬 Tư vấn mua sắm\n\nBạn thử hỏi về sản phẩm hoặc quay lại sau nhé!`;
  }

  /**
   * Khởi tạo Gemini AI
   */
  initializeGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY không được cấu hình. Gemini AI sẽ không hoạt động.');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
        }
      });
      this.isInitialized = true;
      console.log('✅ Gemini AI đã được khởi tạo thành công');
    } catch (error) {
      console.error('❌ Lỗi khởi tạo Gemini:', error.message);
    }
  }

  /**
   * Kiểm tra Gemini đã sẵn sàng chưa
   */
  isReady() {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Tạo system prompt cho chatbot TechStore - PREMIUM VERSION
   */
  getSystemPrompt(context = {}) {
    const { products = [], categories = [], userInfo = null, analysis = null, hasProducts = false, isGeneralQuestion = false } = context;

    let systemPrompt = `Bạn là Gemini AI - trợ lý AI cao cấp được hỗ trợ bởi Google AI, hoạt động trên nền tảng TechStore - cửa hàng công nghệ hàng đầu Việt Nam.

🎯 VAI TRÒ CỦA BẠN:
- Trợ lý AI THÔNG MINH có khả năng trả lời MỌI CÂU HỎI như Gemini gốc
- Tư vấn viên chuyên nghiệp về công nghệ với kiến thức sâu rộng
- Có thể trả lời câu hỏi chung, giải toán, dịch thuật, viết văn, hỏi đáp kiến thức...
- Hiểu biết rộng về nhiều lĩnh vực: khoa học, lịch sử, văn hóa, lập trình, v.v.

🧠 KHẢ NĂNG CỦA BẠN:
- Trả lời câu hỏi TỔNG QUÁT về bất kỳ chủ đề nào
- Giải thích khái niệm, định nghĩa, kiến thức
- Hỗ trợ viết code, debug, giải thuật
- Dịch ngôn ngữ, sửa lỗi ngữ pháp
- Giải toán, tính toán, logic
- Tư vấn công nghệ chuyên sâu
- Trò chuyện tự nhiên, thân thiện

📦 VỀ TECHSTORE (khi được hỏi về sản phẩm):
- Laptop (Gaming, Văn phòng, Đồ họa sáng tạo, Ultrabook)
- PC Desktop (Gaming PC, Workstation, PC văn phòng, Mini PC)
- Linh kiện (CPU Intel/AMD, VGA NVIDIA/AMD, RAM, Mainboard, SSD/HDD, PSU, Case, Tản nhiệt)
- Màn hình, Phụ kiện Gaming, Console & Gaming
- Thương hiệu: ASUS, Acer, Dell, HP, Lenovo, MSI, Apple, Intel, AMD, NVIDIA...

💎 PHONG CÁCH TRẢ LỜI:
1. THÂN THIỆN & THÔNG MINH - Trả lời như một AI thực sự thông minh
2. LINH HOẠT - Nếu hỏi về TechStore → tư vấn sản phẩm. Nếu hỏi chung → trả lời như Gemini
3. TỰ NHIÊN & HỮU ÍCH - Luôn cố gắng giúp đỡ người dùng tốt nhất có thể
4. SỬ DỤNG EMOJI PHÙ HỢP - Tạo cảm giác thân thiện 😊💻🎮
5. KHÔNG GIỚI HẠN CHỦ ĐỀ - Trả lời bất kỳ câu hỏi hợp lệ nào

⚠️ QUY TẮC:
${isGeneralQuestion ? 
`- Đây là CÂU HỎI CHUNG - hãy trả lời như Gemini AI thực sự
- Không cần đề cập đến TechStore hay sản phẩm
- Trả lời đầy đủ, chính xác, hữu ích` :
`- KHÔNG liệt kê tên sản phẩm, giá cả trong câu trả lời text
- Sản phẩm được hiển thị riêng dưới dạng card với hình ảnh
- Nếu ${hasProducts ? 'CÓ' : 'KHÔNG CÓ'} sản phẩm phù hợp, hãy trả lời phù hợp
- Chủ động hỏi: ngân sách, mục đích sử dụng, thương hiệu yêu thích`}

📋 CHÍNH SÁCH TECHSTORE:
- Thanh toán: COD, Chuyển khoản, ZaloPay, Momo
- Giao hàng: Miễn phí từ 500k | Nội thành 1-2 ngày | Tỉnh 3-5 ngày
- Bảo hành: 12-36 tháng chính hãng
- Đổi trả: 7 ngày nếu lỗi`;

    // Add user context for personalization
    if (userInfo) {
      systemPrompt += `\n\n👤 KHÁCH HÀNG:`;
      if (userInfo.name) systemPrompt += `\n- Tên: ${userInfo.name}`;
      systemPrompt += `\n- Loại: ${userInfo.isAuthenticated ? 'Thành viên' : 'Khách'}`;
      
      if (userInfo.purchaseHistory && userInfo.purchaseHistory.totalOrders > 0) {
        systemPrompt += `\n- Khách hàng thân thiết: ${userInfo.purchaseHistory.totalOrders} đơn hàng`;
        systemPrompt += `\n- Tổng chi tiêu: ${(userInfo.purchaseHistory.totalSpent || 0).toLocaleString()}đ`;
        systemPrompt += `\n→ Hãy đối xử như VIP, gợi ý sản phẩm phù hợp!`;
      }
    }

    // Add Gemini analysis context if available
    if (analysis) {
      systemPrompt += `\n\n🔍 PHÂN TÍCH YÊU CẦU:`;
      if (analysis.intent) systemPrompt += `\n- Ý định: ${analysis.intent}`;
      if (analysis.entities?.product_type) systemPrompt += `\n- Loại SP: ${analysis.entities.product_type}`;
      if (analysis.entities?.brand) systemPrompt += `\n- Thương hiệu: ${analysis.entities.brand}`;
      if (analysis.entities?.price_range?.min || analysis.entities?.price_range?.max) {
        const min = analysis.entities.price_range.min ? `từ ${(analysis.entities.price_range.min/1000000).toFixed(0)}tr` : '';
        const max = analysis.entities.price_range.max ? `đến ${(analysis.entities.price_range.max/1000000).toFixed(0)}tr` : '';
        systemPrompt += `\n- Ngân sách: ${min} ${max}`.trim();
      }
      if (analysis.entities?.features?.length > 0) {
        systemPrompt += `\n- Nhu cầu: ${analysis.entities.features.join(', ')}`;
      }
    }

    if (categories && categories.length > 0) {
      systemPrompt += `\n\n📂 DANH MỤC: ${categories.join(', ')}`;
    }

    return systemPrompt;
  }

  /**
   * Gửi tin nhắn đến Gemini và nhận phản hồi
   * @param {string} message - Tin nhắn từ người dùng
   * @param {Array} conversationHistory - Lịch sử cuộc trò chuyện
   * @param {Object} context - Context bổ sung (sản phẩm, user info, etc.)
   */
  async chat(message, conversationHistory = [], context = {}) {
    const { isGeneralQuestion = false } = context;
    
    // If this is a general question and Gemini is not available, try to answer locally
    if (isGeneralQuestion) {
      const localAnswer = this.tryAnswerLocally(message);
      if (localAnswer) {
        return {
          text: localAnswer,
          model: 'local',
          fallback: false
        };
      }
    }
    
    // Nếu đã biết hết quota, dùng fallback luôn
    if (this.quotaExhausted) {
      console.log('📝 Sử dụng fallback response (quota đã hết)');
      // For general questions, use special fallback
      if (isGeneralQuestion) {
        return {
          text: this.getGeneralQuestionFallback(message),
          model: 'fallback',
          fallback: true,
          reason: 'quota_exhausted_general'
        };
      }
      return {
        text: this.getFallbackResponse(message),
        model: 'fallback',
        fallback: true,
        reason: 'quota_exhausted_cached'
      };
    }

    if (!this.isReady()) {
      console.warn('⚠️ Gemini chưa khởi tạo - sử dụng fallback response');
      // For general questions, use special fallback
      if (isGeneralQuestion) {
        return {
          text: this.getGeneralQuestionFallback(message),
          model: 'fallback',
          fallback: true,
          reason: 'not_initialized_general'
        };
      }
      return {
        text: this.getFallbackResponse(message),
        model: 'fallback',
        fallback: true,
        reason: 'not_initialized'
      };
    }

    try {
      const systemPrompt = this.getSystemPrompt(context);
      
      // Format conversation history for Gemini
      const formattedHistory = conversationHistory.slice(-10).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Start chat with history
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: `Hệ thống: ${systemPrompt}` }]
          },
          {
            role: 'model', 
            parts: [{ text: 'Tôi đã hiểu. Tôi là trợ lý AI của TechStore và sẽ hỗ trợ khách hàng theo đúng quy tắc.' }]
          },
          ...formattedHistory
        ]
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = await result.response;
      const text = response.text();

      return {
        text,
        model: 'gemini-2.0-flash',
        tokensUsed: response.usageMetadata?.totalTokenCount || 0
      };
    } catch (error) {
      console.error('Lỗi Gemini chat:', error);
      
      // Handle specific errors - use fallback instead of throwing
      if (error.message?.includes('API key')) {
        console.warn('⚠️ API key không hợp lệ - sử dụng fallback response');
        this.quotaExhausted = true;
        return {
          text: this.getFallbackResponse(message),
          model: 'fallback',
          fallback: true,
          reason: 'invalid_api_key'
        };
      }
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn('⚠️ Hết quota API - sử dụng fallback response');
        this.quotaExhausted = true;
        return {
          text: this.getFallbackResponse(message),
          model: 'fallback',
          fallback: true,
          reason: 'quota_exceeded'
        };
      }
      if (error.message?.includes('safety')) {
        return {
          text: 'Xin lỗi, tôi không thể trả lời câu hỏi này. Vui lòng thử câu hỏi khác.',
          model: 'gemini-2.0-flash',
          blocked: true
        };
      }
      
      // For any other error, also use fallback
      console.warn('⚠️ Lỗi không xác định - sử dụng fallback response:', error.message);
      return {
        text: this.getFallbackResponse(message),
        model: 'fallback',
        fallback: true,
        reason: 'unknown_error'
      };
    }
  }

  /**
   * Phân tích intent và entities bằng Gemini
   */
  async analyzeIntent(message) {
    if (!this.isReady() || this.quotaExhausted) {
      return null;
    }

    try {
      const prompt = `Phân tích tin nhắn sau và trả về JSON:
Tin nhắn: "${message}"

Trả về JSON với format:
{
  "intent": "greeting|product_search|price_inquiry|order_status|support|comparison|other",
  "entities": {
    "product_type": "laptop|pc|cpu|vga|ram|keyboard|mouse|headphone|speaker|monitor|other|null",
    "brand": "brand_name hoặc null",
    "price_range": { "min": number|null, "max": number|null },
    "features": ["gaming", "văn phòng", "thiết kế", etc.]
  },
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0
}

CHỈ trả về JSON, không có text khác.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Lỗi analyze intent:', error);
      // Mark quota as exhausted if quota error
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaExhausted = true;
      }
      return null;
    }
  }

  /**
   * Tạo mô tả sản phẩm bằng Gemini
   */
  async generateProductDescription(product) {
    if (!this.isReady() || this.quotaExhausted) {
      return null;
    }

    try {
      const prompt = `Tạo mô tả ngắn gọn (2-3 câu) cho sản phẩm sau bằng tiếng Việt:
Tên: ${product.name}
Thương hiệu: ${product.brand || 'N/A'}
Danh mục: ${product.category || 'N/A'}
Giá: ${product.price?.toLocaleString() || 'N/A'}đ

Mô tả nên:
- Highlight các điểm nổi bật
- Phù hợp với đối tượng khách hàng
- Chuyên nghiệp và hấp dẫn`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi generate description:', error);
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaExhausted = true;
      }
      return null;
    }
  }

  /**
   * So sánh sản phẩm bằng Gemini
   */
  async compareProducts(products) {
    if (!this.isReady() || this.quotaExhausted || products.length < 2) {
      return null;
    }

    try {
      const productList = products.map((p, i) => 
        `${i + 1}. ${p.name} - ${p.price?.toLocaleString()}đ\n   Thương hiệu: ${p.brand || 'N/A'}`
      ).join('\n');

      const prompt = `So sánh các sản phẩm sau và đưa ra nhận xét ngắn gọn bằng tiếng Việt:

${productList}

Hãy so sánh về:
1. Giá cả
2. Thương hiệu/Độ tin cậy
3. Phù hợp với nhu cầu nào

Trả lời ngắn gọn, dễ hiểu.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi compare products:', error);
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaExhausted = true;
      }
      return null;
    }
  }

  /**
   * Phân tích đánh giá sản phẩm
   */
  async analyzeReview(reviewText) {
    if (!this.isReady() || this.quotaExhausted) {
      return null;
    }

    try {
      const prompt = `Phân tích đánh giá sản phẩm sau và trả về JSON:
"${reviewText}"

Trả về JSON:
{
  "sentiment": "positive|neutral|negative",
  "score": 1-5,
  "aspects": {
    "quality": "positive|neutral|negative|not_mentioned",
    "price": "positive|neutral|negative|not_mentioned",
    "service": "positive|neutral|negative|not_mentioned",
    "delivery": "positive|neutral|negative|not_mentioned"
  },
  "summary": "tóm tắt ngắn gọn"
}

CHỈ trả về JSON.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Lỗi analyze review:', error);
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaExhausted = true;
      }
      return null;
    }
  }

  /**
   * Tư vấn sản phẩm dựa trên nhu cầu
   */
  async recommendByNeeds(needs, availableProducts = []) {
    if (!this.isReady() || this.quotaExhausted) {
      return null;
    }

    try {
      const productList = availableProducts.slice(0, 20).map(p => 
        `- ${p.name}: ${p.price?.toLocaleString()}đ (${p.category || 'N/A'})`
      ).join('\n');

      const prompt = `Khách hàng có nhu cầu: "${needs}"

Danh sách sản phẩm có sẵn:
${productList || 'Không có thông tin sản phẩm cụ thể'}

Hãy tư vấn ngắn gọn:
1. Loại sản phẩm nào phù hợp nhất
2. Lưu ý khi chọn mua
3. Tầm giá tham khảo (nếu biết)

Trả lời thân thiện, dễ hiểu.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi recommend:', error);
      if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        this.quotaExhausted = true;
      }
      return null;
    }
  }
}

module.exports = new GeminiService();
