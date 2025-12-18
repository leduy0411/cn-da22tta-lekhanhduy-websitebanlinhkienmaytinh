const mongoose = require('mongoose');
require('dotenv').config();
const Cart = require('./models/Cart');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';

async function testCartCreation() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // Test 1: Tạo cart với sessionId
    console.log('\n📝 Test 1: Tạo cart với sessionId');
    try {
      const cart1 = new Cart({
        sessionId: 'test-session-123',
        items: [],
        totalAmount: 0
      });
      await cart1.save();
      console.log('✅ Tạo cart với sessionId thành công:', cart1._id);
    } catch (e) {
      console.error('❌ Lỗi khi tạo cart với sessionId:', e.message);
    }

    // Test 2: Tạo cart với userId
    console.log('\n📝 Test 2: Tạo cart với userId');
    try {
      const cart2 = new Cart({
        userId: new mongoose.Types.ObjectId(),
        items: [],
        totalAmount: 0
      });
      await cart2.save();
      console.log('✅ Tạo cart với userId thành công:', cart2._id);
    } catch (e) {
      console.error('❌ Lỗi khi tạo cart với userId:', e.message);
    }

    // Test 3: Tạo cart không có gì
    console.log('\n📝 Test 3: Tạo cart không có userId và sessionId');
    try {
      const cart3 = new Cart({
        items: [],
        totalAmount: 0
      });
      await cart3.save();
      console.log('✅ Tạo cart không có gì thành công:', cart3._id);
    } catch (e) {
      console.error('❌ Lỗi khi tạo cart không có gì (EXPECTED):', e.message);
    }

    // Test 4: Tạo cart với null values
    console.log('\n📝 Test 4: Tạo cart với null values');
    try {
      const cart4 = new Cart({
        userId: null,
        sessionId: null,
        items: [],
        totalAmount: 0
      });
      await cart4.save();
      console.log('✅ Tạo cart với null values thành công:', cart4._id);
    } catch (e) {
      console.error('❌ Lỗi khi tạo cart với null values (EXPECTED):', e.message);
    }

    // Liệt kê tất cả carts
    console.log('\n📋 Danh sách carts sau test:');
    const allCarts = await Cart.find({});
    allCarts.forEach(cart => {
      console.log(`- Cart ${cart._id}: userId=${cart.userId}, sessionId=${cart.sessionId}`);
    });

    // Cleanup
    await Cart.deleteMany({});
    console.log('\n🗑️  Đã xóa tất cả test carts');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

testCartCreation();
