/**
 * Enhanced Recommendation Routes v2.0
 * Tích hợp Python AI Service (SVD, ALS, NCF, FAISS, Association Rules)
 * với fallback to NodeJS RecommendationService
 * 
 * API Endpoints:
 *   GET  /api/ai/v2/recommend/user/:userId      - Gợi ý theo user
 *   GET  /api/ai/v2/recommend/product/:productId - Gợi ý theo sản phẩm
 *   POST /api/ai/v2/recommend/cart               - Gợi ý theo giỏ hàng
 *   GET  /api/ai/v2/recommend/trending           - Sản phẩm trending
 *   GET  /api/ai/v2/recommend/fbt/:productId     - Frequently Bought Together
 *   POST /api/ai/v2/train                        - Trigger training
 *   GET  /api/ai/v2/status                       - Model status
 *   GET  /api/ai/v2/metrics/models               - Model metrics
 *   GET  /api/ai/v2/training/history             - Training history
 *   GET  /api/ai/v2/ab-test/results              - A/B test results
 *   POST /api/ai/v2/track                        - Track interaction
 *   POST /api/ai/v2/track-click                  - Track rec click
 */

const express = require('express');
const router = express.Router();
const { auth, optionalAuth, isAdmin } = require('../../middleware/auth');
const AIServiceClient = require('../../services/ai/AIServiceClient');
const RecommendationService = require('../../services/ai/RecommendationService');
const RecommendationLog = require('../../models/RecommendationLog');
const UserInteraction = require('../../models/UserInteraction');

// ==================== RECOMMENDATION ENDPOINTS ====================

/**
 * GET /api/ai/v2/recommend/user/:userId
 * Gợi ý sản phẩm cho user dựa trên hành vi
 * Sử dụng: SVD + NCF + Popularity (Python) với fallback NodeJS
 */
router.get('/recommend/user/:userId', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const { limit = 10, ab_variant = null } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    let recommendations = [];
    let modelSources = [];
    let usedPython = false;

    // Try Python AI Service first
    const aiAvailable = await AIServiceClient.isServiceAvailable();
    
    if (aiAvailable) {
      const aiResult = await AIServiceClient.getUserRecommendations(userId, {
        limit: parsedLimit,
        abVariant: ab_variant
      });

      if (aiResult?.success && aiResult.recommendations?.length > 0) {
        recommendations = aiResult.recommendations;
        modelSources = aiResult.model_sources || [];
        usedPython = true;
      }
    }

    // Fallback to NodeJS RecommendationService
    if (recommendations.length === 0) {
      const fallbackRecs = await RecommendationService.getPersonalizedRecommendations(
        userId, { limit: parsedLimit }
      );
      recommendations = fallbackRecs;
      modelSources = ['nodejs_personalized'];
    }

    const latencyMs = Date.now() - startTime;

    // Log recommendation (async, non-blocking)
    _logRecommendation({
      user: req.user?._id || userId,
      requestType: 'user',
      recommendations,
      modelSources,
      abVariant: ab_variant,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: usedPython ? 'python-ai' : 'nodejs-fallback',
        abVariant: ab_variant
      }
    });
  } catch (error) {
    console.error('V2 User recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/recommend/product/:productId
 * Gợi ý sản phẩm tương tự (Content-Based + Item CF + Association)
 */
router.get('/recommend/product/:productId', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { productId } = req.params;
    const { limit = 10, type = 'hybrid' } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    const userId = req.user?._id?.toString();

    let recommendations = [];
    let modelSources = [];
    let usedPython = false;

    // Try Python AI Service
    const aiAvailable = await AIServiceClient.isServiceAvailable();
    
    if (aiAvailable) {
      const aiResult = await AIServiceClient.getProductRecommendations(productId, {
        limit: parsedLimit,
        userId
      });

      if (aiResult?.success && aiResult.recommendations?.length > 0) {
        recommendations = aiResult.recommendations;
        modelSources = aiResult.model_sources || [];
        usedPython = true;
      }
    }

    // Fallback to NodeJS
    if (recommendations.length === 0) {
      switch (type) {
        case 'rule-based':
          recommendations = await RecommendationService.getRuleBasedRecommendations(
            productId, { limit: parsedLimit }
          );
          modelSources = ['nodejs_rule_based'];
          break;
        case 'item-based':
          recommendations = await RecommendationService.getItemBasedCF(
            productId, { limit: parsedLimit }
          );
          modelSources = ['nodejs_item_cf'];
          break;
        case 'content-based':
          recommendations = await RecommendationService.getContentBasedRecommendations(
            productId, { limit: parsedLimit }
          );
          modelSources = ['nodejs_content_based'];
          break;
        case 'cross-sell':
          recommendations = await RecommendationService.getCrossSellRecommendations(
            productId, { limit: parsedLimit }
          );
          modelSources = ['nodejs_cross_sell'];
          break;
        case 'hybrid':
        default:
          recommendations = await RecommendationService.getHybridRecommendations(
            userId, productId, { limit: parsedLimit }
          );
          modelSources = ['nodejs_hybrid'];
      }
    }

    const latencyMs = Date.now() - startTime;

    _logRecommendation({
      user: req.user?._id,
      requestType: 'product',
      inputProductId: productId,
      recommendations,
      modelSources,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: usedPython ? 'python-ai' : 'nodejs-fallback'
      }
    });
  } catch (error) {
    console.error('V2 Product recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/v2/recommend/cart
 * Gợi ý sản phẩm mua kèm (Association Rules / Market Basket)
 */
router.post('/recommend/cart', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cartItems, productIds } = req.body;
    const { limit = 5 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 5, 20);
    const userId = req.user?._id?.toString();

    // Extract product IDs from cart items
    let cartProductIds = productIds || [];
    if (cartItems && cartItems.length > 0) {
      cartProductIds = cartItems.map(item => 
        (item.product?._id || item.product || item.productId)?.toString()
      ).filter(Boolean);
    }

    if (cartProductIds.length === 0) {
      return res.json({ success: true, count: 0, recommendations: [] });
    }

    let recommendations = [];
    let modelSources = [];
    let usedPython = false;

    // Try Python AI Service (Association Rules + Content-Based)
    const aiAvailable = await AIServiceClient.isServiceAvailable();
    
    if (aiAvailable) {
      const aiResult = await AIServiceClient.getCartRecommendations(
        cartProductIds, userId
      );

      if (aiResult?.success && aiResult.recommendations?.length > 0) {
        recommendations = aiResult.recommendations;
        modelSources = aiResult.model_sources || [];
        usedPython = true;
      }
    }

    // Fallback to NodeJS
    if (recommendations.length === 0) {
      recommendations = await RecommendationService.getCartRecommendations(
        cartItems || cartProductIds.map(id => ({ product: id })),
        { limit: parsedLimit }
      );
      modelSources = ['nodejs_cart'];
    }

    const latencyMs = Date.now() - startTime;

    _logRecommendation({
      user: req.user?._id,
      requestType: 'cart',
      inputCartProductIds: cartProductIds,
      recommendations,
      modelSources,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: usedPython ? 'python-ai' : 'nodejs-fallback'
      }
    });
  } catch (error) {
    console.error('V2 Cart recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/recommend/trending
 * Sản phẩm trending (popular + recent interactions)
 */
router.get('/recommend/trending', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 10, category = null } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    let recommendations = [];
    let modelSources = [];
    let usedPython = false;

    const aiAvailable = await AIServiceClient.isServiceAvailable();
    
    if (aiAvailable) {
      const aiResult = await AIServiceClient.getTrending({
        limit: parsedLimit,
        category
      });

      if (aiResult?.success && aiResult.recommendations?.length > 0) {
        recommendations = aiResult.recommendations;
        modelSources = aiResult.model_sources || [];
        usedPython = true;
      }
    }

    // Fallback
    if (recommendations.length === 0) {
      recommendations = await RecommendationService.getPopularRecommendations({
        limit: parsedLimit,
        category
      });
      modelSources = ['nodejs_popular'];
    }

    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: usedPython ? 'python-ai' : 'nodejs-fallback'
      }
    });
  } catch (error) {
    console.error('V2 Trending error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TRACKING ====================

/**
 * POST /api/ai/v2/track
 * Track user interaction (real-time event)
 * Saves to MongoDB AND forwards to Python AI service for online learning
 */
router.post('/track', optionalAuth, async (req, res) => {
  try {
    const { productId, interactionType, sessionId, metadata = {} } = req.body;

    if (!productId || !interactionType) {
      return res.status(400).json({
        success: false,
        message: 'productId and interactionType are required'
      });
    }

    const userId = req.user?._id;

    // Save to MongoDB
    if (userId) {
      const interaction = new UserInteraction({
        user: userId,
        product: productId,
        interactionType,
        sessionId,
        source: metadata.source || 'direct',
        metadata,
        deviceType: metadata.deviceType || 'desktop',
        viewDuration: metadata.viewDuration || 0
      });
      await interaction.save();
    }

    // Forward to Python AI Service (non-blocking)
    if (userId) {
      AIServiceClient.trackInteraction(
        userId.toString(), productId, interactionType, metadata
      ).catch(err => console.error('AI tracking forward failed:', err.message));
    }

    res.json({ success: true, message: 'Interaction tracked' });
  } catch (error) {
    console.error('V2 Track error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * POST /api/ai/v2/train
 * Trigger model training (Admin only)
 */
router.post('/train', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { force = false } = req.body;
    const result = await AIServiceClient.triggerTraining(force);

    if (result) {
      res.json({ success: true, ...result });
    } else {
      res.status(503).json({
        success: false,
        message: 'AI Service không khả dụng. Hãy khởi động Python AI Service.'
      });
    }
  } catch (error) {
    console.error('V2 Train error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/status
 * Get AI model status
 */
router.get('/status', async (req, res) => {
  try {
    const aiAvailable = await AIServiceClient.isServiceAvailable();
    
    let pythonStatus = null;
    if (aiAvailable) {
      pythonStatus = await AIServiceClient.getModelStatus();
    }

    res.json({
      success: true,
      pyServiceAvailable: aiAvailable,
      pythonModels: pythonStatus?.models || null,
      nodejsService: {
        available: true,
        models: ['rule-based', 'user-cf', 'item-cf', 'content-based', 'hybrid']
      }
    });
  } catch (error) {
    console.error('V2 Status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/training/report
 * Get training report
 */
router.get('/training/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const report = await AIServiceClient.getTrainingReport();

    if (report) {
      res.json({ success: true, ...report });
    } else {
      res.status(503).json({
        success: false,
        message: 'AI Service không khả dụng'
      });
    }
  } catch (error) {
    console.error('V2 Training report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/ab-test/results
 * Get A/B test results
 */
router.get('/ab-test/results', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { days = 30 } = req.query;
    
    const [abResults, modelPerf, aiVariants] = await Promise.all([
      RecommendationLog.getABTestResults(parseInt(days)),
      RecommendationLog.getModelPerformance(parseInt(days)),
      AIServiceClient.getABVariants()
    ]);

    res.json({
      success: true,
      abTestResults: abResults,
      modelPerformance: modelPerf,
      variants: aiVariants?.variants || null
    });
  } catch (error) {
    console.error('V2 A/B test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/v2/track-click
 * Track recommendation click (for CTR calculation)
 */
router.post('/track-click', optionalAuth, async (req, res) => {
  try {
    const { logId, productId, position } = req.body;
    
    if (logId) {
      await RecommendationLog.findByIdAndUpdate(logId, {
        $push: {
          clickedProducts: {
            product: productId,
            position,
            clickedAt: new Date()
          }
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== NEW v2.0 ENDPOINTS ====================

/**
 * GET /api/ai/v2/recommend/fbt/:productId
 * Frequently Bought Together (Association Rules)
 */
router.get('/recommend/fbt/:productId', async (req, res) => {
  const startTime = Date.now();
  try {
    const { productId } = req.params;
    const { limit = 5 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 5, 20);

    let recommendations = [];
    let usedPython = false;

    const aiAvailable = await AIServiceClient.isServiceAvailable();
    if (aiAvailable) {
      const aiResult = await AIServiceClient.getFrequentlyBoughtTogether(
        productId, parsedLimit
      );
      if (aiResult?.success && aiResult.recommendations?.length > 0) {
        recommendations = aiResult.recommendations;
        usedPython = true;
      }
    }

    // Fallback: use product recommendations as proxy
    if (recommendations.length === 0) {
      const fallback = await RecommendationService.getCrossSellRecommendations(
        productId, { limit: parsedLimit }
      );
      recommendations = fallback || [];
    }

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources: ['association_rules'],
        latencyMs,
        engine: usedPython ? 'python-ai' : 'nodejs-fallback'
      }
    });
  } catch (error) {
    console.error('V2 FBT error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/training/history
 * Training history
 */
router.get('/training/history', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { limit = 10 } = req.query;
    const result = await AIServiceClient.getTrainingHistory(parseInt(limit) || 10);

    if (result) {
      res.json({ success: true, ...result });
    } else {
      res.status(503).json({ success: false, message: 'AI Service không khả dụng' });
    }
  } catch (error) {
    console.error('V2 Training history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/metrics/models
 * Model performance metrics
 */
router.get('/metrics/models', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const metrics = await AIServiceClient.getModelMetrics();

    if (metrics) {
      res.json({ success: true, ...metrics });
    } else {
      res.status(503).json({ success: false, message: 'AI Service không khả dụng' });
    }
  } catch (error) {
    console.error('V2 Model metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== HELPER ====================

async function _logRecommendation(data) {
  try {
    const log = new RecommendationLog({
      user: data.user,
      requestType: data.requestType,
      inputProductId: data.inputProductId,
      inputCartProductIds: data.inputCartProductIds,
      recommendations: (data.recommendations || []).slice(0, 20).map((rec, idx) => ({
        product: rec._id || rec.productId,
        score: rec.score,
        position: idx + 1,
        sources: rec.sources || [rec.recommendationType]
      })),
      modelSources: data.modelSources,
      abVariant: data.abVariant,
      latencyMs: data.latencyMs
    });
    await log.save();
  } catch (error) {
    console.error('Failed to log recommendation:', error.message);
  }
}

module.exports = router;
