const mongoose = require('mongoose');
const Product = require('./models/Product');

const allProducts = [
  // LAPTOPS - Dưới 15 triệu (6 sản phẩm)
  {
    name: 'Laptop Dell Inspiron 15 3520',
    description: 'Laptop Dell Inspiron 15 với Intel Core i3, RAM 8GB, phù hợp văn phòng học tập',
    price: 9990000,
    category: 'Laptop',
    brand: 'DELL',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 40,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i3-1215U',
      'RAM': '8GB',
      'Ổ cứng': '256GB SSD'
    },
    rating: 4.0
  },
  {
    name: 'Laptop Lenovo IdeaPad Slim 3',
    description: 'Laptop Lenovo IdeaPad Slim 3 với AMD Ryzen 5, RAM 8GB, thiết kế mỏng gọn',
    price: 10990000,
    category: 'Laptop',
    brand: 'LENOVO',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 35,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'AMD Ryzen 5 7520U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.1
  },
  {
    name: 'Laptop Acer Aspire 5 A515',
    description: 'Laptop Acer Aspire 5 với AMD Ryzen 5, RAM 8GB, SSD 512GB, thiết kế mỏng nhẹ',
    price: 11990000,
    category: 'Laptop',
    brand: 'ACER',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 25,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'AMD Ryzen 5 5500U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.2
  },
  {
    name: 'Laptop HP Pavilion 15',
    description: 'Laptop HP Pavilion 15 với Intel Core i5, RAM 8GB, màn hình 15.6 inch FHD',
    price: 12990000,
    category: 'Laptop',
    brand: 'HP',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 28,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i5-1235U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.3
  },
  {
    name: 'Laptop Asus Vivobook 15 X1504VA',
    description: 'Laptop Asus Vivobook 15 với Intel Core i5 gen 13, RAM 8GB, SSD 512GB',
    price: 13490000,
    category: 'Laptop',
    brand: 'ASUS',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 30,
    specifications: {
      'Màn hình': '15.6 inch, FHD',
      'CPU': 'Intel Core i5-1335U',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.3
  },
  {
    name: 'Laptop MSI Modern 14 C13M',
    description: 'Laptop MSI Modern 14 với Intel Core i5 gen 13, RAM 16GB',
    price: 14990000,
    category: 'Laptop',
    brand: 'MSI',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600',
    stock: 20,
    specifications: {
      'Màn hình': '14 inch, FHD',
      'CPU': 'Intel Core i5-1335U',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.4
  },
  
  // LAPTOPS - Từ 15-20 triệu (1 sản phẩm)
  {
    name: 'Laptop MSI GF63 Thin',
    description: 'Laptop gaming MSI GF63 với Intel Core i5, GTX 1650, RAM 8GB',
    price: 16990000,
    category: 'Laptop',
    brand: 'MSI',
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600',
    stock: 18,
    specifications: {
      'Màn hình': '15.6 inch, FHD 144Hz',
      'CPU': 'Intel Core i5-11400H',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA GTX 1650 4GB'
    },
    rating: 4.4
  },
  
  // LAPTOPS - Trên 20 triệu (3 sản phẩm)
  {
    name: 'Laptop Asus TUF Gaming F15',
    description: 'Laptop gaming Asus TUF F15 với Intel Core i7, RTX 4050, RAM 16GB',
    price: 25990000,
    category: 'Laptop',
    brand: 'ASUS',
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600',
    stock: 15,
    specifications: {
      'Màn hình': '15.6 inch, FHD 144Hz',
      'CPU': 'Intel Core i7-12700H',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA RTX 4050 6GB'
    },
    rating: 4.6
  },
  {
    name: 'Dell XPS 15',
    description: 'Laptop Dell XPS 15 với màn hình OLED 15.6 inch, Intel Core i7 thế hệ 13',
    price: 35990000,
    category: 'Laptop',
    brand: 'DELL',
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600',
    stock: 25,
    specifications: {
      'Màn hình': '15.6 inch, OLED 3.5K',
      'CPU': 'Intel Core i7-13700H',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA RTX 4050'
    },
    rating: 4.6
  },
  {
    name: 'MacBook Pro 14 M3',
    description: 'MacBook Pro 14 inch với chip M3, màn hình Liquid Retina XDR',
    price: 42990000,
    category: 'Laptop',
    brand: 'APPLE',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600',
    stock: 30,
    specifications: {
      'Màn hình': '14.2 inch, Liquid Retina XDR',
      'Chip': 'Apple M3',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD'
    },
    rating: 4.9
  },

  // SẢN PHẨM KHÁC
  {
    name: 'iPhone 15 Pro Max',
    description: 'Điện thoại iPhone 15 Pro Max 256GB với chip A17 Pro',
    price: 29990000,
    category: 'Điện thoại',
    brand: 'APPLE',
    image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600',
    stock: 50,
    rating: 4.8
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Flagship Samsung với bút S Pen, camera 200MP',
    price: 27990000,
    category: 'Điện thoại',
    brand: 'SAMSUNG',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600',
    stock: 45,
    rating: 4.7
  },
  {
    name: 'iPad Pro 11 M2',
    description: 'iPad Pro 11 inch với chip M2',
    price: 21990000,
    category: 'Tablet',
    brand: 'APPLE',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600',
    stock: 40,
    rating: 4.8
  },
  {
    name: 'AirPods Pro 2',
    description: 'Tai nghe Apple AirPods Pro 2 với chip H2',
    price: 6290000,
    category: 'Âm thanh',
    brand: 'APPLE',
    image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=600',
    stock: 100,
    rating: 4.7
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Tai nghe chụp tai Sony với chống ồn hàng đầu',
    price: 8990000,
    category: 'Âm thanh',
    brand: 'SONY',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
    stock: 60,
    rating: 4.8
  }
];

mongoose.connect('mongodb://localhost:27017/thietbidientu')
.then(async () => {
  console.log('✅ Đã kết nối MongoDB\n');
  
  // Xóa tất cả sản phẩm cũ
  await Product.deleteMany({});
  console.log('🗑️  Đã xóa dữ liệu cũ\n');
  
  // Thêm sản phẩm mới
  await Product.insertMany(allProducts);
  console.log(`✅ Đã thêm ${allProducts.length} sản phẩm!\n`);
  
  // Kiểm tra
  const laptops = await Product.find({ category: 'Laptop' }).sort({ price: 1 });
  console.log(`📦 Tổng số laptop: ${laptops.length}\n`);
  
  const under15 = laptops.filter(p => p.price < 15000000);
  const from15to20 = laptops.filter(p => p.price >= 15000000 && p.price <= 20000000);
  const over20 = laptops.filter(p => p.price > 20000000);
  
  console.log('💰 Phân loại theo giá:');
  console.log(`  Dưới 15 triệu: ${under15.length} laptop`);
  console.log(`  Từ 15-20 triệu: ${from15to20.length} laptop`);
  console.log(`  Trên 20 triệu: ${over20.length} laptop\n`);
  
  console.log('📋 Chi tiết laptop dưới 15 triệu:');
  under15.forEach(p => {
    console.log(`  - ${p.name}: ${p.price.toLocaleString('vi-VN')} VND`);
  });
  
  process.exit(0);
})
.catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
