# 🎯 HƯỚNG DẪN NHANH: LẤY OAUTH CREDENTIALS

## 📝 Google OAuth (5 phút)

### Bước 1: Vào Google Cloud Console
Truy cập: **https://console.cloud.google.com/**

### Bước 2: Tạo Project
- Click "Select a project" ở góc trên
- Click "NEW PROJECT"
- Đặt tên: "Tech Store" (hoặc tên bất kỳ)
- Click "CREATE"

### Bước 3: Tạo OAuth Credentials
1. Vào **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → Chọn **"OAuth client ID"**
3. Nếu chưa có OAuth consent screen:
   - Click "CONFIGURE CONSENT SCREEN"
   - Chọn "External" → CREATE
   - App name: "Tech Store"
   - User support email: (email của bạn)
   - Developer contact: (email của bạn)
   - SAVE AND CONTINUE → SAVE AND CONTINUE → BACK TO DASHBOARD
4. Quay lại Credentials → CREATE CREDENTIALS → OAuth client ID
5. Application type: **Web application**
6. Name: "Tech Store Web Client"
7. **Authorized redirect URIs** → ADD URI:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
8. Click **CREATE**
9. **COPY** Client ID và Client Secret

### Bước 4: Dán vào .env
Mở file `backend/.env` và dán:
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

---

## 📘 Facebook OAuth (5 phút)

### Bước 1: Vào Facebook Developers
Truy cập: **https://developers.facebook.com/**

### Bước 2: Tạo App
1. Click **"My Apps"** → **"Create App"**
2. Use case: **"Other"** → NEXT
3. App type: **"Consumer"** → NEXT
4. App name: "Tech Store"
5. App contact email: (email của bạn)
6. Click **"Create app"**
7. Xác thực mật khẩu Facebook nếu được yêu cầu

### Bước 3: Lấy App ID & App Secret
1. Vào **Settings** → **Basic**
2. **Copy App ID**
3. Click **Show** ở App secret → nhập mật khẩu → **Copy App secret**

### Bước 4: Thêm Facebook Login Product
1. Dashboard → **Add a product**
2. Tìm **Facebook Login** → Click **Set Up**
3. Chọn **Web** → Skip quickstart
4. Vào **Facebook Login** → **Settings** (sidebar bên trái)
5. **Valid OAuth Redirect URIs** → Thêm:
   ```
   http://localhost:5000/api/auth/facebook/callback
   ```
6. **Save Changes**

### Bước 5: Chuyển sang Mode Live (QUAN TRỌNG!)
1. Ở góc trên cùng, có toggle **"App Mode: Development"**
2. Click toggle → Chuyển sang **"Live"**
3. (Có thể cần điền thêm thông tin nếu Facebook yêu cầu)

### Bước 6: Dán vào .env
Mở file `backend/.env` và dán:
```env
FACEBOOK_APP_ID=your-app-id-here
FACEBOOK_APP_SECRET=your-app-secret-here
```

---

## 🚀 Chạy Server

Sau khi có credentials:

```bash
# Backend
cd backend
npm run dev

# Frontend (terminal mới)
cd frontend
npm start
```

Truy cập: **http://localhost:3000/login**

Click nút Google/Facebook để test! ✅

---

## ⚠️ Lưu ý quan trọng

### Nếu không có credentials ngay:
- Server vẫn chạy bình thường
- Login/Register thông thường vẫn hoạt động
- Chỉ nút Google/Facebook sẽ báo lỗi

### Nếu gặp lỗi redirect_uri_mismatch:
- Kiểm tra URL trong console phải khớp chính xác
- Google: `http://localhost:5000/api/auth/google/callback`
- Facebook: `http://localhost:5000/api/auth/facebook/callback`
- **KHÔNG có dấu `/` cuối cùng**

### Facebook App phải ở chế độ Live:
- Development mode chỉ cho phép test users
- Chuyển sang Live để mọi người dùng được

---

## 🎉 Xong!

Giờ bạn có thể:
- ✅ Đăng nhập bằng Google
- ✅ Đăng nhập bằng Facebook  
- ✅ Giỏ hàng được merge tự động
- ✅ UI hiện đại với màu brand chính thức

Chúc bạn thành công! 🚀
