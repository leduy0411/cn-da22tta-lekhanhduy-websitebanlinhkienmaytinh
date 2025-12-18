const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/thietbidientu');

async function reorderShopBuildOption() {
  try {
    console.log('🔧 Đang sắp xếp lại thứ tự options...\n');
    
    // Tìm filter của PC build sẵn - filter "Thương Hiệu" có nhiều options
    const filters = await Filter.find({ 
      category: 'PC build sẵn'
    });
    
    console.log(`Tìm thấy ${filters.length} filters cho "PC build sẵn":\n`);
    filters.forEach(f => {
      console.log(`  - ${f.displayName} (${f.name}): ${f.options.length} options`);
    });
    
    // Lấy filter có nhiều options nhất (filter Thương Hiệu)
    const filter = filters.find(f => f.options.length > 1);
    
    if (!filter) {
      console.log('\n❌ Không tìm thấy filter với nhiều options!');
      return;
    }
    
    console.log(`\n✅ Sẽ sắp xếp lại filter: ${filter.displayName}\n`);
    
    console.log('📋 Filter hiện tại:', filter.displayName);
    console.log('Số options:', filter.options.length);
    console.log('Thứ tự cũ:');
    filter.options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label} (${opt.value})`);
    });
    
    // Tìm và di chuyển "Shop Build" lên đầu
    const shopBuildIndex = filter.options.findIndex(opt => 
      opt.value === 'shop build' || opt.label === 'Shop Build'
    );
    
    if (shopBuildIndex === -1) {
      console.log('\n❌ Không tìm thấy option "Shop Build"!');
      return;
    }
    
    console.log(`\n✅ Tìm thấy "Shop Build" ở vị trí ${shopBuildIndex + 1}`);
    
    // Di chuyển lên đầu
    const shopBuild = filter.options.splice(shopBuildIndex, 1)[0];
    filter.options.unshift(shopBuild);
    
    console.log('\n📋 Thứ tự mới:');
    filter.options.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label} (${opt.value})`);
    });
    
    // Lưu thay đổi
    await filter.save();
    console.log('\n✅ Đã lưu thay đổi thành công!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.connection.close();
  }
}

reorderShopBuildOption();
