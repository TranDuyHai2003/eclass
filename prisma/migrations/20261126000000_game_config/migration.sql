-- Cấu hình game admin sửa được (giá đồ trang trí, mức xu các hoạt động). Chỉ thêm bảng.
CREATE TABLE IF NOT EXISTS "GameConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("key")
);
