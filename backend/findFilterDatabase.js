const mongoose = require('mongoose');

// Kết nối và liệt kê TẤT CẢ databases
mongoose.connect('mongodb://localhost:27017/', { dbName: 'admin' });

async function listAllDatabases() {
  try {
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    
    console.log('📚 Tất cả databases trong MongoDB:\n');
    databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    console.log('\n🔍 Kiểm tra từng database...\n');
    
    for (const db of databases) {
      if (db.name === 'admin' || db.name === 'local' || db.name === 'config') continue;
      
      const conn = mongoose.createConnection(`mongodb://localhost:27017/${db.name}`);
      await conn.asPromise();
      
      const Filter = conn.model('Filter', new mongoose.Schema({}, { strict: false, collection: 'filters' }));
      const filters = await Filter.find({});
      
      if (filters.length > 0) {
        console.log(`\n✅ Database: ${db.name}`);
        console.log(`   Có ${filters.length} filters:`);
        filters.forEach(f => {
          console.log(`     - ${f.displayName || f.name} (category: "${f.category}", options: ${f.options?.length || 0})`);
        });
      }
      
      await conn.close();
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await mongoose.connection.close();
  }
}

listAllDatabases();
