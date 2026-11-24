-- Nhiệm vụ ẩn: biệt danh (danh hiệu) cấp tự động, có thể có hạn (chỉ thêm, không đổi dữ liệu cũ)
ALTER TYPE "ItemSource" ADD VALUE IF NOT EXISTS 'QUEST';
ALTER TABLE "UserItem" ADD COLUMN "expiresAt" TIMESTAMP(3);
