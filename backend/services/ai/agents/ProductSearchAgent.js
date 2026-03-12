/**
 * Product Search Agent
 * Handles product search queries with hybrid search and advanced filtering
 * 
 * @module services/ai/agents/ProductSearchAgent
 * @description Specialized agent for product discovery and search
 */

const ToolSystem = require('../core/ToolSystem');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ProductSearchAgent {
  constructor() {
    this.name = 'ProductSearchAgent';
    this.capabilities = ['product_search', 'price_inquiry', 'product_details'];
    
    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }
  }

  /**
   * Execute agent logic
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Agent response
   */
  async execute(params) {
    const { message, intent, plan, context } = params;
    const entities = intent.entities;

    try {
      console.log(`🔍 ProductSearchAgent executing for intent: ${intent.intent}`);

      // Step 1: Search products using ToolSystem
      const searchParams = {
        query: message,
        limit: 10
      };
      
      // Only add params if they have values
      if (entities.category && entities.category[0]) {
        searchParams.category = entities.category[0];
      }
      if (entities.brand && entities.brand[0]) {
        searchParams.brand = entities.brand[0];
      }
      if (entities.price?.min) {
        searchParams.minPrice = entities.price.min;
      }
      if (entities.price?.max) {
        searchParams.maxPrice = entities.price.max;
      }

      const searchResult = await ToolSystem.execute('searchProducts', searchParams);

      if (!searchResult.success) {
        throw new Error('Product search failed');
      }

      let products = searchResult.data;

      // Step 2: Apply additional filters if needed
      if (entities.specs || entities.purpose) {
        const filterResult = await ToolSystem.execute('filterProducts', {
          products,
          filters: {
            specs: entities.specs,
            ...entities.price && { minPrice: entities.price.min, maxPrice: entities.price.max }
          }
        });

        if (filterResult.success) {
          products = filterResult.data;
        }
      }

      // Step 3: Rank results
      const rankResult = await ToolSystem.execute('rankResults', {
        products,
        criteria: ['relevance', 'rating', 'price', 'popularity'],
        weights: {
          relevance: 0.4,
          rating: 0.3,
          price: 0.2,
          popularity: 0.1
        }
      });

      if (rankResult.success) {
        products = rankResult.data;
      }

      // Step 4: Generate AI response using Gemini
      const aiResponse = await this._generateResponse(message, products, entities);

      return {
        answer: aiResponse,
        products: products.slice(0, 5),
        productCount: products.length,
        intent: intent.intent,
        entities,
        source: 'ProductSearchAgent',
        metadata: {
          searchQuery: message,
          filtersApplied: {
            category: entities.category,
            brand: entities.brand,
            priceRange: entities.price
          }
        }
      };

    } catch (error) {
      console.error('ProductSearchAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(message, entities, 0),
        products: [],
        intent: intent.intent,
        source: 'ProductSearchAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Generate AI response using Gemini
   * @private
   */
  async _generateResponse(query, products, entities) {
    if (!this.model) {
      return this._getFallbackResponse(query, entities, products.length);
    }

    try {
      // Handle no results case
      if (products.length === 0) {
        const prompt = `Bạn là chuyên gia tư vấn sản phẩm công nghệ tại TechStore.

Khách hàng hỏi: "${query}"

Tiêu chí tìm kiếm:
${entities.category ? `- Danh mục: ${entities.category.join(', ')}` : ''}
${entities.price ? `- Giá: ${entities.price.min ? `từ ${entities.price.min.toLocaleString('vi-VN')} VND` : ''} ${entities.price.max ? `đến ${entities.price.max.toLocaleString('vi-VN')} VND` : ''}` : ''}
${entities.brand ? `- Thương hiệu: ${entities.brand.join(', ')}` : ''}

Không tìm thấy sản phẩm phù hợp với tiêu chí trên.

Hãy:
1. Thông báo lịch sự rằng không có sản phẩm phù hợp
2. Giải thích ngắn gọn lý do (ví dụ: giá quá thấp cho loại sản phẩm này)
3. Gợi ý giải pháp: nâng ngân sách, xem sản phẩm tương tự, hoặc danh mục khác
4. Hỏi có muốn xem các lựa chọn thay thế không

Trả lời bằng tiếng Việt, thân thiện và hữu ích.`;

        const result = await this.model.generateContent(prompt);
        const response = result.response;
        return response.text();
      }

      // Build product context
      const productContext = products.slice(0, 5).map((p, idx) => `
${idx + 1}. **${p.name}**
   - Thương hiệu: ${p.brand || 'N/A'}
   - Giá: ${p.price?.toLocaleString('vi-VN')} VND${p.originalPrice ? ` (Giá gốc: ${p.originalPrice.toLocaleString('vi-VN')} VND)` : ''}
   - Tình trạng: ${p.stock > 0 ? `Còn ${p.stock} sản phẩm` : 'Hết hàng'}
   - Đánh giá: ${p.rating || 'Chưa có'} ⭐
   - Mô tả: ${p.description?.substring(0, 150) || 'N/A'}...
      `).join('\n');

      const prompt = `Bạn là chuyên gia tư vấn sản phẩm công nghệ tại TechStore.

Khách hàng hỏi: "${query}"

Danh sách ${products.length} sản phẩm phù hợp:
${productContext}

Hãy:
1. Tóm tắt kết quả tìm kiếm
2. Giới thiệu 2-3 sản phẩm nổi bật nhất
3. So sánh ưu điểm của từng sản phẩm
4. Đưa ra gợi ý phù hợp dựa trên nhu cầu

Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();

    } catch (error) {
      console.error('Gemini generation error:', error);
      return this._getFallbackResponse(query, entities, products.length);
    }
  }

  /**
   * Fallback response when AI unavailable
   * @private
   */
  _getFallbackResponse(query, entities, productCount = 0) {
    // Handle no results case
    if (productCount === 0) {
      let response = '😔 **Không tìm thấy sản phẩm phù hợp**\n\n';
      
      if (entities.category) {
        response += `📦 Danh mục: **${entities.category.join(', ')}**\n`;
      }
      
      if (entities.price) {
        if (entities.price.max) {
          response += `💰 Giá tối đa: **${entities.price.max.toLocaleString('vi-VN')} VND**\n`;
        }
        if (entities.price.min) {
          response += `💰 Giá tối thiểu: **${entities.price.min.toLocaleString('vi-VN')} VND**\n`;
        }
      }
      
      if (entities.brand) {
        response += `🏷️ Thương hiệu: **${entities.brand.join(', ')}**\n`;
      }
      
      response += '\n💡 **Gợi ý:**\n';
      response += '• Thử tăng ngân sách hoặc giảm yêu cầu\n';
      response += '• Xem các thương hiệu khác\n';
      response += '• Hỏi tôi để tìm sản phẩm tương tự';
      
      return response;
    }
    
    // Has results - show summary
    let response = '🛍️ **Kết quả tìm kiếm**\n\n';

    if (entities.category) {
      response += `📦 Danh mục: **${entities.category.join(', ')}**\n`;
    }

    if (entities.price) {
      if (entities.price.max) {
        response += `💰 Giá tối đa: **${entities.price.max.toLocaleString('vi-VN')} VND**\n`;
      }
      if (entities.price.min) {
        response += `💰 Giá tối thiểu: **${entities.price.min.toLocaleString('vi-VN')} VND**\n`;
      }
    }

    if (entities.brand) {
      response += `🏷️ Thương hiệu: **${entities.brand.join(', ')}**\n`;
    }

    response += `\n✨ Tìm thấy **${productCount}** sản phẩm phù hợp. Vui lòng xem danh sách bên dưới.`;

    return response;
  }

  /**
   * Execute with streaming support
   * @param {Object} params - Execution parameters
   * @param {Function} onChunk - Chunk callback
   * @returns {Promise<Object>} Agent response
   */
  async executeStreaming(params, onChunk) {
    // For now, use regular execute
    // TODO: Implement true streaming with Gemini streaming API
    const result = await this.execute(params);
    
    onChunk?.({
      type: 'answer',
      data: result.answer
    });

    onChunk?.({
      type: 'products',
      data: result.products
    });

    return result;
  }
}

module.exports = new ProductSearchAgent();
