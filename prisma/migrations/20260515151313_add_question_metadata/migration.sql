-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'Medium',
ADD COLUMN     "subCategory" TEXT;
