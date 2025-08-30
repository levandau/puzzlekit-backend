# PuzzleKit Backend

Backend API cho ứng dụng PuzzleKit - AI-powered puzzle book generator.

## 🚀 Tính năng

- **Authentication & Authorization** - JWT-based với refresh tokens
- **Puzzle Management** - CRUD operations cho Sudoku, Maze, Word Search, Nonogram
- **Book Composer** - Tạo và quản lý sách puzzle với layout tùy chỉnh
- **Template Library** - Thư viện templates có sẵn
- **File Upload** - Xử lý upload hình ảnh cho nonogram
- **Rate Limiting** - Bảo vệ API khỏi abuse
- **Export Services** - Hỗ trợ export PDF, PNG, SVG

## 🛠️ Công nghệ sử dụng

- **Node.js** + **TypeScript** + **Express**
- **MongoDB** với **Mongoose**
- **JWT** cho authentication
- **Multer** cho file upload
- **Rate Limiter Flexible** cho rate limiting
- **Helmet** cho security headers

## 📦 Cài đặt

### Yêu cầu

- Node.js >= 18.0.0
- MongoDB >= 5.0
- npm hoặc yarn

### Bước 1: Clone và cài đặt dependencies

```bash
cd backend
npm install
```

### Bước 2: Setup môi trường

```bash
# Chạy script setup tự động
npm run setup

# Hoặc thủ công:
cp env.example .env
mkdir uploads logs dist
```

### Bước 3: Cấu hình environment

Sửa file `.env`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/puzzlekit

# JWT (QUAN TRỌNG: Thay đổi trong production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://puzzlekit.leosterling.net
```

### Bước 4: Khởi động MongoDB

```bash
# Trên Windows
net start MongoDB

# Trên macOS với brew
brew services start mongodb-community

# Trên Linux
sudo systemctl start mongod
```

### Bước 5: Seed database (tùy chọn)

```bash
npm run build
npm run seed
```

### Bước 6: Khởi động server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📋 Scripts có sẵn

```bash
npm run dev          # Khởi động development server
npm run build        # Build TypeScript -> JavaScript
npm start            # Khởi động production server
npm test             # Chạy tests
npm run setup        # Setup môi trường và directories
npm run seed         # Seed database với sample data
npm run lint         # Chạy ESLint
npm run lint:fix     # Tự động fix linting errors
```

## 🔗 API Endpoints

### Authentication
```
POST /api/v1/auth/register     # Đăng ký user mới
POST /api/v1/auth/login        # Đăng nhập
POST /api/v1/auth/refresh-token # Refresh JWT token
GET  /api/v1/auth/profile      # Lấy thông tin profile
PUT  /api/v1/auth/profile      # Cập nhật profile
```

### Puzzles
```
GET    /api/v1/puzzles         # Lấy danh sách puzzles của user
POST   /api/v1/puzzles         # Tạo puzzle mới
GET    /api/v1/puzzles/:id     # Lấy chi tiết puzzle
PUT    /api/v1/puzzles/:id     # Cập nhật puzzle
DELETE /api/v1/puzzles/:id     # Xóa puzzle
GET    /api/v1/puzzles/public  # Lấy public puzzles
```

### Books
```
GET    /api/v1/books           # Lấy danh sách books của user
POST   /api/v1/books           # Tạo book mới
GET    /api/v1/books/:id       # Lấy chi tiết book
PUT    /api/v1/books/:id       # Cập nhật book
DELETE /api/v1/books/:id       # Xóa book
POST   /api/v1/books/:id/pages # Thêm page mới
PUT    /api/v1/books/:id/pages/:pageId  # Cập nhật page
DELETE /api/v1/books/:id/pages/:pageId  # Xóa page
```

### Templates
```
GET    /api/v1/templates       # Lấy danh sách templates
GET    /api/v1/templates/:id   # Lấy chi tiết template
POST   /api/v1/templates       # Tạo template mới (auth)
POST   /api/v1/templates/:id/download # Download template (auth)
POST   /api/v1/templates/:id/rate     # Rate template (auth)
```

### Health Check
```
GET /api/v1/health             # Kiểm tra trạng thái API
```

## 🧪 Testing

```bash
# Chạy tất cả tests
npm test

# Chạy tests với watch mode
npm run test:watch

# Test specific endpoints
curl http://localhost:5000/api/v1/health
```

## 🔧 Cấu hình

### Rate Limiting
- **General API**: 100 requests/15 phút
- **Auth endpoints**: 5 requests/15 phút  
- **Generation endpoints**: 10 requests/5 phút

### File Upload
- **Max file size**: 5MB
- **Allowed types**: JPG, PNG, GIF, SVG, WebP
- **Upload directory**: `uploads/`

### Security
- **Helmet** middleware cho security headers
- **CORS** được cấu hình cho frontend domains
- **JWT** tokens có thời hạn 7 ngày
- **Bcrypt** với 12 rounds cho password hashing

## 📊 Database Schema

### Users
- Authentication & profile info
- Subscription management (free/premium/pro)
- Usage tracking (puzzles generated, books created)
- Preferences (default layouts, sizes)

### Puzzles
- SVG data cho puzzle và solution
- Metadata (seed, difficulty, algorithm)
- Tags cho categorization
- Public/private visibility

### Books
- Multi-page layout system (1, 2, 4 puzzles per page)
- Customizable settings (KDP size, margins, copyright)
- Export history tracking

### Templates
- Official và user-generated templates
- Rating và download tracking
- Search và filter capabilities

## 🔍 Debugging

### Logs
```bash
# Development logs
tail -f logs/app.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

### Common Issues

**MongoDB Connection Failed**
```bash
# Kiểm tra MongoDB service
sudo systemctl status mongod

# Khởi động MongoDB
sudo systemctl start mongod
```

**Port 5000 đã được sử dụng**
```bash
# Tìm process đang dùng port
lsof -ti:5000

# Kill process
kill -9 $(lsof -ti:5000)
```

**JWT Token Issues**
- Đảm bảo `JWT_SECRET` đã được set trong `.env`
- Kiểm tra token format: `Bearer <token>`
- Verify token chưa expired

## 🚀 Production Deployment

### Environment Variables cho Production
```env
NODE_ENV=production
JWT_SECRET=your-production-secret-key-64-characters-minimum
MONGODB_URI=mongodb://your-production-db-uri
ALLOWED_ORIGINS=https://puzzlekit.leosterling.net
```

### PM2 Configuration
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker Support
```bash
docker build -t puzzlekit-backend .
docker run -p 5000:5000 --env-file .env puzzlekit-backend
```

## 📝 Changelog

### v1.0.0
- Initial release
- Full CRUD operations cho puzzles và books
- JWT authentication
- Template library system
- Rate limiting và security middleware
