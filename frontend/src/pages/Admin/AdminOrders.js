import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiShoppingBag, FiEye, FiRefreshCw, FiFilter, FiPackage, FiTruck, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import './AdminOrders.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const statusColors = {
    pending: { bg: '#fff3cd', color: '#856404', label: 'Chờ xử lý' },
    confirmed: { bg: '#cfe2ff', color: '#084298', label: 'Đã xác nhận' },
    shipping: { bg: '#d1ecf1', color: '#0c5460', label: 'Đang giao' },
    delivered: { bg: '#d4edda', color: '#155724', label: 'Đã giao' },
    cancelled: { bg: '#f8d7da', color: '#721c24', label: 'Đã hủy' }
  };

  const statusOptions = [
    { value: 'all', label: 'Tất cả đơn hàng' },
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'shipping', label: 'Đang giao' },
    { value: 'delivered', label: 'Đã giao' },
    { value: 'cancelled', label: 'Đã hủy' }
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data.orders || response.data);
    } catch (error) {
      console.error('Lỗi khi lấy đơn hàng:', error);
      alert('Không thể tải danh sách đơn hàng!');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (!window.confirm(`Bạn có chắc muốn cập nhật trạng thái đơn hàng thành "${statusColors[newStatus].label}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Cập nhật trạng thái thành công!');
      fetchOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi cập nhật trạng thái!');
    }
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
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

  const filteredOrders = orders.filter(order => {
    const matchStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo.phone.includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <FiShoppingBag />;
      case 'confirmed': return <FiCheckCircle />;
      case 'shipping': return <FiTruck />;
      case 'delivered': return <FiPackage />;
      case 'cancelled': return <FiXCircle />;
      default: return <FiShoppingBag />;
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="admin-orders">
      <div className="orders-header">
        <h1>
          <FiShoppingBag /> Quản lý Đơn hàng
        </h1>
        <button className="btn-refresh" onClick={fetchOrders}>
          <FiRefreshCw /> Làm mới
        </button>
      </div>

      <div className="orders-filters">
        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="search-group">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="orders-stats">
          <span className="stat-item">
            Tổng: <strong>{filteredOrders.length}</strong> đơn
          </span>
        </div>
      </div>

      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>SĐT</th>
              <th>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Ngày đặt</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  Không có đơn hàng nào
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order._id}>
                  <td className="order-number">
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td>{order.customerInfo.name}</td>
                  <td>{order.customerInfo.phone}</td>
                  <td className="items-count">
                    {order.items.length} sản phẩm
                  </td>
                  <td className="order-total">
                    <strong>{formatPrice(order.totalAmount)}</strong>
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{
                        background: statusColors[order.status]?.bg,
                        color: statusColors[order.status]?.color
                      }}
                    >
                      {getStatusIcon(order.status)}
                      {statusColors[order.status]?.label}
                    </span>
                  </td>
                  <td className="order-date">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="order-actions">
                    <button
                      className="btn-view"
                      onClick={() => handleViewDetails(order)}
                      title="Xem chi tiết"
                    >
                      <FiEye />
                    </button>
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <select
                        className="status-select"
                        value={order.status}
                        onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                      >
                        <option value={order.status}>Cập nhật...</option>
                        {order.status === 'pending' && (
                          <>
                            <option value="confirmed">Xác nhận</option>
                            <option value="cancelled">Hủy đơn</option>
                          </>
                        )}
                        {order.status === 'confirmed' && (
                          <>
                            <option value="shipping">Bắt đầu giao</option>
                            <option value="cancelled">Hủy đơn</option>
                          </>
                        )}
                        {order.status === 'shipping' && (
                          <option value="delivered">Đã giao hàng</option>
                        )}
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal chi tiết đơn hàng */}
      {showDetailModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đơn hàng #{selectedOrder.orderNumber}</h2>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div className="order-detail-content">
              <div className="detail-section">
                <h3>Thông tin khách hàng</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Tên:</strong> {selectedOrder.customerInfo.name}
                  </div>
                  <div className="info-item">
                    <strong>SĐT:</strong> {selectedOrder.customerInfo.phone}
                  </div>
                  <div className="info-item">
                    <strong>Email:</strong> {selectedOrder.customerInfo.email}
                  </div>
                  <div className="info-item full-width">
                    <strong>Địa chỉ:</strong> {selectedOrder.customerInfo.address}
                  </div>
                  {selectedOrder.customerInfo.note && (
                    <div className="info-item full-width">
                      <strong>Ghi chú:</strong> {selectedOrder.customerInfo.note}
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Sản phẩm đã đặt</h3>
                <div className="order-items">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="order-item-row">
                      <img src={item.image} alt={item.name} />
                      <div className="item-info">
                        <h4>{item.name}</h4>
                        <p>Số lượng: {item.quantity}</p>
                      </div>
                      <div className="item-price">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Tổng cộng</h3>
                <div className="order-summary">
                  <div className="summary-row">
                    <span>Tổng tiền hàng:</span>
                    <strong>{formatPrice(selectedOrder.totalAmount)}</strong>
                  </div>
                  <div className="summary-row total">
                    <span>Tổng thanh toán:</span>
                    <strong className="total-amount">{formatPrice(selectedOrder.totalAmount)}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Trạng thái đơn hàng</h3>
                <div className="status-info">
                  <span 
                    className="status-badge large"
                    style={{
                      background: statusColors[selectedOrder.status]?.bg,
                      color: statusColors[selectedOrder.status]?.color
                    }}
                  >
                    {getStatusIcon(selectedOrder.status)}
                    {statusColors[selectedOrder.status]?.label}
                  </span>
                  <p className="order-time">
                    Đặt lúc: {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminOrders;
