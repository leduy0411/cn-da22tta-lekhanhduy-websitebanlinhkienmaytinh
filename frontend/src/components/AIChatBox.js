import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiSend } from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = useCallback(async (sid) => {
    try {
      const response = await aiAPI.getChatHistory(sid);
      if (response.data.success && response.data.history) {
        const formattedMessages = response.data.history.map(msg => ({
          role: msg.role,
          text: msg.content,
          products: msg.referencedItems?.products || [],
          quickReplies: [],
          time: new Date(msg.timestamp)
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Lỗi khi tải lịch sử chat AI:', error);
      // Thêm tin nhắn chào mừng nếu chưa có lịch sử
      setMessages(prev => {
        if (prev.length === 0) {
          return [{
            role: 'assistant',
            text: 'Xin chào! 👋 Tôi là trợ lý AI của TechStore. Tôi có thể giúp bạn tìm sản phẩm, tư vấn cấu hình, hoặc giải đáp thắc mắc. Bạn cần hỗ trợ gì?',
            products: [],
            quickReplies: ['Tìm laptop gaming', 'Tư vấn PC văn phòng', 'Sản phẩm bán chạy'],
            time: new Date()
          }];
        }
        return prev;
      });
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
    setInputMessage(reply);
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
    setMessages([{
      role: 'assistant',
      text: 'Xin chào! 👋 Tôi là trợ lý AI của TechStore. Tôi có thể giúp bạn tìm sản phẩm, tư vấn cấu hình, hoặc giải đáp thắc mắc. Bạn cần hỗ trợ gì?',
      products: [],
      quickReplies: ['Tìm laptop gaming', 'Tư vấn PC văn phòng', 'Sản phẩm bán chạy'],
      time: new Date()
    }]);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <>
      {/* AI Chat Button */}
      <button 
        className={`ai-chat-button ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        title="Trợ lý AI TechStore"
      >
        <div className="ai-chat-button-inner">
          <div className="ai-chat-button-icon">
            <RiRobot2Line size={32} />
          </div>
          <span className="ai-chat-badge">AI</span>
        </div>
        <div className="ai-chat-button-pulse"></div>
        <div className="ai-chat-button-pulse delay"></div>
      </button>

      {/* AI Chat Box */}
      {isOpen && (
        <div className="ai-chat-box">
          <div className="ai-chat-header">
            <div className="ai-chat-header-info">
              <div className="ai-avatar">
                <RiRobot2Line size={24} />
              </div>
              <div>
                <h4>Trợ Lý AI TechStore</h4>
                <span className="ai-status">● Sẵn sàng hỗ trợ</span>
              </div>
            </div>
            <div className="ai-header-actions">
              <button className="new-chat-btn" onClick={startNewConversation} title="Cuộc trò chuyện mới">
                +
              </button>
              <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
                <FiX size={24} />
              </button>
            </div>
          </div>

          <div className="ai-chat-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`ai-message ${message.role === 'user' ? 'ai-user-message' : 'ai-assistant-message'}`}
              >
                <div className="ai-message-bubble">
                  <p>{message.text}</p>
                  
                  {/* Hiển thị sản phẩm gợi ý */}
                  {message.products && message.products.length > 0 && (
                    <div className="ai-products-list">
                      {message.products.slice(0, 3).map((product, pIndex) => (
                        <Link 
                          to={`/product/${product._id}`} 
                          key={pIndex} 
                          className="ai-product-card"
                          onClick={() => setIsOpen(false)}
                        >
                          <img 
                            src={product.images?.[0] || '/img/placeholder.png'} 
                            alt={product.name}
                            onError={(e) => e.target.src = '/img/placeholder.png'}
                          />
                          <div className="ai-product-info">
                            <span className="ai-product-name">{product.name}</span>
                            <span className="ai-product-price">{formatPrice(product.salePrice || product.price)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Quick Replies */}
                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="ai-quick-replies">
                      {message.quickReplies.map((reply, rIndex) => (
                        <button 
                          key={rIndex} 
                          className="ai-quick-reply-btn"
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
