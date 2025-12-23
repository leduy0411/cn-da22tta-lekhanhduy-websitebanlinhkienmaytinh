import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiPackage, FiShoppingBag, FiUsers, FiBarChart2, FiLogOut, FiGrid, FiMessageCircle, FiStar, FiSettings } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [user]);

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      logout();
      navigate('/');
    }
  };

  const menuItems = [
    { path: '/admin', icon: FiBarChart2, label: 'Dashboard', exact: true },
    { path: '/admin/products', icon: FiPackage, label: 'Sản phẩm' },
    { path: '/admin/categories', icon: FiGrid, label: 'Danh mục' },
    { path: '/admin/orders', icon: FiShoppingBag, label: 'Đơn hàng' },
    { path: '/admin/users', icon: FiUsers, label: 'Người dùng' },
    { path: '/admin/reviews', icon: FiStar, label: 'Đánh giá' },
    { path: '/admin/chat', icon: FiMessageCircle, label: 'Chat' },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <FiSettings className="header-icon" />
          <h2>Admin</h2>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}

          <Link to="/" className="nav-item">
            <FiHome className="nav-icon" />
            <span className="nav-label">Về trang chủ</span>
          </Link>

          <button onClick={handleLogout} className="nav-item logout-btn">
            <FiLogOut className="nav-icon" />
            <span className="nav-label">Đăng xuất</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              <div className="avatar-circle">
                <img src="/img/img-admin-logo/admin-logo.png" alt="Admin" className="avatar-image" />
              </div>
            </div>
            <div className="admin-details">
              <p className="admin-name">{user?.name}</p>
              <p className="admin-role">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
