const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';

async function fixIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    const db = mongoose.connection.db;
    
    // Kiểm tra collection có tồn tại không
    const collections = await db.listCollections({ name: 'carts' }).toArray();
    
    if (collections.length === 0) {
      console.log('⚠️  Collection "carts" chưa tồn tại, đang tạo...');
      await db.createCollection('carts');
      console.log('✅ Đã tạo collection "carts"');
    }
    
    const collection = db.collection('carts');

    // Liệt kê các index hiện tại
    console.log('📋 Danh sách index hiện tại:');
    const currentIndexes = await collection.indexes();
    console.log(currentIndexes);

    // Xóa các index cũ (trừ _id)
    console.log('\n🔧 Đang xóa các index cũ...');
    try {
      await collection.dropIndex('userId_1');
      console.log('✅ Đã xóa index userId_1');
    } catch (e) {
      console.log('⚠️  Index userId_1 không tồn tại');
    }
    
    try {
      await collection.dropIndex('sessionId_1');
      console.log('✅ Đã xóa index sessionId_1');
    } catch (e) {
      console.log('⚠️  Index sessionId_1 không tồn tại');
    }

    // Tạo index mới với partialFilterExpression
    console.log('\n🔧 Đang tạo index mới...');
    await collection.createIndex(
      { userId: 1 }, 
      { 
        unique: true,
        partialFilterExpression: { userId: { $type: "objectId" } },
        name: 'userId_1_partial'
      }
    );
    console.log('✅ Đã tạo index cho userId');

    await collection.createIndex(
      { sessionId: 1 }, 
      { 
        unique: true,
        partialFilterExpression: { sessionId: { $type: "string" } },
        name: 'sessionId_1_partial'
      }
    );
    console.log('✅ Đã tạo index cho sessionId');

    // Xóa các cart có cả sessionId và userId đều null (dữ liệu rác)
    console.log('\n🔧 Đang xóa dữ liệu rác...');
    const result = await collection.deleteMany({ 
      $and: [
        { $or: [{ sessionId: null }, { sessionId: { $exists: false } }] },
        { $or: [{ userId: null }, { userId: { $exists: false } }] }
      ]
    });
    console.log(`✅ Đã xóa ${result.deletedCount} giỏ hàng rác`);

    console.log('\n📋 Danh sách index sau khi sửa:');
    const newIndexes = await collection.indexes();
    console.log(newIndexes);

    console.log('\n✅ Hoàn tất! Hệ thống giỏ hàng đã được sửa.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

fixIndexes();
