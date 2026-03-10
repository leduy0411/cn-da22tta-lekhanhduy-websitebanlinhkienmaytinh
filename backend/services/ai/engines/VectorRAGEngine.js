/**
 * Vector RAG Engine
 * Enhanced RAG with vector embeddings and context building
 * 
 * @module services/ai/engines/VectorRAGEngine
 * @description Advanced RAG for AI-powered responses with product context
 */

const Product = require('../../../models/Product');
const ProductEmbedding = require('../../../models/ProductEmbedding');
const SemanticSearchService = require('../SemanticSearchService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class VectorRAGEngine {
  constructor() {
    this.embeddingsCache = new Map();
    this.contextCache = new Map();
    this.maxCacheSize = 100;

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.gemini.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      });
    }
  }

  /**
   * Generate response using RAG
   * @param {string} query - User query
   * @param {Array} products - Product context
   * @param {Object} options - RAG options
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(query, products = [], options = {}) {
    const {
      maxProducts = 5,
      includeSpecs = true,
      includeReviews = false,
      systemContext = 'default'
    } = options;

    try {
      // Build product context
      const productContext = this._buildProductContext(
        products.slice(0, maxProducts),
        { includeSpecs, includeReviews }
      );

      // Get system persona
      const systemPersona = this._getSystemPersona(systemContext);

      // Build prompt
      const prompt = this._buildPrompt(query, productContext, systemPersona);

      // Generate response with Gemini
      if (this.model) {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
      } else {
        return this._getFallbackResponse(query, products);
      }

    } catch (error) {
      console.error('VectorRAG generation error:', error);
      return this._getFallbackResponse(query, products);
    }
  }

  /**
   * Retrieve relevant products for RAG
   * @param {string} query - Search query
   * @param {Object} options - Retrieval options
   * @returns {Promise<Array>} Relevant products
   */
  async retrieveContext(query, options = {}) {
    const {
      limit = 5,
      category = null,
      minScore = 0.3,
      useCache = true
    } = options;

    // Check cache
    const cacheKey = `${query}_${category}_${limit}`;
    if (useCache && this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey);
    }

    try {
      // Use semantic search to find relevant products
      const results = await SemanticSearchService.searchWithEmbeddings(query, {
        limit: limit * 2,
        category,
        minScore
      });

      // Extract products
      const products = results.map(r => r.product);

      // Cache results
      if (useCache) {
        this._cacheContext(cacheKey, products);
      }

      return products;

    } catch (error) {
      console.error('Context retrieval error:', error);
      
      // Fallback to keyword search
      return this._fallbackRetrieval(query, { limit, category });
    }
  }

  /**
   * Generate embeddings for text
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async generateEmbedding(text) {
    // Use TF-IDF for now (can be upgraded to sentence transformers)
    return SemanticSearchService.calculateTFIDFVector(text);
  }

  /**
   * Build enriched product context
   * @private
   */
  _buildProductContext(products, options) {
    const { includeSpecs, includeReviews } = options;

    return products.map((product, index) => {
      let context = `\n**Sản phẩm ${index + 1}: ${product.name}**\n`;
      context += `- ID: ${product._id}\n`;
      context += `- Thương hiệu: ${product.brand || 'N/A'}\n`;
      context += `- Danh mục: ${product.category || 'N/A'}\n`;
      context += `- Giá: ${product.price?.toLocaleString('vi-VN')} VND`;
      
      if (product.originalPrice && product.originalPrice > product.price) {
        const discount = Math.round((1 - product.price / product.originalPrice) * 100);
        context += ` (Giảm ${discount}% từ ${product.originalPrice.toLocaleString('vi-VN')} VND)`;
      }
      
      context += `\n- Tình trạng: ${product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}\n`;
      context += `- Đánh giá: ${product.rating || 'Chưa có'} ⭐`;
      
      if (product.reviewCount) {
        context += ` (${product.reviewCount} đánh giá)`;
      }
      
      context += `\n- Mô tả: ${(product.description || '').substring(0, 200)}...\n`;

      if (includeSpecs && product.specifications) {
        context += `- Thông số kỹ thuật:\n`;
        Object.entries(product.specifications).slice(0, 5).forEach(([key, value]) => {
          context += `  • ${key}: ${value}\n`;
        });
      }

      return context;
    }).join('\n');
  }

  /**
   * Get system persona based on context
   * @private
   */
  _getSystemPersona(context) {
    const personas = {
      default: 'Bạn là chuyên gia tư vấn sản phẩm công nghệ tại TechStore.',
      gaming: 'Bạn là chuyên gia gaming gear, am hiểu sâu về PC gaming và thiết bị chơi game.',
      technical: 'Bạn là kỹ sư phần cứng, chuyên giải thích chi tiết kỹ thuật một cách dễ hiểu.',
      sales: 'Bạn là nhân viên bán hàng nhiệt tình, giúp khách hàng tìm sản phẩm phù hợp nhất.'
    };

    return personas[context] || personas.default;
  }

  /**
   * Build prompt for Gemini
   * @private
   */
  _buildPrompt(query, productContext, systemPersona) {
    return `${systemPersona}

**Yêu cầu của khách hàng:**
"${query}"

**Thông tin sản phẩm liên quan:**
${productContext}

**Nhiệm vụ:**
1. Phân tích yêu cầu của khách hàng
2. Giới thiệu các sản phẩm phù hợp nhất (ưu tiên top 2-3)
3. So sánh ưu/nhược điểm nếu có nhiều lựa chọn
4. Đưa ra khuyến nghị cụ thể
5. Hỏi thêm nếu cần làm rõ nhu cầu

**Lưu ý:**
- Trả lời bằng tiếng Việt
- Thân thiện, chuyên nghiệp
- Tập trung vào lợi ích khách hàng
- Sử dụng markdown để format (**, -, •)
- Đề cập ID sản phẩm khi giới thiệu

Trả lời:`;
  }

  /**
   * Fallback response
   * @private
   */
  _getFallbackResponse(query, products) {
    if (products.length === 0) {
      return '🔍 Xin lỗi, tôi không tìm thấy sản phẩm phù hợp. Bạn có thể mô tả chi tiết hơn được không?';
    }

    let response = '🛍️ **Dựa trên yêu cầu của bạn, đây là những sản phẩm phù hợp:**\n\n';
    
    products.slice(0, 3).forEach((product, index) => {
      response += `**${index + 1}. ${product.name}**\n`;
      response += `- Giá: ${product.price?.toLocaleString('vi-VN')} VND\n`;
      response += `- Đánh giá: ${product.rating || 'Chưa có'} ⭐\n\n`;
    });

    response += '💡 Bạn muốn biết thêm chi tiết về sản phẩm nào?';

    return response;
  }

  /**
   * Fallback retrieval using keyword search
   * @private
   */
  async _fallbackRetrieval(query, options) {
    const { limit, category } = options;

    const filter = {
      $text: { $search: query },
      stock: { $gt: 0 }
    };

    if (category) {
      filter.category = new RegExp(category, 'i');
    }

    const products = await Product.find(filter)
      .sort({ rating: -1 })
      .limit(limit)
      .lean();

    return products;
  }

  /**
   * Cache context
   * @private
   */
  _cacheContext(key, data) {
    if (this.contextCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.contextCache.keys().next().value;
      this.contextCache.delete(firstKey);
    }

    this.contextCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.contextCache.clear();
    console.log('🗑️ VectorRAG cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.contextCache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.contextCache.keys())
    };
  }
}

module.exports = new VectorRAGEngine();
