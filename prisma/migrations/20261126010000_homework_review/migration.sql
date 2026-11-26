-- Cơ chế xu mới (26/11/2026): hạn nộp BTVN theo lớp + giáo viên duyệt chữa bài. Chỉ thêm bảng / giá trị enum.
CREATE TYPE "HomeworkReviewLevel" AS ENUM ('NONE', 'PARTIAL', 'FULL');

ALTER TYPE "PointSource" ADD VALUE IF NOT EXISTS 'HOMEWORK_REVIEW';

CREATE TABLE "HomeworkDeadline" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomeworkDeadline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeworkReview" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "HomeworkReviewLevel" NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomeworkReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeworkDeadline_classId_idx" ON "HomeworkDeadline"("classId");
CREATE UNIQUE INDEX "HomeworkDeadline_lessonId_classId_key" ON "HomeworkDeadline"("lessonId", "classId");
CREATE INDEX "HomeworkReview_userId_idx" ON "HomeworkReview"("userId");
CREATE UNIQUE INDEX "HomeworkReview_lessonId_userId_key" ON "HomeworkReview"("lessonId", "userId");

ALTER TABLE "HomeworkDeadline" ADD CONSTRAINT "HomeworkDeadline_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkDeadline" ADD CONSTRAINT "HomeworkDeadline_classId_fkey" FOREIGN KEY ("classId") REFERENCES "StudyClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkReview" ADD CONSTRAINT "HomeworkReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
