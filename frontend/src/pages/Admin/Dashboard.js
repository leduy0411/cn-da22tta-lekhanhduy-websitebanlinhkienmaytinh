import React, { useState, useEffect } from 'react';
import { FiUsers, FiPackage, FiShoppingBag, FiDollarSign, FiAlertCircle, FiTrendingUp, FiEye, FiX, FiCalendar } from 'react-icons/fi';
import { adminAPI, orderAPI, productAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import Swal from 'sweetalert2';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [modalData, setModalData] = useState({ show: false, type: '', data: [], title: '' });
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const promises = [
        productAPI.getAll({ stock_lte: 1, limit: 5 })
      ];

      if (isAdmin()) {
        promises.unshift(adminAPI.getStats());
        promises.push(adminAPI.getAllOrders({ status: 'pending', limit: 5 }));
        // Fetch all orders for revenue chart
        const token = localStorage.getItem('token');
        promises.push(
          axios.get(`${API_URL}/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 500 }
          })
        );
      } else {
        promises.unshift(orderAPI.getOrders({ status: 'pending', limit: 5 }));
      }

      const results = await Promise.all(promises);

      if (isAdmin()) {
        const [statsResponse, productsResponse, ordersResponse, allOrdersResponse] = results;
        setStats(statsResponse.data);
        setLowStockProducts(productsResponse.data.products || productsResponse.data || []);
        setPendingOrders(ordersResponse.data.orders || []);
        
        // Process revenue data for charts
        const allOrders = allOrdersResponse?.data?.orders || allOrdersResponse?.data || [];
        processRevenueData(allOrders);
      } else {
        const [ordersResponse, productsResponse] = results;
        setPendingOrders(ordersResponse.data || []);
        setLowStockProducts(productsResponse.data.products || productsResponse.data || []);
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const processRevenueData = (orders) => {
    // Doanh thu theo 7 ngày gần nhất
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      last7Days.push({
        date: dateStr,
        fullDate: date.toDateString(),
        revenue: 0,
        orders: 0
      });
    }

    // Tính doanh thu từng ngày
    orders.forEach(order => {
      if (order.status !== 'cancelled') {
        const orderDate = new Date(order.createdAt).toDateString();
        const dayData = last7Days.find(d => d.fullDate === orderDate);
        if (dayData) {
          dayData.revenue += order.totalAmount || 0;
          dayData.orders += 1;
        }
      }
    });

    setRevenueData(last7Days);

    // Thống kê theo trạng thái đơn hàng
    const statusCount = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      if (statusCount.hasOwnProperty(order.status)) {
        statusCount[order.status]++;
      }
    });

    const statusData = [
      { name: 'Chờ xử lý', value: statusCount.pending, color: '#f59e0b' },
      { name: 'Đang xử lý', value: statusCount.processing, color: '#3b82f6' },
      { name: 'Đang giao', value: statusCount.shipped, color: '#7c3aed' },
      { name: 'Đã giao', value: statusCount.delivered, color: '#10b981' },
      { name: 'Đã hủy', value: statusCount.cancelled, color: '#e63946' }
    ].filter(s => s.value > 0);

    setOrderStatusData(statusData);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffa500',
      processing: '#1976d2',
      shipped: '#0c5460',
      delivered: '#28a745',
      cancelled: '#dc3545'
    };
    return colors[status] || '#999';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Chờ xử lý',
      processing: 'Đang xử lý',
      shipped: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
    };
    return texts[status] || status;
  };

  const handleStatCardClick = async (type) => {
    try {
      const token = localStorage.getItem('token');
      let data = [];
      let title = '';

      switch (type) {
        case 'users':
          title = 'Danh sách Khách hàng';
          const usersResponse = await axios.get(`${API_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 100 }
          });
          data = usersResponse.data.users || [];
          break;

        case 'products':
          title = 'Danh sách Sản phẩm';
          const productsResponse = await productAPI.getAll({ limit: 100 });
          data = productsResponse.data.products || productsResponse.data || [];
          break;

        case 'orders':
          title = 'Danh sách Đơn hàng';
          const ordersResponse = await axios.get(`${API_URL}/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 100 }
          });
          data = ordersResponse.data.orders || ordersResponse.data || [];
          console.log('Orders data:', data);
          break;

        case 'revenue':
          title = 'Chi tiết Doanh thu';
          const revenueResponse = await axios.get(`${API_URL}/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 100 }
          });
          const allOrders = revenueResponse.data.orders || revenueResponse.data || [];
          data = allOrders.filter(order => order.status !== 'cancelled');
          console.log('Revenue data:', data);
          break;

        default:
          break;
      }

      setModalData({ show: true, type, data, title });
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu:', error);
      Swal.fire('Lỗi', 'Không thể tải dữ liệu!', 'error');
    }
  };

  const closeModal = () => {
    setModalData({ show: false, type: '', data: [], title: '' });
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  const statCards = [
    {
      icon: FiUsers,
      title: 'Tổng khách hàng',
      value: stats?.totalUsers || 0,
      color1: '#e63946',
      color2: '#f97068',
      onClick: () => handleStatCardClick('users')
    },
    {
      icon: FiPackage,
      title: 'Tổng sản phẩm',
      value: stats?.totalProducts || 0,
      color1: '#7c3aed',
      color2: '#a78bfa',
      onClick: () => handleStatCardClick('products')
    },
    {
      icon: FiShoppingBag,
      title: 'Tổng đơn hàng',
      value: stats?.totalOrders || 0,
      color1: '#3b82f6',
      color2: '#60a5fa',
      onClick: () => handleStatCardClick('orders')
    },
    {
      icon: FiDollarSign,
      title: 'Tổng doanh thu',
      value: formatPrice(stats?.totalRevenue || 0),
      color1: '#10b981',
      color2: '#34d399',
      onClick: () => handleStatCardClick('revenue')
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
        <div className="dashboard-header-content">
          <div className="dashboard-header-left">
            <h1>Thống kê và báo cáo</h1>
            <p className="dashboard-subtitle">Tổng quan hệ thống quản trị</p>
          </div>
          <div className="dashboard-header-right">
            <div className="dashboard-date-badge">
              <FiCalendar size={16} />
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {isAdmin() && (
        <>
          <div className="stats-grid">
            {statCards.map((card, index) => (
              <div
                key={index}
                className="stat-card clickable"
                style={{ 
                  '--card-color-1': card.color1,
                  '--card-color-2': card.color2
                }}
                onClick={card.onClick}
              >
                <div className="stat-icon">
                  <card.icon />
                </div>
                <div className="stat-content">
                  <h3 className="stat-title">{card.title}</h3>
                  <p className="stat-value">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="alerts-section">
            <h2>⚡ Cảnh báo</h2>
            <div className="alerts-grid">
              {alertCards.map((card, index) => (
                <div key={index} className="alert-card" style={{ '--alert-color': card.color, '--alert-bg': card.color + '15' }}>
                  <div className="alert-icon-wrapper" style={{ background: card.color + '12' }}>
                    <card.icon size={26} color={card.color} />
                  </div>
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

          {/* Biểu đồ doanh thu */}
          <div className="charts-section">
            <div className="charts-grid">
              {/* Biểu đồ doanh thu theo ngày */}
              <div className="chart-card">
                <div className="chart-header">
                  <h3>📊 Doanh thu 7 ngày gần nhất</h3>
                  <span className="chart-subtitle">Tổng: {formatPrice(revenueData.reduce((sum, d) => sum + d.revenue, 0))}</span>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis 
                        tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        formatter={(value) => [formatPrice(value), 'Doanh thu']}
                        labelStyle={{ fontWeight: 'bold' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                      <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[4, 4, 0, 0]} />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e63946" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Biểu đồ số đơn hàng */}
              <div className="chart-card">
                <div className="chart-header">
                  <h3>📈 Số đơn hàng theo ngày</h3>
                  <span className="chart-subtitle">Tổng: {revenueData.reduce((sum, d) => sum + d.orders, 0)} đơn</span>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip 
                        formatter={(value) => [value + ' đơn', 'Số đơn hàng']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="orders" 
                        stroke="#7c3aed" 
                        strokeWidth={3}
                        dot={{ fill: '#7c3aed', strokeWidth: 2, r: 5, stroke: '#fff' }}
                        activeDot={{ r: 7, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Biểu đồ cột trạng thái đơn hàng */}
              <div className="chart-card">
                <div className="chart-header">
                  <h3>📦 Trạng thái đơn hàng</h3>
                  <span className="chart-subtitle">{orderStatusData.reduce((sum, d) => sum + d.value, 0)} đơn</span>
                </div>
                <div className="chart-container">
                  {orderStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart 
                        data={orderStatusData} 
                        margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12, fill: '#666' }}
                          angle={-15}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#666' }}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          formatter={(value) => [value + ' đơn hàng', 'Số lượng']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                          cursor={{ fill: 'rgba(102, 126, 234, 0.1)' }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[8, 8, 0, 0]}
                          maxBarSize={60}
                        >
                          {orderStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-chart-data">Chưa có dữ liệu đơn hàng</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!isAdmin() && (
        <div className="welcome-section" style={{ padding: '20px', background: 'white', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0 }}>Xin chào, {user?.name || 'Nhân viên'}! 👋</h2>
          <p style={{ color: '#666', marginBottom: 0 }}>
            Chào mừng bạn đến với trang quản trị. Dưới đây là danh sách các đơn hàng cần xử lý.
          </p>
        </div>
      )}

      {/* Đơn hàng chờ xử lý */}
      <div className="pending-orders-section">
        <div className="section-header">
          <h2>🛒 Đơn hàng chờ xử lý</h2>
          <a href="/admin/orders" className="view-all-link">Xem tất cả →</a>
        </div>
        <div className="orders-list">
          {pendingOrders.length === 0 ? (
            <div className="no-data">Không có đơn hàng chờ xử lý</div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Số lượng SP</th>
                  <th>Tổng tiền</th>
                  <th>Ngày đặt</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order._id}>
                    <td className="order-number">
                      <strong>{order.orderNumber}</strong>
                    </td>
                    <td>{order.customerInfo?.name}</td>
                    <td className="text-center">{order.items?.length || 0}</td>
                    <td className="price">{formatPrice(order.totalAmount)}</td>
                    <td className="date">{formatDate(order.createdAt)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: getStatusColor(order.status) + '20', color: getStatusColor(order.status) }}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-view-small"
                        onClick={() => navigate('/admin/orders')}
                        title="Xem chi tiết"
                      >
                        <FiEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sản phẩm sắp hết hàng */}
      <div className="low-stock-section">
        <div className="section-header">
          <h2>📦 Sản phẩm sắp hết hàng</h2>
          <a href="/admin/products" className="view-all-link">Xem tất cả →</a>
        </div>
        <div className="products-list">
          {lowStockProducts.length === 0 ? (
            <div className="no-data">Tất cả sản phẩm đều còn hàng</div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>Tồn kho</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="product-info">
                        <img
                          src={product.image?.startsWith('http') ? product.image : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${product.image}`}
                          alt={product.name}
                          onError={(e) => e.target.src = 'https://via.placeholder.com/50'}
                        />
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td className="price">{formatPrice(product.price)}</td>
                    <td>
                      <span className={`stock-badge ${product.stock <= 5 ? 'critical' : 'low'}`}>
                        {product.stock} sản phẩm
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-view-small"
                        onClick={() => navigate('/admin/products')}
                        title="Cập nhật"
                      >
                        <FiEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h2>🚀 Thao tác nhanh</h2>
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

      {/* Modal hiển thị chi tiết */}
      {modalData.show && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalData.title}</h2>
              <button className="btn-close" onClick={closeModal}>
                <FiX />
              </button>
            </div>

            <div className="modal-body">
              {modalData.type === 'users' && (
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Email</th>
                      <th>Quyền</th>
                      <th>Ngày đăng ký</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="no-data">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      modalData.data.map((user) => (
                        <tr key={user._id}>
                          <td><strong>{user.name}</strong></td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`role-badge ${user.role}`}>
                              {user.role === 'admin' ? 'Admin' : 'Khách hàng'}
                            </span>
                          </td>
                          <td className="date">{formatDate(user.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {modalData.type === 'products' && (
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Danh mục</th>
                      <th>Giá</th>
                      <th>Tồn kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="no-data">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      modalData.data.map((product) => (
                        <tr key={product._id}>
                          <td>
                            <div className="product-info">
                              <img
                                src={product.image?.startsWith('http') ? product.image : `${API_URL}${product.image}`}
                                alt={product.name}
                                onError={(e) => e.target.src = 'https://via.placeholder.com/50'}
                              />
                              <strong>{product.name}</strong>
                            </div>
                          </td>
                          <td>{product.category}</td>
                          <td className="price">{formatPrice(product.price)}</td>
                          <td className="text-center">{product.stock}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {modalData.type === 'orders' && (
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Sản phẩm đã mua</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Ngày đặt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      modalData.data.map((order) => (
                        <tr key={order._id}>
                          <td className="order-number">
                            <strong>{order.orderNumber}</strong>
                          </td>
                          <td>{order.customerInfo?.name}</td>
                          <td>
                            <div className="order-items-summary">
                              {order.items?.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="item-summary">
                                  • {item.name} (x{item.quantity})
                                </div>
                              ))}
                              {order.items?.length > 3 && (
                                <div className="more-items">
                                  +{order.items.length - 3} sản phẩm khác
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="price">{formatPrice(order.totalAmount)}</td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                background: getStatusColor(order.status) + '20',
                                color: getStatusColor(order.status)
                              }}
                            >
                              {getStatusText(order.status)}
                            </span>
                          </td>
                          <td className="date">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {modalData.type === 'revenue' && (
                <div className="revenue-detail">
                  <div className="revenue-summary">
                    <h3>Tổng doanh thu: {formatPrice(stats?.totalRevenue || 0)}</h3>
                    <p>Từ {modalData.data.length} đơn hàng đã hoàn thành/đang xử lý</p>
                  </div>
                  <table className="modal-table">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Khách hàng</th>
                        <th>Sản phẩm đã mua</th>
                        <th>Số tiền</th>
                        <th>Trạng thái</th>
                        <th>Ngày đặt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.data.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="no-data">Chưa có đơn hàng nào</td>
                        </tr>
                      ) : (
                        modalData.data.map((order) => (
                          <tr key={order._id}>
                            <td className="order-number">
                              <strong>{order.orderNumber}</strong>
                            </td>
                            <td>{order.customerInfo?.name}</td>
                            <td>
                              <div className="order-items-summary">
                                {order.items?.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="item-summary">
                                    • {item.name} (x{item.quantity})
                                  </div>
                                ))}
                                {order.items?.length > 2 && (
                                  <div className="more-items">
                                    +{order.items.length - 2} SP khác
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="price"><strong>{formatPrice(order.totalAmount)}</strong></td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  background: getStatusColor(order.status) + '20',
                                  color: getStatusColor(order.status)
                                }}
                              >
                                {getStatusText(order.status)}
                              </span>
                            </td>
                            <td className="date">{formatDate(order.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
