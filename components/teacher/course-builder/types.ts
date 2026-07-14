import { Course, Chapter, Lesson, Attachment, StudyClass } from "@prisma/client";

export type CourseWithRelations = Course & {
  examDate?: Date | null;
  chapters: (Chapter & {
    lessons: (Lesson & {
      attachments: Attachment[];
    })[];
  })[];
  attachments: Attachment[];
  classes: StudyClass[];
};
