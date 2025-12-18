import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthCallback.css';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  useEffect(() => {
    const handleCallback = () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const userStr = params.get('user');
      const error = params.get('error');

      if (error) {
        // Có lỗi từ OAuth
        navigate('/login?error=' + error);
        return;
      }

      if (token && userStr) {
        try {
          const user = JSON.parse(decodeURIComponent(userStr));
          
          // Lưu token và user info
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          // Update context
          setUser(user);

          // Clear sessionId khi đăng nhập
          localStorage.removeItem('sessionId');

          // Redirect dựa vào role
          if (user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/');
          }
        } catch (err) {
          console.error('Error parsing user data:', err);
          navigate('/login?error=auth_failed');
        }
      } else {
        navigate('/login?error=missing_data');
      }
    };

    handleCallback();
  }, [location, navigate, setUser]);

  return (
    <div className="auth-callback-page">
      <div className="callback-spinner">
        <div className="spinner-circle"></div>
        <h2>Đang xử lý đăng nhập...</h2>
        <p>Vui lòng chờ trong giây lát</p>
      </div>
    </div>
  );
};

export default AuthCallback;
