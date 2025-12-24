import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaGoogle, FaFacebookF } from 'react-icons/fa';
import { FiEye, FiEyeOff, FiMail, FiLock } from 'react-icons/fi';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

    console.log('Đang đăng nhập với:', formData.email);
    const result = await login(formData.email, formData.password);
    console.log('Kết quả đăng nhập:', result);

    if (result.success) {
      // Chuyển hướng dựa vào role
      if (result.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } else {
      setError(result.message);
      console.error('Lỗi đăng nhập:', result.message);
    }

    setLoading(false);
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth with sessionId for cart merging
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const sessionId = localStorage.getItem('sessionId');
    const url = sessionId 
      ? `${baseURL}/auth/google?sessionId=${sessionId}`
      : `${baseURL}/auth/google`;
    window.location.href = url;
  };

  const handleFacebookLogin = () => {
    // Redirect to Facebook OAuth with sessionId for cart merging
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const sessionId = localStorage.getItem('sessionId');
    const url = sessionId 
      ? `${baseURL}/auth/facebook?sessionId=${sessionId}`
      : `${baseURL}/auth/facebook`;
    window.location.href = url;
  };

  return (
    <div 
      className="auth-page"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/img/img-nen-dangnhap/pexels-lulizler-3165335.jpg)`
      }}
    >
      <div className="auth-split-container">
        {/* Left Side - Branding */}
        <div className="auth-branding">
          <div className="branding-content">
            <div className="brand-icon">
              <span className="icon-computer">💻</span>
            </div>
            <h1 className="brand-title">Tech Store</h1>
            <p className="brand-slogan">Nơi công nghệ hội tụ</p>
            <div className="brand-features">
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>Sản phẩm chính hãng</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>Giá cả cạnh tranh</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span>Giao hàng nhanh chóng</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="auth-form-container">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h2>Đăng nhập</h2>
              <p className="auth-subtitle">Chào mừng bạn quay trở lại! 👋</p>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
              <div className="form-group">
                <label htmlFor="email">
                  <FiMail className="label-icon" />
                  <span>Email</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="example@email.com"
                    className="form-input"
                    autoComplete="new-email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <FiLock className="label-icon" />
                  <span>Mật khẩu</span>
                </label>
                <div className="input-wrapper password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Nhập mật khẩu"
                    minLength="6"
                    className="form-input"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span className="remember-text">Ghi nhớ đăng nhập</span>
                </label>
                <Link to="/forgot-password" className="forgot-link">
                  Quên mật khẩu?
                </Link>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <span className="btn-arrow">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="divider">
              <span>hoặc</span>
            </div>

            <div className="social-login">
              <button 
                type="button"
                className="social-btn google-btn" 
                onClick={handleGoogleLogin}
                title="Đăng nhập với Google"
              >
                <FaGoogle className="social-icon" />
                Đăng nhập với Google
              </button>
              {/* <button 
                type="button"
                className="social-btn facebook-btn" 
                onClick={handleFacebookLogin}
              >
                <FaFacebookF className="social-icon" />
                Đăng nhập với Facebook
              </button> */}
            </div>

            <div className="auth-footer">
              <p>
                Chưa có tài khoản?
                <Link to="/register" className="register-link">
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
