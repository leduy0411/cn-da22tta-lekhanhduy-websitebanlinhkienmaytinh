# 🚀 NHANH - Deploy Lên Network (5 phút)

## Bước 1: Build Project
```powershell
./deploy.ps1
```
Hoặc thủ công:
```bash
cd frontend
npm run build
cd ../backend
```

## Bước 2: Lấy IP máy
```powershell
ipconfig
```
Tìm **IPv4 Address**, ví dụ: `192.168.1.100`

## Bước 3: Mở Firewall
```powershell
# Mở PowerShell as Administrator
New-NetFirewallRule -DisplayName "Tech Store" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

## Bước 4: Cập nhật Backend .env
File `backend/.env`:
```env
FRONTEND_URL=http://192.168.1.100:3000
NODE_ENV=production
```

## Bước 5: Chạy Server
```bash
cd backend
npm start
```

## Bước 6: Truy cập
Từ bất kỳ máy nào trong mạng LAN:
- Mở browser: `http://192.168.1.100:5000`

## ✅ Xong!

Nếu có lỗi, xem chi tiết trong **DEPLOYMENT_GUIDE.md**
