import React, { useState, useEffect, useCallback } from 'react';
import { RiRobot2Line, RiSearchLine, RiBarChartLine, RiSettings4Line, RiRefreshLine, RiPlayCircleLine, RiFileChartLine } from 'react-icons/ri';
import { FiMessageCircle, FiTrendingUp, FiDatabase, FiCpu, FiActivity, FiCheckCircle } from 'react-icons/fi';
import axios from 'axios';
import Swal from 'sweetalert2';
import './AdminAI.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminAI = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [aiStats, setAiStats] = useState(null);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [forecast, setForecast] = useState(null);

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const loadAIStats = useCallback(async () => {
    try {
      setLoading(true);
      // Load basic stats from chatbot conversations
      const conversationsRes = await axios.get(`${API_URL}/ai/chatbot/admin/stats`, getAuthHeader()).catch(() => null);
      setAiStats(conversationsRes?.data || {
        totalConversations: 0,
        activeToday: 0,
        avgSatisfaction: 0,
        totalMessages: 0
      });
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/chatbot/admin/conversations`, getAuthHeader()).catch(() => null);
      setConversations(response?.data?.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const loadEvaluationReport = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/evaluate/report`, getAuthHeader()).catch(() => null);
      setEvaluationReport(response?.data?.report || null);
    } catch (error) {
      console.error('Error loading evaluation report:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const loadForecast = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/forecast`, {
        ...getAuthHeader(),
        params: { periods: 30, type: 'daily', algorithm: 'ensemble' }
      }).catch(() => null);
      setForecast(response?.data?.forecast || null);
    } catch (error) {
      console.error('Error loading forecast:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadAIStats();
    } else if (activeTab === 'conversations') {
      loadConversations();
    } else if (activeTab === 'evaluation') {
      loadEvaluationReport();
    } else if (activeTab === 'forecast') {
      loadForecast();
    }
  }, [activeTab, loadAIStats, loadConversations, loadEvaluationReport, loadForecast]);

  const handleRunEvaluation = async (modelType) => {
    try {
      Swal.fire({
        title: 'Đang đánh giá...',
        text: 'Quá trình đánh giá mô hình đang chạy',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      if (modelType === 'all') {
        await axios.post(`${API_URL}/ai/evaluate/all`, {}, getAuthHeader());
        Swal.fire('Thành công', 'Đã bắt đầu đánh giá tất cả các mô hình', 'success');
      } else {
        await axios.post(`${API_URL}/ai/evaluate/${modelType}/default`, {}, getAuthHeader());
        Swal.fire('Thành công', `Đã hoàn thành đánh giá mô hình ${modelType}`, 'success');
      }
      loadEvaluationReport();
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể chạy đánh giá: ' + error.message, 'error');
    }
  };

  const handleGenerateEmbeddings = async () => {
    try {
      const result = await Swal.fire({
        title: 'Tạo Embeddings?',
        text: 'Quá trình này sẽ tạo embeddings cho tất cả sản phẩm. Có thể mất vài phút.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Bắt đầu',
        cancelButtonText: 'Hủy'
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Đang tạo embeddings...',
        text: 'Quá trình đang chạy trong nền',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await axios.post(`${API_URL}/ai/embeddings/generate`, {}, getAuthHeader());
      Swal.fire('Thành công', 'Đã bắt đầu tạo embeddings trong nền', 'success');
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể tạo embeddings: ' + error.message, 'error');
    }
  };

  const handleInitializeTFIDF = async () => {
    try {
      const result = await Swal.fire({
        title: 'Khởi tạo TF-IDF?',
        text: 'Điều này sẽ cập nhật từ điển TF-IDF cho tìm kiếm.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Khởi tạo',
        cancelButtonText: 'Hủy'
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Đang khởi tạo...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await axios.post(`${API_URL}/ai/tfidf/initialize`, {}, getAuthHeader());
      Swal.fire('Thành công', 'Đã khởi tạo TF-IDF thành công', 'success');
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể khởi tạo TF-IDF: ' + error.message, 'error');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: RiBarChartLine },
    { id: 'conversations', label: 'Hội thoại AI', icon: FiMessageCircle },
    { id: 'evaluation', label: 'Đánh giá Model', icon: RiFileChartLine },
    { id: 'forecast', label: 'Dự báo', icon: FiTrendingUp },
    { id: 'settings', label: 'Cài đặt', icon: RiSettings4Line }
  ];

  const renderOverview = () => (
    <div className="ai-overview">
      <div className="ai-stats-grid">
        <div className="ai-stat-card">
          <div className="stat-icon chatbot">
            <RiRobot2Line />
          </div>
          <div className="stat-info">
            <h4>Chatbot AI</h4>
            <p className="stat-value">{aiStats?.totalConversations || 0}</p>
            <span className="stat-label">Cuộc hội thoại</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon search">
            <RiSearchLine />
          </div>
          <div className="stat-info">
            <h4>Tìm kiếm ngữ nghĩa</h4>
            <p className="stat-value status-active"><FiCheckCircle /> Hoạt động</p>
            <span className="stat-label">Hybrid Search</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon recommendation">
            <FiActivity />
          </div>
          <div className="stat-info">
            <h4>Đề xuất sản phẩm</h4>
            <p className="stat-value status-active"><FiCheckCircle /> Hoạt động</p>
            <span className="stat-label">Hybrid Recommendation</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon forecast">
            <FiTrendingUp />
          </div>
          <div className="stat-info">
            <h4>Dự báo doanh số</h4>
            <p className="stat-value status-active"><FiCheckCircle /> Hoạt động</p>
            <span className="stat-label">Ensemble Model</span>
          </div>
        </div>
      </div>

      <div className="ai-features-section">
        <h3>Các tính năng AI</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <RiRobot2Line className="feature-icon" />
              <h4>Chatbot Thông minh</h4>
            </div>
            <p>Hỗ trợ khách hàng 24/7 với khả năng truy vấn database, tư vấn sản phẩm, và kiểm tra đơn hàng.</p>
            <ul className="feature-list">
              <li>Intent recognition (15+ intents)</li>
              <li>Context-aware responses</li>
              <li>Product recommendation</li>
              <li>Order tracking</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-header">
              <RiSearchLine className="feature-icon" />
              <h4>Tìm kiếm Ngữ nghĩa</h4>
            </div>
            <p>Tìm kiếm sản phẩm thông minh với nhiều thuật toán kết hợp.</p>
            <ul className="feature-list">
              <li>Keyword Search</li>
              <li>TF-IDF Search</li>
              <li>Embedding Search</li>
              <li>Hybrid Search</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-header">
              <FiActivity className="feature-icon" />
              <h4>Hệ thống Đề xuất</h4>
            </div>
            <p>Đề xuất sản phẩm cá nhân hóa dựa trên hành vi người dùng.</p>
            <ul className="feature-list">
              <li>Collaborative Filtering</li>
              <li>Content-Based Filtering</li>
              <li>Rule-Based Recommendations</li>
              <li>Hybrid Recommendations</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-header">
              <FiTrendingUp className="feature-icon" />
              <h4>Dự báo Doanh số</h4>
            </div>
            <p>Dự báo doanh số với nhiều thuật toán ensemble.</p>
            <ul className="feature-list">
              <li>Moving Average</li>
              <li>Exponential Smoothing</li>
              <li>Linear Regression</li>
              <li>Ensemble Model</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConversations = () => (
    <div className="ai-conversations">
      <div className="section-header">
        <h3>Lịch sử Hội thoại AI</h3>
        <button className="refresh-btn" onClick={loadConversations} disabled={loading}>
          <RiRefreshLine className={loading ? 'spinning' : ''} /> Làm mới
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <RiRobot2Line size={60} />
          <p>Chưa có cuộc hội thoại nào</p>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv, index) => (
            <div key={conv._id || index} className="conversation-item">
              <div className="conv-header">
                <span className="conv-id">#{conv.sessionId?.slice(-8) || index + 1}</span>
                <span className="conv-date">
                  {new Date(conv.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                </span>
                <span className={`conv-status ${conv.status || 'active'}`}>
                  {conv.status === 'ended' ? 'Đã kết thúc' : 'Hoạt động'}
                </span>
              </div>
              <div className="conv-stats">
                <span><FiMessageCircle /> {conv.messageCount || 0} tin nhắn</span>
                {conv.satisfaction && <span>⭐ {conv.satisfaction}/5</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEvaluation = () => (
    <div className="ai-evaluation">
      <div className="section-header">
        <h3>Đánh giá Mô hình AI</h3>
        <div className="header-actions">
          <button className="action-btn primary" onClick={() => handleRunEvaluation('all')}>
            <RiPlayCircleLine /> Chạy tất cả
          </button>
          <button className="refresh-btn" onClick={loadEvaluationReport} disabled={loading}>
            <RiRefreshLine className={loading ? 'spinning' : ''} /> Làm mới
          </button>
        </div>
      </div>

      <div className="evaluation-models">
        <div className="eval-card">
          <div className="eval-header">
            <FiActivity className="eval-icon" />
            <h4>Recommendation Models</h4>
          </div>
          <div className="eval-metrics">
            <div className="metric">
              <span className="metric-label">Precision@10</span>
              <span className="metric-value">{evaluationReport?.recommendation?.precision || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Recall@10</span>
              <span className="metric-value">{evaluationReport?.recommendation?.recall || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">NDCG@10</span>
              <span className="metric-value">{evaluationReport?.recommendation?.ndcg || 'N/A'}</span>
            </div>
          </div>
          <button className="eval-btn" onClick={() => handleRunEvaluation('recommendation')}>
            Đánh giá
          </button>
        </div>

        <div className="eval-card">
          <div className="eval-header">
            <RiSearchLine className="eval-icon" />
            <h4>Search Models</h4>
          </div>
          <div className="eval-metrics">
            <div className="metric">
              <span className="metric-label">Precision</span>
              <span className="metric-value">{evaluationReport?.search?.precision || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Recall</span>
              <span className="metric-value">{evaluationReport?.search?.recall || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">MRR</span>
              <span className="metric-value">{evaluationReport?.search?.mrr || 'N/A'}</span>
            </div>
          </div>
          <button className="eval-btn" onClick={() => handleRunEvaluation('search')}>
            Đánh giá
          </button>
        </div>

        <div className="eval-card">
          <div className="eval-header">
            <FiMessageCircle className="eval-icon" />
            <h4>Sentiment Analysis</h4>
          </div>
          <div className="eval-metrics">
            <div className="metric">
              <span className="metric-label">Accuracy</span>
              <span className="metric-value">{evaluationReport?.sentiment?.accuracy || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">F1 Score</span>
              <span className="metric-value">{evaluationReport?.sentiment?.f1 || 'N/A'}</span>
            </div>
          </div>
          <button className="eval-btn" onClick={() => handleRunEvaluation('sentiment')}>
            Đánh giá
          </button>
        </div>
      </div>
    </div>
  );

  const renderForecast = () => (
    <div className="ai-forecast">
      <div className="section-header">
        <h3>Dự báo Doanh số</h3>
        <button className="refresh-btn" onClick={loadForecast} disabled={loading}>
          <RiRefreshLine className={loading ? 'spinning' : ''} /> Làm mới
        </button>
      </div>

      {forecast ? (
        <div className="forecast-content">
          <div className="forecast-summary">
            <div className="forecast-stat">
              <h4>Dự báo 30 ngày tới</h4>
              <p className="forecast-value">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(forecast.totalPredicted || 0)}
              </p>
            </div>
            <div className="forecast-stat">
              <h4>Thuật toán</h4>
              <p>{forecast.algorithm || 'Ensemble'}</p>
            </div>
            <div className="forecast-stat">
              <h4>Độ tin cậy</h4>
              <p>{forecast.confidence ? `${(forecast.confidence * 100).toFixed(1)}%` : 'N/A'}</p>
            </div>
          </div>

          <div className="forecast-details">
            <h4>Chi tiết dự báo</h4>
            <div className="forecast-table">
              {forecast.predictions?.slice(0, 10).map((pred, idx) => (
                <div key={idx} className="forecast-row">
                  <span className="forecast-date">
                    {new Date(pred.date).toLocaleDateString('vi-VN')}
                  </span>
                  <span className="forecast-amount">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pred.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <FiTrendingUp size={60} />
          <p>Không có dữ liệu dự báo</p>
          <button className="action-btn" onClick={loadForecast}>Tải dự báo</button>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="ai-settings">
      <div className="section-header">
        <h3>Cài đặt AI</h3>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-header">
            <FiDatabase className="settings-icon" />
            <h4>Quản lý Embeddings</h4>
          </div>
          <p>Tạo và cập nhật embeddings cho sản phẩm để cải thiện tìm kiếm ngữ nghĩa.</p>
          <button className="settings-btn" onClick={handleGenerateEmbeddings}>
            <FiCpu /> Tạo Embeddings
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <RiSearchLine className="settings-icon" />
            <h4>TF-IDF Vocabulary</h4>
          </div>
          <p>Khởi tạo lại từ điển TF-IDF cho tìm kiếm từ khóa.</p>
          <button className="settings-btn" onClick={handleInitializeTFIDF}>
            <RiRefreshLine /> Khởi tạo TF-IDF
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <RiRobot2Line className="settings-icon" />
            <h4>Chatbot Settings</h4>
          </div>
          <p>Cấu hình chatbot AI và các mẫu phản hồi.</p>
          <div className="settings-info">
            <span><FiCheckCircle /> 15+ Intent patterns</span>
            <span><FiCheckCircle /> Context-aware</span>
            <span><FiCheckCircle /> Product integration</span>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <FiActivity className="settings-icon" />
            <h4>Recommendation Config</h4>
          </div>
          <p>Cấu hình hệ thống đề xuất sản phẩm.</p>
          <div className="settings-info">
            <span><FiCheckCircle /> Collaborative Filtering</span>
            <span><FiCheckCircle /> Content-Based</span>
            <span><FiCheckCircle /> Hybrid Model</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-ai">
      <div className="ai-header">
        <div className="ai-title">
          <RiRobot2Line size={32} />
          <h2>Quản Lý AI</h2>
        </div>
        <p className="ai-subtitle">Quản lý và giám sát các hệ thống AI của TechStore</p>
      </div>

      <div className="ai-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="ai-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'conversations' && renderConversations()}
        {activeTab === 'evaluation' && renderEvaluation()}
        {activeTab === 'forecast' && renderForecast()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};

export default AdminAI;
