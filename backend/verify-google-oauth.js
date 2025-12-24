/**
 * SCRIPT KIỂM TRA VÀ DEBUG GOOGLE OAUTH
 * Chạy: node verify-google-oauth.js
 */

require('dotenv').config();
const https = require('https');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'http://localhost:5000/api/auth/google/callback';

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║           KIỂM TRA TOÀN BỘ CẤU HÌNH GOOGLE OAUTH                ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('\n');

console.log('📋 THÔNG TIN ĐANG SỬ DỤNG:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Client ID:     ', clientId);
console.log('Client Secret: ', clientSecret);
console.log('Redirect URI:  ', redirectUri);
console.log('\n');

// Kiểm tra Client ID format
if (!clientId || clientId === 'your-google-client-id') {
  console.log('❌ LỖI: Client ID không hợp lệ hoặc chưa được cấu hình!');
  process.exit(1);
}

if (!clientId.endsWith('.apps.googleusercontent.com')) {
  console.log('❌ LỖI: Client ID không đúng format!');
  console.log('   Phải kết thúc bằng: .apps.googleusercontent.com');
  process.exit(1);
}

console.log('✅ Client ID format đúng');

if (!clientSecret || clientSecret === 'your-google-client-secret') {
  console.log('❌ LỖI: Client Secret không hợp lệ!');
  process.exit(1);
}

if (!clientSecret.startsWith('GOCSPX-')) {
  console.log('⚠️ CẢNH BÁO: Client Secret có thể không đúng format!');
  console.log('   Thường bắt đầu bằng: GOCSPX-');
}

console.log('✅ Client Secret đã được cấu hình');
console.log('\n');

// Tạo URL xác thực
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(clientId)}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('profile email')}&` +
  `access_type=offline`;

console.log('🔗 URL XÁC THỰC (copy vào trình duyệt để test):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(authUrl);
console.log('\n');

console.log('📝 HƯỚNG DẪN SỬA LỖI "invalid_client":');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Lỗi này xảy ra khi Google không nhận ra Client ID.');
console.log('Có 2 nguyên nhân chính:');
console.log('');
console.log('1. CLIENT ID KHÔNG TỒN TẠI HOẶC ĐÃ BỊ XÓA');
console.log('   → Vào: https://console.cloud.google.com/apis/credentials');
console.log('   → Kiểm tra xem có OAuth Client ID với số này không:');
console.log('     ' + clientId.split('-')[0] + '-' + clientId.split('-')[1].substring(0, 10) + '...');
console.log('');
console.log('2. SAI PROJECT TRONG GOOGLE CLOUD CONSOLE');
console.log('   → Kiểm tra thanh trên cùng của Google Cloud Console');
console.log('   → Đảm bảo đang ở đúng project (dangnhap hoặc tên khác)');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('🔧 GIẢI PHÁP ĐẢM BẢO 100% THÀNH CÔNG:');
console.log('');
console.log('1. Vào: https://console.cloud.google.com/apis/credentials');
console.log('');
console.log('2. Kiểm tra project ở góc trên bên trái (cạnh logo Google Cloud)');
console.log('   Nếu không phải project bạn đang dùng, click để chọn đúng project');
console.log('');
console.log('3. Trong phần "OAuth 2.0 Client IDs", tìm ID có số:');
console.log('   j4gdc8rhibb86mimemckb6le68f3egks');
console.log('');
console.log('4. Nếu KHÔNG TÌM THẤY → Tạo mới OAuth Client ID:');
console.log('   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"');
console.log('   - Application type: Web application');
console.log('   - Authorized redirect URIs: http://localhost:5000/api/auth/google/callback');
console.log('   - Click CREATE');
console.log('   - Copy Client ID và Client Secret mới');
console.log('');
console.log('5. Cập nhật file .env với thông tin mới');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
