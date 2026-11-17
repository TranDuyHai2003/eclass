-- Tài khoản demo chỉ xem (read-only)
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
