/**
 * Chat API Route v2.0 - Direct Gemini Integration
 * ════════════════════════════════════════════════════════════════
 * Architecture: Frontend → Backend/Gemini → MongoDB RAG
 * 
 * POST /api/chat
 *     Main RAG chatbot endpoint with Gemini AI + Product RAG
 *     - Search relevant products từ MongoDB
 *     - Build context cho Gemini
 *     - Generate smart response
 *     - Save conversation history
 *
 * POST /api/chat/stream
 *     Streaming variant (real-time typing effect)
 *
 * GET  /api/chat/conversations
 *     Get all conversations của user
 *
 * GET  /api/chat/conversation/:sessionId
 *     Get specific conversation by sessionId
 *
 * DELETE /api/chat/conversation/:sessionId
 *     Delete conversation
 *
 * GET  /api/chat/admin/sessions
 *     Admin: view all chat sessions
 * 
 * @version 2.0
 * @author AI Expert Team
 */

const express = require('express');
const router  = express.Router();
const ChatbotConversation = require('../models/ChatbotConversation');
const ChatMessage = require('../models/ChatMessage');
const { auth, isStaffOrAdmin } = require('../middleware/auth');
const geminiChatService = require('../services/GeminiChatService');
const productRAG = require('../services/ProductRAGService');

// ─── Input sanitizer ────────────────────────────────────────────────────────
function sanitize(str) {
  return String(str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/chat   — Main RAG Chatbot với Gemini
// ════════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    const userMessage = sanitize(message);

    // Validation
    if (!userMessage) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message is required' 
      });
    }

    // Step 1: Tìm hoặc tạo conversation session
    let conversation = null;
    if (sessionId) {
      conversation = await ChatbotConversation.findOne({ sessionId });
    }

    if (!conversation) {
      conversation = new ChatbotConversation({
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId || null,
        messages: [],
        status: 'active'
      });
    }

    // Step 2: Search relevant products (RAG)
    const relevantProducts = await productRAG.searchRelevantProducts(userMessage, 5);

    // Step 3: Get conversation history (last 5 messages)
    const chatHistory = conversation.messages.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Step 4: Call Gemini với RAG context
    const geminiResponse = await geminiChatService.generateResponse(
      userMessage,
      relevantProducts,
      chatHistory
    );

    // Step 5: Save messages to conversation
    conversation.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    conversation.messages.push({
      role: 'assistant',
      content: geminiResponse.answer,
      timestamp: new Date(),
      metadata: {
        productContext: relevantProducts.length,
        source: geminiResponse.source
      }
    });

    conversation.lastMessage = new Date();
    await conversation.save();

    // Step 6: Return response
    return res.json({
      success: true,
      sessionId: conversation.sessionId,
      answer: geminiResponse.answer,
      products: relevantProducts.map(p => ({
        id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        stock: p.stock,
        rating: p.rating,
        image: p.images && p.images[0] ? p.images[0] : null
      })),
      productCount: relevantProducts.length,
      source: geminiResponse.source,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ [POST /api/chat] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/chat/stream   — Streaming response (real-time typing)
// ════════════════════════════════════════════════════════════════════════════
router.post('/stream', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    const userMessage = sanitize(message);

    if (!userMessage) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Step 1: Find or create conversation
    let conversation = null;
    if (sessionId) {
      conversation = await ChatbotConversation.findOne({ sessionId });
    }

    if (!conversation) {
      conversation = new ChatbotConversation({
        sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId || null,
        messages: [],
        status: 'active'
      });
    }

    // Step 2: Search products (RAG)
    const relevantProducts = await productRAG.searchRelevantProducts(userMessage, 5);
    
    // Send products first
    res.write(`data: ${JSON.stringify({ type: 'products', products: relevantProducts })}\n\n`);

    // Step 3: Get chat history
    const chatHistory = conversation.messages.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Step 4: Stream from Gemini
    let fullAnswer = '';
    for await (const chunk of geminiChatService.generateStreamingResponse(userMessage, relevantProducts, chatHistory)) {
      if (chunk.error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: chunk.error })}\n\n`);
        break;
      }
      
      if (chunk.text) {
        fullAnswer += chunk.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`);
      }
      
      if (chunk.done) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        break;
      }
    }

    // Step 5: Save to database
    conversation.messages.push(
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: fullAnswer, timestamp: new Date() }
    );
    conversation.lastMessage = new Date();
    await conversation.save();

    res.end();

  } catch (error) {
    console.error('❌ [POST /api/chat/stream] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/chat/conversations   — Get all conversations của user
// ════════════════════════════════════════════════════════════════════════════
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    
    const filter = userId ? { userId } : {};
    const conversations = await ChatbotConversation.find(filter)
      .select('sessionId userId status lastMessage messages')
      .sort({ lastMessage: -1 })
      .limit(50);

    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        sessionId: conv.sessionId,
        userId: conv.userId,
        status: conv.status,
        lastMessage: conv.lastMessage,
        messageCount: conv.messages.length,
        preview: conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1].content.substring(0, 100) 
          : ''
      }))
    });

  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/chat/conversation/:sessionId   — Get specific conversation
// ════════════════════════════════════════════════════════════════════════════
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const conversation = await ChatbotConversation.findOne({ 
      sessionId: req.params.sessionId 
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    res.json({
      success: true,
      conversation: {
        sessionId: conversation.sessionId,
        userId: conversation.userId,
        status: conversation.status,
        messages: conversation.messages,
        lastMessage: conversation.lastMessage,
        createdAt: conversation.createdAt
      }
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  DELETE /api/chat/conversation/:sessionId   — Delete conversation
// ════════════════════════════════════════════════════════════════════════════
router.delete('/conversation/:sessionId', async (req, res) => {
  try {
    const conversation = await ChatbotConversation.findOneAndDelete({ 
      sessionId: req.params.sessionId 
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/chat/admin/sessions   — Admin: view all chat sessions
// ════════════════════════════════════════════════════════════════════════════
router.get('/admin/sessions', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const conversations = await ChatbotConversation.find()
      .sort({ lastMessage: -1 })
      .limit(100);

    res.json({
      success: true,
      sessions: conversations
    });

  } catch (error) {
    console.error('Error getting admin sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách chat', 
      error: error.message 
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  Legacy endpoints for backward compatibility (ChatMessage model)
// ════════════════════════════════════════════════════════════════════════════

// GET: Lấy chat session (live support)
router.get('/session/:sessionId', async (req, res) => {
  try {
    let session = await ChatMessage.findOne({ sessionId: req.params.sessionId });

    if (!session) {
      session = new ChatMessage({
        sessionId: req.params.sessionId,
        messages: [{
          text: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
          sender: 'support',
          time: new Date()
        }]
      });
      await session.save();
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy chat', error: error.message });
  }
});

// POST: Gửi tin nhắn (live support)
router.post('/message', async (req, res) => {
  try {
    const { sessionId, text, sender, userName, userEmail } = req.body;

    let session = await ChatMessage.findOne({ sessionId });

    if (!session) {
      session = new ChatMessage({
        sessionId,
        userName: userName || 'Khách',
        userEmail,
        messages: []
      });
    }

    session.messages.push({ text: sanitize(text), sender, time: new Date() });
    session.lastMessage = new Date();
    if (userName) session.userName = userName;
    if (userEmail) session.userEmail = userEmail;

    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi tin nhắn', error: error.message });
  }
});

module.exports = router;
