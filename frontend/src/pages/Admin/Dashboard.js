import React, { useState, useEffect } from 'react';
import { FiUsers, FiPackage, FiShoppingBag, FiDollarSign, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import { adminAPI } from '../../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thống kê:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  const statCards = [
    {
      icon: FiUsers,
      title: 'Tổng khách hàng',
      value: stats?.totalUsers || 0,
      color: '#667eea',
      bgColor: '#f0f3ff',
    },
    {
      icon: FiPackage,
      title: 'Tổng sản phẩm',
      value: stats?.totalProducts || 0,
      color: '#51cf66',
      bgColor: '#e7f9ec',
    },
    {
      icon: FiShoppingBag,
      title: 'Tổng đơn hàng',
      value: stats?.totalOrders || 0,
      color: '#ff6b6b',
      bgColor: '#ffe5e5',
    },
    {
      icon: FiDollarSign,
      title: 'Tổng doanh thu',
      value: formatPrice(stats?.totalRevenue || 0),
      color: '#ffa500',
      bgColor: '#fff4e5',
    },
  ];

  const alertCards = [
    {
      icon: FiAlertCircle,
      title: 'Đơn hàng chờ xử lý',
      value: stats?.pendingOrders || 0,
      color: '#ff6b6b',
    },
    {
      icon: FiTrendingUp,
      title: 'Sản phẩm sắp hết',
      value: stats?.lowStockProducts || 0,
      color: '#ffa500',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">Tổng quan hệ thống</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card" style={{ borderLeftColor: card.color }}>
            <div className="stat-icon" style={{ background: card.bgColor, color: card.color }}>
              <card.icon size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">{card.title}</h3>
              <p className="stat-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="alerts-section">
        <h2>Cảnh báo</h2>
        <div className="alerts-grid">
          {alertCards.map((card, index) => (
            <div key={index} className="alert-card">
              <card.icon size={32} color={card.color} />
              <div className="alert-content">
                <h3>{card.title}</h3>
                <p className="alert-value" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="quick-actions">
        <h2>Thao tác nhanh</h2>
        <div className="actions-grid">
          <a href="/admin/products" className="action-btn">
            <FiPackage size={20} />
            <span>Quản lý sản phẩm</span>
          </a>
          <a href="/admin/orders" className="action-btn">
            <FiShoppingBag size={20} />
            <span>Quản lý đơn hàng</span>
          </a>
          <a href="/admin/users" className="action-btn">
            <FiUsers size={20} />
            <span>Quản lý người dùng</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
