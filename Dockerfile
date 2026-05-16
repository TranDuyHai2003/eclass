# ==========================================
# GIAI ĐOẠN 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Cài đặt dependencies (Dùng npm ci cho chuẩn xác và nhanh hơn npm install)
COPY package*.json ./
RUN npm ci

# 2. Tách riêng bước Prisma để tận dụng Docker Cache
COPY prisma ./prisma
RUN npx prisma generate

# 3. Copy code và Build dự án
COPY . .
RUN npm run build


# ==========================================
# GIAI ĐOẠN 2: RUNNER (Môi trường chạy thực tế)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Tắt tính năng gửi dữ liệu ẩn danh về Vercel để nhẹ server
ENV NEXT_TELEMETRY_DISABLED=1 

# 1. Copy thư mục public (Standalone KHÔNG tự gom thư mục này)
COPY --from=builder /app/public ./public

# 2. Copy thư mục static (Chứa CSS, JS của Next.js đã compile)
COPY --from=builder /app/.next/static ./.next/static

# 3. Copy thư mục gốc Standalone (Chứa lõi server và thư viện đã chắt lọc)
COPY --from=builder /app/.next/standalone ./

EXPOSE 3000
ENV PORT=3000
# Đảm bảo Node.js lắng nghe trên tất cả các IP của container
ENV HOSTNAME="0.0.0.0" 

# KHÔNG DÙNG "npm start" NỮA! 
# Chạy trực tiếp file server.js đã được Next.js tối ưu sẵn
CMD ["node", "server.js"]