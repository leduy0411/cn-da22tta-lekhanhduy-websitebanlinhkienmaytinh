/**
 * Vector Search Service
 * Performs semantic vector search against KnowledgeDocument collection
 * 
 * @module services/ai/rag/VectorSearchService
 */
const KnowledgeDocument = require('../../../models/KnowledgeDocument');
const ProductEmbedding = require('../../../models/ProductEmbedding');
const EmbeddingService = require('./EmbeddingService');

class VectorSearchService {
  /**
   * Semantic search: embed query then find similar documents
   * @param {string} query - User query text
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Ranked results with text and similarity score
   */
  async search(query, options = {}) {
    const {
      limit = 5,
      minSimilarity = 0.3,
      category = null,
      categories = null
    } = options;

    if (!EmbeddingService.isAvailable()) {
      console.warn('⚠️ EmbeddingService unavailable, returning empty results');
      return [];
    }

    // 1. Embed the query
    const queryEmbedding = await EmbeddingService.embedText(query);

    // 2. Find similar documents
    const results = await KnowledgeDocument.findSimilar(queryEmbedding, {
      limit,
      minSimilarity,
      category,
      categories
    });

    return results;
  }

  /**
   * Hybrid search: combine vector similarity with keyword matching
   * @param {string} query - User query
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Merged and ranked results
   */
  async hybridSearch(query, options = {}) {
    const {
      limit = 5,
      minSimilarity = 0.25,
      category = null,
      categories = null,
      vectorWeight = 0.7,
      keywordWeight = 0.3
    } = options;

    // Parallel: vector search + keyword search
    const [vectorResults, keywordResults] = await Promise.all([
      this.search(query, { limit: limit * 2, minSimilarity, category, categories }),
      this._keywordSearch(query, { limit: limit * 2, category, categories })
    ]);

    // Merge results
    const scored = new Map();

    for (const r of vectorResults) {
      const id = r._id.toString();
      scored.set(id, {
        ...r,
        vectorScore: r.similarity,
        keywordScore: 0,
        finalScore: r.similarity * vectorWeight
      });
    }

    for (const r of keywordResults) {
      const id = r._id.toString();
      if (scored.has(id)) {
        const existing = scored.get(id);
        existing.keywordScore = r.keywordScore;
        existing.finalScore += r.keywordScore * keywordWeight;
      } else {
        scored.set(id, {
          ...r,
          vectorScore: 0,
          keywordScore: r.keywordScore,
          finalScore: r.keywordScore * keywordWeight
        });
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  /**
   * Keyword-based search using MongoDB text index
   * @private
   */
  async _keywordSearch(query, options = {}) {
    const { limit = 10, category = null, categories = null } = options;
    
    const filter = { status: 'completed' };
    if (category) filter.category = category;
    if (categories && categories.length > 0) filter.category = { $in: categories };

    // Use regex for flexible matching (text index may not exist)
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const regexPattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    filter.text = { $regex: regexPattern, $options: 'i' };

    const docs = await KnowledgeDocument.find(filter)
      .select('text source category metadata chunkIndex')
      .limit(limit)
      .lean();

    // Score based on keyword match density
    return docs.map(doc => {
      const textLower = doc.text.toLowerCase();
      const matchCount = words.reduce((count, word) => {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = textLower.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      const keywordScore = Math.min(matchCount / (words.length * 3), 1.0);
      return { ...doc, keywordScore };
    });
  }

  /**
   * Semantic product search using ProductEmbedding collection
   * @param {string} query - User query
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Products ranked by similarity
   */
  async searchProducts(query, options = {}) {
    const {
      limit = 10,
      minSimilarity = 0.4,
      category = null,
      brand = null,
      excludeProductIds = []
    } = options;

    if (!EmbeddingService.isAvailable()) {
      return [];
    }

    const queryEmbedding = await EmbeddingService.embedText(query);

    const results = await ProductEmbedding.findSimilarProducts(queryEmbedding, {
      limit,
      minSimilarity,
      excludeProductIds,
      category,
      brand
    });

    return results;
  }

  /**
   * Get statistics about the knowledge base
   * @returns {Promise<Object>}
   */
  async getStats() {
    const [total, byCategory, bySource] = await Promise.all([
      KnowledgeDocument.countDocuments({ status: 'completed' }),
      KnowledgeDocument.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      KnowledgeDocument.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
    ]);

    return { total, byCategory, bySource };
  }
}

module.exports = new VectorSearchService();
