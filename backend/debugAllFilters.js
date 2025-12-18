const mongoose = require('mongoose');
const Filter = require('./models/Filter');

mongoose.connect('mongodb://localhost:27017/thietbidientu');

async function debugFilters() {
  try {
    console.log('🔍 Debugging all filters...\n');
    
    const all = await Filter.find({});
    console.log(`Tổng số filters: ${all.length}\n`);
    
    all.forEach((f, i) => {
      console.log(`\n━━━ Filter ${i + 1} ━━━`);
      console.log(`ID: ${f._id}`);
      console.log(`Name: ${f.name}`);
      console.log(`DisplayName: ${f.displayName}`);
      console.log(`Category: "${f.category}"`);
      console.log(`Options: ${f.options.length}`);
      console.log(`Active: ${f.isActive}`);
      
      if (f.options.length > 0 && f.options.length <= 10) {
        console.log(`Options list:`);
        f.options.forEach((opt, j) => {
          console.log(`  ${j + 1}. ${opt.label} (${opt.value})`);
        });
      }
    });
    
    // Kiểm tra filter cụ thể từ API test
    console.log('\n\n🔎 Tìm filter ID: 6927a231cff4e5612fb6209b');
    const specific = await Filter.findById('6927a231cff4e5612fb6209b');
    if (specific) {
      console.log('✅ Tìm thấy!');
      console.log(JSON.stringify(specific, null, 2));
    } else {
      console.log('❌ Không tìm thấy filter này!');
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.connection.close();
  }
}

debugFilters();
