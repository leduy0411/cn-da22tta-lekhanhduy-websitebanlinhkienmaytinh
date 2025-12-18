import React, { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiSend, FiMessageCircle } from 'react-icons/fi';
import axios from 'axios';
import './AdminChat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminChat = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedSession) {
      scrollToBottom();
    }
  }, [selectedSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/chat/admin/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
      
      // Update selected session if it exists
      if (selectedSession) {
        const updated = response.data.find(s => s.sessionId === selectedSession.sessionId);
        if (updated) {
          setSelectedSession(updated);
        }
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách chat:', error);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedSession) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/chat/message`, {
        sessionId: selectedSession.sessionId,
        text: replyMessage,
        sender: 'support'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setReplyMessage('');
      await fetchSessions();
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      alert('Không thể gửi tin nhắn');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Bạn có chắc muốn xóa cuộc hội thoại này?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/chat/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (selectedSession?.sessionId === sessionId) {
        setSelectedSession(null);
      }
      
      await fetchSessions();
      alert('Đã xóa cuộc hội thoại');
    } catch (error) {
      console.error('Lỗi khi xóa chat:', error);
      alert('Không thể xóa cuộc hội thoại');
    }
  };

  const handleUpdateStatus = async (sessionId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/chat/session/${sessionId}/status`, 
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchSessions();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { text: 'Đang xử lý', class: 'status-active' },
      resolved: { text: 'Đã giải quyết', class: 'status-resolved' },
      archived: { text: 'Lưu trữ', class: 'status-archived' }
    };
    return badges[status] || badges.active;
  };

  return (
    <div className="admin-chat">
      <div className="chat-header-title">
        <FiMessageCircle size={24} />
        <h2>Quản Lý Chat</h2>
        <span className="session-count">{sessions.length} cuộc hội thoại</span>
      </div>

      <div className="chat-container">
        {/* Sessions List */}
        <div className="sessions-list">
          <h3>Danh sách hội thoại</h3>
          {sessions.length === 0 ? (
            <div className="no-sessions">Chưa có cuộc hội thoại nào</div>
          ) : (
            sessions.map((session) => (
              <div 
                key={session._id}
                className={`session-item ${selectedSession?.sessionId === session.sessionId ? 'active' : ''}`}
                onClick={() => setSelectedSession(session)}
              >
                <div className="session-info">
                  <div className="session-name">{session.userName || 'Khách'}</div>
                  <div className="session-time">
                    {new Date(session.lastMessage).toLocaleString('vi-VN')}
                  </div>
                  {session.userEmail && (
                    <div className="session-email">{session.userEmail}</div>
                  )}
                  <div className="session-preview">
                    {session.messages[session.messages.length - 1]?.text}
                  </div>
                </div>
                <div className="session-actions">
                  <span className={`status-badge ${getStatusBadge(session.status).class}`}>
                    {getStatusBadge(session.status).text}
                  </span>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.sessionId);
                    }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat Messages */}
        <div className="chat-detail">
          {selectedSession ? (
            <>
              <div className="chat-detail-header">
                <div>
                  <h3>{selectedSession.userName || 'Khách'}</h3>
                  {selectedSession.userEmail && <p>{selectedSession.userEmail}</p>}
                </div>
                <div className="status-controls">
                  <select 
                    value={selectedSession.status}
                    onChange={(e) => handleUpdateStatus(selectedSession.sessionId, e.target.value)}
                    className="status-select"
                  >
                    <option value="active">Đang xử lý</option>
                    <option value="resolved">Đã giải quyết</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </div>
              </div>

              <div className="messages-container">
                {selectedSession.messages.map((message, index) => (
                  <div 
                    key={index}
                    className={`chat-message ${message.sender === 'user' ? 'user' : 'support'}`}
                  >
                    <div className="message-content">
                      <div className="message-text">{message.text}</div>
                      <div className="message-time">
                        {new Date(message.time).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="reply-form" onSubmit={handleSendReply}>
                <input
                  type="text"
                  placeholder="Nhập tin nhắn trả lời..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="reply-input"
                />
                <button type="submit" className="send-btn" disabled={loading}>
                  <FiSend />
                </button>
              </form>
            </>
          ) : (
            <div className="no-selection">
              <FiMessageCircle size={64} />
              <p>Chọn một cuộc hội thoại để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChat;
