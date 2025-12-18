const mongoose = require('mongoose');
const Cart = require('./models/Cart');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';

async function diagnose() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Kiểm tra users
    console.log('👥 Users in database:');
    const users = await User.find({}).select('_id email role');
    users.forEach(u => console.log(`  - ${u.email} (${u.role}) - ID: ${u._id}`));

    // Kiểm tra carts
    console.log('\n🛒 Carts in database:');
    const carts = await Cart.find({});
    if (carts.length === 0) {
      console.log('  (No carts found)');
    } else {
      carts.forEach(c => {
        console.log(`  - Cart ID: ${c._id}`);
        console.log(`    userId: ${c.userId} (type: ${c.userId ? typeof c.userId : 'null'})`);
        console.log(`    sessionId: ${c.sessionId} (type: ${c.sessionId ? typeof c.sessionId : 'null'})`);
        console.log(`    items: ${c.items.length}`);
      });
    }

    // Test tạo cart với userId
    console.log('\n🧪 Testing cart creation with userId...');
    const testUser = users[0];
    if (testUser) {
      try {
        const testCart = new Cart({
          userId: testUser._id,
          items: [],
          totalAmount: 0
        });
        await testCart.save();
        console.log('✅ Created test cart with userId:', testCart._id);
        
        // Xóa test cart
        await Cart.deleteOne({ _id: testCart._id });
        console.log('✅ Deleted test cart');
      } catch (e) {
        console.error('❌ Error creating test cart:', e.message);
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

diagnose();
