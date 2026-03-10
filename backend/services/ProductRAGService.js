/**
 * Product RAG Service - Context Builder
 * ════════════════════════════════════════════════════════════════
 * Search và retrieve products từ MongoDB để làm context cho RAG.
 * Sử dụng text search, keyword matching, và semantic filtering.
 * 
 * @module services/ProductRAGService
 * @author AI Expert Team
 * @version 2.0
 */

const Product = require('../models/Product');

class ProductRAGService {
  constructor() {
    this.maxResults = 5; // Số sản phẩm tối đa trả về cho context
    this.minScore = 0.3; // Relevance score tối thiểu
    console.log('✅ Product RAG Service initialized');
  }

  /**
   * Search products relevant to user query
   * 
   * @param {string} query - User's message/question
   * @param {number} limit - Max products to return (default: 5)
   * @returns {Promise<Array>} Array of relevant products
   */
  async searchRelevantProducts(query, limit = 5) {
    try {
      // Extract keywords để search tốt hơn
      const keywords = this._extractKeywords(query);
      
      // Build search criteria
      const searchCriteria = this._buildSearchCriteria(keywords, query);
      
      // Query MongoDB với text search + filters
      const products = await Product.find(searchCriteria)
        .select('name brand price stock rating reviewCount description specifications category subcategory images')
        .limit(limit)
        .sort({ rating: -1, reviewCount: -1 }) // Prefer high-rated products
        .lean();

      // Fallback: Nếu không tìm thấy sản phẩm, lấy sản phẩm nổi bật
      if (products.length === 0) {
        return await this._getFeaturedProducts(limit);
      }

      return products;

    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  /**
   * Get products by category
   * 
   * @param {string} category - Category name
   * @param {number} limit - Max products
   * @returns {Promise<Array>}
   */
  async getProductsByCategory(category, limit = 5) {
    try {
      const products = await Product.find({ 
        category: new RegExp(category, 'i'),
        stock: { $gt: 0 } // Chỉ lấy sản phẩm còn hàng
      })
        .select('name brand price stock rating reviewCount description specifications')
        .limit(limit)
        .sort({ rating: -1 })
        .lean();

      return products;
    } catch (error) {
      console.error('Error getting products by category:', error);
      return [];
    }
  }

  /**
   * Get products trong price range
   * 
   * @param {number} minPrice 
   * @param {number} maxPrice 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getProductsByPriceRange(minPrice, maxPrice, limit = 5) {
    try {
      const products = await Product.find({
        price: { $gte: minPrice, $lte: maxPrice },
        stock: { $gt: 0 }
      })
        .select('name brand price stock rating reviewCount description')
        .limit(limit)
        .sort({ rating: -1 })
        .lean();

      return products;
    } catch (error) {
      console.error('Error getting products by price range:', error);
      return [];
    }
  }

  /**
   * Get product details by ID
   * 
   * @param {string} productId 
   * @returns {Promise<Object|null>}
   */
  async getProductById(productId) {
    try {
      const product = await Product.findById(productId)
        .select('name brand price stock rating reviewCount description specifications category subcategory images')
        .lean();
      
      return product;
    } catch (error) {
      console.error('Error getting product by ID:', error);
      return null;
    }
  }

  /**
   * Extract keywords từ user query
   * @private
   */
  _extractKeywords(query) {
    // Danh sách từ khóa phổ biến
    const categories = ['laptop', 'máy tính', 'pc', 'gaming', 'văn phòng', 'card', 'vga', 'cpu', 'ram', 'ssd', 'hdd', 'màn hình', 'monitor', 'bàn phím', 'keyboard', 'chuột', 'mouse', 'tai nghe', 'headphone'];
    const brands = ['asus', 'msi', 'dell', 'hp', 'lenovo', 'acer', 'apple', 'intel', 'amd', 'nvidia', 'gigabyte', 'corsair', 'logitech', 'razer'];
    const specs = ['i5', 'i7', 'i9', 'ryzen', 'rtx', 'gtx', '16gb', '32gb', '512gb', '1tb', '144hz', '4k', 'rgb'];

    const lowerQuery = query.toLowerCase();
    const keywords = {
      categories: categories.filter(c => lowerQuery.includes(c)),
      brands: brands.filter(b => lowerQuery.includes(b)),
      specs: specs.filter(s => lowerQuery.includes(s))
    };

    return keywords;
  }

  /**
   * Build MongoDB search criteria
   * @private
   */
  _buildSearchCriteria(keywords, query) {
    const criteria = {
      stock: { $gt: 0 } // Chỉ lấy sản phẩm còn hàng
    };

    // OR conditions for flexible matching
    const orConditions = [];

    // Text search trên name và description
    if (query && query.trim().length > 2) {
      orConditions.push(
        { name: new RegExp(query, 'i') },
        { description: new RegExp(query, 'i') },
        { brand: new RegExp(query, 'i') }
      );
    }

    // Category matching
    if (keywords.categories && keywords.categories.length > 0) {
      keywords.categories.forEach(cat => {
        orConditions.push({ category: new RegExp(cat, 'i') });
        orConditions.push({ subcategory: new RegExp(cat, 'i') });
      });
    }

    // Brand matching
    if (keywords.brands && keywords.brands.length > 0) {
      keywords.brands.forEach(brand => {
        orConditions.push({ brand: new RegExp(brand, 'i') });
      });
    }

    // Specs matching (in specifications object or name)
    if (keywords.specs && keywords.specs.length > 0) {
      keywords.specs.forEach(spec => {
        orConditions.push({ name: new RegExp(spec, 'i') });
      });
    }

    if (orConditions.length > 0) {
      criteria.$or = orConditions;
    }

    return criteria;
  }

  /**
   * Get featured products as fallback
   * @private
   */
  async _getFeaturedProducts(limit = 5) {
    try {
      const products = await Product.find({ 
        stock: { $gt: 0 },
        rating: { $gte: 4 } // Sản phẩm đánh giá cao
      })
        .select('name brand price stock rating reviewCount description specifications')
        .limit(limit)
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
        .lean();

      return products;
    } catch (error) {
      console.error('Error getting featured products:', error);
      return [];
    }
  }

  /**
   * Check if query is about price comparison
   * 
   * @param {string} query 
   * @returns {boolean}
   */
  isPriceQuery(query) {
    const priceKeywords = ['giá', 'bao nhiêu', 'price', 'chi phí', 'cost', 'tiền', 'rẻ', 'đắt', 'budget'];
    return priceKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  /**
   * Check if query is asking for recommendations
   * 
   * @param {string} query 
   * @returns {boolean}
   */
  isRecommendationQuery(query) {
    const recKeywords = ['nên mua', 'gợi ý', 'recommend', 'tư vấn', 'chọn', 'so sánh', 'compare', 'tốt nhất', 'best'];
    return recKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }
}

// Export singleton instance
module.exports = new ProductRAGService();
