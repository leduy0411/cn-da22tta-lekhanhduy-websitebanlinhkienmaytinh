import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Sparkles, ImageIcon, Mic, Send } from 'lucide-react';
import './GeminiChatUI.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const SESSION_KEY = 'techstore_chat_session';
const LAST_USER_MESSAGE_AT_KEY = 'techstore_chat_last_user_message_at';
const SESSION_INACTIVITY_RESET_MS = 30 * 60 * 1000;
const normalizedApiBase = API_BASE.replace(/\/$/, '');
const CHAT_ENDPOINT = normalizedApiBase.endsWith('/api')
  ? `${normalizedApiBase}/v3/chat`
  : `${normalizedApiBase}/api/v3/chat`;

const WELCOME_MESSAGE = {
  id: 1,
  role: 'ai',
  text: 'Chào bạn, mình là trợ lý AI của TechStore. Mình có thể giúp gì cho bạn hôm nay?'
};

function normalizeImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  try {
    return encodeURI(rawUrl.trim());
  } catch (error) {
    return rawUrl.trim();
  }
}

function ProductImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = normalizeImageUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  if (!safeSrc || failed) {
    return (
      <div className="ts-chat-product-image-placeholder" aria-label="Image unavailable">
        <ImageIcon size={16} />
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt || 'Sản phẩm'}
      className="ts-chat-product-image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '');

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [inputText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '';
    }
    return amount.toLocaleString('vi-VN');
  };

  const parseChatResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const rawText = await response.text();
    const looksLikeHtml = /<!doctype html>|<html/i.test(rawText);

    if (looksLikeHtml) {
      throw new Error('Chatbot chưa kết nối đúng API. Vui lòng kiểm tra backend đang chạy ở cổng 5000.');
    }

    throw new Error(rawText?.trim() || 'Phản hồi từ server không hợp lệ.');
  };

  const resetChatSession = () => {
    setSessionId('');
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_USER_MESSAGE_AT_KEY);
  };

  const handleNewChat = () => {
    resetChatSession();
    setMessages([WELCOME_MESSAGE]);
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', text: trimmed }
    ]);
    setInputText('');
    setIsLoading(true);

    try {
      const now = Date.now();
      const lastUserMessageAt = Number(localStorage.getItem(LAST_USER_MESSAGE_AT_KEY) || 0);
      const shouldRotateByInactivity = Boolean(sessionId)
        && Number.isFinite(lastUserMessageAt)
        && lastUserMessageAt > 0
        && (now - lastUserMessageAt > SESSION_INACTIVITY_RESET_MS);

      let outboundSessionId = sessionId;
      if (shouldRotateByInactivity) {
        outboundSessionId = '';
        resetChatSession();
      }

      const token = localStorage.getItem('token');
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId: outboundSessionId || undefined,
          newChat: shouldRotateByInactivity
        })
      });

      const payload = await parseChatResponse(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.data?.text || payload?.message || 'Không thể kết nối chatbot lúc này.');
      }

      if (payload.sessionId && payload.sessionId !== sessionId) {
        setSessionId(payload.sessionId);
        localStorage.setItem(SESSION_KEY, payload.sessionId);
      }

      localStorage.setItem(LAST_USER_MESSAGE_AT_KEY, String(now));

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: payload?.data?.text || 'Xin lỗi, mình chưa có phản hồi phù hợp.',
          products: Array.isArray(payload?.data?.products) ? payload.data.products : [],
          mode: payload?.data?.meta?.mode || 'normal',
          provider: payload?.data?.meta?.provider || '',
          degraded: Boolean(payload?.data?.meta?.degraded)
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại sau.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ts-chat-widget">
      {isOpen && (
        <div className="ts-chat-panel" role="dialog" aria-label="TechStore AI Chat">
          <header className="ts-chat-header">
            <div className="ts-chat-brand">
              <div className="ts-chat-brand-icon">
                <Sparkles size={16} color="#ffffff" />
              </div>
              <h1>TechStore AI</h1>
            </div>

            <div className="ts-chat-header-actions">
              <button
                onClick={handleNewChat}
                className="ts-chat-new"
                type="button"
                aria-label="New chat"
                disabled={isLoading}
              >
                New Chat
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="ts-chat-close"
                type="button"
                aria-label="Đóng chat"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <main className="ts-chat-body">
            <div className="ts-chat-stream">
              {messages.map((msg) => (
                <div key={msg.id} className={`ts-chat-row ${msg.role === 'user' ? 'user' : 'ai'}`}>
                  {msg.role === 'ai' && (
                    <div className="ts-ai-bubble-wrap">
                      <div className="ts-ai-avatar">
                        <Sparkles size={14} color="#ffffff" />
                      </div>
                      <div className="ts-chat-bubble ts-chat-bubble-ai">
                        {msg.text}
                        {Array.isArray(msg.products) && msg.products.length > 0 && (
                          <div className="ts-chat-product-list">
                            {msg.products.map((product) => (
                              <a
                                key={product.id || `${product.name}-${product.imageUrl || ''}`}
                                href={product.productUrl || '#'}
                                className="ts-chat-product-card"
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => {
                                  if (!product.productUrl) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                {product.imageUrl ? (
                                  <ProductImage
                                    src={product.imageUrl}
                                    alt={product.name || 'Sản phẩm'}
                                  />
                                ) : (
                                  <div className="ts-chat-product-image-placeholder" aria-label="Image unavailable">
                                    <ImageIcon size={16} />
                                  </div>
                                )}
                                <div className="ts-chat-product-content">
                                  <h4>{product.name || 'Sản phẩm'}</h4>
                                  {product.brand && <p>{product.brand}</p>}
                                  {product.price ? <strong>{formatCurrency(product.price)} VND</strong> : null}
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {msg.role === 'user' && (
                    <div className="ts-chat-bubble ts-chat-bubble-user">
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="ts-chat-row ai">
                  <div className="ts-ai-bubble-wrap">
                    <div className="ts-ai-avatar">
                      <Sparkles size={14} color="#ffffff" />
                    </div>
                    <div className="ts-chat-bubble ts-chat-bubble-ai">
                      <div className="ts-chat-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </main>

          <div className="ts-chat-composer-wrap">
            <div className="ts-chat-composer">
              <button
                className="ts-chat-icon-btn"
                type="button"
                disabled={isLoading}
                aria-label="Upload image"
              >
                <ImageIcon size={16} />
              </button>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Hỏi AI tư vấn..."
                className="ts-chat-textarea"
                rows={1}
                disabled={isLoading}
              />

              <div className="ts-chat-actions">
                {!inputText.trim() ? (
                  <button
                    className="ts-chat-icon-btn"
                    type="button"
                    disabled={isLoading}
                    aria-label="Voice input"
                  >
                    <Mic size={16} />
                  </button>
                ) : (
                  <button
                    className="ts-chat-send-btn"
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="ts-chat-trigger"
        type="button"
        aria-label={isOpen ? 'Đóng chat' : 'Mở chat'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
