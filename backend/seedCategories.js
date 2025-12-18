const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

// Hàm tạo slug từ tên
const createSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Danh mục mặc định
const defaultCategories = [
  {
    name: 'Laptop',
    slug: createSlug('Laptop'),
    description: 'Máy tính xách tay các loại',
    icon: '💻',
    order: 1,
    isActive: true
  },
  {
    name: 'Laptop Gaming',
    slug: createSlug('Laptop Gaming'),
    description: 'Laptop chuyên game hiệu năng cao',
    icon: '🎮',
    order: 2,
    isActive: true
  },
  {
    name: 'PC GVN',
    slug: createSlug('PC GVN'),
    description: 'PC gaming GVN build sẵn',
    icon: '🖥️',
    order: 3,
    isActive: true
  },
  {
    name: 'Main, CPU, VGA',
    slug: createSlug('Main, CPU, VGA'),
    description: 'Bo mạch chủ, CPU và Card đồ họa',
    icon: '🔧',
    order: 4,
    isActive: true
  },
  {
    name: 'Case, Nguồn, Tản',
    slug: createSlug('Case, Nguồn, Tản'),
    description: 'Vỏ máy tính, nguồn và tản nhiệt',
    icon: '⚡',
    order: 5,
    isActive: true
  },
  {
    name: 'Ổ cứng, RAM, Thẻ nhớ',
    slug: createSlug('Ổ cứng, RAM, Thẻ nhớ'),
    description: 'SSD, HDD, RAM và thẻ nhớ',
    icon: '💾',
    order: 6,
    isActive: true
  },
  {
    name: 'Loa, Micro, Webcam',
    slug: createSlug('Loa, Micro, Webcam'),
    description: 'Thiết bị âm thanh và webcam',
    icon: '🔊',
    order: 7,
    isActive: true
  },
  {
    name: 'Màn hình',
    slug: createSlug('Màn hình'),
    description: 'Màn hình máy tính các loại',
    icon: '🖥️',
    order: 8,
    isActive: true
  },
  {
    name: 'Bàn phím',
    slug: createSlug('Bàn phím'),
    description: 'Bàn phím cơ và bàn phím gaming',
    icon: '⌨️',
    order: 9,
    isActive: true
  },
  {
    name: 'Chuột + Lót chuột',
    slug: createSlug('Chuột + Lót chuột'),
    description: 'Chuột gaming và lót chuột',
    icon: '🖱️',
    order: 10,
    isActive: true
  },
  {
    name: 'Tai Nghe',
    slug: createSlug('Tai Nghe'),
    description: 'Tai nghe gaming và tai nghe thường',
    icon: '🎧',
    order: 11,
    isActive: true
  },
  {
    name: 'Ghế - Bàn',
    slug: createSlug('Ghế - Bàn'),
    description: 'Ghế gaming và bàn làm việc',
    icon: '🪑',
    order: 12,
    isActive: true
  },
  {
    name: 'Phần mềm, mạng',
    slug: createSlug('Phần mềm, mạng'),
    description: 'Phần mềm bản quyền và thiết bị mạng',
    icon: '💿',
    order: 13,
    isActive: true
  },
  {
    name: 'Handheld, Console',
    slug: createSlug('Handheld, Console'),
    description: 'Máy chơi game cầm tay và console',
    icon: '🎮',
    order: 14,
    isActive: true
  },
  {
    name: 'Phụ kiện (Hub, sạc, cáp...)',
    slug: createSlug('Phụ kiện (Hub, sạc, cáp...)'),
    description: 'Hub, sạc dự phòng, cáp kết nối',
    icon: '🔌',
    order: 15,
    isActive: true
  },
  {
    name: 'Dịch vụ và thông tin khác',
    slug: createSlug('Dịch vụ và thông tin khác'),
    description: 'Dịch vụ bảo hành, sửa chữa và thông tin',
    icon: 'ℹ️',
    order: 16,
    isActive: true
  }
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronics-store', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Đã kết nối MongoDB');

    // Xóa tất cả danh mục cũ
    await Category.deleteMany({});
    console.log('🗑️  Đã xóa danh mục cũ');

    // Thêm danh mục mới
    await Category.insertMany(defaultCategories);
    console.log('✅ Đã thêm', defaultCategories.length, 'danh mục mặc định!');

    console.log('\n📋 Danh sách danh mục:');
    defaultCategories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.icon} ${cat.name}`);
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
};

seedCategories();
