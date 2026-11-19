-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('TEST_SUBMIT', 'TEST_SCORE', 'BREAKTHROUGH', 'FINAL_TEST', 'HOMEWORK_SUBMIT', 'HOMEWORK_PASS', 'STREAK', 'MANUAL', 'REDEEM', 'REFUND', 'REVOKE');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('PHYSICAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'DELIVERED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "PointSource" NOT NULL,
    "key" TEXT,
    "refId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "weekStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWeekStreak" INTEGER NOT NULL DEFAULT 0,
    "lastStreakWeek" TEXT,
    "streakFreezes" INTEGER NOT NULL DEFAULT 1,
    "goalRewardId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER,
    "perStudentMonthlyLimit" INTEGER,
    "kind" "RewardKind" NOT NULL DEFAULT 'PHYSICAL',
    "offlineOnly" BOOLEAN NOT NULL DEFAULT true,
    "costVnd" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RewardToStudyClass" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RewardToStudyClass_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedger_userId_key_idx" ON "PointLedger"("userId", "key");

-- CreateIndex
CREATE INDEX "PointLedger_refId_idx" ON "PointLedger"("refId");

-- CreateIndex
CREATE INDEX "Redemption_status_createdAt_idx" ON "Redemption"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_userId_idx" ON "Redemption"("userId");

-- CreateIndex
CREATE INDEX "Redemption_rewardId_idx" ON "Redemption"("rewardId");

-- CreateIndex
CREATE INDEX "_RewardToStudyClass_B_index" ON "_RewardToStudyClass"("B");

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWallet" ADD CONSTRAINT "PointWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RewardToStudyClass" ADD CONSTRAINT "_RewardToStudyClass_A_fkey" FOREIGN KEY ("A") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RewardToStudyClass" ADD CONSTRAINT "_RewardToStudyClass_B_fkey" FOREIGN KEY ("B") REFERENCES "StudyClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
