/**
 * AI Routes v2.0
 * API endpoints cho tất cả AI services
 * 
 * @module routes/ai
 * @description Express routes cho AI Service Layer
 * @version 2.0 - Direct Gemini integration, removed Python AI dependency
 */

const express = require('express');
const router = express.Router();

const { auth, optionalAuth } = require('../middleware/auth');
const {
  RecommendationService,
  SemanticSearchService,
  ReviewAnalysisService,
  SalesForecastingService,
  ModelEvaluationService
} = require('../services/ai');

// Import new Gemini chat service
const geminiChatService = require('../services/GeminiChatService');

// ==================== GEMINI AI STATUS ====================

/**
 * @route GET /api/ai/gemini/status
 * @desc Check Gemini AI status
 * @access Admin
 */
router.get('/gemini/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    res.json({
      success: true,
      gemini: {
        initialized: geminiChatService.isReady(),
        service: 'Direct Gemini Integration',
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        features: [
          'RAG-based chatbot',
          'Product context search',
          'Streaming responses',
          'Conversation history',
          'MongoDB integration'
        ]
      }
    });

  } catch (error) {
    console.error('Gemini status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/gemini/chat
 * @desc Chat with Gemini (admin testing)
 * @access Admin
 */
router.post('/gemini/chat', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Use new Gemini chat service
    const result = await geminiChatService.generateResponse(message, [], []);

    res.json({
      success: result.success,
      response: result.answer,
      source: result.source
    });
  } catch (error) {
    console.error('Gemini chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/gemini/analyze-intent
 * @desc Analyze intent via Python AI service
 * @access Admin
 */
router.post('/gemini/analyze-intent', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Use Python AI service for intent detection
    const intent = await detectIntent(message);

    res.json({
      success: true,
      intent,
      message,
      service: 'Python AI Microservice'
    });
  } catch (error) {
    console.error('Intent analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== RECOMMENDATION ROUTES ====================

/**
 * @route GET /api/ai/recommendations/product/:productId
 * @desc Get product recommendations (similar products)
 * @access Public
 */
router.get('/recommendations/product/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, type = 'hybrid' } = req.query;
    const userId = req.user?._id;

    let recommendations;

    switch (type) {
      case 'rule-based':
        recommendations = await RecommendationService.getRuleBasedRecommendations(productId, { limit: parseInt(limit) });
        break;
      case 'item-based':
        recommendations = await RecommendationService.getItemBasedCF(productId, { limit: parseInt(limit) });
        break;
      case 'content-based':
        recommendations = await RecommendationService.getContentBasedRecommendations(productId, { limit: parseInt(limit) });
        break;
      case 'cross-sell':
        recommendations = await RecommendationService.getCrossSellRecommendations(productId, { limit: parseInt(limit) });
        break;
      case 'hybrid':
      default:
        recommendations = await RecommendationService.getHybridRecommendations(userId, productId, { limit: parseInt(limit) });
    }

    res.json({
      success: true,
      type,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/recommendations/user
 * @desc Get personalized recommendations for user
 * @access Private
 */
router.get('/recommendations/user', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const recommendations = await RecommendationService.getPersonalizedRecommendations(userId, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('User recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/recommendations/popular
 * @desc Get popular products
 * @access Public
 */
router.get('/recommendations/popular', async (req, res) => {
  try {
    const { limit = 10, category = null, timeRange = 30 } = req.query;

    const recommendations = await RecommendationService.getPopularRecommendations({
      limit: parseInt(limit),
      category,
      timeRange: parseInt(timeRange)
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Popular products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/recommendations/cart
 * @desc Get recommendations based on cart items
 * @access Public
 */
router.post('/recommendations/cart', async (req, res) => {
  try {
    const { cartItems } = req.body;
    const { limit = 5 } = req.query;

    const recommendations = await RecommendationService.getCartRecommendations(cartItems, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Cart recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SEARCH ROUTES ====================

/**
 * @route GET /api/ai/search
 * @desc Semantic search products
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { 
      q, 
      limit = 20, 
      type = 'hybrid',
      category = null,
      brand = null,
      minPrice = null,
      maxPrice = null
    } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    let results;
    const options = {
      limit: parseInt(limit),
      category,
      brand,
      priceRange: (minPrice || maxPrice) ? {
        min: minPrice ? parseFloat(minPrice) : 0,
        max: maxPrice ? parseFloat(maxPrice) : Number.MAX_VALUE
      } : null
    };

    switch (type) {
      case 'keyword':
        results = await SemanticSearchService.keywordSearch(q, options);
        break;
      case 'tfidf':
        results = await SemanticSearchService.searchTFIDF(q, options);
        break;
      case 'embedding':
        results = await SemanticSearchService.searchWithEmbeddings(q, options);
        break;
      case 'hybrid':
      default:
        results = await SemanticSearchService.hybridSearch(q, options);
    }

    res.json({
      success: true,
      query: q,
      type,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/search/autocomplete
 * @desc Get autocomplete suggestions
 * @access Public
 */
router.get('/search/autocomplete', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: { products: [], categories: [], brands: [] } });
    }

    const suggestions = await SemanticSearchService.getAutocompleteSuggestions(q, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/search/related
 * @desc Get related search suggestions
 * @access Public
 */
router.get('/search/related', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.json({ success: true, relatedSearches: [] });
    }

    const relatedSearches = await SemanticSearchService.getRelatedSearches(q, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      relatedSearches
    });
  } catch (error) {
    console.error('Related search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== REVIEW ANALYSIS ROUTES ====================

/**
 * @route POST /api/ai/reviews/analyze/:reviewId
 * @desc Analyze a specific review
 * @access Admin
 */
router.post('/reviews/analyze/:reviewId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { reviewId } = req.params;
    const analysis = await ReviewAnalysisService.analyzeReview(reviewId);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Review analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/reviews/sentiment/:productId
 * @desc Get sentiment summary for a product
 * @access Public
 */
router.get('/reviews/sentiment/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const summary = await ReviewAnalysisService.getProductSentimentSummary(productId);

    res.json({
      success: true,
      productId,
      sentiment: summary
    });
  } catch (error) {
    console.error('Sentiment summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/reviews/analyze-text
 * @desc Analyze sentiment of text (for testing)
 * @access Public
 */
router.post('/reviews/analyze-text', async (req, res) => {
  try {
    const { text, rating = null } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const sentiment = ReviewAnalysisService.analyzeSentiment(text, rating);
    const aspects = ReviewAnalysisService.analyzeAspectSentiment(text);
    const spam = ReviewAnalysisService.detectSpam(text, { rating });
    const textAnalysis = ReviewAnalysisService.analyzeText(text);

    res.json({
      success: true,
      analysis: {
        sentiment,
        aspects,
        spam,
        text: textAnalysis
      }
    });
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/reviews/analyze-all
 * @desc Batch analyze all reviews
 * @access Admin
 */
router.post('/reviews/analyze-all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { skipProcessed = true } = req.body;
    
    // Run in background
    ReviewAnalysisService.analyzeAllReviews({ skipProcessed })
      .then(result => console.log('Review analysis complete:', result))
      .catch(err => console.error('Review analysis failed:', err));

    res.json({
      success: true,
      message: 'Review analysis started in background'
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SALES FORECASTING ROUTES ====================

/**
 * @route GET /api/ai/forecast
 * @desc Get sales forecast
 * @access Admin
 */
router.get('/forecast', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { 
      periods = 30, 
      type = 'daily', 
      scope = 'overall',
      algorithm = 'ensemble'
    } = req.query;

    const forecast = await SalesForecastingService.generateForecast({
      forecastPeriods: parseInt(periods),
      forecastType: type,
      scope,
      algorithm
    });

    res.json({
      success: true,
      forecast
    });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/forecast/historical
 * @desc Get historical sales data
 * @access Admin
 */
router.get('/forecast/historical', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { 
      days = 90, 
      groupBy = 'day' 
    } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const data = await SalesForecastingService.aggregateSalesData({
      startDate,
      groupBy
    });

    res.json({
      success: true,
      period: {
        start: startDate,
        end: new Date(),
        groupBy
      },
      data
    });
  } catch (error) {
    console.error('Historical data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/forecast/categories
 * @desc Get category breakdown
 * @access Admin
 */
router.get('/forecast/categories', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const breakdown = await SalesForecastingService.getCategoryBreakdown(startDate, new Date());

    res.json({
      success: true,
      breakdown
    });
  } catch (error) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN CHATBOT ROUTES ====================

/**
 * @route GET /api/ai/chatbot/admin/stats
 * @desc Get AI chatbot statistics for admin
 * @access Admin
 */
router.get('/chatbot/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const ChatbotConversation = require('../models/ChatbotConversation');
    
    const totalConversations = await ChatbotConversation.countDocuments();
    
    // Active today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activeToday = await ChatbotConversation.countDocuments({
      updatedAt: { $gte: todayStart }
    });

    // Average satisfaction
    const satisfactionResult = await ChatbotConversation.aggregate([
      { $match: { satisfactionScore: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgSatisfaction: { $avg: '$satisfactionScore' } } }
    ]);
    const avgSatisfaction = satisfactionResult[0]?.avgSatisfaction || 0;

    // Total messages
    const messagesResult = await ChatbotConversation.aggregate([
      { $project: { messageCount: { $size: { $ifNull: ['$messages', []] } } } },
      { $group: { _id: null, totalMessages: { $sum: '$messageCount' } } }
    ]);
    const totalMessages = messagesResult[0]?.totalMessages || 0;

    res.json({
      success: true,
      totalConversations,
      activeToday,
      avgSatisfaction: avgSatisfaction.toFixed(1),
      totalMessages
    });
  } catch (error) {
    console.error('Chatbot stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/chatbot/admin/conversations
 * @desc Get all AI chatbot conversations for admin
 * @access Admin
 */
router.get('/chatbot/admin/conversations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { limit = 50, skip = 0 } = req.query;
    const ChatbotConversation = require('../models/ChatbotConversation');

    const conversations = await ChatbotConversation.find()
      .sort({ updatedAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('sessionId status satisfactionScore messages createdAt updatedAt')
      .lean();

    const formattedConversations = conversations.map(conv => ({
      _id: conv._id,
      sessionId: conv.sessionId,
      status: conv.status || 'active',
      satisfaction: conv.satisfactionScore,
      messageCount: conv.messages?.length || 0,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    }));

    res.json({
      success: true,
      conversations: formattedConversations,
      total: await ChatbotConversation.countDocuments()
    });
  } catch (error) {
    console.error('Chatbot conversations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CHATBOT ROUTES ====================

/**
 * @route POST /api/ai/chatbot/message
 * @desc Send message to chatbot (via Python AI service)
 * @access Public
 */
router.post('/chatbot/message', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId, context = {} } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message and sessionId are required' 
      });
    }

    const userId = req.user?._id;

    // Use Python AI service for intelligent chat
    const result = await chatWithIntent(message, { topK: 5 });

    // Store conversation in database for history tracking
    const ChatbotConversation = require('../models/ChatbotConversation');
    let conversation = await ChatbotConversation.findOne({ sessionId });
    
    if (!conversation) {
      conversation = new ChatbotConversation({
        sessionId,
        userId,
        messages: []
      });
    }

    conversation.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: result.answer, intent: result.intent, timestamp: new Date() }
    );
    conversation.updatedAt = new Date();
    await conversation.save();

    res.json({
      success: true,
      response: {
        message: result.answer,
        intent: result.intent,
        products: result.products || [],
        source: result.source
      }
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/chatbot/history/:sessionId
 * @desc Get conversation history
 * @access Public
 */
router.get('/chatbot/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    const ChatbotConversation = require('../models/ChatbotConversation');
    const conversation = await ChatbotConversation.findOne({ sessionId })
      .select('messages')
      .lean();

    const history = conversation?.messages.slice(-parseInt(limit)) || [];

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/chatbot/end/:sessionId
 * @desc End conversation and provide feedback
 * @access Public
 */
router.post('/chatbot/end/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { satisfaction } = req.body;

    const ChatbotConversation = require('../models/ChatbotConversation');
    const conversation = await ChatbotConversation.findOne({ sessionId });

    if (conversation) {
      conversation.status = 'completed';
      conversation.satisfactionScore = satisfaction;
      await conversation.save();
    }

    res.json({
      success: true,
      message: 'Conversation ended',
      conversationId: conversation?._id
    });
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MODEL EVALUATION ROUTES ====================

/**
 * @route POST /api/ai/evaluate/:modelType/:modelName
 * @desc Evaluate a specific model
 * @access Admin
 */
router.post('/evaluate/:modelType/:modelName', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { modelType, modelName } = req.params;
    let result;

    switch (modelType) {
      case 'recommendation':
        result = await ModelEvaluationService.evaluateRecommendationModel(modelName, req.body);
        break;
      case 'sentiment':
        result = await ModelEvaluationService.evaluateSentimentModel(modelName, req.body);
        break;
      case 'search':
        result = await ModelEvaluationService.evaluateSearchModel(modelName, req.body);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid model type' });
    }

    res.json({
      success: true,
      evaluation: result
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/evaluate/all
 * @desc Run all model evaluations
 * @access Admin
 */
router.post('/evaluate/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Run in background
    ModelEvaluationService.runAllEvaluations()
      .then(results => console.log('All evaluations complete'))
      .catch(err => console.error('Evaluations failed:', err));

    res.json({
      success: true,
      message: 'Model evaluations started in background'
    });
  } catch (error) {
    console.error('Batch evaluation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/ai/evaluate/report
 * @desc Get evaluation report for thesis
 * @access Admin
 */
router.get('/evaluate/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const report = await ModelEvaluationService.generateThesisReport();

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== INTERACTION TRACKING ====================

/**
 * @route POST /api/ai/track
 * @desc Track user interaction for recommendation training
 * @access Public
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

    const UserInteraction = require('../models/UserInteraction');

    const interaction = new UserInteraction({
      user: req.user?._id || null,
      product: productId,
      interactionType,
      sessionId,
      source: metadata.source || 'direct',
      metadata,
      deviceType: metadata.deviceType || 'desktop',
      viewDuration: metadata.viewDuration || 0
    });

    await interaction.save();

    res.json({
      success: true,
      message: 'Interaction tracked'
    });
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== EMBEDDINGS MANAGEMENT ====================

/**
 * @route POST /api/ai/embeddings/generate
 * @desc Generate embeddings for products
 * @access Admin
 */
router.post('/embeddings/generate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { productId } = req.body;

    if (productId) {
      const embedding = await SemanticSearchService.generateProductEmbedding(productId);
      res.json({ success: true, embedding });
    } else {
      // Generate all in background
      SemanticSearchService.generateAllEmbeddings()
        .then(result => console.log('Embeddings generated:', result))
        .catch(err => console.error('Embedding generation failed:', err));

      res.json({
        success: true,
        message: 'Embedding generation started in background'
      });
    }
  } catch (error) {
    console.error('Embedding generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route POST /api/ai/tfidf/initialize
 * @desc Initialize TF-IDF vocabulary
 * @access Admin
 */
router.post('/tfidf/initialize', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const result = await SemanticSearchService.initializeTFIDF();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('TF-IDF initialization error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
