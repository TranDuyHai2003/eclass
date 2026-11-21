-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('XU', 'GEM');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('SHOP', 'GACHA', 'GIFT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PointSource" ADD VALUE 'ON_TIME';
ALTER TYPE "PointSource" ADD VALUE 'GIFTCODE';
ALTER TYPE "PointSource" ADD VALUE 'GACHA';
ALTER TYPE "PointSource" ADD VALUE 'ITEM';

-- AlterTable
ALTER TABLE "PointLedger" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'XU';

-- AlterTable
ALTER TABLE "PointWallet" ADD COLUMN     "gachaPity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gems" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudyClass" ADD COLUMN     "grade" INTEGER;

-- CreateTable
CREATE TABLE "TestDeadline" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'GEM',
    "amount" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "classId" TEXT,
    "note" TEXT,
    "batchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCodeUse" (
    "id" TEXT NOT NULL,
    "giftCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCodeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "source" "ItemSource" NOT NULL DEFAULT 'SHOP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAvatar" (
    "userId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chest" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "cost" INTEGER NOT NULL,
    "outcome" JSONB NOT NULL,
    "pityBefore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaPull_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestDeadline_classId_idx" ON "TestDeadline"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "TestDeadline_testId_classId_key" ON "TestDeadline"("testId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCode_code_key" ON "GiftCode"("code");

-- CreateIndex
CREATE INDEX "GiftCode_batchId_idx" ON "GiftCode"("batchId");

-- CreateIndex
CREATE INDEX "GiftCode_createdById_createdAt_idx" ON "GiftCode"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCodeUse_userId_idx" ON "GiftCodeUse"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCodeUse_giftCodeId_userId_key" ON "GiftCodeUse"("giftCodeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");

-- CreateIndex
CREATE INDEX "GachaPull_userId_createdAt_idx" ON "GachaPull"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TestDeadline" ADD CONSTRAINT "TestDeadline_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDeadline" ADD CONSTRAINT "TestDeadline_classId_fkey" FOREIGN KEY ("classId") REFERENCES "StudyClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCode" ADD CONSTRAINT "GiftCode_classId_fkey" FOREIGN KEY ("classId") REFERENCES "StudyClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCodeUse" ADD CONSTRAINT "GiftCodeUse_giftCodeId_fkey" FOREIGN KEY ("giftCodeId") REFERENCES "GiftCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCodeUse" ADD CONSTRAINT "GiftCodeUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserItem" ADD CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Đoán khối từ tên lớp (vd "12A1", "Lớp 11 nâng cao"); admin có thể sửa lại ở Quản lý lớp học
UPDATE "StudyClass" SET "grade" = CAST(substring("name" from '(?:^|[^0-9])(1[0-2])(?:[^0-9]|$)') AS INTEGER)
WHERE "grade" IS NULL AND "name" ~ '(^|[^0-9])(1[0-2])([^0-9]|$)';
