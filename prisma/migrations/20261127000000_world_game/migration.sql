-- Thế giới Toán 3D (27/11/2026): trí nhớ FSRS + Elo theo KC, độ khó họ câu, câu đã phát, phát hiện Bảo tàng. Chỉ thêm bảng.
-- CreateTable
CREATE TABLE "WorldKnowledge" (
    "userId" TEXT NOT NULL,
    "kc" TEXT NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "theta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eloN" INTEGER NOT NULL DEFAULT 0,
    "tamedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldKnowledge_pkey" PRIMARY KEY ("userId","kc")
);

-- CreateTable
CREATE TABLE "WorldItemStat" (
    "familyId" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldItemStat_pkey" PRIMARY KEY ("familyId")
);

-- CreateTable
CREATE TABLE "WorldChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "kc" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "context" TEXT NOT NULL,
    "discoveryId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "correct" BOOLEAN,
    "score" DOUBLE PRECISION,
    "confidence" INTEGER,
    "hints" INTEGER NOT NULL DEFAULT 0,
    "responseMs" INTEGER,
    "misconception" TEXT,
    "answer" JSONB,

    CONSTRAINT "WorldChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldDiscovery" (
    "userId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "prediction" TEXT,
    "explanation" TEXT,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldDiscovery_pkey" PRIMARY KEY ("userId","discoveryId")
);

-- CreateIndex
CREATE INDEX "WorldKnowledge_userId_dueAt_idx" ON "WorldKnowledge"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "WorldChallenge_userId_issuedAt_idx" ON "WorldChallenge"("userId", "issuedAt");

-- AddForeignKey
ALTER TABLE "WorldKnowledge" ADD CONSTRAINT "WorldKnowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldChallenge" ADD CONSTRAINT "WorldChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldDiscovery" ADD CONSTRAINT "WorldDiscovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

