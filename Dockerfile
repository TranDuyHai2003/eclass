# ==========================================
# GIAI ĐOẠN 1: BUILDER
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

# Bổ sung OpenSSL cho Prisma trên Alpine
RUN apk add --no-cache openssl

# 1. Cài đặt dependencies
COPY package*.json ./
RUN npm ci

# 2. Tách riêng bước Prisma để tận dụng Docker Cache
COPY prisma ./prisma
RUN npx prisma generate

# 3. Copy code và Build dự án
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ==========================================
# GIAI ĐOẠN 2: RUNNER (Môi trường chạy thực tế)
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

# Bổ sung OpenSSL cho môi trường chạy
RUN apk add --no-cache openssl

# 🔥 [THÊM MỚI]: Cài thẳng Prisma CLI vào hệ thống (không dùng npx nữa)
RUN npm install -g prisma@6.19.2

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1 

# 1. Copy thư mục public
COPY --from=builder /app/public ./public

# 2. Copy thư mục static
COPY --from=builder /app/.next/static ./.next/static

# 3. Copy thư mục gốc Standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0" 

# 🔥 [ĐÃ SỬA]: Chạy thẳng lệnh `prisma db push` vì máy đã có sẵn
CMD ["sh", "-c", "prisma db push && node server.js"]