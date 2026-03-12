/**
 * Comparison Agent
 * Compares products side-by-side with detailed analysis
 * 
 * @module services/ai/agents/ComparisonAgent  
 * @description Specialized agent for product comparisons
 */

const ToolSystem = require('../core/ToolSystem');
const Product = require('../../../models/Product');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const VectorSearchService = require('../rag/VectorSearchService');

class ComparisonAgent {
  constructor() {
    this.name = 'ComparisonAgent';
    this.capabilities = ['comparison', 'product_analysis'];
    
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
      console.log(`⚖️ ComparisonAgent executing for: ${message}`);

      let productsToCompare = [];

      // Step 1: Identify products to compare
      if (entities.products && entities.products.length >= 2) {
        // Search for products by name
        productsToCompare = await this._findProductsByNames(entities.products);
      } else if (context.selectedProducts && context.selectedProducts.length >= 2) {
        // Use pre-selected products
        productsToCompare = await this._getProductsByIds(context.selectedProducts);
      } else {
        // Try to extract from message
        const extracted = await this._extractProductsFromMessage(message, entities);
        productsToCompare = extracted;
      }

      if (productsToCompare.length < 2) {
        return {
          answer: '🤔 Tôi cần ít nhất 2 sản phẩm để so sánh. Vui lòng cung cấp tên hoặc ID của các sản phẩm bạn muốn so sánh.',
          products: [],
          intent: intent.intent,
          source: 'ComparisonAgent',
          error: 'Insufficient products for comparison'
        };
      }

      // Step 2: Get full product details
      const productIds = productsToCompare.map(p => p._id.toString());
      const comparisonResult = await ToolSystem.execute('compareProducts', {
        productIds,
        attributes: this._getComparisonAttributes(productsToCompare)
      });

      if (!comparisonResult.success) {
        throw new Error('Product comparison failed');
      }

      const comparison = comparisonResult.data;

      // Step 3: Analyze specifications
      const analysis = await this._analyzeComparison(comparison, entities.purpose);

      // Step 4: Generate AI response
      const aiResponse = await this._generateResponse(
        message,
        comparison,
        analysis,
        entities
      );

      return {
        answer: aiResponse,
        products: comparison.products,
        comparison: {
          table: comparison.specifications,
          analysis
        },
        intent: intent.intent,
        source: 'ComparisonAgent',
        metadata: {
          comparedProducts: comparison.products.length,
          attributes: Object.keys(comparison.specifications).length
        }
      };

    } catch (error) {
      console.error('ComparisonAgent error:', error);
      
      return {
        answer: this._getFallbackResponse(message, entities),
        products: [],
        intent: intent.intent,
        source: 'ComparisonAgent_Fallback',
        error: error.message
      };
    }
  }

  /**
   * Find products by names
   * @private
   */
  async _findProductsByNames(productNames) {
    const products = [];

    for (const name of productNames) {
      const result = await Product.find({
        name: new RegExp(name, 'i')
      })
        .limit(1)
        .lean();

      if (result.length > 0) {
        products.push(result[0]);
      }
    }

    return products;
  }

  /**
   * Get products by IDs
   * @private
   */
  async _getProductsByIds(productIds) {
    const products = await Product.find({
      _id: { $in: productIds }
    }).lean();

    return products;
  }

  /**
   * Extract products from message
   * @private
   */
  async _extractProductsFromMessage(message, entities) {
    // Try to find products mentioned in message
    const searches = [];

    // Extract GPU models
    const gpuMatches = message.match(/RTX\s*\d{4}|GTX\s*\d{4}|RX\s*\d{4}/gi);
    if (gpuMatches) {
      searches.push(...gpuMatches);
    }

    // Extract CPU models
    const cpuMatches = message.match(/i[3579]-?\d+[A-Z]?|Ryzen\s+[3579]\s+\d+[A-Z]?/gi);
    if (cpuMatches) {
      searches.push(...cpuMatches);
    }

    // Extract laptop models
    const laptopMatches = message.match(/(TUF|ROG|Vivobook|Zenbook|ThinkPad|Pavilion|Inspiron)\s+[\w\s-]+/gi);
    if (laptopMatches) {
      searches.push(...laptopMatches);
    }

    const products = [];
    for (const search of searches.slice(0, 3)) {
      const result = await Product.find({
        name: new RegExp(search, 'i')
      })
        .limit(1)
        .lean();

      if (result.length > 0) {
        products.push(result[0]);
      }
    }

    return products;
  }

  /**
   * Get comparison attributes based on product category
   * @private
   */
  _getComparisonAttributes(products) {
    const category = products[0].category;

    const attributesByCategory = {
      laptop: ['cpu', 'gpu', 'ram', 'storage', 'screen', 'battery', 'weight'],
      pc: ['cpu', 'gpu', 'ram', 'storage', 'psu', 'case'],
      gpu: ['model', 'vram', 'coreClock', 'memorySpeed', 'tdp', 'ports'],
      cpu: ['cores', 'threads', 'baseClock', 'boostClock', 'tdp', 'socket'],
      monitor: ['size', 'resolution', 'refreshRate', 'panelType', 'responseTime'],
      ram: ['capacity', 'speed', 'type', 'timing', 'voltage'],
      ssd: ['capacity', 'interface', 'readSpeed', 'writeSpeed', 'formFactor']
    };

    return attributesByCategory[category.toLowerCase()] || ['price', 'brand', 'rating'];
  }

  /**
   * Analyze comparison
   * @private
   */
  async _analyzeComparison(comparison, purpose) {
    const analysis = {
      winner: null,
      strengths: {},
      weaknesses: {},
      recommendations: []
    };

    const products = comparison.products;

    // Analyze price
    const prices = products.map(p => p.price);
    const minPriceIndex = prices.indexOf(Math.min(...prices));
    const maxPriceIndex = prices.indexOf(Math.max(...prices));

    analysis.strengths[products[minPriceIndex].id] = analysis.strengths[products[minPriceIndex].id] || [];
    analysis.strengths[products[minPriceIndex].id].push('Giá rẻ nhất');

    // Analyze ratings
    const ratings = products.map(p => p.rating || 0);
    const bestRatingIndex = ratings.indexOf(Math.max(...ratings));

    analysis.strengths[products[bestRatingIndex].id] = analysis.strengths[products[bestRatingIndex].id] || [];
    analysis.strengths[products[bestRatingIndex].id].push('Đánh giá cao nhất');

    // Stock analysis
    products.forEach((product, index) => {
      if (product.stock === 0) {
        analysis.weaknesses[product.id] = analysis.weaknesses[product.id] || [];
        analysis.weaknesses[product.id].push('Hết hàng');
      }
    });

    // Determine winner based on purpose
    if (purpose === 'gaming') {
      // For gaming, prioritize performance
      analysis.winner = products[bestRatingIndex].id;
      analysis.recommendations.push('Cho gaming, hiệu suất là quan trọng nhất');
    } else if (purpose === 'office') {
      // For office, prioritize value
      analysis.winner = products[minPriceIndex].id;
      analysis.recommendations.push('Cho văn phòng, tính tiết kiệm là ưu tiên');
    } else {
      // Balanced: best rating
      analysis.winner = products[bestRatingIndex].id;
    }

    return analysis;
  }

  /**
   * Generate AI response
   * @private
   */
  async _generateResponse(query, comparison, analysis, entities) {
    if (!this.model) {
      return this._getFallbackResponse(query, entities);
    }

    try {
      const productsInfo = comparison.products.map((p, idx) => `
**Sản phẩm ${idx + 1}: ${p.name}**
- Thương hiệu: ${p.brand}
- Giá: ${p.price?.toLocaleString('vi-VN')} VND
- Đánh giá: ${p.rating || 'Chưa có'} ⭐
- Tình trạng: ${p.stock > 0 ? 'Còn hàng' : 'Hết hàng'}
      `).join('\n');

      const specsTable = Object.entries(comparison.specifications)
        .map(([spec, values]) => `- ${spec}: ${values.join(' vs ')}`)
        .join('\n');

      const prompt = `Bạn là chuyên gia tư vấn sản phẩm công nghệ.

Khách hàng muốn so sánh: "${query}"

${productsInfo}

**Bảng so sánh thông số:**
${specsTable}

**Phân tích:**
- Điểm mạnh: ${JSON.stringify(analysis.strengths)}
- Điểm yếu: ${JSON.stringify(analysis.weaknesses)}

${await this._getRAGContext(query)}

Hãy:
1. Tóm tắt sự khác biệt chính
2. Phân tích ưu/nhược điểm từng sản phẩm
3. Giải thích kỹ thuật (dựa trên tài liệu tham khảo nếu có)
4. Đề xuất sản phẩm phù hợp nhất dựa trên mục đích sử dụng
5. Đưa ra lời khuyên cuối cùng

Trả lời bằng tiếng Việt, chi tiết và dễ hiểu.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();

    } catch (error) {
      console.error('Gemini generation error:', error);
      return this._getFallbackResponse(query, entities);
    }
  }

  /**
   * Get RAG context for richer comparison advice
   * @private
   */
  async _getRAGContext(query) {
    try {
      const docs = await VectorSearchService.hybridSearch(query, {
        limit: 2,
        minSimilarity: 0.25,
        categories: ['hardware', 'technology', 'product_spec']
      });
      if (docs.length === 0) return '';

      let context = '**TÀI LIỆU THAM KHẢO:**\n';
      docs.forEach((doc, i) => {
        context += `--- ${doc.source} ---\n${doc.text.substring(0, 500)}\n\n`;
      });
      return context;
    } catch {
      return '';
    }
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(query, entities) {
    return '⚖️ **So sánh sản phẩm**\n\nTôi đang phân tích và so sánh các sản phẩm để tìm ra sự khác biệt chính. Vui lòng xem bảng so sánh chi tiết bên dưới.';
  }
}

module.exports = new ComparisonAgent();
