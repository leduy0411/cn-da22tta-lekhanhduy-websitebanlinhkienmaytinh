require('dotenv').config();

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          KIỂM TRA CẤU HÌNH GOOGLE OAUTH CHI TIẾT          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log('✅ Client ID:', clientId);
console.log('✅ Client Secret:', clientSecret ? `${clientSecret.substring(0, 20)}...` : 'THIẾU');
console.log('\n');

console.log('⚠️  LỖI "invalid_client" VẪN CÒN - Làm theo đúng các bước:\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('BƯỚC 1: Mở link này trong Chrome/Edge:');
console.log('👉 https://console.cloud.google.com/apis/credentials\n');

console.log('BƯỚC 2: Click vào "TechStore" trong danh sách OAuth 2.0 Client IDs\n');

console.log('BƯỚC 3: Kiểm tra "Authorized redirect URIs"');
console.log('Phải CÓ CHÍNH XÁC dòng này (copy paste nguyên xi):');
console.log('\n   📋 http://localhost:5000/api/auth/google/callback\n');
console.log('⚠️  LƯU Ý:');
console.log('   - KHÔNG có dấu cách thừa ở đầu/cuối');
console.log('   - KHÔNG có https:// (phải là http://)');
console.log('   - Port phải là 5000');
console.log('   - Phải có /api/auth/google/callback\n');

console.log('Nếu CHƯA CÓ:');
console.log('   1. Click "+ ADD URI"');
console.log('   2. Paste: http://localhost:5000/api/auth/google/callback');
console.log('   3. Click SAVE (góc dưới cùng)\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('BƯỚC 4: Kiểm tra OAuth consent screen');
console.log('   1. Click "OAuth consent screen" ở menu bên trái');
console.log('   2. Kiểm tra "Publishing status"');
console.log('   3. Nếu là "Testing":');
console.log('      - Scroll xuống phần "Test users"');
console.log('      - Click "+ ADD USERS"');
console.log('      - Thêm: leduytctv2019@gmail.com');
console.log('      - Click SAVE\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('BƯỚC 5: Đợi 2-3 phút để Google cập nhật');
console.log('   Sau đó thử đăng nhập lại\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔍 DEBUG: Nếu vẫn lỗi sau khi làm xong, chụp màn hình:');
console.log('   1. Trang chi tiết "TechStore" (phần Authorized redirect URIs)');
console.log('   2. Trang "OAuth consent screen" (phần Test users)\n');
console.log('   Gửi cho tôi để kiểm tra.\n');
