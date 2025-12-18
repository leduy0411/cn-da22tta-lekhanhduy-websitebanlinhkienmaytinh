const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');

// GET: Lấy tất cả chat sessions (cho admin)
router.get('/admin/sessions', async (req, res) => {
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
