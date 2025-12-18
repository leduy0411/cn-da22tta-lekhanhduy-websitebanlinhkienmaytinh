const mongoose = require('mongoose');
const Filter = require('./models/Filter');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/laptop-shop', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Đã kết nối MongoDB'))
.catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

async function addPriceFilter() {
  try {
    // Xóa bộ lọc giá cũ nếu có
    await Filter.deleteMany({ name: 'priceRange' });
    console.log('Đã xóa bộ lọc giá cũ (nếu có)');

    // Tạo bộ lọc giá mới cho danh mục Laptop
    const priceFilter = new Filter({
      name: 'priceRange',
      displayName: 'GIÁ BÁN',
      type: 'select',
      category: 'Laptop',
      options: [
        {
          value: '0-15000000',
          label: 'Dưới 15 triệu'
        },
        {
          value: '15000000-20000000',
          label: 'Từ 15 - 20 triệu'
        },
        {
          value: '20000000-999999999',
          label: 'Trên 20 triệu'
        }
      ],
      order: 1, // Hiển thị đầu tiên
      isActive: true
    });

    await priceFilter.save();
    console.log('✅ Đã thêm bộ lọc GIÁ BÁN cho Laptop');

    // Hiển thị kết quả
    const allFilters = await Filter.find({ category: 'Laptop' }).sort({ order: 1 });
    console.log('\n📋 Danh sách bộ lọc cho Laptop:');
    allFilters.forEach(f => {
      console.log(`  - ${f.displayName} (${f.name}): ${f.options.length} options`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

addPriceFilter();
