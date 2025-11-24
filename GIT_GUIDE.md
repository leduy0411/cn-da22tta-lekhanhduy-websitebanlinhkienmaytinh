# Hướng dẫn commit dự án lên GitHub

## Bước 1: Cài đặt Git

1. Download Git tại: https://git-scm.com/download/win
2. Cài đặt với các tùy chọn mặc định
3. Restart PowerShell sau khi cài xong

## Bước 2: Cấu hình Git (chỉ làm 1 lần)

```powershell
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

## Bước 3: Tạo Repository trên GitHub

1. Truy cập https://github.com/new
2. Đặt tên repository (ví dụ: `electronics-store`)
3. Chọn **Public** hoặc **Private**
4. **KHÔNG** chọn "Initialize with README" (vì đã có)
5. Click **Create repository**

## Bước 4: Commit và Push

Mở PowerShell tại thư mục `c:\đồ án chuyên ngành` và chạy:

```powershell
# Khởi tạo Git
git init

# Thêm tất cả files
git add .

# Xem files sẽ được commit
git status

# Commit
git commit -m "Initial commit: E-commerce website"

# Thêm remote (thay YOUR_USERNAME và YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Đổi branch thành main
git branch -M main

# Push lên GitHub
git push -u origin main
```

## Bước 5: Nhập credentials

Khi push lần đầu, Git sẽ yêu cầu đăng nhập GitHub:
- **Username**: Tên GitHub của bạn
- **Password**: Dùng Personal Access Token (không phải password)

### Tạo Personal Access Token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → Classic
3. Chọn scopes: `repo`, `workflow`
4. Copy token và dùng làm password

## Các lệnh Git hữu ích

```powershell
# Xem trạng thái
git status

# Xem lịch sử commit
git log --oneline

# Thêm file mới
git add .

# Commit thay đổi
git commit -m "Your message"

# Push lên GitHub
git push

# Pull code mới nhất
git pull

# Tạo branch mới
git checkout -b feature-name

# Chuyển branch
git checkout main

# Xem remote URL
git remote -v
```

## Files đã được ignore (.gitignore)

✅ node_modules/
✅ .env files
✅ build/
✅ uploads/*
✅ logs
✅ IDE configs

## Lưu ý quan trọng

1. ⚠️ **KHÔNG commit file .env** (đã được ignore)
2. ⚠️ Tạo file `.env.example` để hướng dẫn cấu hình
3. ⚠️ Thư mục `uploads/` không được push (chứa ảnh test)
4. ✅ File `README.md` đã có hướng dẫn đầy đủ

## Cấu trúc commit được push

```
đồ án chuyên ngành/
├── .gitignore          ✅ Có
├── README.md           ✅ Có  
├── git-setup.ps1       ✅ Có
├── backend/
│   ├── models/         ✅ Có
│   ├── routes/         ✅ Có
│   ├── middleware/     ✅ Có
│   ├── server.js       ✅ Có
│   ├── package.json    ✅ Có
│   ├── .env.example    ✅ Có
│   ├── .gitignore      ✅ Có
│   └── uploads/        ❌ Ignored (chỉ có .gitkeep)
└── frontend/
    ├── src/            ✅ Có
    ├── public/         ✅ Có
    ├── package.json    ✅ Có
    └── .gitignore      ✅ Có
```

---

**Sau khi push thành công, repository của bạn sẽ có đầy đủ code và documentation!**
