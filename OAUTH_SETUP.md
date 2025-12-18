# Hướng dẫn cấu hình OAuth Authentication

## 🚀 Setup hoàn thành

Hệ thống OAuth đã được tích hợp hoàn chỉnh với Google và Facebook login. Để sử dụng, bạn cần:

---

## 📋 Các bước cấu hình

### 1️⃣ **Google OAuth Setup**

#### Bước 1: Tạo Google OAuth App
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project có sẵn
3. Vào **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Chọn **Application type**: Web application
6. Thêm **Authorized redirect URIs**:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
7. Lưu lại **Client ID** và **Client Secret**

#### Bước 2: Cập nhật `.env`
Thêm vào file `backend/.env`:
```env
GOOGLE_CLIENT_ID=your-actual-google-client-id
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret
```

---

### 2️⃣ **Facebook OAuth Setup**

#### Bước 1: Tạo Facebook App
1. Truy cập [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Chọn **Consumer** → **Next**
4. Điền tên app → **Create App**
5. Vào **Settings** → **Basic**
6. Lưu lại **App ID** và **App Secret**

#### Bước 2: Cấu hình Facebook Login
1. Vào **Products** → Add **Facebook Login**
2. Chọn **Settings** (trong Facebook Login)
3. Thêm **Valid OAuth Redirect URIs**:
   ```
   http://localhost:5000/api/auth/facebook/callback
   ```
4. Bật tùy chọn **Use Strict Mode for Redirect URIs**

#### Bước 3: Cập nhật `.env`
Thêm vào file `backend/.env`:
```env
FACEBOOK_APP_ID=your-actual-facebook-app-id
FACEBOOK_APP_SECRET=your-actual-facebook-app-secret
```

---

### 3️⃣ **Backend Configuration**

File `.env` hoàn chỉnh trong `backend/` folder:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/thietbidientu

# JWT
JWT_SECRET=your_very_secret_jwt_key_here

# URLs
FRONTEND_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Port
PORT=5000
```

---

## 🔄 Luồng hoạt động OAuth

### **Google Login Flow:**
```
1. User clicks "Đăng nhập với Google"
   → Frontend: http://localhost:5000/api/auth/google
   
2. Google authentication page
   → User logs in with Google account
   
3. Google redirects to callback
   → Backend: http://localhost:5000/api/auth/google/callback
   
4. Backend creates/updates user, generates JWT
   → Redirects to: http://localhost:3000/auth/callback?token=xxx&user=yyy
   
5. Frontend AuthCallback page
   → Saves token, updates context
   → Redirects to home or admin dashboard
```

### **Facebook Login Flow:**
Tương tự nhưng thay `google` bằng `facebook`

---

## 📁 Cấu trúc code đã thêm

### Backend:
- ✅ `backend/config/passport.js` - Passport strategies cho Google & Facebook
- ✅ `backend/routes/auth.js` - OAuth routes & callbacks (đã cập nhật)
- ✅ `backend/models/User.js` - Support OAuth fields (googleId, facebookId, authProvider)
- ✅ `backend/server.js` - Initialize Passport middleware

### Frontend:
- ✅ `frontend/src/pages/Login.js` - Social login buttons
- ✅ `frontend/src/pages/Login.css` - Styled buttons với brand colors
- ✅ `frontend/src/pages/AuthCallback.js` - OAuth callback handler
- ✅ `frontend/src/pages/AuthCallback.css` - Loading spinner UI
- ✅ `frontend/src/App.js` - Added `/auth/callback` route

---

## 🧪 Testing OAuth

### **Kiểm tra Google Login:**
1. Đảm bảo backend đang chạy: `cd backend && npm run dev`
2. Đảm bảo frontend đang chạy: `cd frontend && npm start`
3. Vào http://localhost:3000/login
4. Click nút "Đăng nhập với Google" (màu đỏ)
5. Đăng nhập Google account
6. Kiểm tra redirect về homepage với user đã login

### **Kiểm tra Facebook Login:**
Tương tự nhưng click nút "Đăng nhập với Facebook" (màu xanh)

---

## 🔐 Security Notes

1. **HTTPS trong Production:**
   - Google & Facebook yêu cầu HTTPS cho production URLs
   - Cập nhật redirect URIs với domain thật

2. **Secret Keys:**
   - Không commit file `.env` vào Git
   - Sử dụng secret keys mạnh
   - Rotate keys định kỳ

3. **Email Verification:**
   - Google luôn cung cấp email verified
   - Facebook có thể không cung cấp email
   - Code đã xử lý trường hợp Facebook không có email

---

## 🎨 UI Features

- ✅ Màu sắc công nghệ: Dark blue gradient background
- ✅ Google button: Official red (#DB4437)
- ✅ Facebook button: Official blue (#1877F2)
- ✅ Hover effects với shadow animation
- ✅ Loading spinner khi processing OAuth callback
- ✅ Error handling với redirects

---

## 🐛 Troubleshooting

### Lỗi "redirect_uri_mismatch":
- Kiểm tra URL trong Google/Facebook Console khớp chính xác với callback URL
- Đảm bảo có `/api/auth/google/callback` hoặc `/api/auth/facebook/callback`

### Lỗi "App Not Setup":
- Facebook: App phải ở chế độ Live (không phải Development)
- Hoặc thêm test users trong Facebook App settings

### Token không được lưu:
- Kiểm tra console để xem errors
- Verify `AuthCallback.js` đang parse token đúng cách

---

## 📦 Dependencies đã cài

```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-facebook": "^3.0.0"
}
```

---

## ✅ Checklist

- [x] Install dependencies (passport, strategies)
- [x] Create passport config file
- [x] Update User model với OAuth fields
- [x] Add OAuth routes to auth.js
- [x] Initialize passport in server.js
- [x] Create AuthCallback component
- [x] Add callback route to App.js
- [x] Style social login buttons
- [x] Create .env.example file
- [x] Write documentation

---

## 🎯 Next Steps

1. **Lấy Google & Facebook credentials** từ consoles
2. **Cập nhật file `.env`** với credentials thật
3. **Restart backend server** để load env variables
4. **Test OAuth flow** với cả Google và Facebook
5. **(Optional) Deploy lên production** với HTTPS

---

Đã xong! 🎉 OAuth authentication giờ hoạt động hoàn chỉnh!
