const axios = require('axios');

async function testAddToCart() {
  try {
    // Test 1: Thêm sản phẩm khi ĐÃ đăng nhập
    console.log('\n=== TEST 1: User đã đăng nhập ===');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@techstore.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Đăng nhập thành công');
    console.log('Token:', token.substring(0, 20) + '...');

    // Lấy danh sách sản phẩm
    const productsResponse = await axios.get('http://localhost:5000/api/products');
    const productId = productsResponse.data.products[0]._id;
    console.log('ProductId:', productId);

    // Thêm vào giỏ hàng
    console.log('\nThêm sản phẩm vào giỏ hàng...');
    const addResponse = await axios.post(
      'http://localhost:5000/api/cart/add',
      { productId, quantity: 1 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Thành công!');
    console.log('Cart:', addResponse.data.cart);

  } catch (error) {
    console.error('❌ LỖI:', error.response?.data || error.message);
    if (error.response?.data?.stack) {
      console.error('Stack:', error.response.data.stack);
    }
  }

  try {
    // Test 2: Thêm sản phẩm khi CHƯA đăng nhập
    console.log('\n=== TEST 2: Guest (chưa đăng nhập) ===');
    
    const productsResponse = await axios.get('http://localhost:5000/api/products');
    const productId = productsResponse.data.products[0]._id;
    console.log('ProductId:', productId);

    const addResponse = await axios.post(
      'http://localhost:5000/api/cart/add',
      { productId, quantity: 1 },
      { headers: { 'x-session-id': 'test-session-' + Date.now() } }
    );
    
    console.log('✅ Thành công!');
    console.log('Cart:', addResponse.data.cart);

  } catch (error) {
    console.error('❌ LỖI:', error.response?.data || error.message);
  }

  process.exit(0);
}

testAddToCart();
