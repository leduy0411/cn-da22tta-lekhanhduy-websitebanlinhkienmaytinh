const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// GET: Lấy tất cả sản phẩm với phân trang và lọc
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/products - Query params:', req.query);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    
    // XÂY DỰNG FILTER VỚI LOGIC AND TUYỆT ĐỐI
    const andConditions = [];
    
    // 1. CATEGORY - BẮT BUỘC EXACT MATCH (Ưu tiên cao nhất)
    if (req.query.category) {
      const categoryFilter = {
        category: new RegExp(`^${req.query.category.trim()}$`, 'i')
      };
      andConditions.push(categoryFilter);
      console.log('🏷️  Category filter:', categoryFilter);
    }
    
    // 2. SUBCATEGORY - Có thể nhiều subcategories (product phải có ít nhất 1 trong các subcategories đã chọn)
    if (req.query.subcategory) {
      const subcats = req.query.subcategory.split(',').map(s => s.trim()).filter(s => s);
      if (subcats.length > 0) {
        const subcategoryOrConditions = [];
        const priceRangeConditions = [];
        
        subcats.forEach(subcat => {
          // Kiểm tra xem subcategory có phải là khoảng giá không
          const pricePatterns = [
            { regex: /^Dưới\s+(\d+)\s*triệu$/i, type: 'max' },
            { regex: /^Từ\s+(\d+)-(\d+)\s*triệu$/i, type: 'range' },
            { regex: /^Trên\s+(\d+)\s*triệu$/i, type: 'min' }
          ];
          
          let isPriceFilter = false;
          
          for (const pattern of pricePatterns) {
            const match = subcat.match(pattern.regex);
            if (match) {
              isPriceFilter = true;
              
              if (pattern.type === 'max') {
                const max = parseInt(match[1]) * 1000000;
                priceRangeConditions.push({ price: { $lt: max } });
              } else if (pattern.type === 'range') {
                const min = parseInt(match[1]) * 1000000;
                const max = parseInt(match[2]) * 1000000;
                priceRangeConditions.push({
                  $and: [
                    { price: { $gte: min } },
                    { price: { $lte: max } }
                  ]
                });
              } else if (pattern.type === 'min') {
                const min = parseInt(match[1]) * 1000000;
                priceRangeConditions.push({ price: { $gt: min } });
              }
              
              break;
            }
          }
          
          // Nếu không phải price filter, add như subcategory tag bình thường
          if (!isPriceFilter) {
            subcategoryOrConditions.push({ subcategory: subcat });
          }
        });
        
        // Combine price ranges với OR (nếu chọn nhiều khoảng giá)
        if (priceRangeConditions.length > 0) {
          if (priceRangeConditions.length === 1) {
            andConditions.push(priceRangeConditions[0]);
          } else {
            andConditions.push({ $or: priceRangeConditions });
          }
          console.log('💰 Price range from subcategory:', priceRangeConditions);
        }
        
        // Add subcategory tags với OR
        if (subcategoryOrConditions.length > 0) {
          if (subcategoryOrConditions.length === 1) {
            andConditions.push(subcategoryOrConditions[0]);
          } else {
            andConditions.push({ $or: subcategoryOrConditions });
          }
          console.log('🏷️  Subcategory filter:', subcategoryOrConditions);
        }
      }
    }
    
    // 3. BRAND - Có thể nhiều brands (OR giữa các brands, nhưng vẫn phải AND với category)
    if (req.query.brand) {
      const brands = req.query.brand.split(',').map(b => b.trim()).filter(b => b);
      if (brands.length > 0) {
        if (brands.length === 1) {
          andConditions.push({
            brand: new RegExp(`^${brands[0]}$`, 'i')
          });
        } else {
          // Multiple brands: OR giữa các brands
          andConditions.push({
            $or: brands.map(b => ({ brand: new RegExp(`^${b}$`, 'i') }))
          });
        }
      }
    }
    
    // 4. PRICE RANGE
    if (req.query.priceRange) {
      const [min, max] = req.query.priceRange.split('-').map(v => parseFloat(v) || 0);
      const priceCondition = {};
      if (min > 0) priceCondition.$gte = min;
      if (max > 0 && max < 999999999) priceCondition.$lte = max;
      if (Object.keys(priceCondition).length > 0) {
        andConditions.push({ price: priceCondition });
      }
    }
    
    // 4. DYNAMIC FILTERS (specifications)
    const excludedParams = ['page', 'limit', 'category', 'brand', 'priceRange', 'subcategory'];
    Object.keys(req.query).forEach(key => {
      if (!excludedParams.includes(key)) {
        const values = req.query[key].split(',').map(v => v.trim()).filter(v => v);
        
        if (values.length > 0) {
          if (values.length === 1) {
            // Single value
            andConditions.push({
              [`specifications.${key}`]: new RegExp(values[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
            });
          } else {
            // Multiple values: OR giữa các values của cùng 1 spec
            andConditions.push({
              $or: values.map(v => ({
                [`specifications.${key}`]: new RegExp(v.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
              }))
            });
          }
        }
      }
    });
    
    // XÂY DỰNG FILTER CUỐI CÙNG
    const filter = andConditions.length > 0 ? { $and: andConditions } : {};
    
    console.log('🔍 Final MongoDB filter:', JSON.stringify(filter, null, 2));

    const products = await Product.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(filter);
    
    console.log(`✅ Found ${total} products, returning ${products.length} items`);

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

// GET: Lấy danh sách brands theo category
router.get('/brands', async (req, res) => {
  try {
    const { category } = req.query;
    
    let filter = {};
    if (category) {
      filter.category = new RegExp(`^${category}$`, 'i');
    }
    
    const brands = await Product.distinct('brand', filter);
    const sortedBrands = brands.filter(b => b).sort();
    
    res.json(sortedBrands);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách thương hiệu', error: error.message });
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
    // Lấy categories từ Category collection thay vì Product
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1 })
      .select('name slug description icon order');
    
    // Đếm số lượng sản phẩm cho mỗi danh mục
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({ 
          category: new RegExp(`^${category.name}$`, 'i') 
        });
        return {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          order: category.order,
          isActive: category.isActive !== false,
          count
        };
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
