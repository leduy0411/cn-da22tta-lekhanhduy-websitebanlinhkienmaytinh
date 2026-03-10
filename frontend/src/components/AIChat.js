/**
 * AI Chatbot Component v2.0
 * ════════════════════════════════════════════════════════════════
 * Features:
 * - RAG-based product recommendations
 * - Markdown rendering
 * - Typing animation
 * - Product cards
 * - Conversation history
 * - Suggested questions
 * 
 * @author AI Expert Team
 * @version 2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { FiMessageCircle, FiX, FiSend, FiPackage, FiShoppingCart } from 'react-icons/fi';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './AIChat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState([]);
  const messagesEndRef = useRef(null);

  // Suggested questions
  const suggestedQuestions = [
    'Laptop gaming có gì tốt không?',
    'Tư vấn PC văn phòng giá rẻ',
    'So sánh RTX 4060 vs 4070',
    'SSD 1TB giá bao nhiêu?',
    'Card đồ họa tốt nhất 2024'
  ];

  useEffect(() => {
    // Get or create session ID
    let sid = localStorage.getItem('aiChatSessionId');
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('aiChatSessionId', sid);
    }
    setSessionId(sid);

    // Load conversation history
    loadConversation(sid);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (sid) => {
    try {
      const response = await axios.get(`${API_URL}/chat/conversation/${sid}`);
      if (response.data.success) {
        const conv = response.data.conversation;
        // Convert to message format
        const msgs = conv.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));
        setMessages(msgs);
      }
    } catch (error) {
      // First time - no conversation yet
      console.log('No previous conversation');
      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: '👋 **Xin chào!** Tôi là AI trợ lý của TechStore.\\n\\nTôi có thể giúp bạn:\\n- 🔍 Tìm kiếm sản phẩm\\n- 💡 Tư vấn cấu hình\\n- 📊 So sánh sản phẩm\\n- 💰 Thông tin giá cả\\n\\nBạn cần tìm gì hôm nay?',
        timestamp: new Date()
      }]);
    }
  };

  const handleSendMessage = async (message = null) => {
    const textToSend = message || inputMessage.trim();
    if (!textToSend || !sessionId) return;

    // Add user message
    const userMsg = {
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);
    setProducts([]);

    try {
      console.log('🔵 Sending message to:', `${API_URL}/chat`);
      console.log('📤 Payload:', { message: textToSend, sessionId });

      const response = await axios.post(`${API_URL}/chat`, {
        message: textToSend,
        sessionId: sessionId,
        userId: null // TODO: get from auth context
      });

      console.log('📥 Response:', response.data);

      if (response.data.success) {
        // Add assistant message
        const assistantMsg = {
          role: 'assistant',
          content: response.data.answer,
          timestamp: new Date(),
          source: response.data.source
        };

        setMessages(prev => [...prev, assistantMsg]);

        // Show products if any
        if (response.data.products && response.data.products.length > 0) {
          console.log('🛍️ Products:', response.data.products);
          setProducts(response.data.products);
        }
      } else {
        throw new Error('Response not successful');
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      let errorMessage = '⚠️ Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.';
      
      if (error.code === 'ERR_NETWORK') {
        errorMessage = '🔌 **Không thể kết nối server**\n\nVui lòng kiểm tra:\n- Backend server có đang chạy không?\n- URL API có đúng không?';
      } else if (error.response?.status === 500) {
        errorMessage = '⚠️ **Lỗi server**\n\n' + (error.response?.data?.message || 'Server đang gặp vấn đề, vui lòng thử lại.');
      }
      
      const errorMsg = {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestedQuestion = (question) => {
    handleSendMessage(question);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button 
        className={`ai-chat-button ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <FiMessageCircle size={28} />
        <span className="ai-badge">AI</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-header-info">
              <div className="ai-avatar">🤖</div>
              <div>
                <h4>AI Chatbot</h4>
                <span className="ai-status">● Online</span>
              </div>
            </div>
            <button 
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {messages.map((msg, index) => (
              <div 
                key={index}
                className={`ai-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="ai-message-content">
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
                <span className="ai-message-time">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="ai-message assistant">
                <div className="ai-message-content">
                  <div className="ai-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Products display */}
            {products.length > 0 && (
              <div className="ai-products-section">
                <h4><FiPackage /> Sản phẩm gợi ý</h4>
                <div className="ai-products-grid">
                  {products.map((product, index) => (
                    <div key={index} className="ai-product-card">
                      {product.image && (
                        <img src={product.image} alt={product.name} />
                      )}
                      <div className="ai-product-info">
                        <h5>{product.name}</h5>
                        {product.brand && <p className="brand">{product.brand}</p>}
                        <p className="price">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND'
                          }).format(product.price)}
                        </p>
                        {product.rating && (
                          <p className="rating">⭐ {product.rating}/5</p>
                        )}
                        <span className={`stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
                          {product.stock > 0 ? '✅ Còn hàng' : '❌ Hết hàng'}
                        </span>
                      </div>
                      <button 
                        className="ai-view-product-btn"
                        onClick={() => window.location.href = `/product/${product.id}`}
                      >
                        <FiShoppingCart /> Xem chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested questions (show when no messages) */}
            {messages.length <= 1 && !isTyping && (
              <div className="ai-suggested-questions">
                <p>💡 <strong>Gợi ý câu hỏi:</strong></p>
                <div className="ai-suggestions-grid">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      className="ai-suggestion-btn"
                      onClick={() => handleSuggestedQuestion(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-container">
            <textarea
              className="ai-chat-input"
              placeholder="Nhập câu hỏi của bạn..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={1}
              disabled={isTyping}
            />
            <button 
              className="ai-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isTyping}
            >
              <FiSend />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChat;
