/**
 * Hybrid Search Engine
 * Combines keyword search and semantic search for better relevance
 * 
 * @module services/ai/engines/HybridSearchEngine
 * @description Advanced search with keyword + vector similarity
 */

const Product = require('../../../models/Product');
const ProductEmbedding = require('../../../models/ProductEmbedding');
const SemanticSearchService = require('../SemanticSearchService');

class HybridSearchEngine {
  constructor() {
    this.keywordWeight = 0.4;
    this.semanticWeight = 0.6;
  }

  /**
   * Hybrid search: keyword + semantic
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    const {
      limit = 10,
      category = null,
      brand = null,
      minPrice = null,
      maxPrice = null,
      keywordWeight = this.keywordWeight,
      semanticWeight = this.semanticWeight
    } = options;

    try {
      // Execute both searches in parallel
      const [keywordResults, semanticResults] = await Promise.all([
        this._keywordSearch(query, { category, brand, minPrice, maxPrice, limit: limit * 2 }),
        this._semanticSearch(query, { category, brand, minPrice, maxPrice, limit: limit * 2 })
      ]);

      // Fuse results
      const fusedResults = this._fuseResults(
        keywordResults,
        semanticResults,
        keywordWeight,
        semanticWeight
      );

      // Rank by combined score
      const rankedResults = this._rankResults(fusedResults, {
        relevance: 0.4,
        price: 0.2,
        rating: 0.3,
        popularity: 0.1
      });

      return rankedResults.slice(0, limit);

    } catch (error) {
      console.error('Hybrid search error:', error);
      
      // Fallback to keyword only
      return this._keywordSearch(query, { category, brand, minPrice, maxPrice, limit });
    }
  }

  /**
   * Keyword search using MongoDB text index
   * @private
   */
  async _keywordSearch(query, options) {
    const { category, brand, minPrice, maxPrice, limit } = options;

    const filter = {
      $text: { $search: query },
      stock: { $gt: 0 }
    };

    if (category) {
      filter.category = new RegExp(category, 'i');
    }

    if (brand) {
      filter.brand = new RegExp(brand, 'i');
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = minPrice;
      if (maxPrice) filter.price.$lte = maxPrice;
    }

    const products = await Product.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();

    return products.map(product => ({
      product,
      keywordScore: product.score || 0,
      semanticScore: 0,
      source: 'keyword'
    }));
  }

  /**
   * Semantic search using embeddings
   * @private
   */
  async _semanticSearch(query, options) {
    const { category, brand, minPrice, maxPrice, limit } = options;

    try {
      // Use existing SemanticSearchService
      const results = await SemanticSearchService.searchWithEmbeddings(query, {
        limit,
        category,
        minScore: 0.3
      });

      return results.map(result => ({
        product: result.product,
        keywordScore: 0,
        semanticScore: result.score,
        source: 'semantic'
      }));

    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  /**
   * Fuse keyword and semantic results
   * @private
   */
  _fuseResults(keywordResults, semanticResults, keywordWeight, semanticWeight) {
    const fusedMap = new Map();

    // Add keyword results
    keywordResults.forEach(result => {
      const id = result.product._id.toString();
      fusedMap.set(id, {
        product: result.product,
        keywordScore: result.keywordScore,
        semanticScore: 0,
        fusedScore: result.keywordScore * keywordWeight
      });
    });

    // Merge semantic results
    semanticResults.forEach(result => {
      const id = result.product._id.toString();
      
      if (fusedMap.has(id)) {
        // Product found in both - combine scores
        const existing = fusedMap.get(id);
        existing.semanticScore = result.semanticScore;
        existing.fusedScore = (
          existing.keywordScore * keywordWeight +
          result.semanticScore * semanticWeight
        );
      } else {
        // Only in semantic results
        fusedMap.set(id, {
          product: result.product,
          keywordScore: 0,
          semanticScore: result.semanticScore,
          fusedScore: result.semanticScore * semanticWeight
        });
      }
    });

    return Array.from(fusedMap.values());
  }

  /**
   * Rank results by multiple factors
   * @private
   */
  _rankResults(results, weights) {
    return results.map(result => {
      const product = result.product;
      
      // Normalize scores
      const relevanceScore = result.fusedScore;
      const ratingScore = (product.rating || 0) / 5;
      const priceScore = this._getPriceScore(product.price);
      const popularityScore = this._getPopularityScore(product);

      // Calculate final score
      const finalScore = (
        relevanceScore * weights.relevance +
        ratingScore * weights.rating +
        priceScore * weights.price +
        popularityScore * weights.popularity
      );

      return {
        ...product,
        _score: finalScore,
        _relevance: relevanceScore,
        _rating: ratingScore,
        _priceScore: priceScore,
        _popularity: popularityScore
      };
    }).sort((a, b) => b._score - a._score);
  }

  /**
   * Get price score (lower is better)
   * @private
   */
  _getPriceScore(price) {
    // Normalize price to 0-1 scale
    const maxPrice = 100000000; // 100M VND
    return 1 - Math.min(price / maxPrice, 1);
  }

  /**
   * Get popularity score
   * @private
   */
  _getPopularityScore(product) {
    const reviewCount = product.reviewCount || 0;
    const viewCount = product.viewCount || 0;
    
    // Normalize to 0-1 scale
    return Math.min((reviewCount + viewCount / 100) / 100, 1);
  }

  /**
   * Update search weights
   * @param {number} keywordWeight - Weight for keyword search
   * @param {number} semanticWeight - Weight for semantic search
   */
  updateWeights(keywordWeight, semanticWeight) {
    this.keywordWeight = keywordWeight;
    this.semanticWeight = semanticWeight;
  }
}

module.exports = new HybridSearchEngine();
