# 🔧 Hướng Dẫn Sửa Lỗi Bộ Lọc Giá

## ❌ Vấn Đề
Khi chọn bộ lọc giá (ví dụ: "Dưới 15 triệu"), sản phẩm hiển thị không đúng với khoảng giá đã chọn.

## ✅ Đã Sửa

### 1. Thống nhất Database Name
**Vấn đề:** Các file seed và server đang dùng các database khác nhau (`laptop-shop`, `tech-store`, `thietbidientu`)

**Giải pháp:** Đã thống nhất tất cả file sử dụng database `thietbidientu`

Các file đã sửa:
- `seedComplete.js`
- `testPriceFilter.js`
- `checkProducts.js`

### 2. Thêm Logging vào Backend
**Mục đích:** Giúp debug và theo dõi các request filter

**Thay đổi trong `backend/routes/products.js`:**
```javascript
// Log khi apply price filter
console.log(`💰 Price filter applied: ${minPrice} - ${maxPrice}`);

// Log filter query
console.log('🔍 Filter query:', JSON.stringify(filter));

// Log kết quả
console.log(`✅ Found ${total} products matching filter`);
console.log(`📦 Returning ${products.length} products`);
```

### 3. Tạo Trang Test
**File:** `frontend/public/test-price-filter.html`

Trang test này cho phép:
- Test các khoảng giá khác nhau
- Kiểm tra kết quả trả về từ API
- Xem URL request và response
- Test tất cả các trường hợp trong một lần click

## 🧪 Cách Test

### Bước 1: Seed Dữ Liệu
```powershell
cd "c:\doanchuyennganh\đồ án chuyên ngành\đồ án chuyên ngành\backend"
node seedComplete.js
```

Kết quả mong đợi:
- 15 sản phẩm
- 10 laptop trong đó:
  - 6 laptop dưới 15 triệu
  - 1 laptop từ 15-20 triệu
  - 3 laptop trên 20 triệu

### Bước 2: Setup Bộ Lọc
```powershell
node setupLaptopFilters.js
```

Tạo bộ lọc giá cho category Laptop:
- Dưới 15 triệu: `0-15000000`
- Từ 15 - 20 triệu: `15000000-20000000`
- Trên 20 triệu: `20000000-999999999`

### Bước 3: Khởi Động Server
```powershell
node server.js
```

Server chạy tại: `http://localhost:5000`

### Bước 4: Khởi Động Frontend (Terminal riêng)
```powershell
cd "c:\doanchuyennganh\đồ án chuyên ngành\đồ án chuyên ngành\frontend"
npm start
```

Frontend chạy tại: `http://localhost:3000`

### Bước 5: Test Bộ Lọc

#### Option 1: Dùng Trang Test
Mở: `http://localhost:3000/test-price-filter.html`

Click nút "🔬 Test Tất Cả" để xem kết quả ngay lập tức.

#### Option 2: Test Trực Tiếp API
```powershell
# Test 1: Laptop - Dưới 15 triệu
curl "http://localhost:5000/api/products?category=Laptop&priceRange=0-15000000"

# Test 2: Laptop - Từ 15-20 triệu
curl "http://localhost:5000/api/products?category=Laptop&priceRange=15000000-20000000"

# Test 3: Laptop - Trên 20 triệu
curl "http://localhost:5000/api/products?category=Laptop&priceRange=20000000-999999999"
```

#### Option 3: Test Trên UI Chính
1. Mở `http://localhost:3000`
2. Hover vào menu "Laptop"
3. Click vào bộ lọc giá (ví dụ: "Dưới 15 triệu")
4. Kiểm tra các sản phẩm hiển thị

### Bước 6: Xem Log
Mở terminal đang chạy `node server.js` để xem log:

```
🔍 Filter query: {"price":{"$gte":0,"$lte":15000000},"category":"Laptop"}
✅ Found 6 products matching filter
📦 Returning 6 products (page 1/1)
  - Laptop Dell Inspiron 15 3520: 9,990,000 (Laptop)
  - Laptop Lenovo IdeaPad Slim 3: 10,990,000 (Laptop)
  - Laptop Acer Aspire 5 A515: 11,990,000 (Laptop)
```

## 📊 Kết Quả Mong Đợi

### Test: Laptop - Dưới 15 triệu
**Kết quả:** 6 sản phẩm
```
✅ Laptop Dell Inspiron 15 3520: 9.990.000 VNĐ
✅ Laptop Lenovo IdeaPad Slim 3: 10.990.000 VNĐ
✅ Laptop Acer Aspire 5 A515: 11.990.000 VNĐ
✅ Laptop HP Pavilion 15: 12.990.000 VNĐ
✅ Laptop Asus Vivobook 15 X1504VA: 13.490.000 VNĐ
✅ Laptop MSI Modern 14 C13M: 14.990.000 VNĐ
```

### Test: Laptop - Từ 15-20 triệu
**Kết quả:** 1 sản phẩm
```
✅ Laptop MSI GF63 Thin: 16.990.000 VNĐ
```

### Test: Laptop - Trên 20 triệu
**Kết quả:** 3 sản phẩm
```
✅ Laptop Asus TUF Gaming F15: 25.990.000 VNĐ
✅ Dell XPS 15: 35.990.000 VNĐ
✅ MacBook Pro 14 M3: 42.990.000 VNĐ
```

## ❌ Nếu Vẫn Gặp Lỗi

### Vấn Đề 1: Hiển thị sản phẩm không đúng category
**Nguyên nhân:** Frontend không gửi `category` khi filter giá

**Kiểm tra:** Xem log trong browser console (F12)
```javascript
console.log('🔍 Fetching with filters:', filters);
```

**Giải pháp:** Đảm bảo URL có cả `category` và `priceRange`:
```
/?category=Laptop&priceRange=0-15000000
```

### Vấn Đề 2: API trả về sản phẩm sai
**Kiểm tra:** Xem log trên server

Nếu thấy query không có `category`:
```json
{"price":{"$gte":0,"$lte":15000000}}  // ❌ Thiếu category
```

Thì vấn đề ở frontend - không gửi category trong request.

### Vấn Đề 3: Dữ liệu bị sai
**Giải pháp:** Seed lại database
```powershell
cd backend
node seedComplete.js
node setupLaptopFilters.js
```

## 🔍 Debug Tips

### 1. Kiểm tra dữ liệu trong database
```powershell
cd backend
node listAllProducts.js
```

### 2. Test MongoDB query trực tiếp
```powershell
cd backend
node testFullFilter.js
```

### 3. Kiểm tra log frontend
Mở browser console (F12) và xem:
- Request URL
- Response data
- Filter state

### 4. Kiểm tra log backend
Xem terminal đang chạy `node server.js`:
- Filter query applied
- Products found
- Products returned

## 📝 Ghi Chú

- Bộ lọc giá hoạt động ĐÚNG trong MongoDB
- Backend xử lý filter ĐÚNG
- Vấn đề thường xảy ra ở:
  1. Frontend không gửi đúng parameters
  2. Cache trong browser
  3. Dữ liệu trong database không đúng

## 🎯 Checklist

- [ ] Database đã được seed đúng (15 sản phẩm)
- [ ] Filters đã được setup (THƯƠNG HIỆU, GIÁ BÁN)
- [ ] Server đang chạy và log ra console
- [ ] Frontend đang chạy
- [ ] Test trang test-price-filter.html
- [ ] Kiểm tra log cả frontend và backend
- [ ] Verify URL có đầy đủ parameters

## 📞 Nếu Cần Hỗ Trợ

1. Chụp ảnh màn hình kết quả hiển thị
2. Copy log từ server console
3. Copy log từ browser console (F12)
4. Copy URL hiện tại

---

**Tạo bởi:** GitHub Copilot
**Ngày:** 26/11/2025
