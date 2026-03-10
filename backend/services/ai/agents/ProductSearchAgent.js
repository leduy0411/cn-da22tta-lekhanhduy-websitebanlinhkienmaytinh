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
      const searchResult = await ToolSystem.execute('searchProducts', {
        query: message,
        category: entities.category ? entities.category[0] : null,
        brand: entities.brand ? entities.brand[0] : null,
        minPrice: entities.price?.min,
        maxPrice: entities.price?.max,
        limit: 10
      });

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
        answer: this._getFallbackResponse(message, entities),
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
      return this._getFallbackResponse(query, entities);
    }

    try {
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
      return this._getFallbackResponse(query, entities);
    }
  }

  /**
   * Fallback response when AI unavailable
   * @private
   */
  _getFallbackResponse(query, entities) {
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

    response += '\n✨ Tôi đã tìm thấy các sản phẩm phù hợp với yêu cầu của bạn. Vui lòng xem danh sách bên dưới.';

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
