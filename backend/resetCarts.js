const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';

async function resetCarts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const coll = db.collection('carts');

    // Show current carts
    console.log('📋 Current carts:');
    const carts = await coll.find({}).toArray();
    if (carts.length === 0) {
      console.log('  (No carts found)');
    } else {
      carts.forEach(c => {
        console.log(`  - ID: ${c._id}`);
        console.log(`    userId: ${c.userId || 'null'}`);
        console.log(`    sessionId: ${c.sessionId || 'null'}`);
        console.log(`    items: ${c.items.length}`);
      });
    }

    // Delete all carts
    console.log('\n🗑️  Deleting all carts...');
    const result = await coll.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} carts`);

    // Show indexes
    console.log('\n📋 Current indexes:');
    const indexes = await coll.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}`);
      if (idx.partialFilterExpression) {
        console.log(`    Filter: ${JSON.stringify(idx.partialFilterExpression)}`);
      }
    });

    console.log('\n✅ Done! Database is ready.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

resetCarts();
