import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPackage } from 'react-icons/fi';
import { orderAPI } from '../services/api';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await orderAPI.getOrderById(orderId);
      setOrder(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đơn hàng:', error);
      alert('Không tìm thấy đơn hàng');
      navigate('/');
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

  const formatDate = (date) => {
    return new Date(date).toLocaleString('vi-VN');
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!order) {
    return <div className="loading">Không tìm thấy đơn hàng</div>;
  }

  return (
    <div className="order-success-page">
      <div className="container">
        <div className="success-card">
          <FiCheckCircle className="success-icon" />
          <h1>Đặt hàng thành công!</h1>
          <p className="success-message">
            Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ liên hệ với bạn sớm nhất.
          </p>

          <div className="order-number">
            <FiPackage />
            <div>
              <span className="label">Mã đơn hàng:</span>
              <span className="value">{order.orderNumber}</span>
            </div>
          </div>

          <div className="order-details-card">
            <h2>Thông tin đơn hàng</h2>

            <div className="info-section">
              <h3>Thông tin khách hàng</h3>
              <div className="info-row">
                <span>Họ tên:</span>
                <span>{order.customerInfo.name}</span>
              </div>
              <div className="info-row">
                <span>Email:</span>
                <span>{order.customerInfo.email}</span>
              </div>
              <div className="info-row">
                <span>Số điện thoại:</span>
                <span>{order.customerInfo.phone}</span>
              </div>
              <div className="info-row">
                <span>Địa chỉ:</span>
                <span>{order.customerInfo.address}</span>
              </div>
            </div>

            <div className="info-section">
              <h3>Sản phẩm đã đặt</h3>
              {order.items.map((item, index) => (
                <div key={index} className="order-item-row">
                  <span>{item.name} x {item.quantity}</span>
                  <span>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="info-section">
              <h3>Thanh toán</h3>
              <div className="info-row">
                <span>Phương thức:</span>
                <span>{order.paymentMethod}</span>
              </div>
              <div className="info-row">
                <span>Trạng thái:</span>
                <span className="status-badge">{order.status}</span>
              </div>
              <div className="info-row total">
                <span>Tổng cộng:</span>
                <span className="total-amount">{formatPrice(order.totalAmount)}</span>
              </div>
            </div>

            {order.note && (
              <div className="info-section">
                <h3>Ghi chú</h3>
                <p>{order.note}</p>
              </div>
            )}

            <div className="info-section">
              <div className="info-row">
                <span>Ngày đặt hàng:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={() => navigate('/')} className="continue-btn">
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
