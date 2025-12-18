import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { productAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import MegaMenu from '../components/MegaMenu';
import './Home.css';

const Home = ({ searchQuery }) => {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    priceRange: '',
    page: 1,
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [dynamicFilters, setDynamicFilters] = useState([]); // Bộ lọc động từ database
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
  });
  const [currentSlide, setCurrentSlide] = useState(0);

  const bannerImages = [
    `${process.env.PUBLIC_URL}/img/img-banner-dai/gearvn-laptop-gaming-t8-header-banner.png`,
    `${process.env.PUBLIC_URL}/img/img-banner-dai/gearvn-pc-gvn-rtx-5060-t9-header-banner.png`,
    `${process.env.PUBLIC_URL}/img/img-banner-dai/thang_04_pc_banner_web_collection_1920x420.jpg`,
  ];

  const totalSlides = bannerImages.length + 1; // +1 cho slide "THÁNG MỚI - DEAL TỐT"

  // Auto slide banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000); // Chuyển slide mỗi 5 giây

    return () => clearInterval(interval);
  }, [totalSlides]);

  // Đọc URL parameters và cập nhật filters
  useEffect(() => {
    console.log('🔄 URL changed, location.search:', location.search);
    const params = new URLSearchParams(location.search);
    const newFilters = {
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      priceRange: params.get('priceRange') || '',
      page: parseInt(params.get('page')) || 1,
    };
    
    // Thêm các bộ lọc động khác từ URL
    params.forEach((value, key) => {
      if (!['category', 'brand', 'page', 'priceRange'].includes(key)) {
        newFilters[key] = value;
      }
    });
    
    console.log('✅ New filters from URL:', newFilters);
    setFilters(newFilters);
  }, [location.search]);

  useEffect(() => {
    fetchCategories();
    fetchDynamicFilters();
  }, []);

  // Fetch dynamic filters khi category thay đổi
  useEffect(() => {
    if (filters.category) {
      fetchDynamicFilters(filters.category);
      fetchBrandsByCategory(filters.category);
    } else {
      fetchDynamicFilters();
      fetchBrands();
    }
  }, [filters.category]);

  useEffect(() => {
    console.log('⚡ useEffect triggered - filters changed:', filters);
    console.log('⚡ searchQuery:', searchQuery);
    if (searchQuery) {
      console.log('🔍 Calling searchProducts');
      searchProducts(searchQuery);
    } else {
      console.log('📦 Calling fetchProducts');
      fetchProducts();
    }
  }, [filters, searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching with filters:', filters);
      console.log('📍 URL search params:', location.search);
      
      // Lọc bỏ các giá trị rỗng
      const cleanFilters = Object.keys(filters).reduce((acc, key) => {
        if (filters[key] && filters[key] !== '') {
          acc[key] = filters[key];
        }
        return acc;
      }, {});
      
      console.log('🧹 Clean filters sent to API:', cleanFilters);
      console.log('🌐 API URL will be:', `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/products?${new URLSearchParams(cleanFilters).toString()}`);
      
      const response = await productAPI.getAll(cleanFilters);
      console.log('📥 Response:', response.data);
      console.log('📊 Total products:', response.data.totalProducts);
      console.log('📦 Products returned:', response.data.products.length);
      console.log('📦 First 3 products:', response.data.products.slice(0, 3).map(p => `${p.name} - ${p.price.toLocaleString()}đ`));
      
      setProducts(response.data.products);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalProducts: response.data.totalProducts,
      });
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (query) => {
    try {
      setLoading(true);
      const response = await productAPI.search(query);
      setProducts(response.data.products);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalProducts: response.data.count,
      });
    } catch (error) {
      console.error('Lỗi khi tìm kiếm:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await productAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await productAPI.getBrands();
      setBrands(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thương hiệu:', error);
    }
  };

  const fetchBrandsByCategory = async (category) => {
    try {
      const response = await productAPI.getAll({ category, limit: 1000 });
      // Lấy danh sách thương hiệu unique từ sản phẩm trong category
      const uniqueBrands = [...new Set(
        response.data.products
          .map(p => p.brand)
          .filter(brand => brand && brand.trim() !== '')
      )].sort();
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Lỗi khi lấy thương hiệu theo danh mục:', error);
      setBrands([]);
    }
  };

  const fetchDynamicFilters = async (category = '') => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const url = category 
        ? `${API_URL}/filters?category=${category}`
        : `${API_URL}/filters`;
      
      const response = await fetch(url);
      const data = await response.json();
      setDynamicFilters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy bộ lọc:', error);
      setDynamicFilters([]);
    }
  };

  const handleFilterChange = (key, value) => {
    if (key === 'category') {
      // Reset brand khi đổi category
      setFilters({ ...filters, category: value, brand: '', page: 1 });
    } else {
      setFilters({ ...filters, [key]: value, page: 1 });
    }
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPriceRangeLabel = (range) => {
    switch(range) {
      case '0-15000000':
        return 'Dưới 15 triệu';
      case '15000000-20000000':
        return 'Từ 15 - 20 triệu';
      case '20000000-999999999':
        return 'Trên 20 triệu';
      default:
        return '';
    }
  };

  return (
    <div className="home">
      {/* Promotional Banner with Full Slider */}
      {!searchQuery && (
        <div className="promo-banner-slider">
          <div className="banner-slides-container">
            {/* Slide "THÁNG MỚI - DEAL TỐT" */}
            <div className={`banner-slide promo-slide ${currentSlide === 0 ? 'active' : ''}`}>
              <div className="promo-content">
                <div className="promo-robot">
                  <div className="robot-body">
                    <div className="robot-antenna"></div>
                    <div className="robot-head">
                      <div className="robot-eye left"></div>
                      <div className="robot-eye right"></div>
                    </div>
                  </div>
                </div>
                <div className="promo-megaphone">📢</div>
                <div className="promo-text">
                  <div className="promo-month">THÁNG MỚI</div>
                  <div className="promo-title">DEAL TỐT</div>
                </div>
                <div className="promo-features">
                  <div className="promo-box">
                    <div className="promo-icon">🎁</div>
                    <div className="promo-label">Giảm<br/>50%</div>
                  </div>
                  <div className="promo-box">
                    <div className="promo-icon">🛍️</div>
                    <div className="promo-label">Mua 2<br/>Tặng 1</div>
                  </div>
                  <div className="promo-box">
                    <div className="promo-icon">🚚</div>
                    <div className="promo-label">FREE<br/>SHIP</div>
                  </div>
                </div>
                <div className="promo-lightning promo-lightning-1">⚡</div>
                <div className="promo-lightning promo-lightning-2">⚡</div>
                <div className="promo-lightning promo-lightning-3">⚡</div>
              </div>
            </div>

            {/* 3 Slides ảnh banner */}
            {bannerImages.map((image, index) => (
              <div
                key={index}
                className={`banner-slide image-slide ${currentSlide === index + 1 ? 'active' : ''}`}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
          </div>

          {/* Slider Controls */}
          <div className="banner-slider-dots">
            {[...Array(totalSlides)].map((_, index) => (
              <button
                key={index}
                className={`banner-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>

          <button
            className="banner-slider-arrow prev"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)}
          >
            ‹
          </button>
          <button
            className="banner-slider-arrow next"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % totalSlides)}
          >
            ›
          </button>
        </div>
      )}

      {/* Promotional Cards Grid */}
      {!searchQuery && (
        <div className="promo-cards-section">
          <div className="promo-cards-grid">
            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-laptop-gaming-slider-bot-t8.png`} alt="Laptop Gaming" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-laptop-van-phong-slider-bot-t8.png`} alt="Laptop Văn Phòng" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-pc-amd-sub-t8.png`} alt="PC AMD" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-gaming-gear-sub-t8.png`} alt="Gaming Gear" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-ban-phim-slider-right-t8.png`} alt="Bàn Phím" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-build-pc-slider-right-t8.png`} alt="Build PC" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-gaming-gear-deal-hoi-sub-banner-t8.png`} alt="Gaming Gear Deal" />
            </div>

            <div className="promo-card banner-image">
              <img src={`${process.env.PUBLIC_URL}/img/gearvn-man-hinh-sub-t8.png`} alt="Màn Hình Gaming" />
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      {!searchQuery && (
        <div className="banner-section">
          <div className="banner-content">
            <div className="banner-left">
              <img 
                src="https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800" 
                alt="PC Gaming Setup" 
                className="banner-image"
              />
            </div>
            <div className="banner-right">
              <div className="banner-badge">Chuyên Mua Bán</div>
              <h1 className="banner-title">LINH KIỆN - MÁY TÍNH</h1>
              <div className="banner-features">
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Uy Tín Chất Lượng</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Cam Kết Giá Rẻ Nhất</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Bảo Hành 1 đổi 1</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✓</span>
                  <span>Tư Vấn Mua Hàng Miễn Phí</span>
                </div>
              </div>
              <div className="banner-products">
                <img 
                  src="https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=150" 
                  alt="SSD" 
                  className="product-thumb"
                />
                <img 
                  src="https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=150" 
                  alt="VR Headset" 
                  className="product-thumb"
                />
                <img 
                  src="https://images.unsplash.com/photo-1625948515291-69613efd103f?w=150" 
                  alt="Gaming Controller" 
                  className="product-thumb"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        <div className="page-header">
          <h2></h2>
          <p className="subtitle">
            {searchQuery 
              ? `Kết quả tìm kiếm: "${searchQuery}"`
              : `${pagination.totalProducts} sản phẩm`
            }
          </p>
        </div>

        <div className={searchQuery ? "content-wrapper-full" : "content-wrapper"}>
          {!searchQuery && (
            <aside className="sidebar">
              <MegaMenu />

              {/* Active Filters Display */}
              {(filters.category || filters.brand || filters.priceRange || Object.keys(filters).some(key => !['category', 'brand', 'page', 'priceRange'].includes(key) && filters[key])) && (
                <div className="active-filters">
                  <h4>Đang lọc:</h4>
                  {filters.category && (
                    <div className="filter-tag">
                      <span>Danh mục: {filters.category}</span>
                      <button onClick={() => setFilters({...filters, category: ''})}>×</button>
                    </div>
                  )}
                  {filters.brand && (
                    <div className="filter-tag">
                      <span>Thương hiệu: {filters.brand}</span>
                      <button onClick={() => setFilters({...filters, brand: ''})}>×</button>
                    </div>
                  )}
                  {filters.priceRange && (
                    <div className="filter-tag">
                      <span>Giá: {getPriceRangeLabel(filters.priceRange)}</span>
                      <button onClick={() => setFilters({...filters, priceRange: ''})}>×</button>
                    </div>
                  )}
                  {Object.keys(filters).map(key => {
                    if (!['category', 'brand', 'page', 'priceRange'].includes(key) && filters[key]) {
                      return (
                        <div key={key} className="filter-tag">
                          <span>{key}: {filters[key]}</span>
                          <button onClick={() => {
                            const newFilters = {...filters};
                            delete newFilters[key];
                            setFilters(newFilters);
                          }}>×</button>
                        </div>
                      );
                    }
                    return null;
                  })}
                  <button
                    className="clear-filters"
                    onClick={() => setFilters({ category: '', brand: '', priceRange: '', page: 1 })}
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </aside>
          )}

          <main className="main-content">
            {loading ? (
              <div className="loading">Đang tải...</div>
            ) : products.length > 0 ? (
              <>
                <div className={searchQuery ? "products-search-grid" : "products-grid"}>
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {!searchQuery && pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={pagination.currentPage === 1}
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      className="pagination-btn"
                    >
                      ← Trước
                    </button>
                    
                    <span className="page-info">
                      Trang {pagination.currentPage} / {pagination.totalPages}
                    </span>
                    
                    <button
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      className="pagination-btn"
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-products">
                <p>Không tìm thấy sản phẩm nào</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Home;
