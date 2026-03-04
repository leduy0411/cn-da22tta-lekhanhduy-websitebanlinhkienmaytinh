/**
 * AI Service Client v2.0
 * Proxy calls từ NodeJS backend → Python FastAPI AI Service
 * Fallback to local recommendations nếu AI service unavailable
 * 
 * New: FBT, batch, training history, model metrics endpoints
 */
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT) || 5000;

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_SERVICE_TIMEOUT,
  headers: { 'Content-Type': 'application/json' }
});

let _isAvailable = null;
let _lastCheck = 0;
const CHECK_INTERVAL = 30000;

/**
 * Check if Python AI service is available
 */
async function isServiceAvailable() {
  const now = Date.now();
  if (_isAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _isAvailable;
  }
  
  try {
    const response = await aiClient.get('/health', { timeout: 2000 });
    _isAvailable = response.data?.status === 'ok';
    _lastCheck = now;
    return _isAvailable;
  } catch {
    _isAvailable = false;
    _lastCheck = now;
    return false;
  }
}

/**
 * Get recommendations for a user
 */
async function getUserRecommendations(userId, options = {}) {
  const { limit = 10, excludeIds = [], abVariant = null } = options;
  
  try {
    const params = { limit };
    if (excludeIds.length > 0) params.exclude = excludeIds.join(',');
    if (abVariant) params.ab_variant = abVariant;
    
    const response = await aiClient.get(`/recommend/user/${userId}`, { params });
    return response.data;
  } catch (error) {
    console.error('AI Service getUserRecommendations error:', error.message);
    return null;
  }
}

/**
 * Get product recommendations (similar products)
 */
async function getProductRecommendations(productId, options = {}) {
  const { limit = 10, userId = null, excludeIds = [] } = options;
  
  try {
    const params = { limit };
    if (userId) params.user_id = userId;
    if (excludeIds.length > 0) params.exclude = excludeIds.join(',');
    
    const response = await aiClient.get(`/recommend/product/${productId}`, { params });
    return response.data;
  } catch (error) {
    console.error('AI Service getProductRecommendations error:', error.message);
    return null;
  }
}

/**
 * Get cart recommendations (cross-sell / association rules)
 */
async function getCartRecommendations(productIds, userId = null) {
  try {
    const response = await aiClient.post('/recommend/cart', {
      product_ids: productIds,
      user_id: userId
    });
    return response.data;
  } catch (error) {
    console.error('AI Service getCartRecommendations error:', error.message);
    return null;
  }
}

/**
 * Get frequently bought together products
 */
async function getFrequentlyBoughtTogether(productId, limit = 5) {
  try {
    const response = await aiClient.get(`/recommend/fbt/${productId}`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('AI Service FBT error:', error.message);
    return null;
  }
}

/**
 * Batch recommendations for multiple users
 */
async function getBatchRecommendations(userIds, limit = 10) {
  try {
    const response = await aiClient.post('/recommend/batch', {
      user_ids: userIds,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('AI Service batch recommendations error:', error.message);
    return null;
  }
}

/**
 * Get trending products
 */
async function getTrending(options = {}) {
  const { limit = 10, category = null } = options;
  
  try {
    const params = { limit };
    if (category) params.category = category;
    
    const response = await aiClient.get('/recommend/trending', { params });
    return response.data;
  } catch (error) {
    console.error('AI Service getTrending error:', error.message);
    return null;
  }
}

/**
 * Track interaction for online learning
 */
async function trackInteraction(userId, productId, interactionType, metadata = {}) {
  try {
    await aiClient.post('/track', {
      user_id: userId,
      product_id: productId,
      interaction_type: interactionType,
      metadata
    });
  } catch (error) {
    console.error('AI Service track error:', error.message);
  }
}

/**
 * Trigger model training
 */
async function triggerTraining(force = false) {
  try {
    const response = await aiClient.post('/train', { force });
    return response.data;
  } catch (error) {
    console.error('AI Service triggerTraining error:', error.message);
    return null;
  }
}

/**
 * Get model status
 */
async function getModelStatus() {
  try {
    const response = await aiClient.get('/status');
    return response.data;
  } catch (error) {
    console.error('AI Service getModelStatus error:', error.message);
    return null;
  }
}

/**
 * Get training report
 */
async function getTrainingReport() {
  try {
    const response = await aiClient.get('/training/report');
    return response.data;
  } catch (error) {
    console.error('AI Service getTrainingReport error:', error.message);
    return null;
  }
}

/**
 * Get training history
 */
async function getTrainingHistory(limit = 10) {
  try {
    const response = await aiClient.get('/training/history', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('AI Service getTrainingHistory error:', error.message);
    return null;
  }
}

/**
 * Get A/B test variants
 */
async function getABVariants() {
  try {
    const response = await aiClient.get('/ab/variants');
    return response.data;
  } catch (error) {
    console.error('AI Service getABVariants error:', error.message);
    return null;
  }
}

/**
 * Get model performance metrics
 */
async function getModelMetrics() {
  try {
    const response = await aiClient.get('/metrics/models');
    return response.data;
  } catch (error) {
    console.error('AI Service getModelMetrics error:', error.message);
    return null;
  }
}

/**
 * Semantic search via FAISS
 */
async function semanticSearch(query, topK = 10) {
  try {
    const response = await aiClient.post('/search', {
      query,
      top_k: topK
    });
    return response.data;
  } catch (error) {
    console.error('AI Service semanticSearch error:', error.message);
    return null;
  }
}

module.exports = {
  isServiceAvailable,
  getUserRecommendations,
  getProductRecommendations,
  getCartRecommendations,
  getFrequentlyBoughtTogether,
  getBatchRecommendations,
  getTrending,
  trackInteraction,
  triggerTraining,
  getModelStatus,
  getTrainingReport,
  getTrainingHistory,
  getABVariants,
  getModelMetrics,
  semanticSearch
};
