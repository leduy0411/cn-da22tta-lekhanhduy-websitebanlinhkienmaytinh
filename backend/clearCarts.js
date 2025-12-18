const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';

async function clearAllCarts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    const db = mongoose.connection.db;
    const collection = db.collection('carts');

    // Xóa TẤT CẢ giỏ hàng
    console.log('🔧 Đang xóa tất cả giỏ hàng...');
    const result = await collection.deleteMany({});
    console.log(`✅ Đã xóa ${result.deletedCount} giỏ hàng`);

    // Xóa tất cả index
    console.log('🔧 Đang xóa tất cả index...');
    await collection.dropIndexes();
    console.log('✅ Đã xóa tất cả index');

    // Tạo lại index đúng
    console.log('🔧 Đang tạo index mới...');
    await collection.createIndex({ userId: 1 }, { unique: true, sparse: true });
    await collection.createIndex({ sessionId: 1 }, { unique: true, sparse: true });
    console.log('✅ Đã tạo index mới');

    console.log('✅ HOÀN TẤT! Database đã sạch và sẵn sàng.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

clearAllCarts();
