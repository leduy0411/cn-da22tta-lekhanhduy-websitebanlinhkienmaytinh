import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiSend, FiRefreshCw, FiZap } from 'react-icons/fi';
import { RiRobot2Line, RiSparklingLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import { aiAPI } from '../services/api';
import './AIChatBox.css';

const AIChatBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Premium welcome message
  const getWelcomeMessage = () => ({
    role: 'assistant',
    text: 'Xin chào! 👋 Tôi là **TechBot AI** - trợ lý thông minh của TechStore. Tôi có thể:\n\n🔍 Tìm kiếm sản phẩm phù hợp\n💡 Tư vấn cấu hình theo ngân sách\n⚡ So sánh sản phẩm\n📦 Kiểm tra đơn hàng\n\nBạn cần hỗ trợ gì?',
    products: [],
    quickReplies: ['🎮 Laptop Gaming', '💼 PC Văn phòng', '🎧 Tai nghe', '🔥 Sản phẩm HOT'],
    time: new Date(),
    isWelcome: true
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = useCallback(async (sid) => {
    try {
      const response = await aiAPI.getChatHistory(sid);
      if (response.data.success && response.data.history && response.data.history.messages?.length > 0) {
        const formattedMessages = response.data.history.messages.map(msg => ({
          role: msg.role,
          text: msg.content,
          products: msg.referencedItems?.products || [],
          quickReplies: [],
          time: new Date(msg.timestamp)
        }));
        setMessages(formattedMessages);
      } else {
        // Set welcome message
        setMessages([getWelcomeMessage()]);
      }
    } catch (error) {
      console.error('Lỗi khi tải lịch sử chat AI:', error);
      setMessages([getWelcomeMessage()]);
    }
  }, []);

  useEffect(() => {
    // Tạo hoặc lấy AI sessionId từ localStorage
    let sid = localStorage.getItem('aiChatSessionId');
    if (!sid) {
      sid = `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('aiChatSessionId', sid);
    }
    setSessionId(sid);
    
    // Load chat history
    if (sid) {
      loadChatHistory(sid);
    }
  }, [loadChatHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '' || !sessionId || isLoading) return;

    const userMessage = {
      role: 'user',
      text: inputMessage,
      time: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await aiAPI.sendMessage(sessionId, inputMessage, {});
      
      if (response.data.success) {
        const aiResponse = response.data.response;
        const assistantMessage = {
          role: 'assistant',
          text: aiResponse.text,
          products: aiResponse.products || [],
          quickReplies: aiResponse.quickReplies || [],
          time: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn AI:', error);
      const errorMessage = {
        role: 'assistant',
        text: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.',
        products: [],
        quickReplies: [],
        time: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (reply) => {
    // Remove emoji from quick reply for cleaner search
    const cleanReply = reply.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    setInputMessage(cleanReply);
    // Auto submit after setting
    setTimeout(() => {
      const form = document.querySelector('.ai-chat-input-form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  const startNewConversation = () => {
    const newSessionId = `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('aiChatSessionId', newSessionId);
    setSessionId(newSessionId);
    setMessages([getWelcomeMessage()]);
  };

  // Format text with markdown-like styling
  const formatMessageText = (text) => {
    if (!text) return '';
    // Convert **bold** to <strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <>
      {/* AI Chat Button - Premium Design */}
      <button 
        className={`ai-chat-button ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        title="TechBot AI - Trợ lý thông minh"
      >
        <div className="ai-chat-button-inner">
          <div className="ai-chat-button-icon">
            <RiRobot2Line size={28} />
            <RiSparklingLine className="ai-sparkle" size={14} />
          </div>
          <span className="ai-chat-badge">AI</span>
        </div>
        <div className="ai-chat-button-pulse"></div>
        <div className="ai-chat-button-pulse delay"></div>
      </button>

      {/* AI Chat Box - Premium Design */}
      {isOpen && (
        <div className="ai-chat-box premium">
          <div className="ai-chat-header">
            <div className="ai-chat-header-info">
              <div className="ai-avatar premium">
                <RiRobot2Line size={22} />
                <span className="ai-avatar-status"></span>
              </div>
              <div>
                <h4>TechBot AI <FiZap className="ai-premium-icon" size={12} /></h4>
                <span className="ai-status">● Trợ lý thông minh</span>
              </div>
            </div>
            <div className="ai-header-actions">
              <button className="new-chat-btn" onClick={startNewConversation} title="Cuộc trò chuyện mới">
                <FiRefreshCw size={16} />
              </button>
              <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
                <FiX size={22} />
              </button>
            </div>
          </div>

          <div className="ai-chat-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`ai-message ${message.role === 'user' ? 'ai-user-message' : 'ai-assistant-message'} ${message.isWelcome ? 'welcome-message' : ''}`}
              >
                <div className="ai-message-bubble">
                  <p dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }} />
                  
                  {/* Hiển thị sản phẩm gợi ý - Premium Cards */}
                  {message.products && message.products.length > 0 && (
                    <div className="ai-products-list premium">
                      {message.products.slice(0, 5).map((product, pIndex) => (
                        <Link 
                          to={`/product/${product._id}`} 
                          key={pIndex} 
                          className="ai-product-card premium"
                          onClick={() => setIsOpen(false)}
                        >
                          <div className="ai-product-image-wrapper">
                            <img 
                              src={product.images?.[0] || product.image || '/img/placeholder.png'} 
                              alt={product.name}
                              onError={(e) => e.target.src = '/img/placeholder.png'}
                            />
                            {product.salePrice && product.salePrice < product.price && (
                              <span className="ai-product-discount">
                                -{Math.round((1 - product.salePrice / product.price) * 100)}%
                              </span>
                            )}
                          </div>
                          <div className="ai-product-info">
                            <span className="ai-product-name">{product.name}</span>
                            <div className="ai-product-price-row">
                              <span className="ai-product-price">{formatPrice(product.salePrice || product.price)}</span>
                              {product.rating > 0 && (
                                <span className="ai-product-rating">⭐ {product.rating.toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Quick Replies - Premium Style */}
                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="ai-quick-replies premium">
                      {message.quickReplies.map((reply, rIndex) => (
                        <button 
                          key={rIndex} 
                          className="ai-quick-reply-btn premium"
                          onClick={() => handleQuickReply(reply)}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="ai-message-time">
                    {message.time ? new Date(message.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="ai-message ai-assistant-message">
                <div className="ai-message-bubble ai-loading">
                  <div className="ai-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form className="ai-chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="Hỏi AI về sản phẩm, tư vấn..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="ai-chat-input"
              disabled={isLoading}
            />
            <button type="submit" className="ai-send-btn" disabled={isLoading}>
              <FiSend size={20} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIChatBox;
