const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Helper function để tạo session ID
const getOrCreateSessionId = (req) => {
  return req.headers['x-session-id'] || `session-${Date.now()}-${Math.random()}`;
};

// GET: Lấy giỏ hàng
router.get('/', async (req, res) => {
  try {
    const sessionId = getOrCreateSessionId(req);
    
    let cart = await Cart.findOne({ sessionId }).populate('items.product');
    
    if (!cart) {
      cart = new Cart({ sessionId, items: [], totalAmount: 0 });
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy giỏ hàng', error: error.message });
  }
});

// POST: Thêm sản phẩm vào giỏ hàng
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const sessionId = getOrCreateSessionId(req);

    // Kiểm tra sản phẩm có tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Kiểm tra tồn kho
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Sản phẩm không đủ hàng trong kho' });
    }

    let cart = await Cart.findOne({ sessionId });

    if (!cart) {
      cart = new Cart({ sessionId, items: [] });
    }

    // Kiểm tra sản phẩm đã có trong giỏ hàng chưa
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Cập nhật số lượng
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Thêm sản phẩm mới
      cart.items.push({ product: productId, quantity });
    }

    // Tính tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã thêm sản phẩm vào giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm vào giỏ hàng', error: error.message });
  }
});

// PUT: Cập nhật số lượng sản phẩm trong giỏ hàng
router.put('/update', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const sessionId = getOrCreateSessionId(req);

    if (quantity < 1) {
      return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
    }

    const cart = await Cart.findOne({ sessionId });
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Sản phẩm không có trong giỏ hàng' });
    }

    cart.items[itemIndex].quantity = quantity;

    // Tính lại tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã cập nhật giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật giỏ hàng', error: error.message });
  }
});

// DELETE: Xóa sản phẩm khỏi giỏ hàng
router.delete('/remove/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const sessionId = getOrCreateSessionId(req);

    const cart = await Cart.findOne({ sessionId });
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    // Tính lại tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: error.message });
  }
});

// DELETE: Xóa toàn bộ giỏ hàng
router.delete('/clear', async (req, res) => {
  try {
    const sessionId = getOrCreateSessionId(req);

    const cart = await Cart.findOne({ sessionId });
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    res.json({ message: 'Đã xóa toàn bộ giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa giỏ hàng', error: error.message });
  }
});

module.exports = router;
