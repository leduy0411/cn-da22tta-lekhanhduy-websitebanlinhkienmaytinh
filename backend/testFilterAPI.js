const http = require('http');

async function testFilterAPI() {
  try {
    console.log('🧪 Testing Filter API...\n');
    
    // Test 1: Lấy tất cả filters
    console.log('📡 Test 1: GET /api/filters (no category)');
    await makeRequest('/api/filters');
    console.log('');
    
    // Test 2: Lấy filters cho "PC build sẵn"
    console.log('📡 Test 2: GET /api/filters?category=PC build sẵn');
    await makeRequest('/api/filters?category=' + encodeURIComponent('PC build sẵn'));
    console.log('');
    
    // Test 3: Thử với các variant khác của tên category
    console.log('📡 Test 3: GET /api/filters?category=pc build sẵn (lowercase)');
    await makeRequest('/api/filters?category=' + encodeURIComponent('pc build sẵn'));
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Đảm bảo backend server đang chạy trên port 5000!');
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('Response:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log('Raw response:', data);
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

testFilterAPI();
