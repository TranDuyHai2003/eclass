"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// =============================================
// TEACHER ACTIONS
// =============================================

export async function getTestByLessonId(lessonId: string) {
  return await prisma.test.findUnique({
    where: { lessonId },
    include: {
      sections: {
        include: {
          questions: { orderBy: { position: "asc" } }
        },
        orderBy: { position: "asc" }
      }
    }
  });
}

export async function getTestByCourseId(courseId: string) {
  return await prisma.test.findUnique({
    where: { courseId },
    include: {
      sections: {
        include: {
          questions: { orderBy: { position: "asc" } }
        },
        orderBy: { position: "asc" }
      }
    }
  });
}

async function requireTeacherOrAdmin() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }
  return session;
}

// Upsert a lesson-level test
export async function upsertTest(
  lessonId: string,
  data: {
    pdfUrl: string;
    duration: number;
    showAnswers: boolean;
    explanation?: string;
    videoUrl?: string;
    audioUrl?: string;
  },
) {
  const session = await requireTeacherOrAdmin();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { course: true } } },
  });

  if (!lesson || lesson.chapter.course.userId !== session.user.id) {
    if (session.user.role !== "ADMIN") {
      throw new Error("Unauthorized access to this lesson");
    }
  }

  const test = await prisma.test.upsert({
    where: { lessonId },
    update: data,
    create: {
      ...data,
      lesson: { connect: { id: lessonId } },
    },
  });

  revalidatePath(`/teacher/courses/${lesson?.chapter.courseId}`);
  return { success: true, test };
}

// Upsert a course-level (final) test
export async function upsertCourseTest(
  courseId: string,
  data: {
    pdfUrl: string;
    duration: number;
    showAnswers: boolean;
    explanation?: string;
    videoUrl?: string;
    audioUrl?: string;
  },
) {
  const session = await requireTeacherOrAdmin();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.userId !== session.user.id) {
    if (session.user.role !== "ADMIN") {
      throw new Error("Unauthorized access to this course");
    }
  }

  const test = await prisma.test.upsert({
    where: { courseId },
    update: data,
    create: {
      ...data,
      course: { connect: { id: courseId } },
    },
  });

  revalidatePath(`/teacher/courses/${courseId}`);
  return { success: true, test };
}

// Data format for sections:
// [ { name: string, position: number, questions: [ { position, type, correctAnswer, points, explanation, videoUrl, audioUrl, needsManualGrading } ] } ]
export async function saveTestMatrix(testId: string, sections: any[]) {
  const session = await requireTeacherOrAdmin();

  // Course ownership validation — supports both lesson-level and course-level tests
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
    },
  });

  if (!test) throw new Error("Test not found");

  const ownerId = test.lesson?.chapter?.course?.userId ?? test.course?.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access to this test");
  }

  // To simplify, we delete existing sections and recreate them within a transaction
  await prisma.$transaction(async (tx) => {
    // Delete existing sections (cascade will delete questions)
    await tx.testSection.deleteMany({
      where: { testId },
    });

    // Create new sections and questions
    for (const section of sections) {
      const createdSection = await tx.testSection.create({
        data: {
          testId,
          name: section.name,
          position: section.position,
        },
      });

      if (section.questions && section.questions.length > 0) {
        const questionsData = section.questions.map((q: any) => ({
          sectionId: createdSection.id,
          position: q.position,
          type: q.type,
          correctAnswer: q.correctAnswer,
          points: q.points,
          explanation: q.explanation,
          videoUrl: q.videoUrl,
          audioUrl: q.audioUrl,
          needsManualGrading: q.needsManualGrading || false,
        }));

        await tx.question.createMany({
          data: questionsData,
        });
      }
    }
  });

  return { success: true };
}

// =============================================
// STUDENT ACTIONS
// =============================================

export async function startTestAttempt(testId: string) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  // Check if there is already an uncompleted attempt
  const existingAttempt = await prisma.studentAttempt.findFirst({
    where: {
      testId,
      userId: session.user.id,
      completedAt: null
    }
  });

  if (existingAttempt) {
    return { success: true, attempt: existingAttempt };
  }

  const attempt = await prisma.studentAttempt.create({
    data: {
      testId,
      userId: session.user.id,
    }
  });

  return { success: true, attempt };
}

// Function to normalize short answers
function normalizeShortAnswer(answer: string) {
  if (!answer) return "";
  // Trim spaces at the ends and convert to lower case
  return answer.trim().toLowerCase();
}

export async function submitTestAttempt(attemptId: string, studentAnswers: { questionId: string, answerProvided: string }[]) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: { include: { sections: { include: { questions: true } } } } }
  });

  if (!attempt || attempt.userId !== session.user.id) {
    throw new Error("Invalid attempt");
  }

  if (attempt.completedAt) {
    throw new Error("Attempt already submitted");
  }

  // Map questions for quick lookup
  const questionMap = new Map<string, any>();
  attempt.test.sections.forEach(s => {
    s.questions.forEach(q => {
      questionMap.set(q.id, q);
    });
  });

  let totalScore = 0;
  const answersData = studentAnswers.map(ans => {
    const q = questionMap.get(ans.questionId);
    let isCorrect = false;
    let pointsAwarded = 0;

    if (q) {
      if (q.type === 'MULTIPLE_CHOICE') {
        isCorrect = ans.answerProvided === q.correctAnswer;
      } else if (q.type === 'SHORT_ANSWER') {
        isCorrect = normalizeShortAnswer(ans.answerProvided) === normalizeShortAnswer(q.correctAnswer);
      } else if (q.type === 'ESSAY') {
        // Essay needs manual grading, so we leave it as null (pending)
        isCorrect = null as any; 
      }

      if (isCorrect === true) {
        pointsAwarded = q.points;
      }
    }

    if (pointsAwarded > 0) {
      totalScore += pointsAwarded;
    }

    return {
      attemptId,
      questionId: ans.questionId,
      answerProvided: ans.answerProvided,
      isCorrect,
      pointsAwarded
    };
  });

  await prisma.$transaction(async (tx) => {
    // Delete any previous drafted answers for this attempt just in case
    await tx.studentAnswer.deleteMany({
      where: { attemptId }
    });

    if (answersData.length > 0) {
      await tx.studentAnswer.createMany({
        data: answersData
      });
    }

    await tx.studentAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        completedAt: new Date(),
      }
    });
  });

  return { success: true, score: totalScore };
}
