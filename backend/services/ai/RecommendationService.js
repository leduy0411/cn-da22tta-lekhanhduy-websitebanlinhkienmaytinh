/**
 * Recommendation Service
 * Hệ thống gợi ý sản phẩm đa mức: Rule-based → Collaborative Filtering → Hybrid
 * 
 * @module services/ai/RecommendationService
 * @description AI Service cho Product Recommendations
 */

const mongoose = require('mongoose');
const Product = require('../../models/Product');
const UserInteraction = require('../../models/UserInteraction');
const ProductEmbedding = require('../../models/ProductEmbedding');
const Order = require('../../models/Order');

class RecommendationService {
  constructor() {
    // Cache cho similarity matrices
    this.userSimilarityCache = new Map();
    this.itemSimilarityCache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
    
    // Weights cho hybrid model
    this.hybridWeights = {
      collaborative: 0.4,
      contentBased: 0.35,
      popularity: 0.15,
      ruleBased: 0.1
    };
  }

  // ==================== UTILITY METHODS ====================
  
  /**
   * Tính Cosine Similarity giữa 2 vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Tính Pearson Correlation
   */
  pearsonCorrelation(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
    
    const n = vecA.length;
    const meanA = vecA.reduce((a, b) => a + b, 0) / n;
    const meanB = vecB.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    
    for (let i = 0; i < n; i++) {
      const diffA = vecA[i] - meanA;
      const diffB = vecB[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }
    
    if (denomA === 0 || denomB === 0) return 0;
    return numerator / (Math.sqrt(denomA) * Math.sqrt(denomB));
  }

  /**
   * Normalize scores to 0-1 range
   */
  normalizeScores(items) {
    if (items.length === 0) return items;
    
    const maxScore = Math.max(...items.map(i => i.score));
    const minScore = Math.min(...items.map(i => i.score));
    const range = maxScore - minScore;
    
    if (range === 0) return items.map(i => ({ ...i, normalizedScore: 1 }));
    
    return items.map(i => ({
      ...i,
      normalizedScore: (i.score - minScore) / range
    }));
  }

  // ==================== LEVEL 1: RULE-BASED RECOMMENDATIONS ====================
  
  /**
   * Gợi ý dựa trên rules đơn giản
   * - Sản phẩm cùng category
   * - Sản phẩm cùng thương hiệu
   * - Sản phẩm theo giá tương đương
   */
  async getRuleBasedRecommendations(productId, options = {}) {
    const { limit = 10, excludeIds = [] } = options;
    
    // Lấy thông tin sản phẩm hiện tại
    const product = await Product.findById(productId);
    if (!product) return [];

    const excludeObjectIds = [...excludeIds, productId].map(id => 
      new mongoose.Types.ObjectId(id)
    );

    // Tính price range (±20%)
    const priceMin = product.price * 0.8;
    const priceMax = product.price * 1.2;

    // Query với scoring rules
    const recommendations = await Product.aggregate([
      {
        $match: {
          _id: { $nin: excludeObjectIds },
          stock: { $gt: 0 }
        }
      },
      {
        $addFields: {
          // Scoring rules
          sameCategoryScore: { $cond: [{ $eq: ['$category', product.category] }, 30, 0] },
          sameBrandScore: { $cond: [{ $eq: ['$brand', product.brand] }, 20, 0] },
          priceRangeScore: {
            $cond: [
              { $and: [
                { $gte: ['$price', priceMin] },
                { $lte: ['$price', priceMax] }
              ]},
              15,
              0
            ]
          },
          ratingScore: { $multiply: ['$rating', 5] },
          stockScore: { $cond: [{ $gt: ['$stock', 10] }, 5, 0] }
        }
      },
      {
        $addFields: {
          totalScore: {
            $add: [
              '$sameCategoryScore',
              '$sameBrandScore', 
              '$priceRangeScore',
              '$ratingScore',
              '$stockScore'
            ]
          }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          image: 1,
          category: 1,
          brand: 1,
          rating: 1,
          stock: 1,
          score: '$totalScore',
          recommendationType: { $literal: 'rule-based' }
        }
      }
    ]);

    return recommendations;
  }

  /**
   * Gợi ý sản phẩm bổ sung (Cross-sell)
   * Ví dụ: Mua laptop → gợi ý chuột, bàn phím, túi đựng
   */
  async getCrossSellRecommendations(productId, options = {}) {
    const { limit = 5 } = options;
    
    const product = await Product.findById(productId);
    if (!product) return [];

    // Mapping cross-sell categories
    const crossSellMap = {
      'Laptop': ['Chuột', 'Bàn phím', 'Tai nghe', 'Màn hình'],
      'PC': ['Màn hình', 'Bàn phím', 'Chuột', 'Ghế gaming'],
      'CPU': ['Mainboard', 'Tản nhiệt'],
      'VGA': ['Nguồn', 'Case'],
      'Mainboard': ['RAM', 'CPU', 'Ổ cứng'],
      'RAM': ['Mainboard', 'CPU'],
      'Màn hình': ['VGA', 'Cáp HDMI'],
      'Ổ cứng': ['Case', 'Cáp SATA'],
      'Case': ['Nguồn', 'Tản nhiệt'],
      'Tản nhiệt': ['Case', 'CPU'],
      'Nguồn': ['VGA', 'Case'],
      'Bàn phím': ['Chuột', 'Lót chuột'],
      'Chuột': ['Bàn phím', 'Lót chuột'],
      'Ghế gaming': ['Bàn gaming', 'PC'],
      'Tai nghe': ['Laptop', 'PC'],
      'Loa': ['PC', 'Laptop'],
      'Console': ['Tay cầm', 'Màn hình']
    };

    const targetCategories = crossSellMap[product.category] || [];
    if (targetCategories.length === 0) return [];

    const recommendations = await Product.find({
      category: { $in: targetCategories },
      stock: { $gt: 0 }
    })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit)
    .select('name price image category brand rating stock');

    return recommendations.map(p => ({
      ...p.toObject(),
      score: 1,
      recommendationType: 'cross-sell'
    }));
  }

  // ==================== LEVEL 2: COLLABORATIVE FILTERING ====================

  /**
   * User-Based Collaborative Filtering
   * Tìm users tương tự → gợi ý sản phẩm họ đã tương tác
   */
  async getUserBasedCF(userId, options = {}) {
    const { limit = 10, minSimilarity = 0.1, topK = 20 } = options;
    
    // Lấy interaction matrix
    const interactionMatrix = await UserInteraction.getInteractionMatrix({
      minInteractions: 2,
      timeRange: 90
    });

    if (interactionMatrix.length < 2) {
      console.log('Not enough users for User-Based CF');
      return [];
    }

    // Tìm user hiện tại trong matrix
    const currentUserData = interactionMatrix.find(
      u => u._id.toString() === userId.toString()
    );
    
    if (!currentUserData || currentUserData.interactions.length === 0) {
      return [];
    }

    // Tạo user vector
    const allProducts = new Set();
    interactionMatrix.forEach(u => {
      u.interactions.forEach(i => allProducts.add(i.product.toString()));
    });
    const productList = Array.from(allProducts);

    const createUserVector = (userData) => {
      const vector = new Array(productList.length).fill(0);
      userData.interactions.forEach(i => {
        const idx = productList.indexOf(i.product.toString());
        if (idx !== -1) vector[idx] = i.score;
      });
      return vector;
    };

    const currentUserVector = createUserVector(currentUserData);
    
    // Tính similarity với các users khác
    const userSimilarities = [];
    for (const otherUser of interactionMatrix) {
      if (otherUser._id.toString() === userId.toString()) continue;
      
      const otherVector = createUserVector(otherUser);
      const similarity = this.cosineSimilarity(currentUserVector, otherVector);
      
      if (similarity >= minSimilarity) {
        userSimilarities.push({
          userId: otherUser._id,
          similarity,
          interactions: otherUser.interactions
        });
      }
    }

    // Sort by similarity và lấy top K users
    userSimilarities.sort((a, b) => b.similarity - a.similarity);
    const topUsers = userSimilarities.slice(0, topK);

    // Lấy products từ similar users (không có trong current user)
    const currentUserProducts = new Set(
      currentUserData.interactions.map(i => i.product.toString())
    );

    const productScores = new Map();
    
    for (const user of topUsers) {
      for (const interaction of user.interactions) {
        const productId = interaction.product.toString();
        if (currentUserProducts.has(productId)) continue;
        
        const weightedScore = interaction.score * user.similarity;
        const current = productScores.get(productId) || { score: 0, count: 0 };
        productScores.set(productId, {
          score: current.score + weightedScore,
          count: current.count + 1
        });
      }
    }

    // Convert to array và sort
    const recommendations = Array.from(productScores.entries())
      .map(([productId, data]) => ({
        productId,
        score: data.score / data.count, // Normalize by count
        supportCount: data.count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Fetch product details
    const productIds = recommendations.map(r => r.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('name price image category brand rating stock');

    return recommendations.map(r => {
      const product = products.find(p => p._id.toString() === r.productId);
      return {
        ...product?.toObject(),
        score: r.score,
        supportCount: r.supportCount,
        recommendationType: 'user-based-cf'
      };
    }).filter(r => r.name);
  }

  /**
   * Item-Based Collaborative Filtering
   * Tìm items tương tự dựa trên user interactions
   */
  async getItemBasedCF(productId, options = {}) {
    const { limit = 10, minSimilarity = 0.1 } = options;
    
    // Check cache
    const cacheKey = `item-${productId}`;
    const cached = this.itemSimilarityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data.slice(0, limit);
    }

    // Lấy tất cả interactions
    const interactions = await UserInteraction.find({
      interactionType: { $in: ['view', 'cart_add', 'purchase', 'review'] }
    }).select('user product weight');

    // Tạo item-user matrix
    const itemUserMap = new Map();
    const allUsers = new Set();
    
    interactions.forEach(i => {
      const productKey = i.product.toString();
      const userKey = i.user.toString();
      allUsers.add(userKey);
      
      if (!itemUserMap.has(productKey)) {
        itemUserMap.set(productKey, new Map());
      }
      const userMap = itemUserMap.get(productKey);
      userMap.set(userKey, (userMap.get(userKey) || 0) + i.weight);
    });

    const userList = Array.from(allUsers);
    const targetProductId = productId.toString();
    
    if (!itemUserMap.has(targetProductId)) {
      return [];
    }

    const createItemVector = (productId) => {
      const userMap = itemUserMap.get(productId);
      if (!userMap) return null;
      return userList.map(userId => userMap.get(userId) || 0);
    };

    const targetVector = createItemVector(targetProductId);
    if (!targetVector) return [];

    // Tính similarity với các products khác
    const similarities = [];
    for (const [otherProductId] of itemUserMap) {
      if (otherProductId === targetProductId) continue;
      
      const otherVector = createItemVector(otherProductId);
      if (!otherVector) continue;
      
      const similarity = this.cosineSimilarity(targetVector, otherVector);
      
      if (similarity >= minSimilarity) {
        similarities.push({
          productId: otherProductId,
          similarity
        });
      }
    }

    // Sort và limit
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, limit);

    // Fetch product details
    const productIds = topSimilar.map(s => s.productId);
    const products = await Product.find({ 
      _id: { $in: productIds },
      stock: { $gt: 0 }
    }).select('name price image category brand rating stock');

    const results = topSimilar.map(s => {
      const product = products.find(p => p._id.toString() === s.productId);
      if (!product) return null;
      return {
        ...product.toObject(),
        score: s.similarity,
        recommendationType: 'item-based-cf'
      };
    }).filter(r => r !== null);

    // Cache results
    this.itemSimilarityCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return results;
  }

  // ==================== LEVEL 3: CONTENT-BASED FILTERING ====================

  /**
   * Content-Based Filtering sử dụng Product Embeddings
   */
  async getContentBasedRecommendations(productId, options = {}) {
    const { limit = 10, minSimilarity = 0.5 } = options;
    
    // Lấy embedding của product hiện tại
    const productEmbedding = await ProductEmbedding.findOne({
      product: productId,
      status: 'completed'
    });

    if (!productEmbedding) {
      // Fallback to rule-based nếu chưa có embedding
      console.log('No embedding found, falling back to rule-based');
      return this.getRuleBasedRecommendations(productId, options);
    }

    // Tìm similar products
    const similarProducts = await ProductEmbedding.findSimilarProducts(
      productEmbedding.embedding,
      {
        limit,
        minSimilarity,
        excludeProductIds: [productId]
      }
    );

    // Fetch full product details
    const productIds = similarProducts.map(s => s.product);
    const products = await Product.find({
      _id: { $in: productIds },
      stock: { $gt: 0 }
    }).select('name price image category brand rating stock');

    return similarProducts.map(s => {
      const product = products.find(p => p._id.toString() === s.product.toString());
      if (!product) return null;
      return {
        ...product.toObject(),
        score: s.similarity,
        recommendationType: 'content-based'
      };
    }).filter(r => r !== null);
  }

  // ==================== LEVEL 4: HYBRID RECOMMENDATIONS ====================

  /**
   * Hybrid Recommendation System
   * Kết hợp nhiều phương pháp với weighted scoring
   */
  async getHybridRecommendations(userId, productId = null, options = {}) {
    const { 
      limit = 10, 
      weights = this.hybridWeights,
      diversityFactor = 0.3  // Để đảm bảo diversity
    } = options;

    const allRecommendations = new Map();
    const addToMap = (items, sourceWeight, sourceName) => {
      items.forEach((item, index) => {
        const id = item._id?.toString() || item.productId?.toString();
        if (!id) return;
        
        // Position-based decay
        const positionWeight = 1 / Math.log2(index + 2);
        const score = (item.normalizedScore || item.score || 1) * sourceWeight * positionWeight;
        
        const existing = allRecommendations.get(id);
        if (existing) {
          existing.score += score;
          existing.sources.push(sourceName);
        } else {
          allRecommendations.set(id, {
            productId: id,
            score,
            sources: [sourceName],
            product: item
          });
        }
      });
    };

    // 1. Get Collaborative Filtering recommendations
    if (userId) {
      try {
        const userBasedRecs = await this.getUserBasedCF(userId, { limit: 20 });
        const normalizedUserBased = this.normalizeScores(userBasedRecs);
        addToMap(normalizedUserBased, weights.collaborative * 0.5, 'user-based-cf');
      } catch (err) {
        console.log('User-based CF error:', err.message);
      }
    }

    // 2. Get Item-Based CF recommendations
    if (productId) {
      try {
        const itemBasedRecs = await this.getItemBasedCF(productId, { limit: 20 });
        const normalizedItemBased = this.normalizeScores(itemBasedRecs);
        addToMap(normalizedItemBased, weights.collaborative * 0.5, 'item-based-cf');
      } catch (err) {
        console.log('Item-based CF error:', err.message);
      }
    }

    // 3. Get Content-Based recommendations
    if (productId) {
      try {
        const contentBasedRecs = await this.getContentBasedRecommendations(productId, { limit: 20 });
        const normalizedContentBased = this.normalizeScores(contentBasedRecs);
        addToMap(normalizedContentBased, weights.contentBased, 'content-based');
      } catch (err) {
        console.log('Content-based error:', err.message);
      }
    }

    // 4. Get Popularity-based recommendations
    try {
      const popularProducts = await UserInteraction.getPopularProducts(20, 30);
      const popularWithProducts = await Product.find({
        _id: { $in: popularProducts.map(p => p._id) },
        stock: { $gt: 0 }
      }).select('name price image category brand rating stock');

      const popularRecs = popularProducts.map(p => {
        const product = popularWithProducts.find(
          prod => prod._id.toString() === p._id.toString()
        );
        return product ? { ...product.toObject(), score: p.score } : null;
      }).filter(p => p !== null);

      const normalizedPopular = this.normalizeScores(popularRecs);
      addToMap(normalizedPopular, weights.popularity, 'popularity');
    } catch (err) {
      console.log('Popularity error:', err.message);
    }

    // 5. Get Rule-Based recommendations
    if (productId) {
      try {
        const ruleBasedRecs = await this.getRuleBasedRecommendations(productId, { limit: 15 });
        const normalizedRuleBased = this.normalizeScores(ruleBasedRecs);
        addToMap(normalizedRuleBased, weights.ruleBased, 'rule-based');
      } catch (err) {
        console.log('Rule-based error:', err.message);
      }
    }

    // Convert map to array và sort
    let results = Array.from(allRecommendations.values())
      .sort((a, b) => b.score - a.score);

    // Apply diversity (ensure variety in categories)
    if (diversityFactor > 0) {
      results = this.applyDiversity(results, diversityFactor, limit * 2);
    }

    // Fetch complete product details
    const topResults = results.slice(0, limit);
    const productIds = topResults.map(r => r.productId);
    
    const products = await Product.find({
      _id: { $in: productIds }
    }).select('name price originalPrice image images category brand rating reviewCount stock');

    return topResults.map(r => {
      const product = products.find(p => p._id.toString() === r.productId);
      if (!product) return null;
      return {
        ...product.toObject(),
        score: r.score,
        sources: r.sources,
        recommendationType: 'hybrid'
      };
    }).filter(r => r !== null);
  }

  /**
   * Apply diversity để đảm bảo recommendations không bị thiên lệch về 1 category
   */
  applyDiversity(items, diversityFactor, targetCount) {
    const categoryCount = new Map();
    const diverseResults = [];
    const maxPerCategory = Math.ceil(targetCount / 3);

    for (const item of items) {
      const category = item.product?.category || 'unknown';
      const count = categoryCount.get(category) || 0;
      
      // Penalize score nếu đã có nhiều items cùng category
      if (count < maxPerCategory) {
        const penalty = 1 - (count * diversityFactor / maxPerCategory);
        diverseResults.push({
          ...item,
          score: item.score * penalty
        });
        categoryCount.set(category, count + 1);
      }
    }

    return diverseResults.sort((a, b) => b.score - a.score);
  }

  // ==================== PERSONALIZED RECOMMENDATIONS ====================

  /**
   * Gợi ý cá nhân hóa cho user dựa trên lịch sử
   */
  async getPersonalizedRecommendations(userId, options = {}) {
    const { limit = 10 } = options;

    // Lấy lịch sử interactions gần đây
    const recentInteractions = await UserInteraction.find({
      user: userId
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('product', 'category brand');

    if (recentInteractions.length === 0) {
      // New user - return popular products
      return this.getPopularRecommendations({ limit });
    }

    // Phân tích preferences
    const categoryPrefs = new Map();
    const brandPrefs = new Map();
    
    recentInteractions.forEach(interaction => {
      if (!interaction.product) return;
      
      const category = interaction.product.category;
      const brand = interaction.product.brand;
      
      categoryPrefs.set(category, (categoryPrefs.get(category) || 0) + interaction.weight);
      if (brand) {
        brandPrefs.set(brand, (brandPrefs.get(brand) || 0) + interaction.weight);
      }
    });

    // Sort preferences
    const topCategories = Array.from(categoryPrefs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const topBrands = Array.from(brandPrefs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);

    // Get products matching preferences
    const interactedProductIds = recentInteractions.map(i => i.product?._id).filter(Boolean);
    
    const recommendations = await Product.find({
      _id: { $nin: interactedProductIds },
      stock: { $gt: 0 },
      $or: [
        { category: { $in: topCategories } },
        { brand: { $in: topBrands } }
      ]
    })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit)
    .select('name price image category brand rating stock');

    return recommendations.map(p => ({
      ...p.toObject(),
      recommendationType: 'personalized',
      matchedPreferences: {
        category: topCategories.includes(p.category),
        brand: topBrands.includes(p.brand)
      }
    }));
  }

  /**
   * Gợi ý sản phẩm phổ biến
   */
  async getPopularRecommendations(options = {}) {
    const { limit = 10, category = null, timeRange = 30 } = options;

    const popularProducts = await UserInteraction.getPopularProducts(limit, timeRange);
    
    const query = {
      _id: { $in: popularProducts.map(p => p._id) },
      stock: { $gt: 0 }
    };
    if (category) query.category = category;

    const products = await Product.find(query)
      .select('name price image category brand rating stock');

    return popularProducts
      .map(p => {
        const product = products.find(prod => prod._id.toString() === p._id.toString());
        if (!product) return null;
        return {
          ...product.toObject(),
          score: p.score,
          uniqueUsers: p.uniqueUserCount,
          viewCount: p.viewCount,
          purchaseCount: p.purchaseCount,
          recommendationType: 'popular'
        };
      })
      .filter(p => p !== null);
  }

  // ==================== CART RECOMMENDATIONS ====================

  /**
   * Gợi ý dựa trên giỏ hàng hiện tại
   */
  async getCartRecommendations(cartItems, options = {}) {
    const { limit = 5 } = options;
    
    if (!cartItems || cartItems.length === 0) return [];

    const recommendations = new Map();
    
    // Get cross-sell và similar products cho mỗi item trong cart
    for (const item of cartItems) {
      const productId = item.product?._id || item.product;
      if (!productId) continue;

      // Cross-sell
      const crossSell = await this.getCrossSellRecommendations(productId, { limit: 3 });
      crossSell.forEach(p => {
        const id = p._id.toString();
        const existing = recommendations.get(id);
        if (existing) {
          existing.score += 1;
        } else {
          recommendations.set(id, { ...p, score: 1 });
        }
      });

      // Item-based CF
      const similar = await this.getItemBasedCF(productId, { limit: 3 });
      similar.forEach(p => {
        if (!p._id) return;
        const id = p._id.toString();
        const existing = recommendations.get(id);
        if (existing) {
          existing.score += p.score || 0.5;
        } else {
          recommendations.set(id, { ...p, score: p.score || 0.5 });
        }
      });
    }

    // Remove items already in cart
    const cartProductIds = cartItems.map(i => 
      (i.product?._id || i.product)?.toString()
    ).filter(Boolean);
    
    cartProductIds.forEach(id => recommendations.delete(id));

    // Sort và return
    return Array.from(recommendations.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(p => ({
        ...p,
        recommendationType: 'cart-based'
      }));
  }
}

module.exports = new RecommendationService();
