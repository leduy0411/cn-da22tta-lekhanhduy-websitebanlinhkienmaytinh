/**
 * AI Commerce Assistant API Routes
 * Main endpoint for the multi-agent AI system
 * 
 * @module routes/aiAssistant
 * @description Next-generation AI assistant routes
 */

const express = require('express');
const router = express.Router();
const AICommerceAssistant = require('../services/ai/AICommerceAssistant');
const ConversationMemoryService = require('../services/ai/ConversationMemoryService');
const BehaviorTrackerService = require('../services/ai/BehaviorTrackerService');
const { optionalAuth } = require('../middleware/auth');

// Initialize AI system on first request
let aiInitialized = false;

router.use(async (req, res, next) => {
  if (!aiInitialized) {
    try {
      await AICommerceAssistant.initialize();
      aiInitialized = true;
    } catch (error) {
      console.error('AI initialization error:', error);
    }
  }
  next();
});

/**
 * @route POST /api/ai-assistant/chat
 * @desc Main chat endpoint - routes to appropriate agent
 * @access Public
 */
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const userId = req.user?._id?.toString();

    // Load or create conversation using ConversationMemoryService
    let conversationResult = await ConversationMemoryService.getSession(sessionId);
    
    if (!conversationResult.success) {
      // Create new session
      conversationResult = await ConversationMemoryService.createSession(userId, {
        userAgent: req.headers['user-agent']
      });
      
      if (!conversationResult.success) {
        throw new Error('Failed to create session: ' + conversationResult.error);
      }
    }

    const conversation = conversationResult.conversation;

    if (!conversation || !conversation.messages) {
      throw new Error('Invalid conversation object');
    }

    // Build context from conversation
    const context = {
      userId,
      sessionId,
      conversationHistory: (conversation.messages || []).slice(-5).map(m => ({
        role: m.role,
        content: m.content
      })),
      userContext: conversation.context || {}
    };

    // Process with AI Commerce Assistant
    const startTime = Date.now();
    const aiResponse = await AICommerceAssistant.chat(message, context);

    const executionTime = Date.now() - startTime;

    const answerText = aiResponse.result?.answer || aiResponse.fallback?.answer || 'Xin lỗi, có lỗi xảy ra.';
    const productIds = aiResponse.result?.products?.map(p => p._id) || [];

    // Save user message
    await ConversationMemoryService.addMessage(sessionId, 'user', message, {
      intent: aiResponse.intent,
      entities: aiResponse.metadata?.entities,
      confidence: aiResponse.confidence
    });

    // Save assistant message
    await ConversationMemoryService.addMessage(sessionId, 'assistant', answerText, {
      agent: aiResponse.agent,
      executionTime,
      products: productIds
    });

    // Track user behavior
    if (aiResponse.intent) {
      // Track search query
      if (aiResponse.intent === 'product_search') {
        await BehaviorTrackerService.trackSearch(userId, sessionId, message, {
          productCount: aiResponse.result?.productCount,
          intent: aiResponse.intent,
          agent: aiResponse.agent
        });
      }
      
      // Track recommendation
      if (aiResponse.intent === 'recommendation' && productIds.length > 0) {
        await BehaviorTrackerService.trackRecommendation(
          userId, 
          sessionId, 
          productIds, 
          aiResponse.metadata?.recommendationStrategy || 'unknown'
        );
      }
      
      // Track comparison
      if (aiResponse.intent === 'comparison' && productIds.length > 0) {
        await BehaviorTrackerService.trackComparison(userId, sessionId, productIds);
      }
      
      // Track PC build
      if (aiResponse.intent === 'pc_build') {
        const entities = aiResponse.metadata?.entities || {};
        await BehaviorTrackerService.trackPCBuild(
          userId, 
          sessionId, 
          entities.price?.max || 0, 
          entities.purpose || 'general'
        );
      }
    }

    // Return response
    res.json({
      success: true,
      sessionId,
      answer: answerText,
      products: aiResponse.result?.products || [],
      productCount: aiResponse.result?.productCount || 0,
      metadata: {
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        agent: aiResponse.agent,
        executionTime,
        plan: aiResponse.plan
      }
    });

  } catch (error) {
    console.error('AI Assistant chat error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route POST /api/ai-assistant/chat/stream
 * @desc Streaming chat endpoint
 * @access Public
 */
router.post('/chat/stream', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const userId = req.user?._id?.toString();

    // Load or create conversation
    let conversationResult = await ConversationMemoryService.getSession(sessionId);
    
    if (!conversationResult.success) {
      conversationResult = await ConversationMemoryService.createSession(userId, {
        userAgent: req.headers['user-agent']
      });
      
      if (!conversationResult.success) {
        throw new Error('Failed to create session: ' + conversationResult.error);
      }
    }

    const conversation = conversationResult.conversation;

    if (!conversation || !conversation.messages) {
      throw new Error('Invalid conversation object in streaming');
    }

    const context = {
      userId,
      sessionId,
      conversationHistory: (conversation.messages || []).slice(-5).map(m => ({
        role: m.role,
        content: m.content
      })),
      userContext: conversation.context || {}
    };

    // Stream response
    await AICommerceAssistant.chatStreaming(message, context, (chunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('AI Assistant streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: { error: error.message } })}\n\n`);
    res.end();
  }
});

/**
 * @route GET /api/ai-assistant/health
 * @desc Get AI system health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = AICommerceAssistant.getHealth();
    res.json({
      success: true,
      health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/stats
 * @desc Get AI system statistics
 * @access Admin
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = AICommerceAssistant.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/conversations
 * @desc Get user conversations
 * @access Private
 */
router.get('/conversations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const { limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await ConversationMemoryService.getUserSessions(userId, {
      limit: parseInt(limit),
      includeMessages: false
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      count: result.count,
      conversations: result.conversations.map(conv => ({
        sessionId: conv.sessionId,
        lastMessage: conv.lastMessage,
        messageCount: conv.messages?.length || 0,
        updatedAt: conv.updatedAt,
        summary: conv.summary
      }))
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/conversation/:sessionId
 * @desc Get specific conversation
 * @access Public
 */
router.get('/conversation/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await ConversationMemoryService.getSession(sessionId, {
      includeMessages: true,
      messageLimit: 50
    });

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation: {
        sessionId: result.conversation.sessionId,
        messages: result.conversation.messages,
        context: result.conversation.context,
        summary: result.conversation.summary,
        createdAt: result.conversation.createdAt,
        updatedAt: result.conversation.updatedAt
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/ai-assistant/conversation/:sessionId
 * @desc Delete conversation
 * @access Public
 */
router.delete('/conversation/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await ConversationMemoryService.deleteSession(sessionId);

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      message: 'Conversation deleted'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/session/:sessionId/stats
 * @desc Get session statistics
 * @access Public
 */
router.get('/session/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await ConversationMemoryService.getSessionStats(sessionId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      stats: result.stats
    });

  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/user/preferences
 * @desc Get user preferences from behavior
 * @access Private
 */
router.get('/user/preferences', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const result = await BehaviorTrackerService.getUserPreferences(userId, {
      days: parseInt(req.query.days) || 90
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      preferences: result.preferences
    });

  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/ai-assistant/trending
 * @desc Get trending behaviors
 * @access Public
 */
router.get('/trending', async (req, res) => {
  try {
    const result = await BehaviorTrackerService.getTrendingBehaviors({
      days: parseInt(req.query.days) || 7,
      limit: parseInt(req.query.limit) || 10
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      trending: result.trending
    });

  } catch (error) {
    console.error('Get trending behaviors error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
