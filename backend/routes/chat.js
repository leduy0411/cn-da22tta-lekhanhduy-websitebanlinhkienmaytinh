/**
 * Chat API Route
 * ════════════════════════════════════════════════════════════════
 * POST /api/chat
 *     Main RAG chatbot endpoint.  Sends the user message to the
 *     Python AI service (intent detection → RAG / price / knowledge),
 *     returns the AI answer + relevant product list.
 *
 * POST /api/chat/detect-intent
 *     Utility: return intent label only (no answer generated).
 *
 * GET  /api/chat/admin/sessions
 *     Admin: list all chat sessions.
 *
 * GET  /api/chat/session/:sessionId
 *     Get (or auto-create) a session by ID.
 *
 * POST /api/chat/message
 *     Append a raw message to a session (human-agent live chat).
 *
 * PUT  /api/chat/session/:sessionId/status
 *     Update session status.
 *
 * DELETE /api/chat/session/:sessionId
 *     Delete a session.
 */

const express = require('express');
const router  = express.Router();
const ChatMessage   = require('../models/ChatMessage');
const { auth, isStaffOrAdmin } = require('../middleware/auth');
const { chatWithIntent, detectIntent } = require('../services/ragService');

// ─── Input sanitizer ────────────────────────────────────────────────────────
function sanitize(str) {
  // Remove control characters; keep printable Unicode (including Vietnamese)
  return String(str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/chat   — Main RAG chatbot
// ════════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const message = sanitize(req.body.message);
    const topK    = Math.min(Math.max(parseInt(req.body.topK) || 5, 1), 20);

    if (!message) {
      return res.status(400).json({ success: false, message: '"message" is required' });
    }

    const result = await chatWithIntent(message, { topK });

    return res.json({
      success:  result.success,
      intent:   result.intent,
      answer:   result.answer,
      products: result.products || [],
      source:   result.source,
    });
  } catch (error) {
    console.error('[POST /api/chat]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/chat/detect-intent   — Debug: intent only
// ════════════════════════════════════════════════════════════════════════════
router.post('/detect-intent', async (req, res) => {
  try {
    const message = sanitize(req.body.message);
    if (!message) {
      return res.status(400).json({ success: false, message: '"message" is required' });
    }
    const intent = await detectIntent(message);
    return res.json({ success: true, intent, message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/chat/admin/sessions   — Admin: all sessions
// ════════════════════════════════════════════════════════════════════════════
router.get('/admin/sessions', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const sessions = await ChatMessage.find().sort({ lastMessage: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách chat', error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /api/chat/session/:sessionId   — Get or create session
// ════════════════════════════════════════════════════════════════════════════
router.get('/session/:sessionId', async (req, res) => {
  try {
    let session = await ChatMessage.findOne({ sessionId: req.params.sessionId });

    if (!session) {
      session = new ChatMessage({
        sessionId: req.params.sessionId,
        messages: [{
          text:   'Xin chào! Tôi có thể giúp gì cho bạn?',
          sender: 'support',
          time:   new Date(),
        }],
      });
      await session.save();
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy chat', error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /api/chat/message   — Append message (live chat)
// ════════════════════════════════════════════════════════════════════════════
router.post('/message', async (req, res) => {
  try {
    const { sessionId, text, sender, userName, userEmail } = req.body;

    let session = await ChatMessage.findOne({ sessionId });

    if (!session) {
      session = new ChatMessage({
        sessionId,
        userName: userName || 'Khách',
        userEmail,
        messages: [],
      });
    }

    session.messages.push({ text: sanitize(text), sender, time: new Date() });
    session.lastMessage = new Date();
    if (userName)  session.userName  = userName;
    if (userEmail) session.userEmail = userEmail;

    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi tin nhắn', error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  PUT /api/chat/session/:sessionId/status   — Update status
// ════════════════════════════════════════════════════════════════════════════
router.put('/session/:sessionId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const session = await ChatMessage.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { status },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy chat session' });
    }

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  DELETE /api/chat/session/:sessionId   — Delete session
// ════════════════════════════════════════════════════════════════════════════
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const session = await ChatMessage.findOneAndDelete({ sessionId: req.params.sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy chat session' });
    }

    res.json({ success: true, message: 'Đã xóa chat session' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa chat', error: error.message });
  }
});

module.exports = router;


// GET: Lấy tất cả chat sessions (cho admin/staff)
router.get('/admin/sessions', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const sessions = await ChatMessage.find()
      .sort({ lastMessage: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách chat', error: error.message });
  }
});

// GET: Lấy chat session theo sessionId
router.get('/session/:sessionId', async (req, res) => {
  try {
    let session = await ChatMessage.findOne({ sessionId: req.params.sessionId });

    if (!session) {
      // Tạo session mới nếu chưa có
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

// POST: Gửi tin nhắn
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

    session.messages.push({
      text,
      sender,
      time: new Date()
    });

    session.lastMessage = new Date();

    if (userName) session.userName = userName;
    if (userEmail) session.userEmail = userEmail;

    await session.save();

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi tin nhắn', error: error.message });
  }
});

// PUT: Cập nhật trạng thái session
router.put('/session/:sessionId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const session = await ChatMessage.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { status },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy chat session' });
    }

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
});

// DELETE: Xóa chat session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const session = await ChatMessage.findOneAndDelete({ sessionId: req.params.sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy chat session' });
    }

    res.json({ success: true, message: 'Đã xóa chat session' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa chat', error: error.message });
  }
});

module.exports = router;
