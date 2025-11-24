const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

// Danh mục mặc định
const defaultCategories = [
  {
    name: 'Điện thoại',
    description: 'Smartphone và điện thoại di động các loại',
    icon: '📱',
    order: 1,
    isActive: true
  },
  {
    name: 'Laptop',
    description: 'Máy tính xách tay cho công việc và giải trí',
    icon: '💻',
    order: 2,
    isActive: true
  },
  {
    name: 'Tablet',
    description: 'Máy tính bảng iPad và Android',
    icon: '📲',
    order: 3,
    isActive: true
  },
  {
    name: 'Tai nghe',
    description: 'Tai nghe có dây và không dây',
    icon: '🎧',
    order: 4,
    isActive: true
  },
  {
    name: 'Đồng hồ thông minh',
    description: 'Smartwatch và vòng đeo tay thông minh',
    icon: '⌚',
    order: 5,
    isActive: true
  },
  {
    name: 'Phụ kiện',
    description: 'Sạc, cáp, ốp lưng và các phụ kiện khác',
    icon: '🔌',
    order: 6,
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
