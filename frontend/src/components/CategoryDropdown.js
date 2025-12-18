import React, { useState, useRef, useEffect } from 'react';
import './CategoryDropdown.css';

const CategoryDropdown = ({ categories, value, onChange, required = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategory = categories.find(cat => cat.name === value);
  const activeCategories = categories.filter(cat => cat.isActive);
  
  // Filter categories based on search
  const filteredCategories = activeCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (category) => {
    onChange(category.name);
    setIsOpen(false);
    setSearchTerm('');
  };

  const renderIcon = (category) => {
    if (!category.icon) return null;
    
    if (category.icon.startsWith('http') || category.icon.startsWith('/')) {
      return (
        <img 
          src={category.icon} 
          alt={category.name}
          className="category-dropdown-icon"
          onError={(e) => e.target.style.display = 'none'}
        />
      );
    }
    
    return <span className="category-dropdown-emoji">{category.icon}</span>;
  };

  return (
    <div className="category-dropdown-wrapper" ref={dropdownRef}>
      <div 
        className={`category-dropdown-header ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCategory ? (
          <div className="category-dropdown-selected">
            {renderIcon(selectedCategory)}
            <span className="category-dropdown-name">{selectedCategory.name}</span>
          </div>
        ) : (
          <span className="category-dropdown-placeholder">-- Chọn danh mục --</span>
        )}
        <svg 
          className={`category-dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 12 12"
        >
          <path fill="currentColor" d="M6 9L1 4h10z"/>
        </svg>
      </div>

      {isOpen && (
        <div className="category-dropdown-menu">
          <div className="category-dropdown-search">
            <input
              type="text"
              placeholder="Tìm kiếm danh mục..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="category-dropdown-list">
            {filteredCategories.length > 0 ? (
              filteredCategories.map(category => (
                <div
                  key={category._id}
                  className={`category-dropdown-item ${value === category.name ? 'selected' : ''}`}
                  onClick={() => handleSelect(category)}
                >
                  {renderIcon(category)}
                  <span className="category-dropdown-name">{category.name}</span>
                  {category.productCount !== undefined && (
                    <span className="category-dropdown-count">
                      {category.productCount}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="category-dropdown-empty">
                Không tìm thấy danh mục
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Hidden input for form validation */}
      <input
        type="hidden"
        value={value || ''}
        required={required}
      />
    </div>
  );
};

export default CategoryDropdown;
