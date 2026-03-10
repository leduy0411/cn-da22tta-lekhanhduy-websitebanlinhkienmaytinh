/**
 * Recommendation Agent
 * Provides personalized product recommendations
 * 
 * @module services/ai/agents/RecommendationAgent  
 * @description Specialized agent for personalized recommendations
 */

const ToolSystem = require('../core/ToolSystem');
const RecommendationService = require('../RecommendationService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class RecommendationAgent {
  constructor() {
    this.name = 'RecommendationAgent';
    this.capabilities = ['recommendation', 'personalized_suggestions'];
    
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
      console.log(`💡 RecommendationAgent executing for: ${message}`);

      let recommendations = [];
      let userPreferences = null;

      // Step 1: Get user preferences if user is logged in
      if (context.userId) {
        const prefsResult = await ToolSystem.execute('getUserPreferences', {
          userId: context.userId,
          limit: 50
        });

        if (prefsResult.success) {
          userPreferences = prefsResult.data;
        }
      }

      // Step 2: Get recommendations based on context
      if (entities.category) {
        // Category-based recommendations
        recommendations = await this._getCategoryRecommendations(
          entities.category[0],
          entities.purpose,
          entities.price
        );
      } else if (context.lastViewedProduct) {
        // Based on last viewed product
        const recResult = await ToolSystem.execute('recommendProducts', {
          productId: context.lastViewedProduct,
          limit: 10,
          strategy: 'content-based'
        });

        if (recResult.success) {
          recommendations = recResult.data;
        }
      } else if (userPreferences) {
        // Personalized based on user preferences
        recommendations = await this._getPersonalizedRecommendations(
          userPreferences,
          entities.purpose,
          entities.price
        );
      } else {
        // Popular products as fallback
        recommendations = await this._getPopularProducts(entities.category);
      }

      // Step 3: Diversify recommendations
      recommendations = this._diversifyResults(recommendations);

      // Step 4: Generate AI response
      const aiResponse = await this._generateResponse(
        message,
        recommendations,
        userPreferences,
        entities
      );

      return {
        answer: aiResponse,
        products: recommendations.slice(0, 6),
        productCount: recommendations.length,
        intent: intent.intent,
        source: 'RecommendationAgent',
        metadata: {
          userPreferences,
          recommendationStrategy: this._determineStrategy(context, entities),
          diversified: true
        }
      };

    } catch (error) {
      console.error('RecommendationAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(message, entities),
        products: [],
        intent: intent.intent,
        source: 'RecommendationAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Get category-based recommendations
   * @private
   */
  async _getCategoryRecommendations(category, purpose, priceRange) {
    const filter = { category: new RegExp(category, 'i'), stock: { $gt: 0 } };

    if (priceRange) {
      filter.price = {};
      if (priceRange.min) filter.price.$gte = priceRange.min;
      if (priceRange.max) filter.price.$lte = priceRange.max;
    }

    const result = await ToolSystem.execute('searchProducts', {
      query: purpose || category,
      category,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      limit: 15,
      sortBy: 'rating'
    });

    return result.success ? result.data : [];
  }

  /**
   * Get personalized recommendations
   * @private
   */
  async _getPersonalizedRecommendations(userPreferences, purpose, priceRange) {
    const favoriteCategory = userPreferences.favoriteCategories[0];
    const favoriteBrand = userPreferences.favoriteBrands[0];

    const result = await ToolSystem.execute('searchProducts', {
      query: purpose || favoriteCategory,
      category: favoriteCategory,
      brand: favoriteBrand,
      minPrice: priceRange?.min || userPreferences.averageSpent * 0.8,
      maxPrice: priceRange?.max || userPreferences.averageSpent * 1.5,
      limit: 12,
      sortBy: 'rating'
    });

    return result.success ? result.data : [];
  }

  /**
   * Get popular products
   * @private
   */
  async _getPopularProducts(categories) {
    const category = categories ? categories[0] : null;

    const result = await ToolSystem.execute('searchProducts', {
      query: category || '',
      category,
      limit: 10,
      sortBy: 'rating'
    });

    return result.success ? result.data : [];
  }

  /**
   * Diversify recommendation results
   * @private
   */
  _diversifyResults(products) {
    // Ensure variety in brands and price ranges
    const diversified = [];
    const seenBrands = new Set();
    const priceRanges = {
      budget: [],
      mid: [],
      high: []
    };

    products.forEach(product => {
      const range = this._getPriceRange(product.price);
      priceRanges[range].push(product);
    });

    // Pick from different ranges
    const maxPerRange = Math.ceil(products.length / 3);
    
    ['budget', 'mid', 'high'].forEach(range => {
      priceRanges[range].slice(0, maxPerRange).forEach(product => {
        if (diversified.length < products.length) {
          diversified.push(product);
        }
      });
    });

    return diversified.length > 0 ? diversified : products;
  }

  /**
   * Get price range category
   * @private
   */
  _getPriceRange(price) {
    if (price < 5000000) return 'budget';
    if (price < 20000000) return 'mid';
    return 'high';
  }

  /**
   * Determine recommendation strategy
   * @private
   */
  _determineStrategy(context, entities) {
    if (context.userId) return 'personalized';
    if (entities.category) return 'category-based';
    if (context.lastViewedProduct) return 'content-based';
    return 'popular';
  }

  /**
   * Generate AI response
   * @private
   */
  async _generateResponse(query, products, userPreferences, entities) {
    if (!this.model) {
      return this._getFallbackResponse(query, entities);
    }

    try {
      const productContext = products.slice(0, 5).map((p, idx) => `
${idx + 1}. **${p.name}**
   - Thương hiệu: ${p.brand}
   - Giá: ${p.price?.toLocaleString('vi-VN')} VND
   - Đánh giá: ${p.rating || 'Chưa có'} ⭐
   - Tình trạng: ${p.stock > 0 ? 'Còn hàng' : 'Hết hàng'}
      `).join('\n');

      let userContext = '';
      if (userPreferences) {
        userContext = `\n**Thông tin người dùng:**
- Danh mục yêu thích: ${userPreferences.favoriteCategories.join(', ')}
- Thương hiệu yêu thích: ${userPreferences.favoriteBrands.join(', ')}
- Mức giá trung bình: ${userPreferences.averageSpent.toLocaleString('vi-VN')} VND
`;
      }

      const prompt = `Bạn là chuyên gia tư vấn sản phẩm công nghệ tại TechStore.

Khách hàng yêu cầu: "${query}"
${userContext}

Danh sách gợi ý:
${productContext}

Hãy:
1. Giải thích tại sao gợi ý những sản phẩm này
2. Phân tích ưu điểm của từng sản phẩm
3. Đề xuất sản phẩm phù hợp nhất dựa trên nhu cầu
4. Đưa ra lời khuyên bổ sung (nếu có)

Trả lời bằng tiếng Việt, thân thiện và chi tiết.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();

    } catch (error) {
      console.error('Gemini generation error:', error);
      return this._getFallbackResponse(query, entities);
    }
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(query, entities) {
    let response = '💡 **Gợi ý sản phẩm cho bạn**\n\n';
    
    response += '✨ Dựa trên yêu cầu của bạn, tôi đã chọn ra những sản phẩm phù hợp nhất. ';
    
    if (entities.purpose) {
      response += `Các sản phẩm này rất phù hợp cho mục đích **${entities.purpose}**. `;
    }

    response += '\n\n📋 Vui lòng xem danh sách bên dưới để chọn lựa.';

    return response;
  }
}

module.exports = new RecommendationAgent();
