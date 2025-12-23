const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('../config/passport');
const User = require('../models/User');
const Cart = require('../models/Cart');
const { auth } = require('../middleware/auth');

// POST: Đăng ký user mới
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng!' });
    }

    // Kiểm tra xem đây có phải user đầu tiên không
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    // Tạo user mới - User đầu tiên sẽ là admin
    const user = new User({
      name,
      email,
      password,
      phone,
      address,
      role: isFirstUser ? 'admin' : 'customer'
    });

    await user.save();

    // Tạo token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    // Thông báo đặc biệt nếu là admin đầu tiên
    const message = isFirstUser 
      ? 'Đăng ký thành công! Bạn là admin đầu tiên của hệ thống.' 
      : 'Đăng ký thành công!';

    res.status(201).json({
      message,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đăng ký!', error: error.message });
  }
});

// POST: Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(401).json({ message: 'Tài khoản đã bị khóa!' });
    }

    // Kiểm tra password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Chuyển giỏ hàng từ session sang user (nếu có)
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      try {
        const sessionCart = await Cart.findOne({ sessionId });
        if (sessionCart && sessionCart.items.length > 0) {
          // Tìm hoặc tạo cart của user
          let userCart = await Cart.findOne({ userId: user._id });
          
          if (userCart) {
            // Merge items từ session cart vào user cart
            for (const sessionItem of sessionCart.items) {
              const existingIndex = userCart.items.findIndex(
                item => item.product.toString() === sessionItem.product.toString()
              );
              
              if (existingIndex > -1) {
                userCart.items[existingIndex].quantity += sessionItem.quantity;
              } else {
                userCart.items.push(sessionItem);
              }
            }
          } else {
            // Chuyển session cart thành user cart
            sessionCart.userId = user._id;
            sessionCart.sessionId = null;
            userCart = sessionCart;
          }
          
          // Tính lại tổng tiền
          await userCart.populate('items.product');
          userCart.totalAmount = userCart.items.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
          }, 0);
          
          await userCart.save();
          
          // Xóa session cart nếu đã chuyển thành user cart
          if (sessionCart._id.toString() !== userCart._id.toString()) {
            await Cart.deleteOne({ sessionId });
          }
        }
      } catch (cartError) {
        console.error('Lỗi khi chuyển giỏ hàng:', cartError);
        // Không block login nếu có lỗi cart
      }
    }

    // Tạo token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công!',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đăng nhập!', error: error.message });
  }
});

// GET: Lấy thông tin user hiện tại
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// PUT: Cập nhật thông tin user
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, address, avatar } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Cập nhật thông tin thành công!', user });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// PUT: Đổi mật khẩu
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    
    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng!' });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đổi mật khẩu!', error: error.message });
  }
});

// POST: Đăng xuất (client sẽ xóa token)
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Đăng xuất thành công!' });
});

// GET: Lấy tất cả reviews của user hiện tại
router.get('/reviews', auth, async (req, res) => {
  try {
    const Review = require('../models/Review');
    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name images price')
      .sort({ createdAt: -1 });
    
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá!', error: error.message });
  }
});

// POST: Quên mật khẩu - Gửi email reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống!' });
    }

    // Tạo reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token và lưu vào database
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Token có hiệu lực trong 1 giờ
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    
    await user.save();

    // Tạo reset URL
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    // TODO: Gửi email thực tế (hiện tại chỉ log ra console)
    console.log('\n==============================================');
    console.log('📧 EMAIL RESET PASSWORD');
    console.log('==============================================');
    console.log(`Gửi đến: ${user.email}`);
    console.log(`Tên: ${user.name}`);
    console.log(`\nLink reset mật khẩu:\n${resetUrl}`);
    console.log(`\nToken có hiệu lực trong 1 giờ`);
    console.log('==============================================\n');

    res.json({ 
      message: 'Email reset mật khẩu đã được gửi! Vui lòng kiểm tra console để lấy link.',
      resetUrl // Trả về luôn để test (production nên bỏ)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi email reset!', error: error.message });
  }
});

// POST: Reset mật khẩu với token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    // Hash token từ URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // Tìm user với token hợp lệ và chưa hết hạn
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }

    // Cập nhật mật khẩu mới
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi reset mật khẩu!', error: error.message });
  }
});

// ============= GOOGLE OAUTH =============

// Google login
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google callback
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
  }),
  async (req, res) => {
    try {
      // Tạo JWT token
      const token = jwt.sign(
        { userId: req.user._id, role: req.user.role },
        process.env.JWT_SECRET || 'your_jwt_secret_key_here',
        { expiresIn: '7d' }
      );

      // Chuyển giỏ hàng từ session sang user (nếu có)
      const sessionId = req.query.sessionId;
      if (sessionId) {
        try {
          const sessionCart = await Cart.findOne({ sessionId });
          if (sessionCart && sessionCart.items.length > 0) {
            let userCart = await Cart.findOne({ userId: req.user._id });
            
            if (userCart) {
              for (const sessionItem of sessionCart.items) {
                const existingIndex = userCart.items.findIndex(
                  item => item.product.toString() === sessionItem.product.toString()
                );
                
                if (existingIndex > -1) {
                  userCart.items[existingIndex].quantity += sessionItem.quantity;
                } else {
                  userCart.items.push(sessionItem);
                }
              }
              await userCart.save();
            } else {
              sessionCart.userId = req.user._id;
              sessionCart.sessionId = undefined;
              await sessionCart.save();
            }
            
            await Cart.deleteOne({ sessionId });
          }
        } catch (cartError) {
          console.error('Error merging carts:', cartError);
        }
      }

      // Redirect về frontend với token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
    }
  }
);

// ============= FACEBOOK OAUTH =============

// Facebook login
router.get('/facebook',
  passport.authenticate('facebook', {
    scope: ['email']
  })
);

// Facebook callback
router.get('/facebook/callback',
  passport.authenticate('facebook', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=facebook_auth_failed`
  }),
  async (req, res) => {
    try {
      // Tạo JWT token
      const token = jwt.sign(
        { userId: req.user._id, role: req.user.role },
        process.env.JWT_SECRET || 'your_jwt_secret_key_here',
        { expiresIn: '7d' }
      );

      // Chuyển giỏ hàng từ session sang user (nếu có)
      const sessionId = req.query.sessionId;
      if (sessionId) {
        try {
          const sessionCart = await Cart.findOne({ sessionId });
          if (sessionCart && sessionCart.items.length > 0) {
            let userCart = await Cart.findOne({ userId: req.user._id });
            
            if (userCart) {
              for (const sessionItem of sessionCart.items) {
                const existingIndex = userCart.items.findIndex(
                  item => item.product.toString() === sessionItem.product.toString()
                );
                
                if (existingIndex > -1) {
                  userCart.items[existingIndex].quantity += sessionItem.quantity;
                } else {
                  userCart.items.push(sessionItem);
                }
              }
              await userCart.save();
            } else {
              sessionCart.userId = req.user._id;
              sessionCart.sessionId = undefined;
              await sessionCart.save();
            }
            
            await Cart.deleteOne({ sessionId });
          }
        } catch (cartError) {
          console.error('Error merging carts:', cartError);
        }
      }

      // Redirect về frontend với token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    } catch (error) {
      console.error('Facebook callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
    }
  }
);

module.exports = router;
