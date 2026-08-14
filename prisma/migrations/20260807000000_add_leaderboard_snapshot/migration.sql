-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaderboardSnapshot" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "studyClassId"   TEXT NOT NULL,
    "periodCode"     TEXT NOT NULL,
    "snapshotType"   TEXT NOT NULL DEFAULT 'WEEKLY',
    "score"          DOUBLE PRECISION NOT NULL,
    "rankingScore"   DOUBLE PRECISION NOT NULL,
    "completedTests" INTEGER NOT NULL,
    "rank"           INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaderboardSnapshot_userId_idx" ON "LeaderboardSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "LeaderboardSnapshot_studyClassId_idx" ON "LeaderboardSnapshot"("studyClassId");
CREATE INDEX IF NOT EXISTS "LeaderboardSnapshot_periodCode_idx" ON "LeaderboardSnapshot"("periodCode");

-- AddForeignKey (safe: skip if already exists)
DO $$ BEGIN
    ALTER TABLE "LeaderboardSnapshot"
        ADD CONSTRAINT "LeaderboardSnapshot_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "LeaderboardSnapshot"
        ADD CONSTRAINT "LeaderboardSnapshot_studyClassId_fkey"
        FOREIGN KEY ("studyClassId") REFERENCES "StudyClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
