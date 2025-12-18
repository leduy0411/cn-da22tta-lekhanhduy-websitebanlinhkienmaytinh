import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { orderAPI } from '../services/api';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  
  // Kiểm tra nếu là mua ngay
  const buyNowItem = location.state?.buyNowItem;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    paymentMethod: 'COD',
    note: '',
  });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.address) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    // Kiểm tra: Nếu không phải mua ngay và giỏ hàng trống
    if (!buyNowItem && (!cart || !cart.items || cart.items.length === 0)) {
      alert('Giỏ hàng trống!');
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      const orderData = {
        customerInfo: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        },
        paymentMethod: formData.paymentMethod,
        note: formData.note,
      };

      // Nếu là mua ngay, thêm thông tin sản phẩm
      if (buyNowItem) {
        orderData.buyNowItem = {
          productId: buyNowItem.productId,
          quantity: buyNowItem.quantity
        };
      }

      const response = await orderAPI.createOrder(orderData);
      
      alert(`✅ ${response.data.message}\nMã đơn hàng: ${response.data.order.orderNumber}`);
      
      // Nếu thanh toán từ giỏ hàng, xóa giỏ hàng
      if (!buyNowItem) {
        await clearCart();
      }
      
      // Chuyển đến trang xác nhận
      navigate(`/order-success/${response.data.order._id}`);
    } catch (error) {
      alert('❌ ' + (error.response?.data?.message || 'Lỗi khi đặt hàng'));
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra nếu cả hai đều trống
  if (!buyNowItem && (!cart || !cart.items || cart.items.length === 0)) {
    return (
      <div className="checkout-empty">
        <div className="container">
          <div className="empty-state">
            <h2>Giỏ hàng trống</h2>
            <p>Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán</p>
            <button onClick={() => navigate('/')} className="back-to-shop">
              Quay lại mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tính tổng tiền
  const getTotalAmount = () => {
    if (buyNowItem) {
      return buyNowItem.price * buyNowItem.quantity;
    }
    return cart?.totalAmount || 0;
  };

  // Lấy danh sách items để hiển thị
  const getDisplayItems = () => {
    if (buyNowItem) {
      return [{
        _id: buyNowItem.productId,
        product: {
          name: buyNowItem.name,
          price: buyNowItem.price,
          image: buyNowItem.image
        },
        quantity: buyNowItem.quantity
      }];
    }
    return cart?.items || [];
  };

  const displayItems = getDisplayItems();
  const totalAmount = getTotalAmount();

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="checkout-title">Thanh toán</h1>

        <div className="checkout-grid">
          <div className="checkout-form-section">
            <form onSubmit={handleSubmit} className="checkout-form">
              <h2>Thông tin giao hàng</h2>

              <div className="form-group">
                <label htmlFor="name">Họ và tên *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="example@email.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Số điện thoại *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="0123456789"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">Địa chỉ giao hàng *</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows="3"
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                />
              </div>

              <div className="form-group">
                <label htmlFor="paymentMethod">Phương thức thanh toán *</label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  required
                >
                  <option value="COD">Thanh toán khi nhận hàng (COD)</option>
                  <option value="Banking">Chuyển khoản ngân hàng</option>
                  <option value="Card">Thẻ tín dụng/Ghi nợ</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="note">Ghi chú (không bắt buộc)</label>
                <textarea
                  id="note"
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Ghi chú thêm về đơn hàng..."
                />
              </div>

              <button type="submit" className="submit-order-btn" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đặt hàng'}
              </button>
            </form>
          </div>

          <div className="order-summary-section">
            <div className="order-summary">
              <h2>Đơn hàng của bạn</h2>
              
              {buyNowItem && (
                <div className="buy-now-badge">🚀 Mua ngay - Thanh toán nhanh</div>
              )}

              <div className="order-items">
                {displayItems.map((item) => (
                  <div key={item._id} className="order-item">
                    <img src={item.product.image} alt={item.product.name} />
                    <div className="order-item-info">
                      <h4>{item.product.name}</h4>
                      <p>Số lượng: {item.quantity}</p>
                    </div>
                    <div className="order-item-price">
                      {formatPrice(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-totals">
                <div className="total-row">
                  <span>Tạm tính:</span>
                  <span>{formatPrice(totalAmount)}</span>
                </div>
                <div className="total-row">
                  <span>Phí vận chuyển:</span>
                  <span>Miễn phí</span>
                </div>
                <div className="total-divider"></div>
                <div className="total-row grand-total">
                  <span>Tổng cộng:</span>
                  <span className="total-price">{formatPrice(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
