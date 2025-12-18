require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const CATEGORIES_WITH_ICONS = [
  {
    name: 'Laptop',
    description: 'Máy tính xách tay các loại',
    icon: '/img/img-danhmucsanpham/Laptop.png',
    order: 1
  },
  {
    name: 'PC',
    description: 'Máy tính để bàn, PC Gaming',
    icon: '/img/img-danhmucsanpham/PC.png',
    order: 2
  },
  {
    name: 'Màn hình',
    description: 'Màn hình máy tính, Gaming Monitor',
    icon: '/img/img-danhmucsanpham/Manhinh.jpg',
    order: 3
  },
  {
    name: 'Case',
    description: 'Vỏ case máy tính',
    icon: '/img/img-danhmucsanpham/Case.png',
    order: 4
  },
  {
    name: 'CPU',
    description: 'Bộ vi xử lý Intel, AMD',
    icon: '/img/img-danhmucsanpham/CPU.png',
    order: 5
  },
  {
    name: 'Bàn phím',
    description: 'Bàn phím cơ, Gaming Keyboard',
    icon: '/img/img-danhmucsanpham/Banphim.jpg',
    order: 6
  },
  {
    name: 'Mainboard',
    description: 'Bo mạch chủ',
    icon: '/img/img-danhmucsanpham/Mainboard.png',
    order: 7
  },
  {
    name: 'VGA',
    description: 'Card màn hình, GPU',
    icon: '/img/img-danhmucsanpham/VGA.jpg',
    order: 8
  },
  {
    name: 'RAM',
    description: 'Bộ nhớ RAM',
    icon: '/img/img-danhmucsanpham/RAM.png',
    order: 9
  },
  {
    name: 'Ổ cứng',
    description: 'SSD, HDD, Ổ cứng lưu trữ',
    icon: '/img/img-danhmucsanpham/Ocung.png',
    order: 10
  },
  {
    name: 'Nguồn',
    description: 'Nguồn máy tính PSU',
    icon: '/img/img-danhmucsanpham/Nguon.png',
    order: 11
  },
  {
    name: 'Tản nhiệt',
    description: 'Tản nhiệt CPU, AIO',
    icon: '/img/img-danhmucsanpham/Tannhiet.png',
    order: 12
  },
  {
    name: 'Chuột',
    description: 'Chuột Gaming, Chuột văn phòng',
    icon: '/img/img-danhmucsanpham/Chuot.jpg',
    order: 13
  },
  {
    name: 'Tai nghe',
    description: 'Tai nghe Gaming, Headphone',
    icon: '/img/img-danhmucsanpham/Tainghe.jpg',
    order: 14
  },
  {
    name: 'Loa',
    description: 'Loa máy tính, Speaker',
    icon: '/img/img-danhmucsanpham/Loa.png',
    order: 15
  },
  {
    name: 'Ghế',
    description: 'Ghế Gaming, Ghế văn phòng',
    icon: '/img/img-danhmucsanpham/Ghe.jpg',
    order: 16
  },
  {
    name: 'Phụ kiện',
    description: 'Các phụ kiện khác',
    icon: '/img/img-danhmucsanpham/Phukien.png',
    order: 17
  },
  {
    name: 'Thiết bị văn phòng',
    description: 'Máy in, Scanner, Thiết bị VP',
    icon: '/img/img-danhmucsanpham/Thietbivp.png',
    order: 18
  },
  {
    name: 'Console',
    description: 'Máy chơi game Console',
    icon: '/img/img-danhmucsanpham/Console.png',
    order: 19
  },
  {
    name: 'Sạc dự phòng',
    description: 'Pin sạc dự phòng, Powerbank',
    icon: '/img/img-danhmucsanpham/Sacdp.png',
    order: 20
  }
];

async function updateCategoryIcons() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tech-shop');
    console.log('✅ Đã kết nối MongoDB');

    for (const catData of CATEGORIES_WITH_ICONS) {
      const existing = await Category.findOne({ name: catData.name });
      
      if (existing) {
        // Cập nhật icon và thông tin
        existing.icon = catData.icon;
        existing.description = catData.description;
        existing.order = catData.order;
        existing.isActive = true;
        
        // Force update slug nếu chưa có
        if (!existing.slug) {
          existing.slug = catData.name
            .toLowerCase()
            .replace(/đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }
        
        await existing.save();
        console.log(`🔄 Đã cập nhật: ${catData.name} -> ${catData.icon}`);
      } else {
        // Tạo mới - tự động tạo slug qua pre-save hook
        await Category.create({
          ...catData,
          slug: catData.name
            .toLowerCase()
            .replace(/đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        });
        console.log(`➕ Đã tạo mới: ${catData.name} -> ${catData.icon}`);
      }
    }

    console.log('\n✅ HOÀN THÀNH! Đã cập nhật tất cả icon danh mục.');
    
    // Hiển thị danh sách
    const allCategories = await Category.find().sort({ order: 1 });
    console.log('\n📋 DANH SÁCH DANH MỤC:');
    allCategories.forEach(cat => {
      console.log(`${cat.order}. ${cat.name} - ${cat.icon} (${cat.isActive ? 'Active' : 'Inactive'})`);
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Đã ngắt kết nối MongoDB');
  }
}

updateCategoryIcons();
