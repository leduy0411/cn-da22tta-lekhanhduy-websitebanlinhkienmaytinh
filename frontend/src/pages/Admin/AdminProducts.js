import React, { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiSearch } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { productAPI, adminAPI } from '../../services/api';
import ImageUpload from '../../components/ImageUpload';
import CategoryDropdown from '../../components/CategoryDropdown';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Swal from 'sweetalert2';
import './AdminProducts.css';

const AdminProducts = ({ openAddModal }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    subcategory: [],
    brand: '',
    image: '',
    images: [],
    stock: '',
  });

  // Cấu hình cho React Quill
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['code-block']
    ],
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'link', 'image',
    'color', 'background',
    'align',
    'code-block'
  ];

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Debug: Log khi filter thay đổi
  useEffect(() => {
    console.log('🔍 Filters:', { categoryFilter, searchTerm, stockFilter, totalProducts: products.length });
  }, [categoryFilter, searchTerm, stockFilter, products]);

  // Mở modal thêm sản phẩm nếu route là /admin/products/add
  useEffect(() => {
    if (openAddModal || location.pathname === '/admin/products/add') {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        subcategory: [],
        brand: '',
        image: '',
        images: [],
        stock: '',
      });
      setShowModal(true);
    }
  }, [openAddModal, location.pathname]);

  // Đóng modal và chuyển về trang danh sách sản phẩm
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    if (location.pathname === '/admin/products/add') {
      navigate('/admin/products');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll({ limit: 1000 }); // Tăng limit để lấy tất cả sản phẩm
      console.log('✅ Loaded products:', response.data.products.length);
      setProducts(response.data.products);
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/categories/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setCategories(data);

      // Đặt category mặc định nếu có danh mục
      if (data.length > 0 && !formData.category) {
        const firstCategory = data[0].name;
        setFormData(prev => ({ ...prev, category: firstCategory }));
        fetchSubcategories(firstCategory);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setCategories([]);
    }
  };

  const fetchSubcategories = async (category) => {
    if (!category) {
      setSubcategories([]);
      setSubcategorySearch('');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/categories/subcategories/${encodeURIComponent(category)}`);
      const data = await response.json();
      setSubcategories(Array.isArray(data) ? data : []);
      setSubcategorySearch('');
    } catch (error) {
      console.error('Lỗi khi lấy danh mục con:', error);
      setSubcategories([]);
      setSubcategorySearch('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Xử lý description từ Quill - loại bỏ HTML rỗng
      const cleanedDescription = formData.description.replace(/<p><br><\/p>/g, '').trim();

      // Kiểm tra description không được rỗng
      if (!cleanedDescription || cleanedDescription === '<p></p>' || cleanedDescription === '') {
        Swal.fire('Lỗi', 'Vui lòng nhập mô tả sản phẩm!', 'error');
        return;
      }

      const productData = {
        ...formData,
        description: cleanedDescription || formData.description
      };

      if (editingProduct) {
        await adminAPI.updateProduct(editingProduct._id, productData);
        Swal.fire('Thành công', 'Cập nhật sản phẩm thành công!', 'success');
      } else {
        await adminAPI.createProduct(productData);
        Swal.fire('Thành công', 'Thêm sản phẩm thành công!', 'success');
      }
      handleCloseModal();
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Chi tiết lỗi:', error);
      Swal.fire('Lỗi', error.response?.data?.message || error.message || 'Có lỗi xảy ra!', 'error');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      subcategory: Array.isArray(product.subcategory) ? product.subcategory : (product.subcategory ? [product.subcategory] : []),
      brand: product.brand || '',
      image: product.image,
      images: product.images || [],
      stock: product.stock,
    });
    fetchSubcategories(product.category);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc muốn xóa sản phẩm này?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      await adminAPI.deleteProduct(id);
      Swal.fire('Thành công', 'Xóa sản phẩm thành công!', 'success');
      fetchProducts();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra!', 'error');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    const firstCategory = categories.length > 0 ? categories[0].name : '';
    setFormData({
      name: '',
      description: '',
      price: '',
      category: firstCategory,
      subcategory: [],
      brand: '',
      image: '',
      images: [],
      stock: '',
    });
    if (firstCategory) {
      fetchSubcategories(firstCategory);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStock = 
      stockFilter === 'all' ? true :
      stockFilter === 'low' ? product.stock <= 1 :
      stockFilter === 'out' ? product.stock === 0 : true;
    
    const matchesCategory = 
      categoryFilter === 'all' ? true :
      (product.category || '') === categoryFilter;
    
    return matchesSearch && matchesStock && matchesCategory;
  });

  console.log('📊 Filtered Results:', {
    total: products.length,
    filtered: filteredProducts.length,
    categoryFilter,
    sampleCategories: products.slice(0, 5).map(p => p.category)
  });

  return (
    <div className="admin-products">
      <div className="page-header">
        <h1>Quản lý sản phẩm</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Thêm sản phẩm
        </button>
      </div>

      <div className="search-bar">
        <FiSearch />
        <input
          type="text"
          placeholder="Tìm kiếm sản phẩm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select 
          className="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
        <select 
          className="stock-filter"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
        >
          <option value="all">Tất cả sản phẩm</option>
          <option value="low">Sắp hết hàng (≤ 1)</option>
          <option value="out">Hết hàng</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="products-table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Hình ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th>Thương hiệu</th>
                <th>Giá</th>
                <th>Tồn kho</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product._id}>
                  <td>
                    <img src={product.images?.[0] || product.image} alt={product.name} className="product-thumb" />
                  </td>
                  <td className="product-name">{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.brand}</td>
                  <td className="price">{formatPrice(product.price)}</td>
                  <td>
                    <span className={`stock ${product.stock <= 1 ? 'low' : ''}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="btn-edit" onClick={() => handleEdit(product)}>
                      <FiEdit />
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(product._id)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { handleCloseModal(); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProduct ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên sản phẩm *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Danh mục *</label>
                  <CategoryDropdown
                    categories={categories}
                    value={formData.category}
                    onChange={(categoryName) => {
                      setFormData({ ...formData, category: categoryName, subcategory: [] });
                      fetchSubcategories(categoryName);
                    }}
                    required={true}
                  />
                  {categories.filter(cat => cat.isActive).length === 0 && (
                    <small style={{ color: '#dc3545', display: 'block', marginTop: '0.25rem' }}>
                      Chưa có danh mục nào. Vui lòng thêm danh mục trước!
                    </small>
                  )}
                </div>

                <div className="form-group">


                  {subcategories.length > 0 && (
                    <>
                      <div className="subcategory-controls">
                        <div className="subcategory-buttons">
                          <button
                            type="button"
                            className="btn-select-all"
                            onClick={() => setFormData({ ...formData, subcategory: subcategories })}
                          >
                            Chọn tất cả
                          </button>
                          <button
                            type="button"
                            className="btn-clear-all"
                            onClick={() => setFormData({ ...formData, subcategory: [] })}
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      <div className="subcategory-list">
                        {subcategories
                          .filter(sub => sub.toLowerCase().includes(subcategorySearch.toLowerCase()))
                          .map((sub, index) => (
                            <div key={index} className="subcategory-item">
                              <label className="subcategory-checkbox">
                                <input
                                  type="checkbox"
                                  checked={formData.subcategory.includes(sub)}
                                  onChange={(e) => {
                                    const newSubcategories = e.target.checked
                                      ? [...formData.subcategory, sub]
                                      : formData.subcategory.filter(s => s !== sub);
                                    setFormData({ ...formData, subcategory: newSubcategories });
                                  }}
                                />
                                <span className="checkmark"></span>
                                <span className="subcategory-text">{sub}</span>
                              </label>
                            </div>
                          ))}
                      </div>
                    </>
                  )}

                  {formData.subcategory.length > 0 && (
                    <div className="selected-count">
                      Đã chọn: <strong>{formData.subcategory.length}</strong> danh mục
                    </div>
                  )}

                  {subcategories.length === 0 && formData.category && (
                    <small style={{ color: '#999', display: 'block', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                      Danh mục này chưa có danh mục con
                    </small>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả *</label>
                <div className="quill-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={formData.description}
                    onChange={(value) => setFormData({ ...formData, description: value })}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Nhập mô tả sản phẩm... Bạn có thể dán bảng từ Excel/Word hoặc tạo bảng HTML"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Giá (VNĐ) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Tồn kho *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hình ảnh chính *</label>
                <ImageUpload
                  value={formData.image}
                  onChange={(url) => setFormData({ ...formData, image: url })}
                  multiple={false}
                />
                <small style={{ color: '#666', fontSize: '0.85rem', display: 'block', marginTop: '0.5rem' }}>
                  Hoặc nhập URL trực tiếp:
                </small>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                  style={{ marginTop: '0.5rem' }}
                />
              </div>

              <div className="form-group">
                <label>Hình ảnh phụ (tối đa 5 ảnh)</label>
                <ImageUpload
                  value={formData.images}
                  onChange={(urls) => setFormData({ ...formData, images: Array.isArray(urls) ? urls : [urls] })}
                  multiple={true}
                  maxFiles={5}
                />
                {formData.images && formData.images.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {formData.images.map((img, index) => (
                      <div key={index} style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <img
                          src={img}
                          alt={`Preview ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e0e0e0' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = formData.images.filter((_, i) => i !== index);
                            setFormData({ ...formData, images: newImages });
                          }}
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => { handleCloseModal(); resetForm(); }}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingProduct ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
