# 🚀 HƯỚNG DẪN DEPLOY LÊN NETWORK/PRODUCTION

## 📋 Checklist Trước Khi Deploy

### ✅ Backend Setup

#### 1. Environment Variables (.env)
Đảm bảo file `backend/.env` có đầy đủ:
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# JWT Secret (PHẢI THAY ĐỔI!)
JWT_SECRET=your_very_strong_secret_key_here_change_in_production

# URLs
FRONTEND_URL=https://your-frontend-domain.com
PORT=5000

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Node Environment
NODE_ENV=production
```

#### 2. Kiểm Tra Dependencies
```bash
cd backend
npm install --production
```

#### 3. Test Backend
```bash
npm start
# Hoặc
npm run dev
```

---

### ✅ Frontend Setup

#### 1. Environment Variables (.env)
Tạo file `frontend/.env.production`:
```env
# Thay bằng domain/IP của backend server
REACT_APP_API_URL=https://your-backend-domain.com/api
# Hoặc IP
# REACT_APP_API_URL=http://192.168.1.100:5000/api
```

#### 2. Build Production
```bash
cd frontend
npm run build
```
→ Tạo folder `build/` chứa static files

---

## 🌐 Deploy Options

### Option 1: Deploy Trên Cùng Server (Recommended)

#### Backend serves Frontend
```javascript
// Thêm vào backend/server.js (sau các routes)
if (process.env.NODE_ENV === 'production') {
  // Serve frontend build
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}
```

#### Chạy:
```bash
# Build frontend
cd frontend
npm run build

# Chạy backend (serve cả frontend)
cd ../backend
npm start
```

Truy cập: `http://localhost:5000` hoặc `http://your-ip:5000`

---

### Option 2: Deploy Riêng Backend & Frontend

#### A. Backend (Port 5000)
```bash
cd backend
npm start
```

#### B. Frontend (Port 3000 hoặc custom)
```bash
cd frontend
npm start
# Hoặc dùng serve package:
npm install -g serve
serve -s build -p 3000
```

#### C. Cập nhật CORS trong backend
File `backend/.env`:
```env
FRONTEND_URL=http://your-frontend-ip:3000
```

---

## 📁 Static Files (Images/Uploads)

### Đảm bảo folder structure:
```
backend/
├── uploads/           # User uploaded files
├── public/            # Static images (banners, icons)
│   ├── img/
│   │   ├── img-banner-dai/
│   │   └── img-danhmucsanpham/
```

### Copy images từ frontend sang backend:
```bash
# Copy public images
xcopy "frontend\public\img" "backend\public\img" /E /I /Y
```

### Access URLs:
- Uploads: `http://localhost:5000/uploads/filename.jpg`
- Public: `http://localhost:5000/public/img/banner.jpg`

---

## 🔧 Deploy Lên Network (LAN)

### 1. Lấy IP của máy:
```bash
ipconfig
# Tìm IPv4 Address, ví dụ: 192.168.1.100
```

### 2. Cập nhật Frontend .env:
```env
REACT_APP_API_URL=http://192.168.1.100:5000/api
```

### 3. Rebuild Frontend:
```bash
cd frontend
npm run build
```

### 4. Cập nhật Backend .env:
```env
FRONTEND_URL=http://192.168.1.100:3000
```

### 5. Mở Firewall (Windows):
```powershell
# Cho phép port 5000 (backend)
New-NetFirewallRule -DisplayName "Tech Store Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow

# Cho phép port 3000 (frontend nếu deploy riêng)
New-NetFirewallRule -DisplayName "Tech Store Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 6. Khởi động servers:
```bash
# Backend
cd backend
npm start

# Frontend (nếu deploy riêng)
cd frontend
npm start
```

### 7. Truy cập từ máy khác:
- Frontend: `http://192.168.1.100:3000`
- Backend: `http://192.168.1.100:5000`
- Hoặc chỉ cần: `http://192.168.1.100:5000` (nếu backend serve frontend)

---

## 🔐 Security Checklist

### Production:
- ✅ Thay đổi `JWT_SECRET` thành chuỗi ngẫu nhiên mạnh
- ✅ Sử dụng HTTPS (nếu có SSL certificate)
- ✅ Cập nhật CORS origins chính xác
- ✅ Không commit file `.env` vào Git
- ✅ Enable rate limiting (optional):
```javascript
// backend/server.js
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);
```

---

## 🐛 Troubleshooting

### Lỗi: Cannot connect to backend
- ✅ Kiểm tra backend đang chạy: `http://your-ip:5000`
- ✅ Kiểm tra CORS settings
- ✅ Kiểm tra firewall đã mở ports

### Lỗi: Images không hiển thị
- ✅ Copy images từ `frontend/public` sang `backend/public`
- ✅ Kiểm tra static middleware trong server.js
- ✅ Kiểm tra paths trong code: `/public/img/...`

### Lỗi: OAuth không hoạt động
- ✅ Cập nhật callback URLs trong Google/Facebook console
- ✅ Thay `localhost` bằng domain/IP thật
- ✅ Kiểm tra `FRONTEND_URL` trong .env

---

## 📦 Production Build Script

Tạo file `deploy.ps1`:
```powershell
Write-Host "Building Tech Store for Production..." -ForegroundColor Cyan

# Build Frontend
Write-Host "`nBuilding Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build

# Copy to backend
Write-Host "`nCopying build to backend..." -ForegroundColor Yellow
if (Test-Path "../backend/build") {
    Remove-Item "../backend/build" -Recurse -Force
}
Copy-Item -Path "build" -Destination "../backend/build" -Recurse

# Copy images
Write-Host "`nCopying images..." -ForegroundColor Yellow
if (-not (Test-Path "../backend/public")) {
    New-Item -Path "../backend/public" -ItemType Directory
}
Copy-Item -Path "public/img" -Destination "../backend/public/img" -Recurse -Force

Set-Location ..
Write-Host "`nBuild completed! Run 'cd backend && npm start'" -ForegroundColor Green
```

Chạy: `./deploy.ps1`

---

## ✅ Final Checklist

- [ ] Frontend `.env` có `REACT_APP_API_URL`
- [ ] Backend `.env` có đầy đủ configs
- [ ] `npm install` cả backend và frontend
- [ ] Frontend đã build: `npm run build`
- [ ] Images đã copy sang backend
- [ ] Firewall đã mở ports
- [ ] Đã test từ máy khác trong LAN
- [ ] CORS đã config đúng domain/IP
- [ ] Database connection string đúng

---

🎉 **Deploy thành công!** Mọi người trong mạng LAN giờ có thể truy cập website của bạn!
