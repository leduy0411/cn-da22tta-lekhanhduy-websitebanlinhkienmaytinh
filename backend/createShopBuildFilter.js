const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/techstore');

async function createShopBuildFilter() {
  try {
    console.log('🔌 Đang kết nối database...');
    
    // Kiểm tra filter đã tồn tại chưa
    const existing = await Filter.findOne({ name: 'shop_build', category: /PC build sẵn/i });
    if (existing) {
      console.log('⚠️  Filter "Shop Build" đã tồn tại!');
      console.log('Thông tin:', existing);
      await mongoose.connection.close();
      return;
    }
    
    // Tạo filter mới cho "PC build sẵn"
    const shopBuildFilter = new Filter({
      name: 'shop_build',
      displayName: 'Shop Build',
      type: 'select',
      category: 'PC build sẵn',
      options: [
        { value: 'shop_build', label: 'Shop Build' }
      ],
      order: 0,
      isActive: true
    });
    
    await shopBuildFilter.save();
    console.log('✅ Đã tạo filter "Shop Build" thành công!');
    console.log('Chi tiết:', shopBuildFilter);
    
    // Kiểm tra lại
    const allFilters = await Filter.find({});
    console.log(`\n📊 Tổng số filters hiện có: ${allFilters.length}`);
    allFilters.forEach(f => {
      console.log(`  - ${f.displayName} (${f.name}) - Category: "${f.category}"`);
    });
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✨ Hoàn tất!');
  }
}

createShopBuildFilter();
