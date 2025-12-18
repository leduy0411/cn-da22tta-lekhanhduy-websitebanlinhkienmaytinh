const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';

async function removeOldIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    const db = mongoose.connection.db;
    
    // Kiểm tra collection có tồn tại không
    const collections = await db.listCollections({ name: 'carts' }).toArray();
    
    if (collections.length === 0) {
      console.log('⚠️  Collection "carts" chưa tồn tại');
      process.exit(0);
    }
    
    const collection = db.collection('carts');

    // Liệt kê các index hiện tại
    console.log('\n📋 Danh sách index hiện tại:');
    const currentIndexes = await collection.indexes();
    currentIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Xóa TẤT CẢ các index (trừ _id)
    console.log('\n🔧 Đang xóa tất cả index cũ...');
    
    for (const idx of currentIndexes) {
      if (idx.name !== '_id_') {
        try {
          await collection.dropIndex(idx.name);
          console.log(`✅ Đã xóa index: ${idx.name}`);
        } catch (e) {
          console.log(`⚠️  Không thể xóa index ${idx.name}:`, e.message);
        }
      }
    }

    // Tạo index mới với partialFilterExpression
    console.log('\n🔧 Đang tạo index mới...');
    
    await collection.createIndex(
      { userId: 1 }, 
      { 
        unique: true,
        partialFilterExpression: { userId: { $exists: true, $type: "objectId" } },
        name: 'userId_1_partial'
      }
    );
    console.log('✅ Đã tạo index cho userId');

    await collection.createIndex(
      { sessionId: 1 }, 
      { 
        unique: true,
        partialFilterExpression: { sessionId: { $exists: true, $type: "string" } },
        name: 'sessionId_1_partial'
      }
    );
    console.log('✅ Đã tạo index cho sessionId');

    // Liệt kê lại index
    console.log('\n📋 Danh sách index sau khi sửa:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx));
    });

    console.log('\n✅ Hoàn tất!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

removeOldIndexes();
