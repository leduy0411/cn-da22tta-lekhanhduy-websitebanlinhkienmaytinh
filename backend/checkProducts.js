const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect('mongodb://localhost:27017/thietbidientu')
.then(async () => {
  console.log('✅ Đã kết nối MongoDB\n');
  
  // Lấy tất cả sản phẩm
  const allProducts = await Product.find({});
  console.log(`📦 Tổng số sản phẩm: ${allProducts.length}\n`);
  
  // Hiển thị thông tin giá của từng sản phẩm
  console.log('💰 Danh sách sản phẩm và giá:');
  allProducts.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     Giá: ${p.price.toLocaleString('vi-VN')} VND`);
    console.log(`     Category: ${p.category}`);
    console.log(`     Brand: ${p.brand}`);
  });
  
  // Test filter theo giá
  console.log('\n🔍 Test lọc theo giá:');
  
  const under15M = await Product.find({
    price: { $gte: 0, $lte: 15000000 }
  });
  console.log(`  Dưới 15 triệu: ${under15M.length} sản phẩm`);
  
  const from15to20M = await Product.find({
    price: { $gte: 15000000, $lte: 20000000 }
  });
  console.log(`  Từ 15-20 triệu: ${from15to20M.length} sản phẩm`);
  
  const over20M = await Product.find({
    price: { $gte: 20000000, $lte: 999999999 }
  });
  console.log(`  Trên 20 triệu: ${over20M.length} sản phẩm`);
  
  // Test lọc kết hợp category + giá
  console.log('\n🔍 Test lọc kết hợp (Laptop + Dưới 15 triệu):');
  const laptopUnder15M = await Product.find({
    category: 'Laptop',
    price: { $gte: 0, $lte: 15000000 }
  });
  console.log(`  Kết quả: ${laptopUnder15M.length} sản phẩm`);
  if (laptopUnder15M.length > 0) {
    laptopUnder15M.forEach(p => {
      console.log(`    - ${p.name}: ${p.price.toLocaleString('vi-VN')} VND`);
    });
  }
  
  process.exit(0);
})
.catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
