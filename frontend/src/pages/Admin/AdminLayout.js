import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiPackage, FiShoppingBag, FiUsers, FiBarChart2, FiLogOut, FiGrid, FiMessageCircle, FiStar, FiTag, FiCpu } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isStaff } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAdmin() && !isStaff()) {
      navigate('/');
    }
  }, [user]);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất',
      text: 'Bạn có chắc muốn đăng xuất?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy'
    });
    if (result.isConfirmed) {
      logout();
      navigate('/');
    }
  };

  const menuItems = [
    { id: 'dashboard', path: '/admin', icon: FiBarChart2, label: 'Thống kê và báo cáo', exact: true, roles: ['admin'] },
    { id: 'products', path: '/admin/products', icon: FiPackage, label: 'Sản phẩm', roles: ['admin'] },
    { id: 'categories', path: '/admin/categories', icon: FiGrid, label: 'Danh mục', roles: ['admin'] },
    { id: 'orders', path: '/admin/orders', icon: FiShoppingBag, label: 'Đơn hàng', roles: ['admin', 'staff'] },
    { id: 'users', path: '/admin/users', icon: FiUsers, label: 'Người dùng', roles: ['admin'] },
    { id: 'coupons', path: '/admin/coupons', icon: FiTag, label: 'Mã giảm giá', roles: ['admin', 'staff'] },
    { id: 'reviews', path: '/admin/reviews', icon: FiStar, label: 'Đánh giá', roles: ['admin', 'staff'] },
    { id: 'chat', path: '/admin/chat', icon: FiMessageCircle, label: 'Chat', roles: ['admin', 'staff'] },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (!isAdmin() && !isStaff()) {
    return null;
  }

  // Filter menu items based on user role
  const allowedMenuItems = menuItems.filter(item => {
    if (isAdmin()) return true;
    if (isStaff()) return item.roles.includes('staff');
    return false;
  });

  const renderMenuItem = (item) => {
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
      >
        <item.icon className="nav-icon" />
        <span className="nav-label">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <FiCpu className="brand-icon" />
            <div className="brand-text">
              <h1 className="brand-title">TechStore</h1>
              <span className="brand-subtitle">
                {isAdmin() ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {allowedMenuItems.map((item) => renderMenuItem(item))}

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
                <img
                  src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${user.avatar}`) : '/img/img-admin-logo/ADMIN.png'}
                  alt={user?.name || 'User'}
                  className="avatar-image"
                  onError={(e) => e.target.src = '/img/img-admin-logo/ADMIN.png'}
                />
              </div>
            </div>
            <div className="admin-details">
              <p className="admin-name">{user?.name}</p>
              <p className="admin-role">{isAdmin() ? 'Administrator' : 'Staff'}</p>
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
