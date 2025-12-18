import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProductFilter.css';

const ProductFilter = ({ currentCategory, totalProducts }) => {
  const [filters, setFilters] = useState([]);
  const [brands, setBrands] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newActiveFilters = {};
    
    params.forEach((value, key) => {
      if (!['category', 'page', 'priceRange'].includes(key)) {
        if (key === 'brand') {
          newActiveFilters[key] = value.split(',');
        } else if (value.includes(',')) {
          newActiveFilters[key] = value.split(',');
        } else {
          newActiveFilters[key] = [value];
        }
      }
    });
    
    const priceParam = params.get('priceRange');
    if (priceParam) {
      const [min, max] = priceParam.split('-');
      setPriceRange({ min: min || '', max: max || '' });
    } else {
      setPriceRange({ min: '', max: '' });
    }
    
    setActiveFilters(newActiveFilters);
  }, [location.search]);

  useEffect(() => {
    if (currentCategory) {
      setLoading(true);
      Promise.all([
        fetchCategoryFilters(currentCategory),
        fetchCategoryBrands(currentCategory)
      ]).finally(() => setLoading(false));
    } else {
      setFilters([]);
      setBrands([]);
    }
  }, [currentCategory]);

  const fetchCategoryFilters = async (category) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/filters?category=${encodeURIComponent(category)}`);
      if (response.ok) {
        const data = await response.json();
        setFilters(Array.isArray(data) ? data : []);
      } else {
        setFilters([]);
      }
    } catch (error) {
      setFilters([]);
    }
  };

  const fetchCategoryBrands = async (category) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/products/brands?category=${encodeURIComponent(category)}`);
      if (response.ok) {
        const data = await response.json();
        setBrands(Array.isArray(data) ? data : []);
      } else {
        setBrands([]);
      }
    } catch (error) {
      setBrands([]);
    }
  };

  const updateURL = (newFilters, newPriceRange = priceRange) => {
    const params = new URLSearchParams(location.search);
    const keysToDelete = [];
    params.forEach((value, key) => {
      if (!['category', 'page'].includes(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => params.delete(key));
    
    Object.entries(newFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        params.set(key, values.join(','));
      }
    });
    
    if (newPriceRange.min || newPriceRange.max) {
      const min = newPriceRange.min || '0';
      const max = newPriceRange.max || '999999999';
      params.set('priceRange', `${min}-${max}`);
    }
    
    params.set('page', '1');
    
    // FORCE HOME RE-RENDER bằng cách navigate với replace=false
    const newUrl = `/?${params.toString()}`;
    navigate(newUrl, { replace: false });
  };

  const handleCheckboxChange = (filterName, value) => {
    const newFilters = { ...activeFilters };
    if (!newFilters[filterName]) {
      newFilters[filterName] = [];
    }
    if (newFilters[filterName].includes(value)) {
      newFilters[filterName] = newFilters[filterName].filter(v => v !== value);
      if (newFilters[filterName].length === 0) {
        delete newFilters[filterName];
      }
    } else {
      newFilters[filterName] = [...newFilters[filterName], value];
    }
    setActiveFilters(newFilters);
    updateURL(newFilters);
  };

  const applyPriceFilter = () => {
    updateURL(activeFilters, priceRange);
  };

  const clearPriceFilter = () => {
    const newPriceRange = { min: '', max: '' };
    setPriceRange(newPriceRange);
    updateURL(activeFilters, newPriceRange);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setPriceRange({ min: '', max: '' });
    const params = new URLSearchParams();
    if (currentCategory) {
      params.set('category', currentCategory);
    }
    navigate(`/?${params.toString()}`);
  };

  const removeFilter = (filterName, value) => {
    const newFilters = { ...activeFilters };
    if (Array.isArray(newFilters[filterName])) {
      newFilters[filterName] = newFilters[filterName].filter(v => v !== value);
      if (newFilters[filterName].length === 0) {
        delete newFilters[filterName];
      }
    } else {
      delete newFilters[filterName];
    }
    setActiveFilters(newFilters);
    updateURL(newFilters);
  };

  const getFilterLabel = (filterName, value) => {
    if (filterName === 'brand') return value;
    const filter = filters.find(f => f.name === filterName);
    if (filter) {
      const option = filter.options.find(o => o.value === value);
      return option ? option.label : value;
    }
    return value;
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || priceRange.min || priceRange.max;

  if (!currentCategory) {
    return null;
  }

  return (
    <div className={`product-filter ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="filter-header">
        <div className="filter-header-left">
          <h3>Bộ lọc</h3>
          {totalProducts !== undefined && (
            <span className="product-count">{totalProducts} sản phẩm</span>
          )}
        </div>
        <div className="filter-actions">
          {hasActiveFilters && (
            <button className="clear-all-btn" onClick={clearAllFilters}>
              <span className="clear-icon">✕</span> Xóa tất cả
            </button>
          )}
          <button className="collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && hasActiveFilters && (
        <div className="active-filters">
          <div className="active-filters-title">Đang lọc:</div>
          <div className="filter-tags">
            {activeFilters.brand?.map(brand => (
              <div key={`brand-${brand}`} className="filter-tag">
                <span className="tag-label">Thương hiệu: {brand}</span>
                <button className="tag-remove" onClick={() => removeFilter('brand', brand)}>✕</button>
              </div>
            ))}
            {(priceRange.min || priceRange.max) && (
              <div className="filter-tag">
                <span className="tag-label">
                  Giá: {priceRange.min ? `${parseInt(priceRange.min).toLocaleString()}đ` : '0đ'} - {priceRange.max ? `${parseInt(priceRange.max).toLocaleString()}đ` : '∞'}
                </span>
                <button className="tag-remove" onClick={clearPriceFilter}>✕</button>
              </div>
            )}
            {Object.entries(activeFilters).map(([filterName, values]) => {
              if (filterName === 'brand') return null;
              return (Array.isArray(values) ? values : [values]).map(value => (
                <div key={`${filterName}-${value}`} className="filter-tag">
                  <span className="tag-label">{getFilterLabel(filterName, value)}</span>
                  <button className="tag-remove" onClick={() => removeFilter(filterName, value)}>✕</button>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="filter-content">
          {loading ? (
            <div className="filter-loading">
              <div className="loading-spinner"></div>
              <p>Đang tải...</p>
            </div>
          ) : (
            <>
              {brands.length > 0 && (
                <div className="filter-section">
                  <h4 className="filter-section-title"><span className="title-icon">🏢</span>Thương hiệu</h4>
                  <div className="filter-options">
                    {brands.map(brand => (
                      <label key={brand} className="filter-checkbox">
                        <input type="checkbox" checked={activeFilters.brand?.includes(brand) || false} onChange={() => handleCheckboxChange('brand', brand)} />
                        <span className="checkbox-custom"></span>
                        <span className="checkbox-label">{brand}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="filter-section">
                <h4 className="filter-section-title"><span className="title-icon">💰</span>Khoảng giá</h4>
                <div className="price-filter">
                  <div className="price-inputs">
                    <input type="number" placeholder="Từ (VNĐ)" value={priceRange.min} onChange={(e) => setPriceRange({...priceRange, min: e.target.value})} className="price-input" />
                    <span className="price-separator">-</span>
                    <input type="number" placeholder="Đến (VNĐ)" value={priceRange.max} onChange={(e) => setPriceRange({...priceRange, max: e.target.value})} className="price-input" />
                  </div>
                  <div className="price-buttons">
                    <button onClick={applyPriceFilter} className="apply-price-btn">Áp dụng</button>
                    {(priceRange.min || priceRange.max) && (
                      <button onClick={clearPriceFilter} className="clear-price-btn">Xóa</button>
                    )}
                  </div>
                  <div className="price-presets">
                    <button onClick={() => { setPriceRange({ min: '0', max: '5000000' }); updateURL(activeFilters, { min: '0', max: '5000000' }); }} className="preset-btn">Dưới 5 triệu</button>
                    <button onClick={() => { setPriceRange({ min: '5000000', max: '10000000' }); updateURL(activeFilters, { min: '5000000', max: '10000000' }); }} className="preset-btn">5 - 10 triệu</button>
                    <button onClick={() => { setPriceRange({ min: '10000000', max: '20000000' }); updateURL(activeFilters, { min: '10000000', max: '20000000' }); }} className="preset-btn">10 - 20 triệu</button>
                    <button onClick={() => { setPriceRange({ min: '20000000', max: '' }); updateURL(activeFilters, { min: '20000000', max: '' }); }} className="preset-btn">Trên 20 triệu</button>
                  </div>
                </div>
              </div>

              {filters.map(filter => (
                <div key={filter._id} className="filter-section">
                  <h4 className="filter-section-title"><span className="title-icon">⚙️</span>{filter.displayName}</h4>
                  <div className="filter-options">
                    {filter.options.map(option => (
                      <label key={option.value} className="filter-checkbox">
                        <input type="checkbox" checked={activeFilters[filter.name]?.includes(option.value) || false} onChange={() => handleCheckboxChange(filter.name, option.value)} />
                        <span className="checkbox-custom"></span>
                        <span className="checkbox-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductFilter;
