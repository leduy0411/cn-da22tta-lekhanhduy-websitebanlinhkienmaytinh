const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

// Dữ liệu mẫu sản phẩm
const sampleProducts = [
  {
    name: 'iPhone 15 Pro Max',
    description: 'Điện thoại iPhone 15 Pro Max 256GB với chip A17 Pro, camera 48MP, màn hình Super Retina XDR 6.7 inch',
    price: 29990000,
    category: 'Điện thoại',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/42/305658/iphone-15-pro-max-blue-thumbnew-600x600.jpg',
    stock: 50,
    specifications: {
      'Màn hình': '6.7 inch, Super Retina XDR',
      'Chip': 'Apple A17 Pro',
      'RAM': '8GB',
      'Bộ nhớ': '256GB',
      'Camera': '48MP + 12MP + 12MP',
      'Pin': '4422 mAh'
    },
    rating: 4.8
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Flagship Samsung với bút S Pen, camera 200MP, màn hình Dynamic AMOLED 2X 6.8 inch',
    price: 27990000,
    category: 'Điện thoại',
    brand: 'Samsung',
    image: 'https://cdn.tgdd.vn/Products/Images/42/307174/samsung-galaxy-s24-ultra-grey-thumbnew-600x600.jpg',
    stock: 45,
    specifications: {
      'Màn hình': '6.8 inch, Dynamic AMOLED 2X',
      'Chip': 'Snapdragon 8 Gen 3',
      'RAM': '12GB',
      'Bộ nhớ': '256GB',
      'Camera': '200MP + 50MP + 12MP + 10MP',
      'Pin': '5000 mAh'
    },
    rating: 4.7
  },
  {
    name: 'MacBook Pro 14 M3',
    description: 'MacBook Pro 14 inch với chip M3, màn hình Liquid Retina XDR, hiệu năng mạnh mẽ',
    price: 42990000,
    category: 'Laptop',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/44/309016/apple-macbook-pro-14-m3-2023-thumbn-600x600.jpg',
    stock: 30,
    specifications: {
      'Màn hình': '14.2 inch, Liquid Retina XDR',
      'Chip': 'Apple M3',
      'RAM': '8GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'GPU 10 nhân',
      'Pin': '70 Wh'
    },
    rating: 4.9
  },
  {
    name: 'Dell XPS 15',
    description: 'Laptop Dell XPS 15 với màn hình OLED 15.6 inch, Intel Core i7 thế hệ 13',
    price: 35990000,
    category: 'Laptop',
    brand: 'Dell',
    image: 'https://cdn.tgdd.vn/Products/Images/44/307203/dell-xps-15-9530-i7-71003169-080124-015855-600x600.jpg',
    stock: 25,
    specifications: {
      'Màn hình': '15.6 inch, OLED 3.5K',
      'CPU': 'Intel Core i7-13700H',
      'RAM': '16GB',
      'Ổ cứng': '512GB SSD',
      'Card đồ họa': 'NVIDIA RTX 4050',
      'Pin': '86 Wh'
    },
    rating: 4.6
  },
  {
    name: 'iPad Pro 11 M2',
    description: 'iPad Pro 11 inch với chip M2, hỗ trợ Apple Pencil thế hệ 2, màn hình Liquid Retina',
    price: 21990000,
    category: 'Tablet',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/522/247517/ipad-pro-11-inch-m2-wifi-gray-thumb-600x600.jpg',
    stock: 40,
    specifications: {
      'Màn hình': '11 inch, Liquid Retina',
      'Chip': 'Apple M2',
      'RAM': '8GB',
      'Bộ nhớ': '128GB',
      'Camera': '12MP + 10MP',
      'Pin': '28.65 Wh'
    },
    rating: 4.8
  },
  {
    name: 'Samsung Galaxy Tab S9',
    description: 'Máy tính bảng Samsung với màn hình Dynamic AMOLED 2X, chip Snapdragon 8 Gen 2',
    price: 18990000,
    category: 'Tablet',
    brand: 'Samsung',
    image: 'https://cdn.tgdd.vn/Products/Images/522/306214/samsung-galaxy-tab-s9-5g-xam-thumb-600x600.jpg',
    stock: 35,
    specifications: {
      'Màn hình': '11 inch, Dynamic AMOLED 2X',
      'Chip': 'Snapdragon 8 Gen 2',
      'RAM': '8GB',
      'Bộ nhớ': '128GB',
      'Pin': '8400 mAh'
    },
    rating: 4.5
  },
  {
    name: 'AirPods Pro 2',
    description: 'Tai nghe Apple AirPods Pro 2 với chip H2, chống ồn chủ động nâng cao',
    price: 6290000,
    category: 'Âm thanh',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/54/289780/apple-airpods-pro-2nd-gen-usb-c-thumb-1-600x600.jpg',
    stock: 100,
    specifications: {
      'Kết nối': 'Bluetooth 5.3',
      'Chip': 'Apple H2',
      'Chống ồn': 'ANC',
      'Thời gian pin': 'Lên đến 6 giờ',
      'Chống nước': 'IPX4'
    },
    rating: 4.7
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Tai nghe chụp tai Sony với chống ồn hàng đầu, chất lượng âm thanh Hi-Res',
    price: 8990000,
    category: 'Âm thanh',
    brand: 'Sony',
    image: 'https://cdn.tgdd.vn/Products/Images/54/289780/apple-airpods-pro-2nd-gen-usb-c-thumb-1-600x600.jpg',
    stock: 60,
    specifications: {
      'Kết nối': 'Bluetooth 5.2',
      'Driver': '30mm',
      'Chống ồn': 'ANC thế hệ mới',
      'Thời gian pin': 'Lên đến 30 giờ',
      'Codec': 'LDAC, AAC'
    },
    rating: 4.8
  },
  {
    name: 'Apple Watch Series 9',
    description: 'Đồng hồ thông minh Apple Watch với chip S9, màn hình Always-On',
    price: 10990000,
    category: 'Smartwatch',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/7077/309013/apple-watch-s9-gps-41mm-vien-nhom-day-cao-su-thumb-600x600.jpg',
    stock: 70,
    specifications: {
      'Màn hình': '1.9 inch, OLED Always-On',
      'Chip': 'Apple S9',
      'Cảm biến': 'ECG, SpO2, Nhiệt độ',
      'Chống nước': '50m',
      'Pin': 'Lên đến 18 giờ'
    },
    rating: 4.6
  },
  {
    name: 'Samsung Galaxy Watch 6',
    description: 'Smartwatch Samsung với màn hình AMOLED, theo dõi sức khỏe toàn diện',
    price: 7990000,
    category: 'Smartwatch',
    brand: 'Samsung',
    image: 'https://cdn.tgdd.vn/Products/Images/7077/306195/samsung-galaxy-watch-6-44mm-den-thumb-600x600.jpg',
    stock: 55,
    specifications: {
      'Màn hình': '1.5 inch, Super AMOLED',
      'Chip': 'Exynos W930',
      'RAM': '2GB',
      'Bộ nhớ': '16GB',
      'Chống nước': '5ATM + IP68',
      'Pin': '425 mAh'
    },
    rating: 4.5
  },
  {
    name: 'Cáp sạc USB-C to Lightning',
    description: 'Cáp sạc nhanh Apple USB-C to Lightning dài 1m, hỗ trợ sạc nhanh 20W',
    price: 590000,
    category: 'Phụ kiện',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/58/233908/cap-lightning-1m-apple-mu7v2-ava-600x600.jpg',
    stock: 200,
    specifications: {
      'Chiều dài': '1m',
      'Đầu vào': 'USB-C',
      'Đầu ra': 'Lightning',
      'Công suất': 'Hỗ trợ 20W'
    },
    rating: 4.4
  },
  {
    name: 'Ốp lưng iPhone 15 Pro Max',
    description: 'Ốp lưng silicone chính hãng Apple cho iPhone 15 Pro Max',
    price: 1290000,
    category: 'Phụ kiện',
    brand: 'Apple',
    image: 'https://cdn.tgdd.vn/Products/Images/60/309660/op-lung-iphone-15-pro-max-silicone-magsafe-apple-thumb-xanh-duong-1-600x600.jpg',
    stock: 150,
    specifications: {
      'Chất liệu': 'Silicone cao cấp',
      'Tính năng': 'Hỗ trợ MagSafe',
      'Độ dày': 'Mỏng nhẹ',
      'Bảo vệ': 'Chống sốc'
    },
    rating: 4.3
  }
];

// Kết nối MongoDB và thêm dữ liệu
const seedDatabase = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/laptop-shop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Đã kết nối MongoDB');

    // Xóa dữ liệu cũ
    await Product.deleteMany({});
    console.log('🗑️  Đã xóa dữ liệu cũ');

    // Thêm dữ liệu mới
    await Product.insertMany(sampleProducts);
    console.log('✅ Đã thêm dữ liệu mẫu thành công!');
    console.log(`📦 Số sản phẩm: ${sampleProducts.length}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
};

seedDatabase();
