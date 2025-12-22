const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { auth, optionalAuth } = require('../middleware/auth');

// Helper function: Cập nhật rating trung bình cho sản phẩm
const updateProductRating = async (productId) => {
  try {
    const stats = await Review.aggregate([
      { 
        $match: { 
          product: new mongoose.Types.ObjectId(productId),
          status: 'approved'
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const rating = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
    const reviewCount = stats.length > 0 ? stats[0].totalReviews : 0;

    await Product.findByIdAndUpdate(productId, { 
      rating: rating,
      reviewCount: reviewCount
    });

    console.log(`📊 Updated product ${productId} rating: ${rating} (${reviewCount} reviews)`);
    return { rating, reviewCount };
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

// GET: Lấy danh sách reviews của một sản phẩm
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'recent' } = req.query;

    let sortOption = {};
    switch (sort) {
      case 'recent':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'highest':
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1, createdAt: -1 };
        break;
      case 'helpful':
        sortOption = { helpful: -1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const reviews = await Review.find({ 
      product: productId,
      status: 'approved'
    })
      .populate('user', 'name email')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Review.countDocuments({ 
      product: productId,
      status: 'approved'
    });

    // Tính rating trung bình
    const stats = await Review.aggregate([
      { 
        $match: { 
          product: new mongoose.Types.ObjectId(productId),
          status: 'approved'
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratings: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Đếm số lượng mỗi loại rating
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0 && stats[0].ratings) {
      stats[0].ratings.forEach(rating => {
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
      });
    }

    res.json({
      reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalReviews: count,
      averageRating: stats.length > 0 ? stats[0].averageRating : 0,
      ratingCounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá', error: error.message });
  }
});

// POST: Tạo review mới (yêu cầu đăng nhập)
router.post('/', auth, async (req, res) => {
  try {
    const { productId, rating, comment, images, orderId } = req.body;

    // Kiểm tra sản phẩm có tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Kiểm tra user có mua sản phẩm này chưa (optional)
    let verified = false;
    const userOrders = await Order.find({
      user: req.userId,
      status: 'delivered',
      'items.product': productId
    });

    if (userOrders.length > 0) {
      verified = true;
    }

    // Tạo review mới
    const review = new Review({
      product: productId,
      user: req.userId,
      order: orderId || null,
      rating,
      comment,
      images: images || [],
      verified
    });

    await review.save();

    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(productId);

    // Populate user info trước khi trả về
    await review.populate('user', 'name email');

    res.status(201).json({ 
      message: 'Đánh giá thành công', 
      review 
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo đánh giá', error: error.message });
  }
});

// PUT: Cập nhật review (chỉ người tạo)
router.put('/:id', auth, async (req, res) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await Review.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá hoặc bạn không có quyền chỉnh sửa' });
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    review.images = images || review.images;

    await review.save();
    
    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(review.product);
    
    await review.populate('user', 'name email');

    res.json({ message: 'Cập nhật đánh giá thành công', review });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật đánh giá', error: error.message });
  }
});

// DELETE: Xóa review (chỉ người tạo)
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá hoặc bạn không có quyền xóa' });
    }

    const productId = review.product;
    await review.deleteOne();

    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(productId);

    res.json({ message: 'Xóa đánh giá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đánh giá', error: error.message });
  }
});

// POST: Đánh dấu review hữu ích
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
    }

    // Kiểm tra user đã đánh dấu helpful chưa
    const alreadyHelpful = review.helpfulBy.includes(req.userId);

    if (alreadyHelpful) {
      // Bỏ helpful
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== req.userId.toString());
      review.helpful = Math.max(0, review.helpful - 1);
    } else {
      // Thêm helpful
      review.helpfulBy.push(req.userId);
      review.helpful += 1;
    }

    await review.save();

    res.json({ 
      message: alreadyHelpful ? 'Đã bỏ đánh dấu hữu ích' : 'Đã đánh dấu hữu ích',
      helpful: review.helpful
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật', error: error.message });
  }
});

// GET: Kiểm tra user đã review sản phẩm chưa
router.get('/check/:productId', auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      product: req.params.productId,
      user: req.userId
    });

    res.json({ 
      hasReviewed: !!review,
      review: review || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi kiểm tra', error: error.message });
  }
});

module.exports = router;
