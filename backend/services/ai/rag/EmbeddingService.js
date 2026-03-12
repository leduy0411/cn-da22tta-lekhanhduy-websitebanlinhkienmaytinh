/**
 * Embedding Service
 * Generates vector embeddings using Google Gemini Embedding API
 * 
 * @module services/ai/rag/EmbeddingService
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class EmbeddingService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.modelName = 'gemini-embedding-001';
    this.dimension = 3072;
    this._initialize();
  }

  _initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY not configured - EmbeddingService disabled');
      return;
    }
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      console.log(`✅ EmbeddingService initialized with ${this.modelName}`);
    } catch (error) {
      console.error('❌ EmbeddingService initialization failed:', error.message);
    }
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async embedText(text) {
    if (!this.model) throw new Error('EmbeddingService not initialized');
    if (!text || !text.trim()) throw new Error('Text cannot be empty');

    // Truncate to avoid token limits (roughly 2048 tokens ≈ 8000 chars)
    const truncated = text.slice(0, 8000);

    const result = await this.model.embedContent(truncated);
    return result.embedding.values;
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embedBatch(texts) {
    if (!this.model) throw new Error('EmbeddingService not initialized');

    const results = [];
    // Process in batches of 5 to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await Promise.all(
        batch.map(text => this.embedText(text))
      );
      results.push(...embeddings);

      // Rate limit pause between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return results;
  }

  /**
   * Check if the service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.model !== null;
  }
}

// Singleton
module.exports = new EmbeddingService();
