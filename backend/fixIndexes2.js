const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';

async function fixIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const db = mongoose.connection.db;
    const coll = db.collection('carts');

    // Liệt kê indexes hiện tại
    console.log('📋 Current indexes:');
    const currentIndexes = await coll.indexes();
    currentIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Xóa TẤT CẢ indexes trừ _id
    console.log('\n🗑️  Dropping all indexes except _id...');
    for (const idx of currentIndexes) {
      if (idx.name !== '_id_') {
        try {
          await coll.dropIndex(idx.name);
          console.log(`  ✅ Dropped: ${idx.name}`);
        } catch (e) {
          console.log(`  ⚠️  Could not drop ${idx.name}: ${e.message}`);
        }
      }
    }

    // Tạo indexes MỚI với partialFilterExpression
    console.log('\n🔧 Creating new indexes with partialFilterExpression...');
    
    // Index cho userId - chỉ áp dụng khi userId có type objectId
    await coll.createIndex(
      { userId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          userId: { $type: "objectId" }
        },
        name: 'userId_1_unique'
      }
    );
    console.log('  ✅ Created userId_1_unique');

    // Index cho sessionId - chỉ áp dụng khi sessionId có type string
    await coll.createIndex(
      { sessionId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          sessionId: { $type: "string" }
        },
        name: 'sessionId_1_unique'
      }
    );
    console.log('  ✅ Created sessionId_1_unique');

    // Liệt kê indexes sau khi tạo
    console.log('\n📋 New indexes:');
    const newIndexes = await coll.indexes();
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}`);
      if (idx.partialFilterExpression) {
        console.log(`    partialFilter:`, JSON.stringify(idx.partialFilterExpression));
      }
    });

    console.log('\n✅ Done!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixIndexes();
