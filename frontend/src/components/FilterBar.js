import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './FilterBar.css';

const FilterBar = ({ currentCategory }) => {
  const [filters, setFilters] = useState([]);
  const [openFilter, setOpenFilter] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const filterBarRef = useRef(null);

  useEffect(() => {
    if (currentCategory) {
      fetchFilters(currentCategory);
    }
  }, [currentCategory]);

  // Đọc active filters từ URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newActiveFilters = {};
    
    params.forEach((value, key) => {
      if (!['category', 'page'].includes(key)) {
        newActiveFilters[key] = value;
      }
    });
    
    console.log('🔍 FilterBar active filters:', newActiveFilters);
    setActiveFilters(newActiveFilters);
  }, [location.search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target)) {
        setOpenFilter(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFilters = async (categoryName) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const url = `${API_URL}/filters?category=${encodeURIComponent(categoryName)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        setFilters([]);
        return;
      }
      
      const data = await response.json();
      setFilters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy bộ lọc:', error);
      setFilters([]);
    }
  };

  const handleFilterClick = (filterName, value) => {
    const params = new URLSearchParams(location.search);
    
    // Nếu đã chọn filter này rồi thì bỏ chọn (toggle)
    if (activeFilters[filterName] === value) {
      params.delete(filterName);
      setActiveFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters[filterName];
        return newFilters;
      });
    } else {
      params.set(filterName, value);
      setActiveFilters(prev => ({ ...prev, [filterName]: value }));
    }
    
    params.set('page', '1'); // Reset về trang 1
    
    // Cập nhật URL mà không reload trang
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
    
    // Trigger custom event để Home component biết URL đã thay đổi
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    setOpenFilter(null);
  };

  const clearFilter = (filterName) => {
    const params = new URLSearchParams(location.search);
    params.delete(filterName);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterName];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(location.search);
    const category = params.get('category');
    
    const newUrl = category ? `/?category=${category}` : '/';
    window.history.replaceState(null, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    setActiveFilters({});
  };

  const toggleFilter = (filterName) => {
    setOpenFilter(openFilter === filterName ? null : filterName);
  };

  const getDisplayValue = (filterName) => {
    const value = activeFilters[filterName];
    if (!value) return null;
    
    // Tìm filter để lấy label
    const filter = filters.find(f => f.name === filterName);
    if (!filter) return value;
    
    // Tìm option để lấy label
    const option = filter.options.find(opt => {
      if (typeof opt === 'string') return opt === value;
      return opt.value === value;
    });
    
    if (!option) return value;
    
    return typeof option === 'string' ? option : (option.label || option.value);
  };

  if (!currentCategory || filters.length === 0) {
    return null;
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="filter-bar" ref={filterBarRef}>
      {filters.map((filter) => {
        const filterName = filter.name;
        const displayName = filter.displayName || filter.name;

        return (
          <div key={filter._id} className="filter-section">
            <h3 className="filter-section-title">{displayName}</h3>
            <div className="filter-options-horizontal">
              {filter.options.map((option, index) => {
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : (option.label || option.value);
                const isSelected = activeFilters[filterName] === optionValue;

                return (
                  <button
                    key={index}
                    className={`filter-option-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleFilterClick(filterName, optionValue)}
                  >
                    {optionLabel}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {hasActiveFilters && (
        <div className="filter-actions">
          <button className="clear-all-filters-btn" onClick={clearAllFilters}>
            ✕ Xóa tất cả bộ lọc
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
