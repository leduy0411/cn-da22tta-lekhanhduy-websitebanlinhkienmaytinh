import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import MegaMenu from '../components/MegaMenu';
import './Home.css';

const Home = ({ searchQuery }) => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [showAllSubcategories, setShowAllSubcategories] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
  });
  const [currentSlide, setCurrentSlide] = useState(0);
  const [urlKey, setUrlKey] = useState(Date.now());

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

  // Đọc URL parameters và GỌI API NGAY LẬP TỨC
  useEffect(() => {
    const loadProducts = async () => {
      const params = new URLSearchParams(location.search);
      const newFilters = {
        category: params.get('category') || '',
        brand: params.get('brand') || '',
        priceRange: params.get('priceRange') || '',
        page: parseInt(params.get('page')) || 1,
      };
      
      // Load subcategories từ URL
      const subcategoryParam = params.get('subcategory');
      if (subcategoryParam) {
        const subs = subcategoryParam.split(',').filter(s => s.trim());
        setSelectedSubcategories(subs);
        newFilters.subcategory = subcategoryParam;
      } else {
        setSelectedSubcategories([]);
      }
      
      // Fetch subcategories nếu có category
      if (newFilters.category) {
        fetchSubcategories(newFilters.category);
      }
      
      // Thêm các bộ lọc động khác từ URL
      params.forEach((value, key) => {
        if (!['category', 'brand', 'page', 'priceRange', 'subcategory'].includes(key)) {
          newFilters[key] = value;
        }
      });
      
      console.log('🔍 Home.js - URL changed, loading products with filters:', newFilters);
      setFilters(newFilters);
      
      // GỌI API TRỰC TIẾP NGAY TỨC KHẮC
      try {
        setLoading(true);
        
        const cleanFilters = Object.keys(newFilters).reduce((acc, key) => {
          if (newFilters[key] && newFilters[key] !== '') {
            acc[key] = newFilters[key];
          }
          return acc;
        }, {});
        
        console.log('📡 Calling API with cleanFilters:', cleanFilters);
        const response = await productAPI.getAll(cleanFilters);
        
        console.log('✅ API response:', response.data.products.length, 'products found');
        setProducts(response.data.products);
        setPagination({
          currentPage: response.data.currentPage,
          totalPages: response.data.totalPages,
          totalProducts: response.data.totalProducts,
        });
      } catch (error) {
        console.error('❌ Error loading products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadProducts();
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

  // CHỈ xử lý search query, KHÔNG xử lý filters (filters đã được xử lý ở useEffect location.search)
  useEffect(() => {
    if (searchQuery) {
      searchProducts(searchQuery);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchQuery]);

  const fetchProductsWithFilters = async (filtersToUse) => {
    try {
      setLoading(true);
      
      // Lọc bỏ các giá trị rỗng
      const cleanFilters = Object.keys(filtersToUse).reduce((acc, key) => {
        if (filtersToUse[key] && filtersToUse[key] !== '') {
          acc[key] = filtersToUse[key];
        }
        return acc;
      }, {});
      
      const response = await productAPI.getAll(cleanFilters);
      
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

  const fetchProducts = async () => {
    return fetchProductsWithFilters(filters);
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
      setCategories([]);
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

  const fetchSubcategories = async (category) => {
    if (!category) {
      setSubcategories([]);
      setSelectedSubcategories([]);
      return;
    }
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/categories/subcategories/${encodeURIComponent(category)}`);
      const data = await response.json();
      setSubcategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục con:', error);
      setSubcategories([]);
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
    const params = new URLSearchParams(location.search);
    params.set('page', newPage.toString());
    navigate(`/?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (categoryName) => {
    console.log('🖱️ Sidebar - Category clicked:', categoryName);
    
    // Fetch subcategories cho category mới
    fetchSubcategories(categoryName);
    setSelectedSubcategories([]);
    setSubcategorySearch('');
    setShowAllSubcategories(false);
    
    // Tạo URL params mới với category được chọn
    const params = new URLSearchParams(location.search);
    params.set('category', categoryName);
    params.set('page', '1'); // Reset về trang 1
    
    // Xóa các filter khác khi chọn category mới
    const keysToDelete = [];
    params.forEach((value, key) => {
      if (!['category', 'page'].includes(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => params.delete(key));
    
    const newUrl = `/?${params.toString()}`;
    console.log('🔗 Navigating to:', newUrl);
    navigate(newUrl);
    
    // Scroll đến phần sản phẩm
    setTimeout(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const offsetTop = mainContent.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSubcategoryToggle = (subcategory) => {
    const newSelected = selectedSubcategories.includes(subcategory)
      ? selectedSubcategories.filter(s => s !== subcategory)
      : [...selectedSubcategories, subcategory];
    
    setSelectedSubcategories(newSelected);
    
    // Cập nhật URL
    const params = new URLSearchParams(location.search);
    if (newSelected.length > 0) {
      params.set('subcategory', newSelected.join(','));
    } else {
      params.delete('subcategory');
    }
    params.set('page', '1');
    navigate(`/?${params.toString()}`);
  };

  const getCategoryImage = (categoryName) => {
    const name = categoryName.toLowerCase();
    
    // Map category names to local images - tên file không dấu
    const imageMap = {
      'laptop': '/img/img-danhmucsanpham/Laptop.png',
      'pc': '/img/img-danhmucsanpham/PC.png',
      'pc build sẵn': '/img/img-danhmucsanpham/PC.png',
      'màn hình': '/img/img-danhmucsanpham/Manhinh.jpg',
      'monitor': '/img/img-danhmucsanpham/Manhinh.jpg',
      'mainboard': '/img/img-danhmucsanpham/Mainboard.png',
      'main': '/img/img-danhmucsanpham/Mainboard.png',
      'cpu': '/img/img-danhmucsanpham/CPU.png',
      'bộ xử lý': '/img/img-danhmucsanpham/CPU.png',
      'vga': '/img/img-danhmucsanpham/VGA.jpg',
      'card': '/img/img-danhmucsanpham/VGA.jpg',
      'card màn hình': '/img/img-danhmucsanpham/VGA.jpg',
      'ram': '/img/img-danhmucsanpham/RAM.png',
      'bộ nhớ': '/img/img-danhmucsanpham/RAM.png',
      'ổ cứng': '/img/img-danhmucsanpham/Ocung.png',
      'ssd': '/img/img-danhmucsanpham/Ocung.png',
      'hdd': '/img/img-danhmucsanpham/Ocung.png',
      'case': '/img/img-danhmucsanpham/Case.png',
      'vỏ case': '/img/img-danhmucsanpham/Case.png',
      'tản nhiệt': '/img/img-danhmucsanpham/Tannhiet.png',
      'cooling': '/img/img-danhmucsanpham/Tannhiet.png',
      'nguồn': '/img/img-danhmucsanpham/Nguon.png',
      'psu': '/img/img-danhmucsanpham/Nguon.png',
      'bàn phím': '/img/img-danhmucsanpham/Banphim.jpg',
      'keyboard': '/img/img-danhmucsanpham/Banphim.jpg',
      'chuột': '/img/img-danhmucsanpham/Chuot.jpg',
      'mouse': '/img/img-danhmucsanpham/Chuot.jpg',
      'ghế': '/img/img-danhmucsanpham/Ghe.jpg',
      'chair': '/img/img-danhmucsanpham/Ghe.jpg',
      'tai nghe': '/img/img-danhmucsanpham/Tainghe.jpg',
      'headphone': '/img/img-danhmucsanpham/Tainghe.jpg',
      'headset': '/img/img-danhmucsanpham/Tainghe.jpg',
      'loa': '/img/img-danhmucsanpham/Loa.png',
      'speaker': '/img/img-danhmucsanpham/Loa.png',
      'console': '/img/img-danhmucsanpham/Console.png',
      'ps5': '/img/img-danhmucsanpham/Console.png',
      'playstation': '/img/img-danhmucsanpham/Console.png',
      'phụ kiện': '/img/img-danhmucsanpham/Phukien.png',
      'accessory': '/img/img-danhmucsanpham/Phukien.png',
      'thiết bị vp': '/img/img-danhmucsanpham/Thietbivp.png',
      'văn phòng': '/img/img-danhmucsanpham/Thietbivp.png',
      'printer': '/img/img-danhmucsanpham/Thietbivp.png',
      'sạc dp': '/img/img-danhmucsanpham/Sacdp.png',
      'sạc dự phòng': '/img/img-danhmucsanpham/Sacdp.png',
      'powerbank': '/img/img-danhmucsanpham/Sacdp.png',
    };
    
    // Tìm key phù hợp
    for (const [key, image] of Object.entries(imageMap)) {
      if (name.includes(key) || key.includes(name)) {
        return process.env.PUBLIC_URL + image;
      }
    }
    
    // Default image
    return 'https://via.placeholder.com/150?text=' + encodeURIComponent(categoryName);
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
        {searchQuery && (
          <>
            <div className="search-results-header">
              <h2>Kết quả tìm kiếm</h2>
              <p className="search-query">"{searchQuery}"</p>
              <p className="search-count">{pagination.totalProducts} sản phẩm</p>
            </div>
          </>
        )}

        {!searchQuery && (
          <>
            {filters.category && (
              <div className="category-header-section">
                <div>
                  <h2 className="category-title">{filters.category}</h2>
                  <p className="category-product-count">{pagination.totalProducts} sản phẩm</p>
                </div>
              </div>
            )}
            
            {!filters.category && (
              <div className="page-header">
                <h2></h2>
                <p className="subtitle">
                  {pagination.totalProducts} sản phẩm
                </p>
              </div>
            )}
          </>
        )}

        <div className={searchQuery ? "content-wrapper-full" : "content-wrapper"}>
          {!searchQuery && (
            <aside className="sidebar">
              {/* Danh mục sản phẩm - Luôn hiển thị */}
              <div className="sidebar-categories-section">
                <h3 className="sidebar-categories-title">Danh mục sản phẩm</h3>
                <div className="sidebar-categories-grid">
                  {categories.length > 0 ? (
                    categories
                      .filter(cat => cat.isActive !== false)
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((category) => (
                        <div 
                          key={category._id || category.name} 
                          className={`sidebar-category-item ${filters.category === category.name ? 'active' : ''}`}
                          onClick={() => handleCategoryClick(category.name)}
                        >
                            <div className="sidebar-category-icon">
                              {category.icon ? (
                                category.icon.startsWith('http') || category.icon.startsWith('/') ? (
                                  <img 
                                    src={category.icon} 
                                    alt={category.name}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = getCategoryImage(category.name);
                                    }}
                                  />
                                ) : /^[\p{Emoji}]$/u.test(category.icon) ? (
                                  <span style={{ fontSize: '48px' }}>{category.icon}</span>
                                ) : (
                                  <img 
                                    src={getCategoryImage(category.name)} 
                                    alt={category.name}
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(category.name);
                                    }}
                                  />
                                )
                              ) : (
                                <img 
                                  src={getCategoryImage(category.name)} 
                                  alt={category.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(category.name);
                                  }}
                                />
                              )}
                            </div>
                            <p className="sidebar-category-name">{category.name}</p>
                          </div>
                        ))
                    ) : (
                      // Fallback: Hiển thị danh mục hardcode nếu chưa load được từ API
                      [
                        'Laptop',
                        'PC',
                        'Màn hình',
                        'Mainboard',
                        'CPU',
                        'VGA',
                        'RAM',
                        'Ổ cứng',
                        'Case',
                        'Tản nhiệt',
                        'Nguồn',
                        'Bàn phím',
                        'Chuột',
                        'Ghế',
                        'Tai nghe',
                        'Loa',
                        'Console',
                        'Phụ kiện',
                        'Thiết bị VP',
                        'Sạc DP'
                      ].map((categoryName, index) => (
                        <div 
                          key={index} 
                          className={`sidebar-category-item ${filters.category === categoryName ? 'active' : ''}`}
                          onClick={() => handleCategoryClick(categoryName)}
                        >
                          <div className="sidebar-category-icon">
                            <img 
                              src={getCategoryImage(categoryName)} 
                              alt={categoryName}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/150?text=' + encodeURIComponent(categoryName);
                              }}
                            />
                          </div>
                          <p className="sidebar-category-name">{categoryName}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

            </aside>
          )}

          <main className="main-content" id="products-section">
            {/* Danh mục con filter - Hiển thị ở trên main content */}
            {filters.category && subcategories.length > 0 && (
              <div className="subcategories-filter-panel">
                <div className="subcategories-header">
                  <h3 className="subcategories-title">
                    <span className="category-badge">{filters.category}</span>
                    Lọc theo danh mục con
                  </h3>
                  
                  <div className="subcategories-actions">
                    <input
                      type="text"
                      placeholder="🔍 Tìm kiếm..."
                      value={subcategorySearch}
                      onChange={(e) => setSubcategorySearch(e.target.value)}
                      className="subcategory-search-input-horizontal"
                    />
                    
                    {selectedSubcategories.length > 0 && (
                      <button 
                        className="clear-all-btn"
                        onClick={() => {
                          setSelectedSubcategories([]);
                          const params = new URLSearchParams(location.search);
                          params.delete('subcategory');
                          params.set('page', '1');
                          navigate(`/?${params.toString()}`);
                        }}
                      >
                        ✕ Xóa tất cả ({selectedSubcategories.length})
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="subcategories-chips-container">
                  {(() => {
                    const filteredSubs = subcategories.filter(sub => 
                      sub.toLowerCase().includes(subcategorySearch.toLowerCase())
                    );
                    const INITIAL_DISPLAY = 12;
                    const displayedSubs = showAllSubcategories || subcategorySearch 
                      ? filteredSubs 
                      : filteredSubs.slice(0, INITIAL_DISPLAY);
                    const hasMore = filteredSubs.length > INITIAL_DISPLAY;
                    
                    return (
                      <>
                        {displayedSubs.map((sub, index) => (
                          <button
                            key={index}
                            className={`subcategory-chip ${selectedSubcategories.includes(sub) ? 'active' : ''}`}
                            onClick={() => handleSubcategoryToggle(sub)}
                          >
                            {selectedSubcategories.includes(sub) && <span className="check-icon">✓</span>}
                            {sub}
                          </button>
                        ))}
                        
                        {!subcategorySearch && hasMore && (
                          <button
                            className="show-more-btn"
                            onClick={() => setShowAllSubcategories(!showAllSubcategories)}
                          >
                            {showAllSubcategories ? (
                              <>
                                <span className="icon">▲</span>
                                Thu gọn
                              </>
                            ) : (
                              <>
                                <span className="icon">▼</span>
                                Xem thêm ({filteredSubs.length - INITIAL_DISPLAY})
                              </>
                            )}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

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
                <div className="no-products-icon">📦</div>
                <h3>Không tìm thấy sản phẩm nào</h3>
                {filters.category && (
                  <p>Không có sản phẩm nào trong danh mục "{filters.category}"</p>
                )}
                {(filters.brand || filters.priceRange) && (
                  <p>Thử xóa một số bộ lọc để xem thêm sản phẩm</p>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Categories Grid Section - Chỉ hiển thị ở trang chủ khi chưa lọc */}
        {!searchQuery && !filters.category && (
          <div className="categories-grid-section">
            <h2 className="categories-grid-title">Danh mục sản phẩm</h2>
            <div className="categories-grid">
              {categories.length > 0 ? (
                categories
                  .filter(cat => cat.isActive !== false)
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((category) => (
                    <div 
                      key={category._id || category.name}
                      className="category-card" 
                      onClick={() => handleCategoryClick(category.name)}
                    >
                      <div className="category-image">
                        {category.icon ? (
                          category.icon.startsWith('http') || category.icon.startsWith('/') ? (
                            <img 
                              src={category.icon} 
                              alt={category.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = getCategoryImage(category.name);
                              }}
                            />
                          ) : /^[\p{Emoji}]$/u.test(category.icon) ? (
                            <span style={{ fontSize: '64px' }}>{category.icon}</span>
                          ) : (
                            <img 
                              src={getCategoryImage(category.name)} 
                              alt={category.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(category.name);
                              }}
                            />
                          )
                        ) : (
                          <img 
                            src={getCategoryImage(category.name)} 
                            alt={category.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(category.name);
                            }}
                          />
                        )}
                      </div>
                      <h3>{category.name}</h3>
                      {category.description && (
                        <p className="category-description">{category.description}</p>
                      )}
                    </div>
                  ))
              ) : (
                // Fallback categories
                [
                  'Laptop',
                  'PC',
                  'Màn hình',
                  'Mainboard',
                  'CPU',
                  'VGA',
                  'RAM',
                  'Ổ cứng',
                  'Case',
                  'Tản nhiệt',
                  'Nguồn',
                  'Bàn phím',
                  'Chuột',
                  'Ghế',
                  'Tai nghe',
                  'Loa',
                  'Console',
                  'Phụ kiện',
                  'Thiết bị VP',
                  'Sạc DP'
                ].map((categoryName, index) => (
                  <div 
                    key={index} 
                    className="category-card" 
                    onClick={() => handleCategoryClick(categoryName)}
                  >
                    <div className="category-image">
                      <img 
                        src={getCategoryImage(categoryName)} 
                        alt={categoryName}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/200?text=' + encodeURIComponent(categoryName);
                        }}
                      />
                    </div>
                    <h3>{categoryName}</h3>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
