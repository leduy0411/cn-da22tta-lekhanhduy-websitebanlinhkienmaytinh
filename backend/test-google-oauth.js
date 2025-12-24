require('dotenv').config();
const https = require('https');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'http://localhost:5000/api/auth/google/callback';

console.log('\n========== KIỂM TRA GOOGLE OAUTH ==========\n');
console.log('Client ID:', clientId);
console.log('Client Secret:', clientSecret ? `${clientSecret.substring(0, 15)}...` : 'KHÔNG CÓ');
console.log('Redirect URI:', redirectUri);
console.log('\n===========================================\n');

// Tạo authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(clientId)}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_type=code&` +
  `scope=profile email&` +
  `access_type=offline`;

console.log('Authorization URL:');
console.log(authUrl);
console.log('\n===========================================\n');
console.log('Mở URL trên vào trình duyệt để test.');
console.log('Nếu bị lỗi "invalid_client", nghĩa là:');
console.log('1. Client ID không đúng');
console.log('2. Redirect URI chưa được thêm vào Google Console');
console.log('3. OAuth consent screen chưa được cấu hình');
