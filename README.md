# Trang Web Bán Thiết Bị Điện Tử

Dự án website thương mại điện tử hoàn chỉnh sử dụng Node.js, React.js và MongoDB.

## 📋 Tính năng

### Khách hàng
- ✅ Đăng ký / Đăng nhập tài khoản
- ✅ Xem danh sách sản phẩm với phân trang
- ✅ Tìm kiếm sản phẩm theo từ khóa
- ✅ Lọc sản phẩm theo danh mục và thương hiệu
- ✅ Xem chi tiết sản phẩm với thông số kỹ thuật
- ✅ Thêm/xóa/cập nhật sản phẩm trong giỏ hàng
- ✅ Đặt hàng và thanh toán
- ✅ Xem thông tin đơn hàng sau khi đặt
- ✅ Quản lý thông tin cá nhân

### Admin
- ✅ Đăng nhập với quyền quản trị
- ✅ Dashboard với thống kê tổng quan
- ✅ Quản lý sản phẩm (Thêm/Sửa/Xóa)
- ✅ Quản lý đơn hàng và cập nhật trạng thái
- ✅ Quản lý người dùng (Khóa/Mở khóa, Phân quyền)
- ✅ Xem thống kê doanh thu, sản phẩm sắp hết hàng

## 🛠️ Công nghệ sử dụng

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM cho MongoDB

### Frontend
- **React.js** - UI library
- **React Router** - Routing
- **Axios** - HTTP client
- **React Icons** - Icons

## 📁 Cấu trúc thư mục

```
đồ án chuyên ngành/
├── backend/
│   ├── models/          # Database models
│   │   ├── Product.js
│   │   ├── Cart.js
│   │   └── Order.js
│   ├── routes/          # API routes
│   │   ├── products.js
│   │   ├── cart.js
│   │   └── orders.js
│   ├── server.js        # Entry point
│   ├── seed.js          # Dữ liệu mẫu
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/  # React components
    │   │   ├── Header.js
    │   │   └── ProductCard.js
    │   ├── pages/       # Page components
    │   │   ├── Home.js
    │   │   ├── ProductDetail.js
    │   │   ├── Cart.js
    │   │   ├── Checkout.js
    │   │   └── OrderSuccess.js
    │   ├── context/     # React Context
    │   │   └── CartContext.js
    │   ├── services/    # API services
    │   │   └── api.js
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 🚀 Hướng dẫn cài đặt

### Yêu cầu
- Node.js (v14 trở lên)
- MongoDB (đã cài đặt và chạy)
- npm hoặc yarn

### Bước 1: Cài đặt Backend

```powershell
# Di chuyển vào thư mục backend
cd "c:\đồ án chuyên ngành\backend"

# Cài đặt dependencies
npm install

# Tạo file .env từ file mẫu
Copy-Item .env.example .env

# Chỉnh sửa file .env với thông tin của bạn
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/electronics-store
# JWT_SECRET=your_secret_key
```

### Bước 2: Khởi động MongoDB

Đảm bảo MongoDB đang chạy trên máy của bạn:

```powershell
# Khởi động MongoDB (nếu chưa chạy)
mongod
```

### Bước 3: Thêm dữ liệu mẫu và tạo Admin

```powershell
# Vẫn ở thư mục backend

# Thêm sản phẩm mẫu
node seed.js

# Tạo tài khoản admin
node createAdmin.js
```

**Tài khoản demo đã tạo:**
- **Admin**: admin@demo.com / admin123
- **User**: user@demo.com / user123

### Bước 4: Chạy Backend Server

```powershell
# Development mode với nodemon
npm run dev

# hoặc Production mode
npm start
```

Backend sẽ chạy tại: `http://localhost:5000`

### Bước 5: Cài đặt Frontend

Mở terminal mới:

```powershell
# Di chuyển vào thư mục frontend
cd "c:\đồ án chuyên ngành\frontend"

# Cài đặt dependencies
npm install
```

### Bước 6: Chạy Frontend

```powershell
# Vẫn ở thư mục frontend
npm start
```

Frontend sẽ tự động mở tại: `http://localhost:3000`

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại (cần token)
- `PUT /api/auth/profile` - Cập nhật thông tin cá nhân (cần token)
- `PUT /api/auth/change-password` - Đổi mật khẩu (cần token)
- `POST /api/auth/logout` - Đăng xuất (cần token)

### Products
- `GET /api/products` - Lấy danh sách sản phẩm
- `GET /api/products/search?q=keyword` - Tìm kiếm sản phẩm
- `GET /api/products/:id` - Lấy chi tiết sản phẩm
- `POST /api/products` - Tạo sản phẩm mới
- `PUT /api/products/:id` - Cập nhật sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm
- `GET /api/products/categories/list` - Lấy danh sách danh mục
- `GET /api/products/brands/list` - Lấy danh sách thương hiệu

### Cart
- `GET /api/cart` - Lấy giỏ hàng
- `POST /api/cart/add` - Thêm sản phẩm vào giỏ
- `PUT /api/cart/update` - Cập nhật số lượng
- `DELETE /api/cart/remove/:productId` - Xóa sản phẩm
- `DELETE /api/cart/clear` - Xóa toàn bộ giỏ hàng

### Orders
- `POST /api/orders` - Tạo đơn hàng mới
- `GET /api/orders` - Lấy danh sách đơn hàng
- `GET /api/orders/:id` - Lấy chi tiết đơn hàng
- `GET /api/orders/tracking/:orderNumber` - Tra cứu đơn hàng
- `PUT /api/orders/:id/status` - Cập nhật trạng thái

### Admin (Cần quyền Admin)
- `GET /api/admin/stats` - Lấy thống kê tổng quan
- `GET /api/admin/users` - Quản lý users
- `PUT /api/admin/users/:id/role` - Cập nhật role
- `PUT /api/admin/users/:id/toggle-status` - Khóa/Mở khóa user
- `DELETE /api/admin/users/:id` - Xóa user
- `GET /api/admin/orders` - Quản lý đơn hàng

## 💡 Tính năng nổi bật

1. **Hệ thống Authentication & Authorization**: JWT token, phân quyền Admin/Customer
2. **Quản lý giỏ hàng thông minh**: Sử dụng session ID để lưu giỏ hàng
3. **Admin Dashboard**: Thống kê, quản lý sản phẩm, đơn hàng, người dùng
4. **Tìm kiếm nâng cao**: Hỗ trợ tìm kiếm theo tên, mô tả và thương hiệu
5. **Lọc sản phẩm linh hoạt**: Lọc theo danh mục, thương hiệu, khoảng giá
6. **Phân trang**: Tối ưu hiển thị với phân trang
7. **Quản lý tồn kho**: Tự động cập nhật số lượng khi đặt hàng
8. **Responsive Design**: Giao diện thân thiện trên mọi thiết bị
9. **Real-time Updates**: Context API để đồng bộ dữ liệu
10. **Protected Routes**: Bảo vệ các trang cần xác thực

## 🎨 Giao diện

**Khách hàng:**
- **Trang chủ**: Hiển thị danh sách sản phẩm với bộ lọc
- **Đăng ký/Đăng nhập**: Form xác thực người dùng
- **Chi tiết sản phẩm**: Thông tin đầy đủ, thông số kỹ thuật
- **Giỏ hàng**: Quản lý sản phẩm, tính tổng tiền
- **Thanh toán**: Form nhập thông tin giao hàng
- **Xác nhận**: Thông tin đơn hàng sau khi đặt thành công

**Admin:**
- **Dashboard**: Tổng quan thống kê hệ thống
- **Quản lý sản phẩm**: Thêm/sửa/xóa sản phẩm
- **Quản lý đơn hàng**: Xem và cập nhật trạng thái đơn hàng
- **Quản lý người dùng**: Phân quyền, khóa/mở tài khoản

## 🔒 Bảo mật

- Validation dữ liệu đầu vào
- Xử lý lỗi toàn diện
- CORS configuration
- Environment variables cho thông tin nhạy cảm

## 📝 Ghi chú

- Dự án sử dụng dữ liệu mẫu về các sản phẩm điện tử phổ biến
- Hình ảnh sản phẩm được link từ các nguồn công khai
- Có thể tùy chỉnh thêm tính năng đăng nhập, quản trị viên, v.v.

## 🐛 Troubleshooting

### MongoDB không kết nối được
- Kiểm tra MongoDB đã chạy chưa: `mongod`
- Kiểm tra MONGODB_URI trong file .env

### Port đã được sử dụng
- Thay đổi PORT trong file .env của backend
- Hoặc dừng process đang sử dụng port đó

### CORS errors
- Đảm bảo backend đang chạy
- Kiểm tra proxy trong frontend/package.json

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Node.js và npm đã cài đặt đúng phiên bản
2. MongoDB đang chạy
3. Đã cài đặt tất cả dependencies (npm install)
4. File .env đã được cấu hình đúng

## 📄 License

MIT License - Tự do sử dụng cho mục đích học tập và thương mại.

---

**Chúc bạn thành công với dự án! 🎉**
