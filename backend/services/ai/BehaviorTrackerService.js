/**
 * Behavior Tracker Service
 * Tracks and analyzes user behaviors for personalization
 * 
 * @module services/ai/BehaviorTrackerService
 * @description User behavior analytics and preference learning
 */

const UserInteraction = require('../../models/UserInteraction');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

class BehaviorTrackerService {
  constructor() {
    this.behaviorTypes = {
      VIEWED_PRODUCT: 'viewed_product',
      SEARCHED_QUERY: 'searched_query',
      RECEIVED_RECOMMENDATION: 'received_recommendation',
      COMPARED_PRODUCTS: 'compared_products',
      ASKED_QUESTION: 'asked_question',
      PC_BUILD_REQUEST: 'pc_build_request',
      ADDED_TO_CART: 'added_to_cart',
      PURCHASED: 'purchased',
      RATED_PRODUCT: 'rated_product'
    };
  }

  /**
   * Track user behavior
   * @param {String} userId - User ID (optional)
   * @param {String} sessionId - Session ID
   * @param {String} behaviorType - Type of behavior
   * @param {Object} metadata - Additional data
   * @returns {Object} Tracked behavior
   */
  async trackBehavior(userId, sessionId, behaviorType, metadata = {}) {
    try {
      // Validate behavior type
      if (!Object.values(this.behaviorTypes).includes(behaviorType)) {
        throw new Error(`Invalid behavior type: ${behaviorType}`);
      }

      const interaction = new UserInteraction({
        user: userId || null,
        sessionId,
        type: behaviorType,
        product: metadata.productId || null,
        metadata: {
          ...metadata,
          timestamp: new Date()
        }
      });

      await interaction.save();

      console.log(`📊 Tracked behavior: ${behaviorType} (session: ${sessionId})`);

      return {
        success: true,
        interaction
      };
    } catch (error) {
      console.error('❌ Error tracking behavior:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Track product view
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} productId - Product ID
   * @param {Object} source - Source of view (search, recommendation, etc.)
   * @returns {Object} Result
   */
  async trackProductView(userId, sessionId, productId, source = {}) {
    return await this.trackBehavior(userId, sessionId, this.behaviorTypes.VIEWED_PRODUCT, {
      productId,
      source: source.agent || 'direct',
      intent: source.intent,
      query: source.query
    });
  }

  /**
   * Track search query
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {String} query - Search query
   * @param {Object} results - Search results metadata
   * @returns {Object} Result
   */
  async trackSearch(userId, sessionId, query, results = {}) {
    return await this.trackBehavior(userId, sessionId, this.behaviorTypes.SEARCHED_QUERY, {
      query,
      resultCount: results.productCount || 0,
      intent: results.intent,
      agent: results.agent
    });
  }

  /**
   * Track recommendation received
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Array} productIds - Recommended product IDs
   * @param {String} strategy - Recommendation strategy used
   * @returns {Object} Result
   */
  async trackRecommendation(userId, sessionId, productIds, strategy) {
    return await this.trackBehavior(userId, sessionId, this.behaviorTypes.RECEIVED_RECOMMENDATION, {
      productIds,
      strategy,
      count: productIds.length
    });
  }

  /**
   * Track product comparison
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Array} productIds - Compared product IDs
   * @returns {Object} Result
   */
  async trackComparison(userId, sessionId, productIds) {
    return await this.trackBehavior(userId, sessionId, this.behaviorTypes.COMPARED_PRODUCTS, {
      productIds,
      count: productIds.length
    });
  }

  /**
   * Track PC build request
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Number} budget - Build budget
   * @param {String} purpose - Build purpose
   * @returns {Object} Result
   */
  async trackPCBuild(userId, sessionId, budget, purpose) {
    return await this.trackBehavior(userId, sessionId, this.behaviorTypes.PC_BUILD_REQUEST, {
      budget,
      purpose
    });
  }

  /**
   * Get user preferences based on behavior history
   * @param {String} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Object} User preferences
   */
  async getUserPreferences(userId, options = {}) {
    try {
      const { days = 90 } = options;

      if (!userId) {
        return {
          success: false,
          error: 'User ID required'
        };
      }

      // Get interactions from last N days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const interactions = await UserInteraction.find({
        user: userId,
        createdAt: { $gte: startDate }
      }).populate('product').lean();

      // Analyze categories
      const categoryCount = {};
      const brandCount = {};
      const priceHistory = [];

      interactions.forEach(interaction => {
        if (interaction.product) {
          // Count categories
          const category = interaction.product.category;
          categoryCount[category] = (categoryCount[category] || 0) + 1;

          // Count brands
          const brand = interaction.product.brand;
          brandCount[brand] = (brandCount[brand] || 0) + 1;

          // Collect prices
          priceHistory.push(interaction.product.price);
        }
      });

      // Get top categories
      const favoriteCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category]) => category);

      // Get top brands
      const favoriteBrands = Object.entries(brandCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([brand]) => brand);

      // Calculate average price range
      const averageSpent = priceHistory.length > 0
        ? priceHistory.reduce((sum, price) => sum + price, 0) / priceHistory.length
        : 0;

      const minPrice = priceHistory.length > 0 ? Math.min(...priceHistory) : 0;
      const maxPrice = priceHistory.length > 0 ? Math.max(...priceHistory) : 0;

      // Get interaction types distribution
      const behaviorDistribution = {};
      interactions.forEach(interaction => {
        behaviorDistribution[interaction.type] = (behaviorDistribution[interaction.type] || 0) + 1;
      });

      return {
        success: true,
        preferences: {
          favoriteCategories,
          favoriteBrands,
          priceRange: {
            min: minPrice,
            max: maxPrice,
            average: Math.round(averageSpent)
          },
          behaviorDistribution,
          totalInteractions: interactions.length,
          analysisWindow: `${days} days`
        }
      };
    } catch (error) {
      console.error('❌ Error getting user preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get session behavior summary
   * @param {String} sessionId - Session ID
   * @returns {Object} Session behavior summary
   */
  async getSessionBehaviors(sessionId) {
    try {
      const interactions = await UserInteraction.find({ sessionId })
        .populate('product')
        .sort({ createdAt: 1 })
        .lean();

      // Categorize behaviors
      const behaviorsByType = {};
      interactions.forEach(interaction => {
        if (!behaviorsByType[interaction.type]) {
          behaviorsByType[interaction.type] = [];
        }
        behaviorsByType[interaction.type].push(interaction);
      });

      // Extract viewed products
      const viewedProducts = interactions
        .filter(i => i.type === this.behaviorTypes.VIEWED_PRODUCT && i.product)
        .map(i => ({
          productId: i.product._id,
          name: i.product.name,
          category: i.product.category,
          brand: i.product.brand,
          price: i.product.price,
          timestamp: i.createdAt
        }));

      // Extract search queries
      const searchQueries = interactions
        .filter(i => i.type === this.behaviorTypes.SEARCHED_QUERY)
        .map(i => ({
          query: i.metadata.query,
          resultCount: i.metadata.resultCount,
          timestamp: i.createdAt
        }));

      return {
        success: true,
        summary: {
          totalInteractions: interactions.length,
          behaviorsByType,
          viewedProducts,
          searchQueries,
          firstInteraction: interactions[0]?.createdAt,
          lastInteraction: interactions[interactions.length - 1]?.createdAt
        }
      };
    } catch (error) {
      console.error('❌ Error getting session behaviors:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user purchase history insights
   * @param {String} userId - User ID
   * @returns {Object} Purchase insights
   */
  async getPurchaseInsights(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID required'
        };
      }

      const orders = await Order.find({ 
        user: userId,
        status: { $in: ['delivered', 'completed'] }
      }).populate('orderItems.product').lean();

      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + order.finalTotal, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      // Analyze purchased categories
      const purchasedCategories = {};
      const purchasedBrands = {};

      orders.forEach(order => {
        order.orderItems.forEach(item => {
          if (item.product) {
            const category = item.product.category;
            const brand = item.product.brand;

            purchasedCategories[category] = (purchasedCategories[category] || 0) + item.quantity;
            purchasedBrands[brand] = (purchasedBrands[brand] || 0) + item.quantity;
          }
        });
      });

      // Get top purchased categories
      const topCategories = Object.entries(purchasedCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, count]) => ({ category, count }));

      // Get top purchased brands
      const topBrands = Object.entries(purchasedBrands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([brand, count]) => ({ brand, count }));

      return {
        success: true,
        insights: {
          totalOrders,
          totalSpent,
          averageOrderValue: Math.round(averageOrderValue),
          topCategories,
          topBrands,
          lastPurchase: orders.length > 0 ? orders[orders.length - 1].createdAt : null
        }
      };
    } catch (error) {
      console.error('❌ Error getting purchase insights:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get trending behaviors across all users
   * @param {Object} options - Analysis options
   * @returns {Object} Trending behaviors
   */
  async getTrendingBehaviors(options = {}) {
    try {
      const { days = 7, limit = 10 } = options;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get top searched queries
      const topQueries = await UserInteraction.aggregate([
        {
          $match: {
            type: this.behaviorTypes.SEARCHED_QUERY,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$metadata.query',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      // Get most viewed products
      const topViewedProducts = await UserInteraction.aggregate([
        {
          $match: {
            type: this.behaviorTypes.VIEWED_PRODUCT,
            product: { $ne: null },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$product',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      // Populate product details
      const productIds = topViewedProducts.map(p => p._id);
      const products = await Product.find({ _id: { $in: productIds } }).lean();
      
      const productMap = {};
      products.forEach(p => {
        productMap[p._id.toString()] = p;
      });

      const viewedProductsWithDetails = topViewedProducts.map(item => ({
        product: productMap[item._id.toString()],
        viewCount: item.count
      }));

      return {
        success: true,
        trending: {
          topQueries: topQueries.map(q => ({ query: q._id, count: q.count })),
          topViewedProducts: viewedProductsWithDetails,
          analysisWindow: `${days} days`
        }
      };
    } catch (error) {
      console.error('❌ Error getting trending behaviors:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new BehaviorTrackerService();
