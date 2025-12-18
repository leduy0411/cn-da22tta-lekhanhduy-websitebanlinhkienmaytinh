const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/techstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkFilters() {
  try {
    // Lấy TẤT CẢ filters không phân biệt isActive
    const allFilters = await Filter.find({}).sort({ category: 1, order: 1 });
    
    console.log('\n=== TẤT CẢ BỘ LỌC TRONG DATABASE ===');
    console.log('Tổng số:', allFilters.length);
    console.log('\n');
    
    // Nhóm theo category
    const byCategory = {};
    allFilters.forEach(filter => {
      const cat = filter.category || 'Không có category';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(filter);
    });
    
    // Hiển thị chi tiết
    Object.keys(byCategory).forEach(cat => {
      console.log(`\n📁 Category: "${cat}"`);
      console.log('─'.repeat(60));
      
      byCategory[cat].forEach(filter => {
        console.log(`  ✓ ${filter.displayName} (${filter.name})`);
        console.log(`    - ID: ${filter._id}`);
        console.log(`    - Active: ${filter.isActive ? '✅ Có' : '❌ Không'}`);
        console.log(`    - Options: ${filter.options.length} tùy chọn`);
        if (filter.options.length > 0) {
          filter.options.forEach((opt, i) => {
            console.log(`      ${i + 1}. ${opt.label || opt.value}`);
          });
        }
        console.log('');
      });
    });
    
    console.log('\n=== TÌM KIẾM "SHOP BUILD" ===');
    const shopBuildFilters = await Filter.find({
      $or: [
        { category: /shop.*build/i },
        { category: /pc.*build/i },
        { name: /shop.*build/i },
        { displayName: /shop.*build/i }
      ]
    });
    
    if (shopBuildFilters.length > 0) {
      console.log(`Tìm thấy ${shopBuildFilters.length} filter liên quan:`);
      shopBuildFilters.forEach(f => {
        console.log(`  - ${f.displayName} (category: "${f.category}", active: ${f.isActive})`);
      });
    } else {
      console.log('❌ KHÔNG tìm thấy filter nào liên quan đến "Shop Build"');
    }
    
  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkFilters();
