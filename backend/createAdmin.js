const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Tạo admin mặc định
const createDefaultAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronics-store', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Đã kết nối MongoDB');

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ email: 'admin@demo.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin đã tồn tại!');
      mongoose.connection.close();
      return;
    }

    // Tạo admin mới
    const admin = new User({
      name: 'Administrator',
      email: 'admin@demo.com',
      password: 'admin123',
      phone: '0123456789',
      address: 'Hà Nội, Việt Nam',
      role: 'admin',
      isActive: true
    });

    await admin.save();
    console.log('✅ Đã tạo tài khoản admin!');
    console.log('📧 Email: admin@demo.com');
    console.log('🔑 Password: admin123');

    // Tạo user demo
    const demoUser = new User({
      name: 'Demo User',
      email: 'user@demo.com',
      password: 'user123',
      phone: '0987654321',
      address: 'TP.HCM, Việt Nam',
      role: 'customer',
      isActive: true
    });

    await demoUser.save();
    console.log('✅ Đã tạo tài khoản user demo!');
    console.log('📧 Email: user@demo.com');
    console.log('🔑 Password: user123');

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
};

createDefaultAdmin();
