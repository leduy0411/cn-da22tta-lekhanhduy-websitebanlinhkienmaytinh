const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/thietbidientu')
.then(async () => {
  console.log('✅ Đã kết nối MongoDB');
  
  // Xóa tất cả filters cũ của Laptop
  await Filter.deleteMany({ category: 'Laptop' });
  console.log('Đã xóa các filter cũ của Laptop');

  // 1. Tạo filter THƯƠNG HIỆU
  const brandFilter = new Filter({
    name: 'brand',
    displayName: 'THƯƠNG HIỆU',
    type: 'select',
    category: 'Laptop',
    options: [
      { value: 'ASUS', label: 'ASUS' },
      { value: 'MSI', label: 'MSI' },
      { value: 'ACER', label: 'ACER' },
      { value: 'DELL', label: 'DELL' },
      { value: 'HP', label: 'HP' },
      { value: 'LENOVO', label: 'LENOVO' }
    ],
    order: 1,
    isActive: true
  });

  await brandFilter.save();
  console.log('✅ Đã tạo bộ lọc THƯƠNG HIỆU');

  // 2. Tạo filter GIÁ BÁN
  const priceFilter = new Filter({
    name: 'priceRange',
    displayName: 'GIÁ BÁN',
    type: 'select',
    category: 'Laptop',
    options: [
      { value: '0-15000000', label: 'Dưới 15 triệu' },
      { value: '15000000-20000000', label: 'Từ 15 - 20 triệu' },
      { value: '20000000-999999999', label: 'Trên 20 triệu' }
    ],
    order: 2,
    isActive: true
  });

  await priceFilter.save();
  console.log('✅ Đã tạo bộ lọc GIÁ BÁN');

  // Hiển thị kết quả
  const allFilters = await Filter.find({ category: 'Laptop' }).sort({ order: 1 });
  console.log('\n📋 Danh sách bộ lọc cho Laptop:');
  allFilters.forEach(f => {
    console.log(`\n  ${f.order}. ${f.displayName} (${f.name})`);
    f.options.forEach(opt => {
      console.log(`     - ${opt.label}: ${opt.value}`);
    });
  });

  process.exit(0);
})
.catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
