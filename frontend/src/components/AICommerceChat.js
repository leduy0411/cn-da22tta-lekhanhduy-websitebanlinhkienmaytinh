import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './AICommerceChat.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

const welcomeMessage = {
  role: 'assistant',
  content: [
    'Xin chao! Minh la tro ly AI cua TechStore.',
    '',
    'Minh co the giup ban:',
    '- Tim san pham theo ngan sach va nhu cau.',
    '- So sanh linh kien va tu van cau hinh.',
    '- Giai dap cau hoi cong nghe ngan gon, de hieu.',
    '',
    'Ban muon bat dau voi yeu cau nao?'
  ].join('\n'),
  timestamp: new Date()
};

const AICommerceChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [lastIntent, setLastIntent] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
      setMessages([welcomeMessage]);
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
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/ai-assistant/conversation/${sessionId}`, { headers });
      const data = await response.json();
      
      if (data.success && data.conversation?.messages) {
        const loadedMessages = data.conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          metadata: msg.metadata
        }));

        setMessages(loadedMessages.length > 0 ? loadedMessages : [welcomeMessage]);
      } else {
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Load conversation error:', error);
      setMessages([welcomeMessage]);
    }
  };

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
  }, [inputMessage]);

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/ai-assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
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

        setLastIntent(data.metadata?.intent || '');

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
    setLastIntent('');
    localStorage.setItem('ai_chat_session', newSessionId);
    setMessages([welcomeMessage]);
  };

  const escapeHtml = (unsafeText) => unsafeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatInline = (text) => {
    let formatted = text;
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return formatted;
  };

  const formatMessage = (content) => {
    const safeContent = escapeHtml(String(content || ''));
    const lines = safeContent.split('\n');

    return lines
      .map((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
          return '<div class="msg-spacer"></div>';
        }

        if (/^###\s+/.test(line)) {
          return `<div class="msg-heading msg-heading-3">${formatInline(line.replace(/^###\s+/, ''))}</div>`;
        }

        if (/^##\s+/.test(line)) {
          return `<div class="msg-heading msg-heading-2">${formatInline(line.replace(/^##\s+/, ''))}</div>`;
        }

        if (/^#\s+/.test(line)) {
          return `<div class="msg-heading msg-heading-1">${formatInline(line.replace(/^#\s+/, ''))}</div>`;
        }

        if (/^[-*]\s+/.test(line)) {
          return `<div class="msg-list-item">${formatInline(line.replace(/^[-*]\s+/, ''))}</div>`;
        }

        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+)\.\s+(.+)$/);
          if (match) {
            return `<div class="msg-ordered-item"><span class="msg-order-index">${match[1]}.</span><span>${formatInline(match[2])}</span></div>`;
          }
        }

        return `<div class="msg-line">${formatInline(line)}</div>`;
      })
      .join('');
  };

  const renderProductCard = (product) => (
    <div className="product-card" key={product._id}>
      <div className="product-thumb-wrap">
        <img
          className="product-thumb"
          src={getProductImageUrl(product)}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/96x96?text=TechStore';
          }}
        />
      </div>
      <div className="product-info">
        <h4>{product.name}</h4>
        <div className="product-details">
          <span className="product-brand">🏷️ {product.brand || 'TechStore'}</span>
          <span className="product-price">💰 {Number(product.price || 0).toLocaleString('vi-VN')}₫</span>
          <span className="product-rating">⭐ {Number(product.rating || 0).toFixed(1)} ({product.reviewCount || 0})</span>
          <span className={`product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
            {product.stock > 0 ? `✅ Còn ${product.stock} sản phẩm` : '❌ Hết hàng'}
          </span>
        </div>
        <button 
          className="view-product-btn"
          onClick={() => window.open(`/products/${product._id}`, '_blank')}
        >
          Xem chi tiết →
        </button>
      </div>
    </div>
  );

  function getProductImageUrl(product) {
    const imageCandidate = product?.images?.[0] || product?.image;
    if (!imageCandidate) {
      return 'https://via.placeholder.com/96x96?text=TechStore';
    }

    if (/^https?:\/\//i.test(imageCandidate)) {
      return imageCandidate;
    }

    if (imageCandidate.startsWith('/')) {
      return `${API_ORIGIN}${imageCandidate}`;
    }

    return `${API_ORIGIN}/${imageCandidate}`;
  }

  const exampleQueries = [
    'Laptop gaming dưới 30 triệu',
    'So sánh RTX 4060 và RTX 4070',
    'Build PC gaming 40 triệu',
    'RAM DDR4 và DDR5 khác nhau gì?'
  ];

  const quickActions = [
    { label: 'Tim laptop', text: 'Tu van laptop cho sinh vien duoi 20 trieu' },
    { label: 'Build PC', text: 'Goi y cau hinh PC gaming 30 trieu' },
    { label: 'So sanh', text: 'So sanh RTX 4060 va RX 7700 XT' },
    { label: 'Kien thuc', text: 'Giai thich su khac nhau giua SSD SATA va NVMe' }
  ];

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button 
          className="ai-chat-fab"
          onClick={() => setIsOpen(true)}
          title="Mở trợ lý AI"
        >
          <span className="chat-icon">🤖</span>
          <span className="chat-badge">new</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`ai-chat-overlay ${isExpanded ? 'expanded' : ''}`} onClick={() => !isExpanded && setIsOpen(false)}>
      <div className={`ai-chat-container ${isExpanded ? 'expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ai-chat-header">
          <div className="header-info">
            <div className="header-icon">
              <span>AI</span>
            </div>
            <div className="header-text">
              <h3>TechStore Assistant</h3>
              <p className="header-status">
                <span className="status-dot"></span>
                Online {lastIntent ? `• ${lastIntent}` : ''}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-btn" onClick={handleNewChat} title="Cuoc hoi thoai moi">
              New
            </button>
            <button 
              className="header-btn expand-btn" 
              onClick={() => setIsExpanded(!isExpanded)} 
              title={isExpanded ? 'Thu nho' : 'Mo rong'}
            >
              {isExpanded ? '−' : '+'}
            </button>
            <button className="header-btn close-btn" onClick={() => { setIsOpen(false); setIsExpanded(false); }} title="Dong">
              x
            </button>
          </div>
        </div>

        <div className="quick-actions-row">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="quick-action-btn"
              onClick={() => handleExampleClick(action.text)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="ai-chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? 'AI' : 'You'}
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
              <div className="message-avatar">AI</div>
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

        {messages.length <= 1 && (
          <div className="example-queries">
            <p className="example-label">Goi y cau hoi:</p>
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
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhap cau hoi cua ban..."
            disabled={isLoading}
            rows={1}
          />
          <button 
            className="send-btn"
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLoading}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
      )}
    </>
  );
};

export default AICommerceChat;
