-- Assign BASIC level to all existing courses and users
UPDATE "User" SET "level" = 'BASIC' WHERE "level" IS NULL;
UPDATE "Course" SET "level" = 'BASIC' WHERE "level" IS NULL;
