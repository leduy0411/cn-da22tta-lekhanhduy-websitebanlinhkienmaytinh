/**
 * Semantic Search Service
 * Tìm kiếm ngữ nghĩa sử dụng vector embeddings
 * 
 * @module services/ai/SemanticSearchService
 * @description AI Service cho Semantic Search với TF-IDF và Cosine Similarity
 */

const mongoose = require('mongoose');
const Product = require('../../models/Product');
const ProductEmbedding = require('../../models/ProductEmbedding');

class SemanticSearchService {
  constructor() {
    // Vocabulary cho TF-IDF
    this.vocabulary = new Map();
    this.idfValues = new Map();
    this.documentCount = 0;
    this.isInitialized = false;
    
    // Vietnamese stopwords
    this.stopwords = new Set([
      'và', 'của', 'có', 'là', 'cho', 'với', 'được', 'để', 'trong', 'này',
      'các', 'một', 'những', 'không', 'theo', 'đến', 'từ', 'như', 'về', 'khi',
      'tại', 'ra', 'trên', 'qua', 'bởi', 'hay', 'vào', 'sau', 'còn', 'cũng',
      'nếu', 'nhưng', 'đã', 'đang', 'sẽ', 'rất', 'nhiều', 'hơn', 'ít', 'mỗi',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'that', 'this',
      'these', 'those', 'it', 'its'
    ]);
    
    // Cache cho search results
    this.searchCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  // ==================== TEXT PREPROCESSING ====================

  /**
   * Chuẩn hóa và tokenize text
   */
  tokenize(text) {
    if (!text) return [];
    
    // Lowercase và remove special characters
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Tokenize
    const tokens = normalized.split(' ').filter(token => 
      token.length > 1 && !this.stopwords.has(token)
    );
    
    return tokens;
  }

  /**
   * Tạo n-grams
   */
  generateNgrams(tokens, n = 2) {
    const ngrams = [...tokens]; // Unigrams
    
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join('_'));
    }
    
    return ngrams;
  }

  /**
   * Tính Term Frequency
   */
  calculateTF(tokens) {
    const tf = new Map();
    const total = tokens.length;
    
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });
    
    // Normalize by document length
    tf.forEach((count, token) => {
      tf.set(token, count / total);
    });
    
    return tf;
  }

  // ==================== TF-IDF IMPLEMENTATION ====================

  /**
   * Khởi tạo TF-IDF vocabulary từ tất cả products
   */
  async initializeTFIDF() {
    console.log('Initializing TF-IDF vocabulary...');
    
    const products = await Product.find({})
      .select('name description brand category specifications');
    
    this.documentCount = products.length;
    const documentFrequency = new Map();
    
    // Tính document frequency
    products.forEach(product => {
      const text = this.createProductText(product);
      const tokens = this.tokenize(text);
      const uniqueTokens = new Set(tokens);
      
      uniqueTokens.forEach(token => {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      });
    });
    
    // Tính IDF
    documentFrequency.forEach((df, token) => {
      const idf = Math.log((this.documentCount + 1) / (df + 1)) + 1;
      this.idfValues.set(token, idf);
      this.vocabulary.set(token, this.vocabulary.size);
    });
    
    this.isInitialized = true;
    console.log(`TF-IDF initialized with ${this.vocabulary.size} terms`);
    
    return {
      vocabularySize: this.vocabulary.size,
      documentCount: this.documentCount
    };
  }

  /**
   * Tạo text đại diện cho product
   */
  createProductText(product) {
    const parts = [
      product.name || '',
      product.description || '',
      product.brand || '',
      product.category || ''
    ];
    
    // Thêm specifications nếu có
    if (product.specifications) {
      const specs = product.specifications;
      if (specs instanceof Map) {
        specs.forEach((value) => parts.push(String(value)));
      } else if (typeof specs === 'object') {
        Object.values(specs).forEach(value => parts.push(String(value)));
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Tính TF-IDF vector cho text
   */
  calculateTFIDFVector(text) {
    const tokens = this.tokenize(text);
    const tf = this.calculateTF(tokens);
    
    // Create sparse vector
    const vector = new Array(this.vocabulary.size).fill(0);
    
    tf.forEach((tfValue, token) => {
      const index = this.vocabulary.get(token);
      const idf = this.idfValues.get(token) || 1;
      
      if (index !== undefined) {
        vector[index] = tfValue * idf;
      }
    });
    
    return vector;
  }

  /**
   * Tính cosine similarity
   */
  cosineSimilarity(vecA, vecB) {
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

  // ==================== SEARCH METHODS ====================

  /**
   * Semantic search với TF-IDF
   */
  async searchTFIDF(query, options = {}) {
    const { limit = 20, minScore = 0.1, category = null, brand = null } = options;
    
    // Check cache
    const cacheKey = `tfidf:${query}:${category}:${brand}:${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.results;
    }
    
    // Initialize nếu chưa
    if (!this.isInitialized) {
      await this.initializeTFIDF();
    }
    
    // Tính query vector
    const queryVector = this.calculateTFIDFVector(query);
    
    // Build filter
    const filter = { stock: { $gt: 0 } };
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    
    // Lấy products
    const products = await Product.find(filter)
      .select('name description brand category price image rating stock specifications');
    
    // Tính similarity cho mỗi product
    const results = products.map(product => {
      const productText = this.createProductText(product);
      const productVector = this.calculateTFIDFVector(productText);
      const similarity = this.cosineSimilarity(queryVector, productVector);
      
      return {
        product: product.toObject(),
        score: similarity,
        matchType: 'tfidf'
      };
    });
    
    // Filter và sort
    const filteredResults = results
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Cache results
    this.searchCache.set(cacheKey, {
      results: filteredResults,
      timestamp: Date.now()
    });
    
    return filteredResults;
  }

  /**
   * Semantic search với pre-computed embeddings
   */
  async searchWithEmbeddings(query, options = {}) {
    const { limit = 20, minScore = 0.3, category = null } = options;
    
    // Lấy query embedding (trong thực tế sẽ gọi external API hoặc model)
    // Ở đây dùng TF-IDF như fallback
    const queryVector = this.calculateTFIDFVector(query);
    
    // Tìm trong ProductEmbedding
    const filter = { status: 'completed' };
    if (category) filter['metadata.category'] = category;
    
    const embeddings = await ProductEmbedding.find(filter)
      .select('product embedding metadata')
      .lean();
    
    if (embeddings.length === 0) {
      // Fallback to TF-IDF search
      return this.searchTFIDF(query, options);
    }
    
    // Tính similarity
    const results = embeddings.map(emb => {
      const similarity = this.cosineSimilarity(queryVector, emb.embedding);
      return {
        productId: emb.product,
        score: similarity,
        metadata: emb.metadata
      };
    });
    
    // Filter và sort
    const topResults = results
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Fetch product details
    const productIds = topResults.map(r => r.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('name description brand category price image rating stock');
    
    return topResults.map(r => {
      const product = products.find(p => p._id.toString() === r.productId.toString());
      return {
        product: product?.toObject(),
        score: r.score,
        matchType: 'embedding'
      };
    }).filter(r => r.product);
  }

  /**
   * Hybrid search: Kết hợp keyword và semantic search
   */
  async hybridSearch(query, options = {}) {
    const { 
      limit = 20, 
      keywordWeight = 0.4, 
      semanticWeight = 0.6,
      category = null,
      brand = null,
      priceRange = null
    } = options;

    const results = new Map();

    // 1. Keyword search (MongoDB text search)
    try {
      const keywordResults = await this.keywordSearch(query, {
        limit: limit * 2,
        category,
        brand,
        priceRange
      });
      
      keywordResults.forEach((result, index) => {
        const id = result.product._id.toString();
        const positionScore = 1 / Math.log2(index + 2);
        results.set(id, {
          product: result.product,
          keywordScore: result.score * positionScore,
          semanticScore: 0
        });
      });
    } catch (err) {
      console.log('Keyword search error:', err.message);
    }

    // 2. Semantic search (TF-IDF)
    try {
      const semanticResults = await this.searchTFIDF(query, {
        limit: limit * 2,
        category,
        brand
      });
      
      semanticResults.forEach((result, index) => {
        const id = result.product._id.toString();
        const positionScore = 1 / Math.log2(index + 2);
        const existing = results.get(id);
        
        if (existing) {
          existing.semanticScore = result.score * positionScore;
        } else {
          results.set(id, {
            product: result.product,
            keywordScore: 0,
            semanticScore: result.score * positionScore
          });
        }
      });
    } catch (err) {
      console.log('Semantic search error:', err.message);
    }

    // Combine scores
    const combinedResults = Array.from(results.values()).map(r => ({
      product: r.product,
      score: r.keywordScore * keywordWeight + r.semanticScore * semanticWeight,
      keywordScore: r.keywordScore,
      semanticScore: r.semanticScore,
      matchType: 'hybrid'
    }));

    // Sort và return
    return combinedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Keyword search sử dụng MongoDB text index
   */
  async keywordSearch(query, options = {}) {
    const { limit = 20, category = null, brand = null, priceRange = null } = options;
    
    const filter = {
      $text: { $search: query },
      stock: { $gt: 0 }
    };
    
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (priceRange) {
      filter.price = {
        $gte: priceRange.min || 0,
        $lte: priceRange.max || Number.MAX_VALUE
      };
    }
    
    const products = await Product.find(
      filter,
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .select('name description brand category price image rating stock');
    
    return products.map(p => ({
      product: p.toObject(),
      score: p._doc.score || 1,
      matchType: 'keyword'
    }));
  }

  // ==================== AUTOCOMPLETE & SUGGESTIONS ====================

  /**
   * Autocomplete suggestions
   */
  async getAutocompleteSuggestions(prefix, options = {}) {
    const { limit = 10 } = options;
    
    if (!prefix || prefix.length < 2) return [];
    
    const regex = new RegExp(`^${prefix}`, 'i');
    
    // Tìm trong product names
    const products = await Product.find({
      name: regex,
      stock: { $gt: 0 }
    })
    .select('name category brand')
    .limit(limit);
    
    // Tìm trong categories
    const categories = await Product.distinct('category', {
      category: regex
    });
    
    // Tìm trong brands
    const brands = await Product.distinct('brand', {
      brand: regex
    });
    
    return {
      products: products.map(p => ({
        type: 'product',
        text: p.name,
        category: p.category
      })),
      categories: categories.slice(0, 5).map(c => ({
        type: 'category',
        text: c
      })),
      brands: brands.slice(0, 5).map(b => ({
        type: 'brand',
        text: b
      }))
    };
  }

  /**
   * Related searches suggestions
   */
  async getRelatedSearches(query, options = {}) {
    const { limit = 5 } = options;
    
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];
    
    // Tìm products matching và extract related terms
    const products = await Product.find({
      $text: { $search: query }
    })
    .select('category brand name')
    .limit(50);
    
    const relatedTerms = new Map();
    
    products.forEach(product => {
      // Add category as related search
      if (product.category) {
        const key = `${tokens[0]} ${product.category}`.toLowerCase();
        relatedTerms.set(key, (relatedTerms.get(key) || 0) + 1);
      }
      
      // Add brand as related search
      if (product.brand) {
        const key = `${product.brand} ${product.category || ''}`.toLowerCase().trim();
        relatedTerms.set(key, (relatedTerms.get(key) || 0) + 1);
      }
    });
    
    // Sort by frequency
    return Array.from(relatedTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }

  // ==================== EMBEDDING GENERATION ====================

  /**
   * Tạo và lưu embedding cho product
   */
  async generateProductEmbedding(productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Initialize TF-IDF nếu cần
    if (!this.isInitialized) {
      await this.initializeTFIDF();
    }

    const productText = this.createProductText(product);
    const embedding = this.calculateTFIDFVector(productText);

    // Lưu embedding
    const productEmbedding = await ProductEmbedding.findOneAndUpdate(
      { product: productId },
      {
        product: productId,
        sourceText: productText,
        embedding,
        dimension: embedding.length,
        embeddingModel: 'tfidf',
        normalizedEmbedding: this.normalizeVector(embedding),
        metadata: {
          productName: product.name,
          category: product.category,
          brand: product.brand,
          priceRange: this.getPriceRange(product.price)
        },
        status: 'completed',
        version: 1
      },
      { upsert: true, new: true }
    );

    return productEmbedding;
  }

  /**
   * Batch generate embeddings cho tất cả products
   */
  async generateAllEmbeddings() {
    const products = await Product.find({}).select('_id');
    let processed = 0;
    let failed = 0;

    console.log(`Generating embeddings for ${products.length} products...`);

    // Initialize TF-IDF first
    await this.initializeTFIDF();

    for (const product of products) {
      try {
        await this.generateProductEmbedding(product._id);
        processed++;
        
        if (processed % 100 === 0) {
          console.log(`Processed ${processed}/${products.length} products`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed to generate embedding for ${product._id}:`, err.message);
      }
    }

    return {
      total: products.length,
      processed,
      failed
    };
  }

  /**
   * Normalize vector
   */
  normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  /**
   * Get price range label
   */
  getPriceRange(price) {
    if (price < 1000000) return 'budget';
    if (price < 5000000) return 'mid-range';
    if (price < 20000000) return 'high-end';
    return 'premium';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.searchCache.clear();
  }
}

module.exports = new SemanticSearchService();
