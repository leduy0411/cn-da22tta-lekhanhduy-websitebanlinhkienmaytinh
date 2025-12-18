import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiClock, FiCheckCircle, FiXCircle, FiTruck, FiEye } from 'react-icons/fi';
import { orderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './MyOrders.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const MyOrders = () => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getOrders();
      // Đảm bảo orders là một array
      const ordersData = Array.isArray(response.data) ? response.data : [];
      console.log('Orders data:', ordersData); // Debug
      setOrders(ordersData);
    } catch (error) {
      console.error('Lỗi khi lấy đơn hàng:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FiClock className="status-icon pending" />;
      case 'processing':
        return <FiPackage className="status-icon processing" />;
      case 'shipped':
        return <FiTruck className="status-icon shipped" />;
      case 'delivered':
        return <FiCheckCircle className="status-icon delivered" />;
      case 'cancelled':
        return <FiXCircle className="status-icon cancelled" />;
      default:
        return <FiClock className="status-icon" />;
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Chờ xác nhận',
      processing: 'Đang xử lý',
      shipped: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status}`;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewDetail = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const getImageUrl = (imagePath) => {
    console.log('Image path:', imagePath); // Debug
    if (!imagePath) return '/img/no-image.png';
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/uploads')) return `${API_URL}${imagePath}`;
    // Nếu path không có /uploads, thêm vào
    if (!imagePath.startsWith('/')) return `${API_URL}/uploads/${imagePath}`;
    return `${API_URL}${imagePath}`;
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter);

  // Đếm số lượng đơn hàng theo trạng thái
  const countByStatus = (status) => {
    return Array.isArray(orders) ? orders.filter(o => o.status === status).length : 0;
  };

  if (!isAuthenticated) {
    return (
      <div className="my-orders-container">
        <div className="auth-required">
          <FiPackage size={64} />
          <h2>Vui lòng đăng nhập</h2>
          <p>Bạn cần đăng nhập để xem đơn hàng của mình</p>
          <Link to="/login" className="btn-login">Đăng nhập ngay</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-orders-container">
        <div className="loading">Đang tải đơn hàng...</div>
      </div>
    );
  }

  return (
    <div className="my-orders-container">
      <div className="orders-header">
        <h1>
          <FiPackage /> Đơn hàng của tôi
        </h1>
        <p className="orders-subtitle">Quản lý và theo dõi đơn hàng của bạn</p>
      </div>

      <div className="orders-filters">
        <button 
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          Tất cả ({Array.isArray(orders) ? orders.length : 0})
        </button>
        <button 
          className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          Chờ xác nhận ({countByStatus('pending')})
        </button>
        <button 
          className={filter === 'processing' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('processing')}
        >
          Đang xử lý ({countByStatus('processing')})
        </button>
        <button 
          className={filter === 'shipped' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('shipped')}
        >
          Đang giao ({countByStatus('shipped')})
        </button>
        <button 
          className={filter === 'delivered' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('delivered')}
        >
          Đã giao ({countByStatus('delivered')})
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">
          <FiPackage size={64} />
          <h3>Chưa có đơn hàng nào</h3>
          <p>Bạn chưa có đơn hàng nào {filter !== 'all' && `ở trạng thái "${getStatusText(filter)}"`}</p>
          <Link to="/" className="btn-shop-now">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((order) => (
            <div key={order._id} className="order-card">
              <div className="order-header">
                <div className="order-info">
                  <h3>Đơn hàng #{order.orderNumber}</h3>
                  <span className="order-date">{formatDate(order.createdAt)}</span>
                </div>
                <div className={getStatusClass(order.status)}>
                  {getStatusIcon(order.status)}
                  <span>{getStatusText(order.status)}</span>
                </div>
              </div>

              <div className="order-products">
                {order.items.map((item, index) => (
                  <div key={index} className="order-product-item">
                    <img 
                      src={getImageUrl(item.image || item.product?.image)}
                      alt={item.name || item.product?.name || 'Sản phẩm'}
                      onError={(e) => e.target.src = '/img/no-image.png'}
                    />
                    <div className="product-info">
                      <h4>{item.name || item.product?.name || 'Sản phẩm không tồn tại'}</h4>
                      <p className="product-quantity">Số lượng: {item.quantity}</p>
                      <p className="product-price">{formatPrice(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-footer">
                <div className="order-total">
                  <span className="total-label">Tổng cộng:</span>
                  <span className="total-amount">{formatPrice(order.totalAmount)}</span>
                </div>
                <div className="order-actions">
                  <button 
                    className="btn-view-detail"
                    onClick={() => handleViewDetail(order)}
                  >
                    <FiEye /> Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal chi tiết đơn hàng */}
      {showDetailModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đơn hàng #{selectedOrder.orderNumber}</h2>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Thông tin đơn hàng</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Trạng thái:</label>
                    <div className={getStatusClass(selectedOrder.status)}>
                      {getStatusIcon(selectedOrder.status)}
                      <span>{getStatusText(selectedOrder.status)}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <label>Ngày đặt:</label>
                    <span>{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <div className="info-item">
                    <label>Phương thức thanh toán:</label>
                    <span>{selectedOrder.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : 'Chuyển khoản'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Thông tin người nhận</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Họ tên:</label>
                    <span>{selectedOrder.customerInfo?.name || selectedOrder.shippingAddress?.fullName || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Số điện thoại:</label>
                    <span>{selectedOrder.customerInfo?.phone || selectedOrder.shippingAddress?.phone || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{selectedOrder.customerInfo?.email || 'N/A'}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>Địa chỉ:</label>
                    <span>{selectedOrder.customerInfo?.address || selectedOrder.shippingAddress?.address || 'N/A'}</span>
                  </div>
                  {(selectedOrder.note || selectedOrder.shippingAddress?.note) && (
                    <div className="info-item full-width">
                      <label>Ghi chú:</label>
                      <span>{selectedOrder.note || selectedOrder.shippingAddress?.note}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Sản phẩm</h3>
                <div className="detail-products">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="detail-product-item">
                      <img 
                        src={getImageUrl(item.image || item.product?.image)}
                        alt={item.name || item.product?.name || 'Sản phẩm'}
                        onError={(e) => e.target.src = '/img/no-image.png'}
                      />
                      <div className="product-details">
                        <h4>{item.name || item.product?.name || 'Sản phẩm không tồn tại'}</h4>
                        <p>Số lượng: {item.quantity}</p>
                        <p className="item-price">{formatPrice(item.price)} x {item.quantity}</p>
                      </div>
                      <div className="item-total">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <div className="order-summary">
                  <div className="summary-row">
                    <span>Tạm tính:</span>
                    <span>{formatPrice(selectedOrder.totalAmount)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Phí vận chuyển:</span>
                    <span>Miễn phí</span>
                  </div>
                  <div className="summary-row total">
                    <span>Tổng cộng:</span>
                    <span>{formatPrice(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
