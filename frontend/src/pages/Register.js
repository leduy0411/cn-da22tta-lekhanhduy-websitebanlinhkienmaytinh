import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiPhone, FiMapPin, FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự!');
      setLoading(false);
      return;
    }

    const { confirmPassword, ...userData } = formData;
    const result = await register(userData);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div 
      className="register-page"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/img/img-nen-dangnhap/pexels-lulizler-3165335.jpg)`
      }}
    >
      <div className="register-container">
        {/* Left Side - Branding */}
        <div className="register-branding">
          <div className="branding-content">
            <div className="brand-icon">
              <FiUserPlus size={40} />
            </div>
            <h1>Tạo Tài Khoản Mới</h1>
            <p>Đăng ký để trải nghiệm mua sắm công nghệ tuyệt vời</p>
            
            <div className="benefits-list">
              <div className="benefit-item">
                <span className="benefit-icon">🎁</span>
                <span>Ưu đãi độc quyền cho thành viên</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🚚</span>
                <span>Giao hàng nhanh miễn phí</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">💰</span>
                <span>Tích điểm đổi quà hấp dẫn</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">🛡️</span>
                <span>Bảo hành chính hãng toàn quốc</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="register-form-section">
          <div className="form-header">
            <h2>Đăng Ký</h2>
            <p>Điền thông tin của bạn để tạo tài khoản</p>
          </div>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form" autoComplete="off">
            {/* Họ tên */}
            <div className="input-group">
              <div className="input-icon">
                <FiUser />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Họ và tên"
                autoComplete="off"
              />
            </div>

            {/* Email */}
            <div className="input-group">
              <div className="input-icon">
                <FiMail />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Email"
                autoComplete="new-email"
              />
            </div>

            {/* Password Row */}
            <div className="password-row">
              <div className="input-group">
                <div className="input-icon">
                  <FiLock />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Mật khẩu"
                  minLength="6"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <div className="input-group">
                <div className="input-icon">
                  <FiLock />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Xác nhận mật khẩu"
                  minLength="6"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* Số điện thoại */}
            <div className="input-group">
              <div className="input-icon">
                <FiPhone />
              </div>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Số điện thoại"
                autoComplete="off"
              />
            </div>

            {/* Địa chỉ */}
            <div className="input-group textarea-group">
              <div className="input-icon">
                <FiMapPin />
              </div>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="2"
                placeholder="Địa chỉ (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố)"
                autoComplete="off"
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <FiUserPlus />
                  Đăng Ký Ngay
                </>
              )}
            </button>
          </form>

          <div className="register-footer">
            <p>
              Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
