import React, { useState, useEffect } from 'react';
import { productAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import './Home.css';

const Home = ({ searchQuery }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    page: 1,
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
  });

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      searchProducts(searchQuery);
    } else {
      fetchProducts();
    }
  }, [filters, searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll(filters);
      setProducts(response.data.products);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalProducts: response.data.totalProducts,
      });
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);
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

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="home">
      <div className="container">
        <div className="page-header">
          <h2>Danh Sách Sản Phẩm</h2>
          <p className="subtitle">
            {searchQuery 
              ? `Kết quả tìm kiếm: "${searchQuery}"`
              : `${pagination.totalProducts} sản phẩm`
            }
          </p>
        </div>

        <div className="content-wrapper">
          {!searchQuery && (
            <aside className="sidebar">
              <div className="filter-section">
                <h3>Danh mục</h3>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="filter-select"
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-section">
                <h3>Thương hiệu</h3>
                <select
                  value={filters.brand}
                  onChange={(e) => handleFilterChange('brand', e.target.value)}
                  className="filter-select"
                >
                  <option value="">Tất cả thương hiệu</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              {(filters.category || filters.brand) && (
                <button
                  className="clear-filters"
                  onClick={() => setFilters({ category: '', brand: '', page: 1 })}
                >
                  Xóa bộ lọc
                </button>
              )}
            </aside>
          )}

          <main className="main-content">
            {loading ? (
              <div className="loading">Đang tải...</div>
            ) : products.length > 0 ? (
              <>
                <div className="products-grid">
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
