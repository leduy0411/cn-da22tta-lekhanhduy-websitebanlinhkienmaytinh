/**
 * RAGChatBox.js
 * ─────────────────────────────────────────────────────────────
 * Production-quality RAG chatbot UI component.
 *
 * Features:
 *  • Sends messages to POST /api/chat (intent-aware RAG endpoint)
 *  • Displays intent badge: product_search / product_price / knowledge
 *  • Shows product cards with price, stock status and link
 *  • Quick-reply suggestion chips
 *  • Typing indicator while waiting for AI response
 *  • Markdown-style bold text rendering
 *  • Persists chat history in component state (session memory)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { sendRAGMessage } from '../services/ragAPI';
import './RAGChatBox.css';

// ─── Intent metadata ──────────────────────────────────────────────────────
const INTENT_META = {
  product_search:    { label: 'Tìm sản phẩm',       color: '#3b82f6' },
  product_price:     { label: 'Tra giá',             color: '#10b981' },
  knowledge_question:{ label: 'Hỏi kiến thức',       color: '#8b5cf6' },
};

// ─── Initial welcome message ──────────────────────────────────────────────
const WELCOME = {
  role: 'assistant',
  text:
    'Xin chào! 👋 Tôi là **TechBot** — trợ lý AI của TechStore.\n\n' +
    'Tôi có thể giúp bạn:\n' +
    '🔍 **Tìm sản phẩm** theo nhu cầu & ngân sách\n' +
    '💰 **Tra giá** sản phẩm cụ thể\n' +
    '📚 **Giải đáp** kiến thức phần cứng máy tính\n\n' +
    'Bạn cần hỗ trợ gì?',
  products: [],
  intent:   null,
  source:   null,
  time:     new Date(),
};

// ─── Quick reply suggestions ──────────────────────────────────────────────
const QUICK_REPLIES = [
  'Laptop gaming dưới 25 triệu',
  'RTX 4060 giá bao nhiêu',
  'Laptop và PC nên chọn cái nào',
  'CPU tốt nhất tầm 5 triệu',
  'PC văn phòng cấu hình gì đủ dùng',
];

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatPrice(price) {
  if (price == null || isNaN(price)) return 'Liên hệ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

/** Render **bold** and newlines as HTML. */
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ═══════════════════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════════════════
export default function RAGChatBox() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [messages,  setMessages]  = useState([WELCOME]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when chat box opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const message = (text || input).trim();
    if (!message || isLoading) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: message, products: [], intent: null, source: null, time: new Date() },
    ]);
    setIsLoading(true);

    try {
      const data = await sendRAGMessage(message, 5);

      setMessages((prev) => [
        ...prev,
        {
          role:     'assistant',
          text:     data.answer || 'Xin lỗi, tôi không hiểu yêu cầu này.',
          products: data.products || [],
          intent:   data.intent  || null,
          source:   data.source  || null,
          time:     new Date(),
        },
      ]);
    } catch (err) {
      console.error('[RAGChatBox] send error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Xin lỗi, đã có lỗi kết nối. Vui lòng thử lại sau.',
          products: [],
          intent: null,
          source: null,
          time: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => setMessages([{ ...WELCOME, time: new Date() }]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating button ── */}
      {!isOpen && (
        <button
          className="rag-chat-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Mở TechBot AI"
          title="TechBot AI"
        >
          <span className="rag-chat-fab-icon">🤖</span>
          <span className="rag-chat-fab-ping" />
        </button>
      )}

      {/* ── Chat window ── */}
      {isOpen && (
        <div className="rag-chat-window" role="dialog" aria-label="TechBot AI Chatbox">

          {/* Header */}
          <div className="rag-chat-header">
            <div className="rag-chat-header-left">
              <div className="rag-chat-avatar">🤖</div>
              <div>
                <div className="rag-chat-title">TechBot AI</div>
                <div className="rag-chat-subtitle">Powered by Gemini · RAG</div>
              </div>
            </div>
            <div className="rag-chat-header-actions">
              <button onClick={resetChat} title="Cuộc trò chuyện mới" className="rag-icon-btn">↺</button>
              <button onClick={() => setIsOpen(false)} title="Đóng" className="rag-icon-btn">✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="rag-chat-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`rag-msg rag-msg--${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <div className="rag-msg-avatar">🤖</div>
                )}

                <div className="rag-msg-body">
                  {/* Intent badge */}
                  {msg.role === 'assistant' && msg.intent && (
                    <span
                      className="rag-intent-badge"
                      style={{ background: INTENT_META[msg.intent]?.color || '#64748b' }}
                    >
                      {INTENT_META[msg.intent]?.label || msg.intent}
                    </span>
                  )}

                  {/* Text bubble */}
                  <div
                    className="rag-msg-bubble"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                  />

                  {/* Product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="rag-product-grid">
                      {msg.products.slice(0, 4).map((p, pi) => (
                        <Link
                          key={pi}
                          to={`/product/${p._id}`}
                          className="rag-product-card"
                          onClick={() => setIsOpen(false)}
                        >
                          <div className="rag-product-img-wrap">
                            <img
                              src={p.images?.[0] || p.image || '/img/placeholder.png'}
                              alt={p.name}
                              onError={(e) => { e.target.src = '/img/placeholder.png'; }}
                            />
                            {(p.stock || 0) <= 0 && (
                              <span className="rag-product-out-badge">Hết hàng</span>
                            )}
                          </div>
                          <div className="rag-product-info">
                            <p className="rag-product-name">{p.name}</p>
                            <p className="rag-product-brand">{p.brand || ''}</p>
                            <div className="rag-product-footer">
                              <span className="rag-product-price">
                                {formatPrice(p.price)}
                              </span>
                              {p.rating > 0 && (
                                <span className="rag-product-rating">
                                  ⭐ {Number(p.rating).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="rag-msg-time">
                    {msg.time instanceof Date
                      ? msg.time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="rag-msg rag-msg--assistant">
                <div className="rag-msg-avatar">🤖</div>
                <div className="rag-msg-body">
                  <div className="rag-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies (shown only when last message has no products) */}
          {!isLoading && messages[messages.length - 1]?.role !== 'user' && (
            <div className="rag-quick-replies">
              {QUICK_REPLIES.map((qr, i) => (
                <button
                  key={i}
                  className="rag-quick-btn"
                  onClick={() => handleSend(qr)}
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="rag-chat-input-form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="rag-chat-input"
              rows={1}
              placeholder="Hỏi về sản phẩm, giá, kiến thức phần cứng..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              maxLength={500}
            />
            <button
              type="submit"
              className="rag-send-btn"
              disabled={!input.trim() || isLoading}
              aria-label="Gửi"
            >
              ➤
            </button>
          </form>

        </div>
      )}
    </>
  );
}
