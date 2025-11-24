const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware xác thực token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Vui lòng đăng nhập!' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Tài khoản không hợp lệ!' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Xác thực thất bại!', error: error.message });
  }
};

// Middleware kiểm tra role admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập!' });
  }
  next();
};

// Middleware kiểm tra role customer hoặc admin
const isCustomerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'customer' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập!' });
  }
  next();
};

module.exports = { auth, isAdmin, isCustomerOrAdmin };
