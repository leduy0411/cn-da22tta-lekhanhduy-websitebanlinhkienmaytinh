import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './AICommerceChat.css';

const AICommerceChat = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Create session ID on mount
    const storedSessionId = localStorage.getItem('ai_chat_session');
    if (storedSessionId) {
      setSessionId(storedSessionId);
      // Load previous conversation
      loadConversation(storedSessionId);
    } else {
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      localStorage.setItem('ai_chat_session', newSessionId);
      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: '👋 **Xin chào!** Tôi là trợ lý AI của TechStore.\n\nTôi có thể giúp bạn:\n\n🔍 **Tìm sản phẩm** - "Laptop gaming dưới 30 triệu"\n\n💡 **Gợi ý** - "Tư vấn PC cho thiết kế"\n\n⚖️ **So sánh** - "RTX 4060 vs RTX 4070"\n\n🛠️ **Build PC** - "Cấu hình PC gaming 40 triệu"\n\n📚 **Hỏi đáp** - "SSD là gì?"\n\nBạn cần tôi giúp gì ạ? 😊',
        timestamp: new Date()
      }]);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (sessionId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/ai-assistant/conversation/${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.conversation?.messages) {
        setMessages(data.conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          metadata: msg.metadata
        })));
      }
    } catch (error) {
      console.error('Load conversation error:', error);
    }
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: inputMessage,
          sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage = {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
          metadata: {
            intent: data.metadata?.intent,
            agent: data.metadata?.agent,
            executionTime: data.metadata?.executionTime
          },
          products: data.products || []
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🤖 Xin lỗi, tôi đang gặp vấn đề kỹ thuật. Vui lòng thử lại sau.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (example) => {
    setInputMessage(example);
  };

  const handleNewChat = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem('ai_chat_session', newSessionId);
    setMessages([{
      role: 'assistant',
      content: '👋 **Xin chào!** Tôi là trợ lý AI của TechStore.\n\nBạn cần tôi giúp gì ạ? 😊',
      timestamp: new Date()
    }]);
  };

  const formatMessage = (content) => {
    // Basic markdown formatting
    let formatted = content;
    
    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    
    // Lists
    formatted = formatted.replace(/^([•✅❌💡📚⚖️🛠️🔍])\s+(.+)$/gm, '<li>$1 $2</li>');
    
    return formatted;
  };

  const renderProductCard = (product) => (
    <div className="product-card" key={product._id}>
      <div className="product-info">
        <h4>{product.name}</h4>
        <div className="product-details">
          <span className="product-brand">🏷️ {product.brand}</span>
          <span className="product-price">💰 {product.price?.toLocaleString('vi-VN')}₫</span>
          <span className="product-rating">⭐ {product.rating} ({product.reviewCount || 0})</span>
          <span className={`product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
            {product.stock > 0 ? `✅ Còn ${product.stock} sản phẩm` : '❌ Hết hàng'}
          </span>
        </div>
      </div>
      <button 
        className="view-product-btn"
        onClick={() => window.open(`/products/${product._id}`, '_blank')}
      >
        Xem chi tiết →
      </button>
    </div>
  );

  const exampleQueries = [
    'Laptop gaming dưới 30 triệu',
    'So sánh RTX 4060 và RTX 4070',
    'Build PC gaming 40 triệu',
    'SSD là gì?'
  ];

  if (!isOpen) return null;

  return (
    <div className="ai-chat-overlay">
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <div className="header-info">
            <div className="header-icon">🤖</div>
            <div className="header-text">
              <h3>AI Commerce Assistant</h3>
              <p className="header-status">
                <span className="status-dot"></span>
                Đang hoạt động
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-btn" onClick={handleNewChat} title="Cuộc hội thoại mới">
              🔄
            </button>
            <button className="header-btn close-btn" onClick={onClose} title="Đóng">
              ✕
            </button>
          </div>
        </div>

        <div className="ai-chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? '🤖' : '👤'}
              </div>
              <div className="message-content">
                <div 
                  className="message-text"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
                {msg.products && msg.products.length > 0 && (
                  <div className="products-container">
                    {msg.products.slice(0, 5).map(product => renderProductCard(product))}
                  </div>
                )}
                <div className="message-footer">
                  <span className="message-time">
                    {msg.timestamp?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.metadata?.agent && (
                    <span className="message-agent" title={`Xử lý bởi ${msg.metadata.agent}`}>
                      🎯 {msg.metadata.intent}
                      {msg.metadata.executionTime && ` • ${msg.metadata.executionTime}ms`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length === 1 && (
          <div className="example-queries">
            <p className="example-label">💡 Gợi ý câu hỏi:</p>
            <div className="example-buttons">
              {exampleQueries.map((query, index) => (
                <button
                  key={index}
                  className="example-query-btn"
                  onClick={() => handleExampleClick(query)}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ai-chat-input">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập tin nhắn..."
            disabled={isLoading}
            rows={1}
          />
          <button 
            className="send-btn"
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLoading}
          >
            {isLoading ? '⏳' : '🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICommerceChat;
