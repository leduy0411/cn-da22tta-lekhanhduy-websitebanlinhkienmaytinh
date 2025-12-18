const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET: Lấy tất cả sản phẩm với phân trang và lọc
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const brand = req.query.brand;
    
    const stockLte = parseInt(req.query.stock_lte);

    let filter = {};
    
    // Xử lý price filter
    if (req.query.priceRange) {
      const [min, max] = req.query.priceRange.split('-');
      const minPrice = parseFloat(min) || 0;
      const maxPrice = parseFloat(max) || 999999999;
      filter.price = { $gte: minPrice, $lte: maxPrice };
    } else if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    if (category) {
      filter.category = category;
    }
    if (brand) {
      filter.brand = new RegExp(`^${brand}$`, 'i');
    }
    if (stockLte) filter.stock = { $lte: stockLte };

    // Xử lý bộ lọc động từ specifications
    Object.keys(req.query).forEach(key => {
      // Bỏ qua các tham số chuẩn
      if (!['page', 'limit', 'category', 'brand', 'minPrice', 'maxPrice', 'priceRange', 'stock_lte'].includes(key)) {
        // Xử lý range filter (có _min hoặc _max)
        if (key.endsWith('_min')) {
          const fieldName = key.replace('_min', '');
          const minVal = parseFloat(req.query[key]);
          const maxVal = parseFloat(req.query[`${fieldName}_max`]) || Infinity;
          filter[`specifications.${fieldName}`] = { $gte: minVal.toString(), $lte: maxVal === Infinity ? '999999' : maxVal.toString() };
        } else if (key.endsWith('_max')) {
          // Đã xử lý trong _min
        } else {
          // Xử lý select/checkbox filter
          filter[`specifications.${key}`] = req.query[key];
        }
      }
    });

    const products = await Product.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách sản phẩm', error: error.message });
  }
});

// GET: Tìm kiếm sản phẩm
router.get('/search', async (req, res) => {
  try {
    const searchTerm = req.query.q;
    
    if (!searchTerm) {
      return res.status(400).json({ message: 'Vui lòng nhập từ khóa tìm kiếm' });
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { brand: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(20);

    res.json({ products, count: products.length });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm sản phẩm', error: error.message });
  }
});

// GET: Lấy chi tiết sản phẩm theo ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin sản phẩm', error: error.message });
  }
});

// POST: Tạo sản phẩm mới (cho admin)
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: 'Tạo sản phẩm thành công', product });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo sản phẩm', error: error.message });
  }
});

// PUT: Cập nhật sản phẩm
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json({ message: 'Cập nhật sản phẩm thành công', product });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật sản phẩm', error: error.message });
  }
});

// DELETE: Xóa sản phẩm
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: error.message });
  }
});

// GET: Lấy danh sách categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    
    // Đếm số lượng sản phẩm cho mỗi danh mục
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({ category });
        return { name: category, count };
      })
    );
    
    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách danh mục', error: error.message });
  }
});

// GET: Lấy danh sách brands
router.get('/brands/list', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    // Loại bỏ khoảng trắng thừa và lọc các giá trị trùng lặp
    const uniqueBrands = [...new Set(brands.map(b => b.trim()).filter(b => b))];
    res.json(uniqueBrands);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách thương hiệu', error: error.message });
  }
});

module.exports = router;
