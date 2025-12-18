import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiShoppingBag } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [adding, setAdding] = React.useState(false);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    setAdding(true);
    const result = await addToCart(product._id, 1);
    
    if (result.success) {
      alert('✅ Đã thêm vào giỏ hàng!');
    } else {
      alert('❌ ' + result.message);
    }
    setAdding(false);
  };

  const handleBuyNow = async (e) => {
    e.preventDefault();
    if (product.stock === 0) return;
    
    // Chuyển thẳng đến trang thanh toán với thông tin sản phẩm
    navigate('/checkout', {
      state: {
        buyNowItem: {
          productId: product._id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1
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

  const getSpecs = () => {
    if (!product.specifications) return [];
    const specsMap = product.specifications instanceof Map ? product.specifications : new Map(Object.entries(product.specifications));
    return Array.from(specsMap.entries()).slice(0, 4);
  };

  const calculateDiscount = () => {
    if (product.originalPrice && product.originalPrice > product.price) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return 0;
  };

  const discount = calculateDiscount();
  const specs = getSpecs();

  return (
    <Link to={`/product/${product._id}`} className="product-card">
      {discount > 0 && (
        <div className="discount-badge">-{discount}%</div>
      )}
      
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        {product.stock === 0 && <div className="out-of-stock">Hết hàng</div>}
      </div>
      
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        
        {specs.length > 0 && (
          <div className="product-specs">
            {specs.map(([key, value]) => (
              <div key={key} className="spec-item">
                <span className="spec-icon">●</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="product-footer">
          <div className="price-section">
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="original-price">{formatPrice(product.originalPrice)}</div>
            )}
            <div className="product-price">{formatPrice(product.price)}</div>
          </div>
          
          <div className="action-buttons">
            <button
              className="add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={adding || product.stock === 0}
              title="Thêm vào giỏ hàng"
            >
              <FiShoppingCart />
              {adding ? 'Đang thêm...' : 'Thêm'}
            </button>
            
            <button
              className="buy-now-btn"
              onClick={handleBuyNow}
              disabled={adding || product.stock === 0}
              title="Mua ngay"
            >
              <FiShoppingBag />
              Mua
            </button>
          </div>
        </div>

        {product.rating > 0 && (
          <div className="product-rating">
            <span className="stars">{'★'.repeat(Math.floor(product.rating))}{'☆'.repeat(5 - Math.floor(product.rating))}</span>
            <span className="rating-value">{product.rating.toFixed(1)}</span>
            {product.reviews && product.reviews.length > 0 && (
              <span className="review-count">({product.reviews.length} đánh giá)</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
