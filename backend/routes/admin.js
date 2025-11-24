const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { auth, isAdmin } = require('../middleware/auth');

// Tất cả routes đều yêu cầu auth và isAdmin
router.use(auth, isAdmin);

// GET: Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10 } });

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thống kê!', error: error.message });
  }
});

// USER MANAGEMENT
// GET: Lấy danh sách users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách users!', error: error.message });
  }
});

// PUT: Cập nhật role user
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role không hợp lệ!' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    res.json({ message: 'Cập nhật role thành công!', user });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// PUT: Khóa/Mở khóa user
router.put('/users/:id/toggle-status', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      message: user.isActive ? 'Đã mở khóa user!' : 'Đã khóa user!', 
      user 
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// DELETE: Xóa user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    res.json({ message: 'Đã xóa user!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa user!', error: error.message });
  }
});

// ORDER MANAGEMENT - Enhanced
// GET: Lấy tất cả đơn hàng với filter
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    let filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.product')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng!', error: error.message });
  }
});

module.exports = router;
