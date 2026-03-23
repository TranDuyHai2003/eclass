# Giai đoạn 1: Build dự án
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt dependencies trước để tận dụng cache của Docker
COPY package*.json ./
RUN npm install

# Copy toàn bộ code và thực hiện build
COPY . .
RUN npx prisma generate
RUN npm run build

# Giai đoạn 2: Chạy dự án (Runner) - giúp Image nhẹ hơn
FROM node:20-alpine AS runner
WORKDIR /app

# Thiết lập môi trường Production
ENV NODE_ENV=production

# Copy các file cần thiết từ giai đoạn build
# Dùng dấu * để nhận diện cả next.config.js, .mjs hoặc .ts
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]