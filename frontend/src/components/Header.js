import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiSearch, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header = ({ onSearch }) => {
  const navigate = useNavigate();
  const { getCartItemCount } = useCart();
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>🛒 Cửa Hàng Điện Tử</h1>
          </Link>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button">
              <FiSearch />
            </button>
          </form>

          <nav className="nav">
            <Link to="/" className="nav-link">Trang chủ</Link>
            
            {isAuthenticated ? (
              <div className="user-menu-container">
                <button 
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <FiUser size={20} />
                  <span>{user?.name}</span>
                </button>
                
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <p className="user-name">{user?.name}</p>
                      <p className="user-email">{user?.email}</p>
                      <span className="user-role-badge">
                        {isAdmin() ? 'Admin' : 'Khách hàng'}
                      </span>
                    </div>
                    
                    {isAdmin() && (
                      <Link to="/admin" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                        <FiSettings /> Quản trị
                      </Link>
                    )}
                    
                    <button onClick={handleLogout} className="dropdown-item logout">
                      <FiLogOut /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="nav-link">
                <FiUser size={20} /> Đăng nhập
              </Link>
            )}

            <Link to="/cart" className="cart-link">
              <FiShoppingCart size={24} />
              {getCartItemCount() > 0 && (
                <span className="cart-badge">{getCartItemCount()}</span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
