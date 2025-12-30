import React, { useState, useEffect, useRef } from 'react';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';
import axios from 'axios';
import Swal from 'sweetalert2';
import './ChatBox.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ChatBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Tạo hoặc lấy sessionId từ localStorage
    let sid = localStorage.getItem('chatSessionId');
    if (!sid) {
      sid = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatSessionId', sid);
    }
    setSessionId(sid);
    
    // Load chat history
    if (sid) {
      loadChatHistory(sid);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && sessionId) {
      // Poll for new messages every 3 seconds
      const interval = setInterval(() => {
        loadChatHistory(sessionId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async (sid) => {
    try {
      const response = await axios.get(`${API_URL}/chat/session/${sid}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Lỗi khi tải lịch sử chat:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '' || !sessionId) return;

    try {
      await axios.post(`${API_URL}/chat/message`, {
        sessionId,
        text: inputMessage,
        sender: 'user'
      });

      setInputMessage('');
      // Reload chat to get updated messages
      await loadChatHistory(sessionId);
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      Swal.fire('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.', 'error');
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button 
        className={`chat-button ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <FiMessageCircle size={28} />
        <span className="chat-badge">Online</span>
      </button>

      {/* Chat Box */}
      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="avatar">
                <span>CS</span>
              </div>
              <div>
                <h4>Chăm Sóc Khách Hàng</h4>
                <span className="status">● Online</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <FiX size={24} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.sender === 'user' ? 'user-message' : 'support-message'}`}
              >
                <div className="message-bubble">
                  <p>{message.text}</p>
                  <span className="message-time">
                    {new Date(message.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="send-btn">
              <FiSend size={20} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
