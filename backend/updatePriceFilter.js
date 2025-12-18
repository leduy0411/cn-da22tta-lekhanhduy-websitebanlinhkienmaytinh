const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/laptop-shop')
.then(async () => {
  console.log('✅ Đã kết nối MongoDB');
  
  // Xóa filter giá cũ
  await Filter.deleteMany({ name: { $in: ['giatien', 'priceRange'] } });
  console.log('Đã xóa các filter giá cũ');

  // Tạo filter giá mới với value là range
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
    order: 2, // Hiển thị sau brand
    isActive: true
  });

  await priceFilter.save();
  console.log('✅ Đã tạo bộ lọc GIÁ BÁN mới');

  // Hiển thị kết quả
  const allFilters = await Filter.find({ category: 'Laptop' }).sort({ order: 1 });
  console.log('\n📋 Danh sách bộ lọc cho Laptop:');
  allFilters.forEach(f => {
    console.log(`  ${f.order}. ${f.displayName} (${f.name})`);
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
