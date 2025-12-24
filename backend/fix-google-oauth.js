require('dotenv').config();

console.log('\n🔍 KIỂM TRA NGUYÊN NHÂN LỖI "invalid_client"\n');
console.log('═══════════════════════════════════════════════════\n');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('✅ Client ID đang dùng:', clientId);
console.log('✅ Client Secret:', clientSecret ? `${clientSecret.substring(0, 25)}...` : 'THIẾU');
console.log('\n═══════════════════════════════════════════════════\n');

console.log('⚠️  LỖI VẪN CÒN - Có 3 NGUYÊN NHÂN có thể:\n');

console.log('❌ NGUYÊN NHÂN 1: CHƯA CLICK NÚT SAVE');
console.log('   → Sau khi thêm redirect URI trong Google Console');
console.log('   → Phải SCROLL XUỐNG DƯỚI CÙNG');
console.log('   → Click nút SAVE màu xanh');
console.log('   → Đợi thấy thông báo "Client ID updated"\n');

console.log('❌ NGUYÊN NHÂN 2: REDIRECT URI KHÔNG CHÍNH XÁC');
console.log('   → Vào: https://console.cloud.google.com/apis/credentials');
console.log('   → Click "TechStore"');
console.log('   → Kiểm tra "Authorized redirect URIs"');
console.log('   → Phải có CHÍNH XÁC:');
console.log('      http://localhost:5000/api/auth/google/callback');
console.log('   → KHÔNG được có dấu cách, khoảng trắng ở đầu/cuối\n');

console.log('❌ NGUYÊN NHÂN 3: GOOGLE CHƯA CẬP NHẬT');
console.log('   → Đợi 5-10 phút sau khi SAVE');
console.log('   → Xóa cache trình duyệt (Ctrl+Shift+Delete)');
console.log('   → Hoặc dùng chế độ ẩn danh\n');

console.log('═══════════════════════════════════════════════════\n');

console.log('🔧 GIẢI PHÁP CHẮC CHẮN - TẠO CLIENT ID MỚI:\n');
console.log('1. Vào: https://console.cloud.google.com/apis/credentials');
console.log('2. XÓA "TechStore" cũ (click biểu tượng thùng rác)');
console.log('3. Click "+ CREATE CREDENTIALS" → "OAuth client ID"');
console.log('4. Application type: Web application');
console.log('5. Name: TechStore2');
console.log('6. Authorized JavaScript origins:');
console.log('   - http://localhost:3000');
console.log('   - http://localhost:5000');
console.log('7. Authorized redirect URIs:');
console.log('   - http://localhost:5000/api/auth/google/callback');
console.log('8. Click CREATE');
console.log('9. Copy Client ID và Client Secret mới');
console.log('10. Gửi cho tôi để cập nhật vào .env\n');

console.log('═══════════════════════════════════════════════════\n');
