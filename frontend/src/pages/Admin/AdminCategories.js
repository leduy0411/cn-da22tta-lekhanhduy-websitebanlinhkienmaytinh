import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import './AdminCategories.css';

function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📦',
    order: 0,
    isActive: true
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/categories/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setError('Không thể tải danh sách danh mục!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '📦',
        order: category.order || 0,
        isActive: category.isActive
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        icon: '📦',
        order: 0,
        isActive: true
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      if (editingCategory) {
        // Cập nhật
        await axios.put(
          `http://localhost:5000/api/categories/${editingCategory._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Cập nhật danh mục thành công!');
      } else {
        // Tạo mới
        await axios.post(
          'http://localhost:5000/api/categories',
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Thêm danh mục thành công!');
      }

      handleCloseModal();
      fetchCategories();
    } catch (error) {
      setError(error.response?.data?.message || 'Có lỗi xảy ra!');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Xóa danh mục thành công!');
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Có lỗi khi xóa danh mục!');
    }
  };

  const handleToggleActive = async (category) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/categories/${category._id}`,
        { isActive: !category.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCategories();
    } catch (error) {
      alert('Có lỗi khi cập nhật trạng thái!');
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="admin-categories">
      <div className="categories-header">
        <h1>
          <FiPackage /> Quản lý Danh mục
        </h1>
        <button className="btn-add" onClick={() => handleOpenModal()}>
          <FiPlus /> Thêm danh mục
        </button>
      </div>

      {error && !showModal && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="categories-table-container">
        <table className="categories-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Số sản phẩm</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  Chưa có danh mục nào
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category._id}>
                  <td className="category-icon">{category.icon}</td>
                  <td className="category-name">{category.name}</td>
                  <td className="category-description">
                    {category.description || '-'}
                  </td>
                  <td className="category-count">
                    <span className="badge badge-info">
                      {category.productCount || 0} sản phẩm
                    </span>
                  </td>
                  <td className="category-order">{category.order}</td>
                  <td>
                    <button
                      className={`btn-toggle ${category.isActive ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(category)}
                      title={category.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    >
                      {category.isActive ? (
                        <>
                          <FiToggleRight /> Hoạt động
                        </>
                      ) : (
                        <>
                          <FiToggleLeft /> Tắt
                        </>
                      )}
                    </button>
                  </td>
                  <td className="category-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleOpenModal(category)}
                      title="Chỉnh sửa"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(category._id, category.name)}
                      title="Xóa"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>×</button>
            </div>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Tên danh mục *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="VD: Điện thoại"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Mô tả</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Mô tả về danh mục..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="icon">Icon (Emoji)</label>
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleChange}
                    placeholder="📦"
                    maxLength="2"
                  />
                  <small>Chọn 1 emoji để đại diện</small>
                </div>

                <div className="form-group">
                  <label htmlFor="order">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    id="order"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                  <span>Hiển thị danh mục</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingCategory ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCategories;
