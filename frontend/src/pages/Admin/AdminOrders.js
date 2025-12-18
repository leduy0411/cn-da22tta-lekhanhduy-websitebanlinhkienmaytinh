import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiShoppingBag, FiEye, FiRefreshCw, FiFilter, FiPackage, FiTruck, FiCheckCircle, FiXCircle, FiTrash2 } from 'react-icons/fi';
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
    processing: { bg: '#cfe2ff', color: '#084298', label: 'Đang xử lý' },
    shipped: { bg: '#d1ecf1', color: '#0c5460', label: 'Đang giao' },
    delivered: { bg: '#d4edda', color: '#155724', label: 'Đã giao' },
    cancelled: { bg: '#f8d7da', color: '#721c24', label: 'Đã hủy' }
  };

  const statusOptions = [
    { value: 'all', label: 'Tất cả đơn hàng' },
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'processing', label: 'Đang xử lý' },
    { value: 'shipped', label: 'Đang giao' },
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
      const response = await axios.get(`${API_URL}/admin/orders`, {
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
        `${API_URL}/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Cập nhật trạng thái thành công!');
      fetchOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi cập nhật trạng thái!');
    }
  };

  const handleDeliverOrder = async (orderId) => {
    if (!window.confirm('Xác nhận đơn hàng đã được giao thành công?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/orders/${orderId}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Đã xác nhận giao hàng thành công!');
      fetchOrders();
      if (showDetailModal) setShowDetailModal(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi xác nhận giao hàng!');
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = prompt('Nhập lý do hủy đơn hàng:');
    if (!reason) {
      alert('Vui lòng nhập lý do hủy đơn!');
      return;
    }

    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/orders/${orderId}/cancel`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Đã hủy đơn hàng và hoàn trả sản phẩm vào kho!');
      fetchOrders();
      if (showDetailModal) setShowDetailModal(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi hủy đơn hàng!');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Bạn có chắc muốn XÓA VĨNH VIỄN đơn hàng này? Hành động này không thể hoàn tác!')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_URL}/admin/orders/${orderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Đã xóa đơn hàng!');
      fetchOrders();
      if (showDetailModal) setShowDetailModal(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi xóa đơn hàng!');
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
      case 'processing': return <FiCheckCircle />;
      case 'shipped': return <FiTruck />;
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
                      <>
                        <select
                          className="status-select"
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                        >
                          <option value={order.status}>Cập nhật...</option>
                          {order.status === 'pending' && (
                            <option value="processing">Xử lý</option>
                          )}
                          {order.status === 'processing' && (
                            <option value="shipped">Giao hàng</option>
                          )}
                        </select>
                        {(order.status === 'shipped' || order.status === 'processing') && (
                          <button
                            className="btn-deliver"
                            onClick={() => handleDeliverOrder(order._id)}
                            title="Xác nhận giao hàng"
                          >
                            <FiCheckCircle />
                          </button>
                        )}
                        <button
                          className="btn-cancel-order"
                          onClick={() => handleCancelOrder(order._id)}
                          title="Hủy đơn hàng"
                        >
                          <FiXCircle />
                        </button>
                      </>
                    )}
                    <button
                      className="btn-delete-order"
                      onClick={() => handleDeleteOrder(order._id)}
                      title="Xóa đơn hàng"
                    >
                      <FiTrash2 />
                    </button>
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
                  {selectedOrder.note && (
                    <div className="info-item full-width">
                      <strong>Ghi chú:</strong> {selectedOrder.note}
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Sản phẩm đã đặt</h3>
                <div className="order-items">
                  {selectedOrder.items.map((item, index) => {
                    const imageUrl = item.image || item.product?.image;
                    const isExternalImage = imageUrl?.startsWith('http');
                    const finalImageUrl = imageUrl 
                      ? (isExternalImage ? imageUrl : `${API_URL}${imageUrl}`)
                      : null;

                    return (
                      <div key={index} className="order-item-row">
                        {finalImageUrl ? (
                          <img 
                            src={finalImageUrl} 
                            alt={item.name}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/80?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="no-image">
                            <FiPackage size={40} />
                          </div>
                        )}
                        <div className="item-info">
                          <h4>{item.name}</h4>
                          <p>Số lượng: {item.quantity}</p>
                        </div>
                        <div className="item-price">
                          {formatPrice(item.price * item.quantity)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="detail-section">
                <h3>Tổng cộng</h3>
                <div className="order-summary">
                  <div className="summary-row">
                    <span>Tổng tiền hàng:</span>
                    <strong>{formatPrice(selectedOrder.totalAmount)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Phương thức thanh toán:</span>
                    <strong>{selectedOrder.paymentMethod}</strong>
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
                  {selectedOrder.deliveredAt && (
                    <p className="order-time">
                      Giao hàng lúc: {formatDate(selectedOrder.deliveredAt)}
                    </p>
                  )}
                  {selectedOrder.cancelledAt && (
                    <>
                      <p className="order-time">
                        Hủy lúc: {formatDate(selectedOrder.cancelledAt)}
                      </p>
                      {selectedOrder.cancelReason && (
                        <p className="order-time">
                          Lý do hủy: <strong>{selectedOrder.cancelReason}</strong>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                <>
                  {(selectedOrder.status === 'shipped' || selectedOrder.status === 'processing') && (
                    <button 
                      className="btn-deliver-modal"
                      onClick={() => handleDeliverOrder(selectedOrder._id)}
                    >
                      <FiCheckCircle /> Xác nhận đã giao hàng
                    </button>
                  )}
                  <button 
                    className="btn-cancel-order-modal"
                    onClick={() => handleCancelOrder(selectedOrder._id)}
                  >
                    <FiXCircle /> Hủy đơn hàng
                  </button>
                </>
              )}
              <button 
                className="btn-delete-order-modal"
                onClick={() => handleDeleteOrder(selectedOrder._id)}
              >
                <FiTrash2 /> Xóa đơn hàng
              </button>
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
