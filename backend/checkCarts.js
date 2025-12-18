const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';

async function checkCarts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    const db = mongoose.connection.db;
    const collection = db.collection('carts');

    // Đếm tổng số carts
    const totalCarts = await collection.countDocuments();
    console.log(`\n📊 Tổng số giỏ hàng: ${totalCarts}`);

    // Kiểm tra các carts theo loại
    const cartsWithUserId = await collection.countDocuments({ userId: { $exists: true, $ne: null } });
    const cartsWithSessionId = await collection.countDocuments({ sessionId: { $exists: true, $ne: null } });
    const cartsWithBoth = await collection.countDocuments({ 
      userId: { $exists: true, $ne: null },
      sessionId: { $exists: true, $ne: null }
    });
    const cartsWithNeither = await collection.countDocuments({ 
      $and: [
        { $or: [{ userId: null }, { userId: { $exists: false } }] },
        { $or: [{ sessionId: null }, { sessionId: { $exists: false } }] }
      ]
    });

    console.log(`\n📋 Phân loại giỏ hàng:`);
    console.log(`  - Có userId: ${cartsWithUserId}`);
    console.log(`  - Có sessionId: ${cartsWithSessionId}`);
    console.log(`  - Có cả hai (BUG!): ${cartsWithBoth}`);
    console.log(`  - Không có gì (BUG!): ${cartsWithNeither}`);

    // Hiển thị tất cả carts
    console.log(`\n📦 Chi tiết các giỏ hàng:`);
    const allCarts = await collection.find({}).toArray();
    allCarts.forEach((cart, index) => {
      console.log(`\nGiỏ hàng ${index + 1}:`);
      console.log(`  _id: ${cart._id}`);
      console.log(`  userId: ${cart.userId || 'null'}`);
      console.log(`  sessionId: ${cart.sessionId || 'null'}`);
      console.log(`  Số sản phẩm: ${cart.items?.length || 0}`);
      console.log(`  Tổng tiền: ${cart.totalAmount || 0}`);
    });

    // Xóa các cart có vấn đề
    if (cartsWithBoth > 0) {
      console.log(`\n⚠️  Phát hiện ${cartsWithBoth} giỏ hàng có cả userId và sessionId`);
      console.log('🔧 Đang sửa...');
      const result = await collection.updateMany(
        { 
          userId: { $exists: true, $ne: null },
          sessionId: { $exists: true, $ne: null }
        },
        { $unset: { sessionId: "" } }
      );
      console.log(`✅ Đã xóa sessionId khỏi ${result.modifiedCount} giỏ hàng`);
    }

    if (cartsWithNeither > 0) {
      console.log(`\n⚠️  Phát hiện ${cartsWithNeither} giỏ hàng rác (không có userId và sessionId)`);
      console.log('🔧 Đang xóa...');
      const result = await collection.deleteMany({ 
        $and: [
          { $or: [{ userId: null }, { userId: { $exists: false } }] },
          { $or: [{ sessionId: null }, { sessionId: { $exists: false } }] }
        ]
      });
      console.log(`✅ Đã xóa ${result.deletedCount} giỏ hàng rác`);
    }

    console.log('\n✅ Hoàn tất kiểm tra!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

checkCarts();
