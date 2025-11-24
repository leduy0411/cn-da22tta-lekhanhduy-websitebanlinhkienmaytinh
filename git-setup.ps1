# Script để commit dự án lên GitHub
# Chạy script này sau khi đã cài đặt Git

# 1. Cài đặt Git nếu chưa có
# Download tại: https://git-scm.com/download/win

# 2. Cấu hình Git (chỉ cần làm 1 lần)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 3. Khởi tạo Git repository
git init

# 4. Thêm tất cả files (trừ những file trong .gitignore)
git add .

# 5. Xem trạng thái (optional)
git status

# 6. Commit với message
git commit -m "Initial commit: E-commerce website with React, Node.js, MongoDB

Features:
- User authentication (register, login, forgot password)
- Product management with image upload
- Category management
- Shopping cart
- Order management
- Admin dashboard with statistics
- Responsive design"

# 7. Tạo repository trên GitHub trước (https://github.com/new)
# Sau đó thêm remote URL
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 8. Đổi tên branch thành main (nếu cần)
git branch -M main

# 9. Push lên GitHub
git push -u origin main

# ===== HOẶC: Push lên branch khác =====
# git checkout -b develop
# git push -u origin develop
