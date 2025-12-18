const mongoose = require('mongoose');
const Product = require('./models/Product');

const laptops = [
  {
    name: 'Laptop Asus Vivobook 15 X1504VA',
    description: 'Laptop Asus Vivobook 15 với Intel Core i5 gen 13, RAM 8GB, SSD 512GB, màn hình 15.6 inch FHD',
    price: 13490000,
    category: 'Laptop',
    brand: 'ASUS',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 30,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i5-1335U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'Intel Iris Xe Graphics',
      'Pin': '42 Wh'
    },
    rating: 4.3
  },
  {
    name: 'Laptop Acer Aspire 5 A515',
    description: 'Laptop Acer Aspire 5 với AMD Ryzen 5, RAM 8GB, SSD 512GB, thiết kế mỏng nhẹ',
    price: 11990000,
    category: 'Laptop',
    brand: 'ACER',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 25,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'AMD Ryzen 5 5500U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'AMD Radeon Graphics',
      'Pin': '48 Wh'
    },
    rating: 4.2
  },
  {
    name: 'Laptop MSI Modern 14 C13M',
    description: 'Laptop MSI Modern 14 với Intel Core i5 gen 13, RAM 16GB, màn hình 14 inch FHD',
    price: 14990000,
    category: 'Laptop',
    brand: 'MSI',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 20,
    specifications: {
      'Màn hình': '14 inch, FHD',
      'CPU': 'Intel Core i5-1335U',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'Intel Iris Xe Graphics',
      'Pin': '56 Wh'
    },
    rating: 4.4
  },
  {
    name: 'Laptop HP Pavilion 15',
    description: 'Laptop HP Pavilion 15 với Intel Core i5, RAM 8GB, màn hình 15.6 inch FHD',
    price: 12990000,
    category: 'Laptop',
    brand: 'HP',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 28,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i5-1235U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'Intel Iris Xe Graphics',
      'Pin': '41 Wh'
    },
    rating: 4.3
  },
  {
    name: 'Laptop Lenovo IdeaPad Slim 3',
    description: 'Laptop Lenovo IdeaPad Slim 3 với AMD Ryzen 5, RAM 8GB, thiết kế mỏng gọn',
    price: 10990000,
    category: 'Laptop',
    brand: 'LENOVO',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 35,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'AMD Ryzen 5 7520U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'AMD Radeon Graphics',
      'Pin': '47 Wh'
    },
    rating: 4.1
  },
  {
    name: 'Laptop Asus TUF Gaming F15',
    description: 'Laptop gaming Asus TUF F15 với Intel Core i7, RTX 4050, RAM 16GB, màn hình 144Hz',
    price: 25990000,
    category: 'Laptop',
    brand: 'ASUS',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 15,
    specifications: {
      'Màn hình': '15.6 inch, FHD 144Hz',
      'CPU': 'Intel Core i7-12700H',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA RTX 4050 6GB',
      'Pin': '90 Wh'
    },
    rating: 4.6
  },
  {
    name: 'Laptop MSI GF63 Thin',
    description: 'Laptop gaming MSI GF63 với Intel Core i5, GTX 1650, RAM 8GB, giá tốt',
    price: 16990000,
    category: 'Laptop',
    brand: 'MSI',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 18,
    specifications: {
      'Màn hình': '15.6 inch, FHD 144Hz',
      'CPU': 'Intel Core i5-11400H',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA GTX 1650 4GB',
      'Pin': '51 Wh'
    },
    rating: 4.4
  },
  {
    name: 'Laptop Dell Inspiron 15 3520',
    description: 'Laptop Dell Inspiron 15 với Intel Core i3, RAM 8GB, phù hợp văn phòng học tập',
    price: 9990000,
    category: 'Laptop',
    brand: 'DELL',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 40,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i3-1215U',
      'RAM': '8GB',
      'Ổ cứng': '256GB SSD',
      'Card đồ họa': 'Intel UHD Graphics',
      'Pin': '41 Wh'
    },
    rating: 4.0
  }
];

mongoose.connect('mongodb://localhost:27017/laptop-shop')
.then(async () => {
  console.log('✅ Đã kết nối MongoDB\n');
  
  // Thêm các laptop mới
  await Product.insertMany(laptops);
  console.log(`✅ Đã thêm ${laptops.length} laptop mới!\n`);
  
  // Kiểm tra lại
  const allLaptops = await Product.find({ category: 'Laptop' }).sort({ price: 1 });
  console.log(`📦 Tổng số laptop: ${allLaptops.length}\n`);
  console.log('💰 Danh sách laptop theo giá:');
  allLaptops.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} - ${p.price.toLocaleString('vi-VN')} VND (${p.brand})`);
  });
  
  // Test lọc
  console.log('\n🔍 Test lọc laptop theo giá:');
  
  const under15M = await Product.find({
    category: 'Laptop',
    price: { $gte: 0, $lte: 15000000 }
  });
  console.log(`  Dưới 15 triệu: ${under15M.length} laptop`);
  under15M.forEach(p => console.log(`    - ${p.name}: ${p.price.toLocaleString('vi-VN')} VND`));
  
  const from15to20M = await Product.find({
    category: 'Laptop',
    price: { $gte: 15000000, $lte: 20000000 }
  });
  console.log(`\n  Từ 15-20 triệu: ${from15to20M.length} laptop`);
  from15to20M.forEach(p => console.log(`    - ${p.name}: ${p.price.toLocaleString('vi-VN')} VND`));
  
  const over20M = await Product.find({
    category: 'Laptop',
    price: { $gte: 20000000 }
  });
  console.log(`\n  Trên 20 triệu: ${over20M.length} laptop`);
  over20M.forEach(p => console.log(`    - ${p.name}: ${p.price.toLocaleString('vi-VN')} VND`));
  
  process.exit(0);
})
.catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
