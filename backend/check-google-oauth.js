const fs = require('fs');
const path = require('path');

require('dotenv').config();

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║        HƯỚNG DẪN SỬA LỖI GOOGLE OAUTH "invalid_client"       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'http://localhost:5000/api/auth/google/callback';

console.log('📋 Thông tin hiện tại:');
console.log('   Client ID:', clientId);
console.log('   Redirect URI:', redirectUri);
console.log('\n');

console.log('🔧 CÁCH SỬA (5 phút):');
console.log('\n1. Mở link này trong trình duyệt:');
console.log('   https://console.cloud.google.com/apis/credentials\n');

console.log('2. Click vào "TechStore" trong danh sách OAuth 2.0 Client IDs\n');

console.log('3. Trong phần "Authorized redirect URIs":');
console.log('   - Nếu CHƯA CÓ, click "+ ADD URI"');
console.log('   - Paste CHÍNH XÁC dòng này:');
console.log('     http://localhost:5000/api/auth/google/callback');
console.log('   - Click SAVE\n');

console.log('4. Vào "OAuth consent screen" (menu bên trái):');
console.log('   - Nếu "Publishing status" là "Testing"');
console.log('   - Click "ADD USERS"');
console.log('   - Thêm email: leduytctv2019@gmail.com');
console.log('   - Click SAVE\n');

console.log('5. Đợi 1-2 phút để Google cập nhật');
console.log('   Sau đó thử đăng nhập lại\n');

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('⚠️  Lưu ý: Lỗi "invalid_client" CHỈ có thể sửa trên Google Cloud');
console.log('    Console. Không thể sửa từ code được.\n');

// Tạo file HTML để mở trực tiếp
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sửa lỗi Google OAuth</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .step {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .step h2 {
            color: #4285f4;
            margin-top: 0;
        }
        .code {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            margin: 10px 0;
        }
        .button {
            display: inline-block;
            background: #4285f4;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 0;
        }
        .button:hover {
            background: #357ae8;
        }
    </style>
</head>
<body>
    <h1>🔧 Hướng dẫn sửa lỗi Google OAuth</h1>
    
    <div class="step">
        <h2>Bước 1: Mở Google Cloud Console</h2>
        <a href="https://console.cloud.google.com/apis/credentials" class="button" target="_blank">
            Mở Google Cloud Console
        </a>
    </div>
    
    <div class="step">
        <h2>Bước 2: Click vào "TechStore"</h2>
        <p>Trong danh sách OAuth 2.0 Client IDs, tìm và click vào "TechStore"</p>
    </div>
    
    <div class="step">
        <h2>Bước 3: Thêm Redirect URI</h2>
        <p>Trong phần "Authorized redirect URIs":</p>
        <ul>
            <li>Click "+ ADD URI"</li>
            <li>Paste CHÍNH XÁC dòng này:</li>
        </ul>
        <div class="code">http://localhost:5000/api/auth/google/callback</div>
        <ul>
            <li>Click SAVE</li>
        </ul>
    </div>
    
    <div class="step">
        <h2>Bước 4: Thêm Test User</h2>
        <p>Click "OAuth consent screen" ở menu bên trái:</p>
        <ul>
            <li>Nếu "Publishing status" là "Testing"</li>
            <li>Click "ADD USERS"</li>
            <li>Thêm email: <strong>leduytctv2019@gmail.com</strong></li>
            <li>Click SAVE</li>
        </ul>
    </div>
    
    <div class="step">
        <h2>Bước 5: Đợi và thử lại</h2>
        <p>Đợi 1-2 phút để Google cập nhật cấu hình, sau đó thử đăng nhập lại.</p>
    </div>
    
    <div class="step" style="background: #fff3cd; border-left: 4px solid #ffc107;">
        <h2>⚠️ Quan trọng</h2>
        <p>Lỗi "invalid_client" CHỈ có thể sửa trên Google Cloud Console.</p>
        <p>Không thể sửa từ code được.</p>
    </div>
    
    <div class="step">
        <h2>📋 Thông tin cấu hình hiện tại:</h2>
        <p><strong>Client ID:</strong></p>
        <div class="code">${clientId}</div>
        <p><strong>Redirect URI:</strong></p>
        <div class="code">${redirectUri}</div>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'huong-dan-sua-loi-google-oauth.html'), htmlContent);
console.log('✅ Đã tạo file hướng dẫn: huong-dan-sua-loi-google-oauth.html');
console.log('   Mở file này trong trình duyệt để xem hướng dẫn chi tiết.\n');
