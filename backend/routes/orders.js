const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// POST: Tạo đơn hàng mới
router.post('/', async (req, res) => {
  try {
    const { customerInfo, paymentMethod, note } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(400).json({ message: 'Không tìm thấy session ID' });
    }

    // Lấy giỏ hàng
    const cart = await Cart.findOne({ sessionId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Kiểm tra tồn kho và tạo items cho đơn hàng
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      
      if (!product) {
        return res.status(404).json({ message: `Sản phẩm ${item.product.name} không tồn tại` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Sản phẩm ${product.name} không đủ hàng. Còn ${product.stock} sản phẩm` 
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });

      // Giảm số lượng tồn kho
      product.stock -= item.quantity;
      await product.save();
    }

    // Tạo mã đơn hàng
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Tạo đơn hàng
    const order = new Order({
      orderNumber,
      items: orderItems,
      customerInfo,
      totalAmount: cart.totalAmount,
      paymentMethod,
      note,
      status: 'Pending'
    });

    await order.save();

    // Xóa giỏ hàng sau khi đặt hàng thành công
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    res.status(201).json({ 
      message: 'Đặt hàng thành công!', 
      order 
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo đơn hàng', error: error.message });
  }
});

// GET: Lấy danh sách đơn hàng
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product');

    const total = await Order.countDocuments();

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng', error: error.message });
  }
});

// GET: Lấy chi tiết đơn hàng theo ID
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin đơn hàng', error: error.message });
  }
});

// GET: Tìm đơn hàng theo mã đơn hàng
router.get('/tracking/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tra cứu đơn hàng', error: error.message });
  }
});

// PUT: Cập nhật trạng thái đơn hàng
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json({ message: 'Cập nhật trạng thái thành công', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
});

module.exports = router;
