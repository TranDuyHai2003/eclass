# eClass — Nền tảng học trực tuyến

eClass là nền tảng học trực tuyến (LMS) cho giáo viên và học sinh. Hệ thống quản lý khóa học, video bài giảng, bài tập về nhà, bài kiểm tra, chấm điểm và bảng xếp hạng học sinh theo tuần.

Dự án viết bằng **Next.js 16 (App Router)**, **React 19**, **Prisma** + **PostgreSQL**. Video và tài liệu được lưu trên **Backblaze B2** và phân phối qua CDN.

---

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu](#bắt-đầu)
- [Biến môi trường](#biến-môi-trường)
- [Scripts](#scripts)
- [Database & Migration](#database--migration)
- [Triển khai (Deploy)](#triển-khai-deploy)
- [Quy ước đóng góp](#quy-ước-đóng-góp)

---

## Tính năng

### Học sinh
- Đăng ký và đăng nhập bằng email/mật khẩu, Google hoặc Facebook (NextAuth v5).
- Xem khóa học theo chương và bài học: video, tài liệu PDF, bài quiz.
- Hệ thống lưu lại tiến độ học.
- Làm bài tập về nhà và bài kiểm tra. Các dạng câu hỏi gồm trắc nghiệm, đúng/sai, nhóm trắc nghiệm nhiều ý, trả lời ngắn và tự luận.
- Xem kết quả, đáp án và lịch sử làm bài.
- Có bảng xếp hạng theo tuần, kèm trạng thái lên hạng, xuống hạng hoặc mới vào top.
- Bình luận dưới bài học và nhận thông báo.

### Giáo viên
- Tạo và chỉnh sửa khóa học, chương, bài học (kéo-thả để sắp xếp). Có thể nhân bản khóa học.
- **Test Builder**: soạn đề theo phần, hỗ trợ câu hỏi nhiều ý con. Đề có thể lưu vào ngân hàng đề để dùng lại.
- Quản lý video: upload trực tiếp lên B2 qua presigned URL và đồng bộ thư viện video.
- Chấm bài tập về nhà, xem kết quả và phân tích (analytics) theo từng bài và từng học sinh.

### Quản trị viên
- Quản lý người dùng, lớp học và phân lớp.
- Xem thống kê toàn hệ thống, theo dõi tài chính và cấu hình hệ thống.
- Xuất báo cáo Excel (ma trận điểm, bản offline) và chấm lại hàng loạt.

---

## Công nghệ

| Hạng mục | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, output `standalone`) |
| UI | React 19, Tailwind CSS 4, Radix UI, lucide-react, sonner |
| Form & validate | react-hook-form, zod |
| Auth | NextAuth v5 (Credentials, Google, Facebook) + Prisma Adapter |
| Database | PostgreSQL + Prisma ORM 6 |
| Lưu trữ file | Backblaze B2 (S3-compatible, AWS SDK v3) + CDN |
| Media | Vidstack (video player), react-pdf |
| Biểu đồ / xuất file | Recharts, ExcelJS |
| Deploy | Heroku (Node buildpack); có sẵn Dockerfile cho VPS |

---

## Cấu trúc thư mục

```
.
├── actions/          # Server Actions (course, test, homework, ranking, user, ...)
├── app/              # Next.js App Router
│   ├── admin/        # Trang quản trị
│   ├── teacher/      # Trang giáo viên (khóa học, bài kiểm tra, video, bài tập)
│   ├── courses/      # Danh sách & chi tiết khóa học
│   ├── watch/        # Trang học bài (video / tài liệu / quiz)
│   ├── tests/        # Làm bài kiểm tra
│   ├── ranking/      # Bảng xếp hạng
│   └── api/          # Route handlers (upload, videos, exams, analytics, auth, ...)
├── components/       # React components theo module (ui/, course/, teacher/, ...)
├── hooks/            # Custom React hooks
├── lib/              # Prisma client, B2/S3 client, logic chấm điểm & xếp hạng
├── prisma/           # schema.prisma + migrations
├── public/           # Static assets
├── scripts/          # Script vận hành/bảo trì (chạy thủ công bằng ts-node)
├── types/            # Khai báo kiểu dùng chung
├── auth.ts           # Cấu hình NextAuth
├── middleware.ts     # Bảo vệ route theo vai trò
├── copy-assets.js    # Copy public/ và static/ vào bản build standalone
├── Procfile          # Cấu hình process cho Heroku
└── Dockerfile        # Build image cho môi trường VPS/Docker
```

---

## Bắt đầu

### Yêu cầu
- Node.js **22+**
- PostgreSQL **15+**. Có thể chạy bằng Docker, xem `docker-compose.yml`.
- npm

### Cài đặt

```bash
git clone https://github.com/TranDuyHai2003/eclass.git
cd eclass

# 1. Cài dependencies
npm install

# 2. Tạo file biến môi trường rồi điền giá trị thật
cp .env.example .env

# 3. Khởi tạo database
npx prisma generate
npx prisma migrate deploy

# 4. Chạy môi trường phát triển
npm run dev
```

Sau khi chạy, ứng dụng có tại http://localhost:3000.

> Chỉ cần database PostgreSQL cục bộ? Chạy `docker compose up -d postgres`.

---

## Biến môi trường

File [.env.example](.env.example) liệt kê đầy đủ các biến. Các biến chính:

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma |
| `AUTH_SECRET` | Secret ký session của NextAuth (`npx auth secret`) |
| `AUTH_URL` | URL gốc của ứng dụng |
| `AUTH_TRUST_HOST` | `true` khi chạy sau reverse proxy |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Đăng nhập Google (tùy chọn) |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Đăng nhập Facebook (tùy chọn) |
| `B2_KEY_ID` / `B2_APP_KEY` | Khóa truy cập Backblaze B2 |
| `B2_REGION` / `B2_ENDPOINT` / `B2_BUCKET_NAME` | Cấu hình bucket B2 |
| `NEXT_PUBLIC_VIDEO_DOMAIN` | Domain CDN phục vụ video/tài liệu |
| `NEXT_PUBLIC_S3_DOMAIN` | Domain công khai cho file upload |

> ⚠️ **Không commit file `.env`.** File này đã có trong `.gitignore`. Trên Heroku, biến môi trường được khai báo ở **Settings → Config Vars**.

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build production (standalone) và copy assets |
| `npm start` | Chạy bản build: `node .next/standalone/server.js` |
| `npm run lint` | Kiểm tra code bằng ESLint |
| `npm run db:push` | Đồng bộ schema Prisma lên DB (chỉ dùng khi dev) |

Các script bảo trì trong `scripts/` được chạy thủ công, ví dụ:

```bash
npx ts-node scripts/check-b2-files.ts
```

---

## Database & Migration

- Schema nằm ở `prisma/schema.prisma`, migrations nằm ở `prisma/migrations/`.
- Tạo migration mới khi đổi schema:
  ```bash
  npx prisma migrate dev --name ten_thay_doi
  ```
- Trên production, migration được áp dụng tự động bằng `prisma migrate deploy` (release phase của Heroku, xem `Procfile`).

---

## Triển khai (Deploy)

### Heroku (đang sử dụng)

Ứng dụng chạy trên Heroku bằng Node.js buildpack:

1. **Build**: Heroku chạy `npm install` rồi `npm run build`.
2. **Release**: chạy `npx prisma migrate deploy` (khai báo trong `Procfile`).
3. **Web**: chạy `npm start`.

```bash
git push heroku master
```

### Docker / VPS (tùy chọn)

Repo có sẵn `Dockerfile` (multi-stage, output standalone) và `docker-compose.yml` (gồm app và PostgreSQL):

```bash
docker build -t eclass-app .
docker compose up -d
```

---

## Quy ước đóng góp

- Nhánh chính: `master`. Nên tạo nhánh riêng cho từng tính năng hoặc bản sửa lỗi.
- Chạy `npm run lint` và `npm run build` trước khi tạo commit hoặc PR.
- Không commit dữ liệu thật (dump SQL, file `.env`, khóa bí mật). Các loại file này đã được chặn trong `.gitignore`.
- Mọi thay đổi schema phải đi kèm migration.

---

© eClass. Bảo lưu mọi quyền.
