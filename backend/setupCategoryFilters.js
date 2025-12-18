const mongoose = require('mongoose');
const Filter = require('./models/Filter');

const MONGODB_URI = 'mongodb://localhost:27017/computer-store';

// Định nghĩa bộ lọc cho từng danh mục
const categoryFilters = {
  'Laptop': [
    {
      name: 'cpu',
      displayName: 'CPU',
      category: 'Laptop',
      type: 'checkbox',
      options: [
        { value: 'Intel Core i3', label: 'Intel Core i3', count: 0 },
        { value: 'Intel Core i5', label: 'Intel Core i5', count: 0 },
        { value: 'Intel Core i7', label: 'Intel Core i7', count: 0 },
        { value: 'Intel Core i9', label: 'Intel Core i9', count: 0 },
        { value: 'AMD Ryzen 3', label: 'AMD Ryzen 3', count: 0 },
        { value: 'AMD Ryzen 5', label: 'AMD Ryzen 5', count: 0 },
        { value: 'AMD Ryzen 7', label: 'AMD Ryzen 7', count: 0 },
        { value: 'AMD Ryzen 9', label: 'AMD Ryzen 9', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'ram',
      displayName: 'RAM',
      category: 'Laptop',
      type: 'checkbox',
      options: [
        { value: '8GB', label: '8GB', count: 0 },
        { value: '16GB', label: '16GB', count: 0 },
        { value: '32GB', label: '32GB', count: 0 },
        { value: '64GB', label: '64GB trở lên', count: 0 },
      ],
      order: 2,
      isActive: true
    },
    {
      name: 'gpu',
      displayName: 'Card đồ họa',
      category: 'Laptop',
      type: 'checkbox',
      options: [
        { value: 'Intel UHD', label: 'Intel UHD Graphics', count: 0 },
        { value: 'Intel Iris', label: 'Intel Iris Xe', count: 0 },
        { value: 'NVIDIA GTX 1650', label: 'NVIDIA GTX 1650', count: 0 },
        { value: 'NVIDIA RTX 3050', label: 'NVIDIA RTX 3050', count: 0 },
        { value: 'NVIDIA RTX 3060', label: 'NVIDIA RTX 3060', count: 0 },
        { value: 'NVIDIA RTX 4050', label: 'NVIDIA RTX 4050', count: 0 },
        { value: 'NVIDIA RTX 4060', label: 'NVIDIA RTX 4060', count: 0 },
        { value: 'AMD Radeon', label: 'AMD Radeon', count: 0 },
      ],
      order: 3,
      isActive: true
    },
    {
      name: 'screen',
      displayName: 'Kích thước màn hình',
      category: 'Laptop',
      type: 'checkbox',
      options: [
        { value: '13-14 inch', label: '13-14 inch', count: 0 },
        { value: '15-16 inch', label: '15-16 inch', count: 0 },
        { value: '17-18 inch', label: '17-18 inch', count: 0 },
      ],
      order: 4,
      isActive: true
    },
    {
      name: 'storage',
      displayName: 'Ổ cứng',
      category: 'Laptop',
      type: 'checkbox',
      options: [
        { value: '256GB', label: '256GB SSD', count: 0 },
        { value: '512GB', label: '512GB SSD', count: 0 },
        { value: '1TB', label: '1TB SSD', count: 0 },
        { value: '2TB', label: '2TB SSD trở lên', count: 0 },
      ],
      order: 5,
      isActive: true
    }
  ],

  'VGA': [
    {
      name: 'chipset',
      displayName: 'Chipset',
      category: 'VGA',
      type: 'checkbox',
      options: [
        { value: 'NVIDIA GTX 1650', label: 'NVIDIA GTX 1650', count: 0 },
        { value: 'NVIDIA GTX 1660', label: 'NVIDIA GTX 1660', count: 0 },
        { value: 'NVIDIA RTX 3050', label: 'NVIDIA RTX 3050', count: 0 },
        { value: 'NVIDIA RTX 3060', label: 'NVIDIA RTX 3060', count: 0 },
        { value: 'NVIDIA RTX 3070', label: 'NVIDIA RTX 3070', count: 0 },
        { value: 'NVIDIA RTX 4060', label: 'NVIDIA RTX 4060', count: 0 },
        { value: 'NVIDIA RTX 4070', label: 'NVIDIA RTX 4070', count: 0 },
        { value: 'NVIDIA RTX 4080', label: 'NVIDIA RTX 4080', count: 0 },
        { value: 'AMD Radeon RX 6600', label: 'AMD RX 6600', count: 0 },
        { value: 'AMD Radeon RX 6700', label: 'AMD RX 6700', count: 0 },
        { value: 'AMD Radeon RX 7600', label: 'AMD RX 7600', count: 0 },
        { value: 'AMD Radeon RX 7800', label: 'AMD RX 7800', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'vram',
      displayName: 'Bộ nhớ VRAM',
      category: 'VGA',
      type: 'checkbox',
      options: [
        { value: '4GB', label: '4GB', count: 0 },
        { value: '6GB', label: '6GB', count: 0 },
        { value: '8GB', label: '8GB', count: 0 },
        { value: '12GB', label: '12GB', count: 0 },
        { value: '16GB', label: '16GB', count: 0 },
        { value: '24GB', label: '24GB', count: 0 },
      ],
      order: 2,
      isActive: true
    },
    {
      name: 'bus',
      displayName: 'Bus',
      category: 'VGA',
      type: 'checkbox',
      options: [
        { value: 'GDDR5', label: 'GDDR5', count: 0 },
        { value: 'GDDR6', label: 'GDDR6', count: 0 },
        { value: 'GDDR6X', label: 'GDDR6X', count: 0 },
      ],
      order: 3,
      isActive: true
    }
  ],

  'CPU': [
    {
      name: 'socket',
      displayName: 'Socket',
      category: 'CPU',
      type: 'checkbox',
      options: [
        { value: 'LGA1700', label: 'LGA 1700 (Intel 12th-14th)', count: 0 },
        { value: 'LGA1200', label: 'LGA 1200 (Intel 10th-11th)', count: 0 },
        { value: 'AM5', label: 'AM5 (AMD Ryzen 7000)', count: 0 },
        { value: 'AM4', label: 'AM4 (AMD Ryzen 1000-5000)', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'cores',
      displayName: 'Số nhân',
      category: 'CPU',
      type: 'checkbox',
      options: [
        { value: '4', label: '4 nhân', count: 0 },
        { value: '6', label: '6 nhân', count: 0 },
        { value: '8', label: '8 nhân', count: 0 },
        { value: '10', label: '10 nhân', count: 0 },
        { value: '12', label: '12 nhân', count: 0 },
        { value: '16+', label: '16 nhân trở lên', count: 0 },
      ],
      order: 2,
      isActive: true
    },
    {
      name: 'generation',
      displayName: 'Thế hệ',
      category: 'CPU',
      type: 'checkbox',
      options: [
        { value: 'Intel 14th', label: 'Intel thế hệ 14', count: 0 },
        { value: 'Intel 13th', label: 'Intel thế hệ 13', count: 0 },
        { value: 'Intel 12th', label: 'Intel thế hệ 12', count: 0 },
        { value: 'AMD Ryzen 7000', label: 'AMD Ryzen 7000', count: 0 },
        { value: 'AMD Ryzen 5000', label: 'AMD Ryzen 5000', count: 0 },
      ],
      order: 3,
      isActive: true
    }
  ],

  'RAM': [
    {
      name: 'capacity',
      displayName: 'Dung lượng',
      category: 'RAM',
      type: 'checkbox',
      options: [
        { value: '8GB', label: '8GB', count: 0 },
        { value: '16GB', label: '16GB', count: 0 },
        { value: '32GB', label: '32GB', count: 0 },
        { value: '64GB', label: '64GB', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'type',
      displayName: 'Loại RAM',
      category: 'RAM',
      type: 'checkbox',
      options: [
        { value: 'DDR4', label: 'DDR4', count: 0 },
        { value: 'DDR5', label: 'DDR5', count: 0 },
      ],
      order: 2,
      isActive: true
    },
    {
      name: 'speed',
      displayName: 'Bus',
      category: 'RAM',
      type: 'checkbox',
      options: [
        { value: '2666MHz', label: '2666MHz', count: 0 },
        { value: '3000MHz', label: '3000MHz', count: 0 },
        { value: '3200MHz', label: '3200MHz', count: 0 },
        { value: '3600MHz', label: '3600MHz', count: 0 },
        { value: '4800MHz', label: '4800MHz', count: 0 },
        { value: '5200MHz', label: '5200MHz', count: 0 },
        { value: '6000MHz+', label: '6000MHz+', count: 0 },
      ],
      order: 3,
      isActive: true
    }
  ],

  'SSD': [
    {
      name: 'capacity',
      displayName: 'Dung lượng',
      category: 'SSD',
      type: 'checkbox',
      options: [
        { value: '256GB', label: '256GB', count: 0 },
        { value: '512GB', label: '512GB', count: 0 },
        { value: '1TB', label: '1TB', count: 0 },
        { value: '2TB', label: '2TB', count: 0 },
        { value: '4TB+', label: '4TB trở lên', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'interface',
      displayName: 'Chuẩn kết nối',
      category: 'SSD',
      type: 'checkbox',
      options: [
        { value: 'SATA', label: 'SATA', count: 0 },
        { value: 'M.2 NVMe', label: 'M.2 NVMe', count: 0 },
        { value: 'PCIe 3.0', label: 'PCIe 3.0', count: 0 },
        { value: 'PCIe 4.0', label: 'PCIe 4.0', count: 0 },
        { value: 'PCIe 5.0', label: 'PCIe 5.0', count: 0 },
      ],
      order: 2,
      isActive: true
    }
  ],

  'Mainboard': [
    {
      name: 'socket',
      displayName: 'Socket',
      category: 'Mainboard',
      type: 'checkbox',
      options: [
        { value: 'LGA1700', label: 'LGA 1700 (Intel)', count: 0 },
        { value: 'LGA1200', label: 'LGA 1200 (Intel)', count: 0 },
        { value: 'AM5', label: 'AM5 (AMD)', count: 0 },
        { value: 'AM4', label: 'AM4 (AMD)', count: 0 },
      ],
      order: 1,
      isActive: true
    },
    {
      name: 'chipset',
      displayName: 'Chipset',
      category: 'Mainboard',
      type: 'checkbox',
      options: [
        { value: 'Z790', label: 'Z790', count: 0 },
        { value: 'B760', label: 'B760', count: 0 },
        { value: 'H770', label: 'H770', count: 0 },
        { value: 'X670E', label: 'X670E', count: 0 },
        { value: 'B650', label: 'B650', count: 0 },
      ],
      order: 2,
      isActive: true
    },
    {
      name: 'formfactor',
      displayName: 'Form Factor',
      category: 'Mainboard',
      type: 'checkbox',
      options: [
        { value: 'ATX', label: 'ATX', count: 0 },
        { value: 'Micro-ATX', label: 'Micro-ATX', count: 0 },
        { value: 'Mini-ITX', label: 'Mini-ITX', count: 0 },
      ],
      order: 3,
      isActive: true
    }
  ]
};

async function setupFilters() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Xóa tất cả filters cũ
    await Filter.deleteMany({});
    console.log('🗑️  Deleted old filters');

    // Thêm filters mới cho từng category
    let totalAdded = 0;
    for (const [category, filters] of Object.entries(categoryFilters)) {
      console.log(`\n📦 Adding filters for ${category}...`);
      
      for (const filter of filters) {
        await Filter.create(filter);
        console.log(`  ✅ Added: ${filter.displayName}`);
        totalAdded++;
      }
    }

    console.log(`\n🎉 Successfully added ${totalAdded} filters for ${Object.keys(categoryFilters).length} categories!`);
    console.log('\n📋 Summary:');
    Object.entries(categoryFilters).forEach(([category, filters]) => {
      console.log(`  - ${category}: ${filters.length} filters`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

setupFilters();
