import React from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <Link to={`/product/${product._id}`} className="product-card">
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        {product.stock === 0 && <div className="out-of-stock">Hết hàng</div>}
      </div>
      
      <div className="product-info">
        <div className="product-brand">{product.brand}</div>
        <h3 className="product-name">{product.name}</h3>
        
        <div className="product-footer">
          <div className="product-price">{formatPrice(product.price)}</div>
          
          <button
            className="add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={adding || product.stock === 0}
          >
            <FiShoppingCart />
            {adding ? 'Đang thêm...' : 'Thêm'}
          </button>
        </div>

        {product.rating > 0 && (
          <div className="product-rating">
            ⭐ {product.rating.toFixed(1)}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
