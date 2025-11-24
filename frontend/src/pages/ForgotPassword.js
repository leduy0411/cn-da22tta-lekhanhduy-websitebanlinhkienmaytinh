import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import './ForgotPassword.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setResetUrl('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/forgot-password', {
        email
      });

      setMessage(response.data.message);
      if (response.data.resetUrl) {
        setResetUrl(response.data.resetUrl);
      }
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-box">
        <div className="forgot-password-header">
          <FiMail className="icon-large" />
          <h2>Quên mật khẩu</h2>
          <p>Nhập email của bạn để nhận link đặt lại mật khẩu</p>
        </div>

        {message && (
          <div className="alert alert-success">
            <p>{message}</p>
            {resetUrl && (
              <div className="reset-url-box">
                <p><strong>Link reset password:</strong></p>
                <a href={resetUrl} className="reset-link">
                  {resetUrl}
                </a>
                <p className="note">
                  (Trong môi trường thực tế, link này sẽ được gửi qua email)
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">
              <FiMail /> Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email của bạn"
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi link reset mật khẩu'}
          </button>
        </form>

        <div className="back-to-login">
          <Link to="/login">
            <FiArrowLeft /> Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
