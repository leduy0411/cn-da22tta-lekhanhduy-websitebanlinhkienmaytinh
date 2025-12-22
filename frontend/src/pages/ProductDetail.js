import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiArrowLeft, FiShoppingBag } from 'react-icons/fi';
import { productAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import ProductReviews from '../components/ProductReviews';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    fetchProduct();
    fetchRelatedProducts();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getById(id);
      setProduct(response.data);
      setSelectedImage(response.data.image);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin sản phẩm:', error);
      alert('Không tìm thấy sản phẩm');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedProducts = async () => {
    try {
      const response = await productAPI.getAll({ limit: 8 });
      // Lọc bỏ sản phẩm hiện tại và lấy ngẫu nhiên 4 sản phẩm
      const filtered = response.data.products.filter(p => p._id !== id);
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      setRelatedProducts(shuffled.slice(0, 4));
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm gợi ý:', error);
    }
  };

  const handleAddToCart = async () => {
    setAdding(true);
    const result = await addToCart(product._id, quantity);
    
    if (result.success) {
      alert('✅ Đã thêm vào giỏ hàng!');
    } else {
      alert('❌ ' + result.message);
    }
    setAdding(false);
  };

  const handleBuyNow = async () => {
    if (product.stock === 0) return;
    
    // Chuyển thẳng đến trang thanh toán với thông tin sản phẩm
    navigate('/checkout', {
      state: {
        buyNowItem: {
          productId: product._id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: quantity
        }
      }
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!product) {
    return <div className="loading">Không tìm thấy sản phẩm</div>;
  }

  return (
    <div className="product-detail">
      <div className="container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Quay lại
        </button>

        <div className="product-detail-grid">
          <div className="product-image-section">
            <div className="main-image">
              <img src={selectedImage} alt={product.name} />
            </div>
            
            {product.images && product.images.length > 0 && (
              <div className="image-thumbnails">
                <div 
                  className={`thumbnail ${selectedImage === product.image ? 'active' : ''}`}
                  onClick={() => setSelectedImage(product.image)}
                >
                  <img src={product.image} alt={`${product.name} - main`} />
                </div>
                {product.images.map((img, index) => (
                  <div 
                    key={index}
                    className={`thumbnail ${selectedImage === img ? 'active' : ''}`}
                    onClick={() => setSelectedImage(img)}
                  >
                    <img src={img} alt={`${product.name} - ${index + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="product-info-section">
            <div className="brand-tag">{product.brand}</div>
            <h1 className="product-title">{product.name}</h1>
            
            {product.rating > 0 && (
              <div className="rating">
                ⭐ {product.rating.toFixed(1)} / 5.0
              </div>
            )}

            <div className="price-section">
              <div className="price">{formatPrice(product.price)}</div>
              <div className="stock-info">
                {product.stock > 0 ? (
                  <span className="in-stock">Còn hàng ({product.stock} sản phẩm)</span>
                ) : (
                  <span className="out-of-stock">Hết hàng</span>
                )}
              </div>
            </div>

            <div className="description">
              <h3>Mô tả sản phẩm</h3>
              <div 
                className="product-description-content"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>

            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div className="specifications">
                <h3>Thông số kỹ thuật</h3>
                <table>
                  <tbody>
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <tr key={key}>
                        <td className="spec-label">{key}</td>
                        <td className="spec-value">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="purchase-section">
              <div className="quantity-selector">
                <label>Số lượng:</label>
                <div className="quantity-controls">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max={product.stock}
                  />
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="action-buttons-large">
                <button
                  className="add-to-cart-btn-large"
                  onClick={handleAddToCart}
                  disabled={adding || product.stock === 0}
                >
                  <FiShoppingCart size={20} />
                  {adding ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
                </button>
                
                <button
                  className="buy-now-btn-large"
                  onClick={handleBuyNow}
                  disabled={adding || product.stock === 0}
                >
                  <FiShoppingBag size={20} />
                  Mua ngay
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sản phẩm gợi ý */}
        {relatedProducts.length > 0 && (
          <div className="related-products-section">
            <h2 className="related-products-title">Sản phẩm gợi ý</h2>
            <div className="related-products-grid">
              {relatedProducts.map(relatedProduct => (
                <ProductCard key={relatedProduct._id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <ProductReviews productId={id} />
      </div>
    </div>
  );
};

export default ProductDetail;
