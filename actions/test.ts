"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { commitTempFile } from "@/lib/b2";

// =============================================
// TEACHER ACTIONS
// =============================================

export async function getTestByLessonId(lessonId: string) {
  return await prisma.test.findUnique({
    where: { lessonId },
    include: {
      sections: {
        include: {
          questions: { 
            include: { subQuestions: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" } 
          }
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
          questions: { 
            include: { subQuestions: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" } 
          }
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
    title?: string;
    pdfUrl: string;
    duration: number;
    showAnswers: boolean;
    explanation?: string;
    videoUrl?: string;
    solutionVideos?: any;
    audioUrl?: string;
    dueDate?: Date | null;
  },
) {
  const session = await requireTeacherOrAdmin();

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { course: true } } },
  });

  if (!lesson || (lesson.chapter.course.userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized access to this lesson");
  }

  // Tự động đặt tên "Bài 1", "Bài 2"... nếu chưa có tên và không truyền title
  const existingTest = await prisma.test.findUnique({ where: { lessonId }, select: { title: true } });
  let finalTitle = data.title;
  
  if (!finalTitle && (!existingTest || !existingTest.title)) {
    const testCount = await prisma.test.count({
      where: {
        lesson: {
          chapter: {
            courseId: lesson.chapter.courseId,
          },
        },
      },
    });
    finalTitle = `Bài ${testCount + 1}`;
  }

  // Commit any temp files to permanent storage
  data.pdfUrl = await commitTempFile(data.pdfUrl) || data.pdfUrl;
  if (data.explanation) data.explanation = await commitTempFile(data.explanation) || data.explanation;
  if (data.videoUrl) data.videoUrl = await commitTempFile(data.videoUrl) || data.videoUrl;
  if (data.audioUrl) data.audioUrl = await commitTempFile(data.audioUrl) || data.audioUrl;
  if (data.solutionVideos && Array.isArray(data.solutionVideos)) {
    for (const v of data.solutionVideos) {
      if (v.url) v.url = await commitTempFile(v.url) || v.url;
    }
  }

  const test = await prisma.test.upsert({
    where: { lessonId },
    update: {
      ...data,
      title: finalTitle,
    },
    create: {
      ...data,
      title: finalTitle,
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
    solutionVideos?: any;
    audioUrl?: string;
    dueDate?: Date | null;
  },
) {
  const session = await requireTeacherOrAdmin();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || (course.userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized access to this course");
  }

  const existingTest = await prisma.test.findUnique({ where: { courseId }, select: { title: true } });
  const title = existingTest?.title || "Bài kiểm tra cuối khóa";

  // Commit any temp files
  data.pdfUrl = await commitTempFile(data.pdfUrl) || data.pdfUrl;
  if (data.explanation) data.explanation = await commitTempFile(data.explanation) || data.explanation;
  if (data.videoUrl) data.videoUrl = await commitTempFile(data.videoUrl) || data.videoUrl;
  if (data.audioUrl) data.audioUrl = await commitTempFile(data.audioUrl) || data.audioUrl;
  if (data.solutionVideos && Array.isArray(data.solutionVideos)) {
    for (const v of data.solutionVideos) {
      if (v.url) v.url = await commitTempFile(v.url) || v.url;
    }
  }

  const test = await prisma.test.upsert({
    where: { courseId },
    update: data,
    create: {
      ...data,
      title,
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

  const normalizeType = (raw: unknown) => {
    if (typeof raw !== "string") return "MULTIPLE_CHOICE";
    const type = raw.trim().toUpperCase();
    if (type === "MCQ" || type === "MULTIPLE_CHOICE_SINGLE") return "MULTIPLE_CHOICE";
    if (type === "TRUE_FALSE" || type === "SHORT_ANSWER" || type === "ESSAY" || type === "MULTIPLE_CHOICE" || type === "MULTIPLE_CHOICE_GROUP") return type;
    return "MULTIPLE_CHOICE";
  };

  const normalizeAnswer = (raw: unknown) => {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    return value.length > 0 ? value.toUpperCase() : null;
  };

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
  if (ownerId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new Error("Unauthorized access to this test");
  }

  // 3. Update sections and questions non-destructively
  await prisma.$transaction(async (tx) => {
    const existingSections = await tx.testSection.findMany({
      where: { testId },
      include: { questions: true }
    });

    const existingSectionIds = existingSections.map(s => s.id);
    const newSectionIds = sections.filter(s => s.id && !s.id.startsWith('temp-') && !s.id.startsWith('section-')).map(s => s.id);
    
    // Sections to delete
    const sectionIdsToDelete = existingSectionIds.filter(id => !newSectionIds.includes(id));
    if (sectionIdsToDelete.length > 0) {
      await tx.testSection.deleteMany({
        where: { id: { in: sectionIdsToDelete } }
      });
    }

    for (const [sectionIndex, section] of sections.entries()) {
      let sectionId = section.id;
      const isTempSection = !sectionId || sectionId.startsWith('temp-') || sectionId.startsWith('section-');

      if (isTempSection || !existingSectionIds.includes(sectionId)) {
        // Create new section
        const createdSection = await tx.testSection.create({
          data: {
            testId,
            name: section.name,
            position: Number.isFinite(section.position) ? section.position : sectionIndex,
          }
        });
        sectionId = createdSection.id;
      } else {
        // Update existing section
        await tx.testSection.update({
          where: { id: sectionId },
          data: {
            name: section.name,
            position: Number.isFinite(section.position) ? section.position : sectionIndex,
          }
        });
      }

      // Handle questions for this section
      const existingQuestions = existingSections.find(s => s.id === sectionId)?.questions || [];
      const existingQuestionIds = existingQuestions.map(q => q.id);
      const newQuestions = section.questions || [];
      const newQuestionIds = newQuestions.filter((q: any) => q.id && !q.id.startsWith('temp-') && !q.id.startsWith('parsed-')).map((q: any) => q.id);

      // Questions to delete in this section
      const questionIdsToDelete = existingQuestionIds.filter(id => !newQuestionIds.includes(id));
      if (questionIdsToDelete.length > 0) {
        await tx.question.deleteMany({
          where: { id: { in: questionIdsToDelete } }
        });
      }

      // Update or Create questions
      for (const [qIndex, q] of newQuestions.entries()) {
        const isTempQuestion = !q.id || q.id.startsWith('temp-') || q.id.startsWith('parsed-');
        
        // Commit any temp files attached to the question
        const committedExplanation = await commitTempFile(q.explanation) || q.explanation;
        const committedVideoUrl = await commitTempFile(q.videoUrl) || q.videoUrl;
        const committedAudioUrl = await commitTempFile(q.audioUrl) || q.audioUrl;

        const questionData: any = {
          sectionId,
          position: Number.isFinite(q.position) ? q.position : qIndex,
          category: q.category ?? q.question_category ?? null,
          type: normalizeType(q.type),
          correctAnswer: normalizeAnswer(q.correctAnswer),
          points: Number.isFinite(q.points) ? q.points : 1.0,
          explanation: committedExplanation,
          videoUrl: committedVideoUrl,
          audioUrl: committedAudioUrl,
          needsManualGrading: q.needsManualGrading || false,
        };

        if (isTempQuestion || !existingQuestionIds.includes(q.id)) {
          await tx.question.create({
            data: {
              ...questionData,
              subQuestions: q.type === 'MULTIPLE_CHOICE_GROUP' && Array.isArray(q.subQuestions) ? {
                create: q.subQuestions.map((sq: any, sqIdx: number) => ({
                  content: sq.content || `Ý ${sqIdx + 1}`,
                  type: 'TRUE_FALSE',
                  correctAnswer: normalizeAnswer(sq.correctAnswer) || "T",
                  position: sqIdx
                }))
              } : undefined
            }
          });
        } else {
          await tx.question.update({
            where: { id: q.id },
            data: {
              ...questionData,
              subQuestions: q.type === 'MULTIPLE_CHOICE_GROUP' && Array.isArray(q.subQuestions) ? {
                deleteMany: {
                  id: { notIn: q.subQuestions.map((s: any) => s.id).filter((id: any) => id && !id.startsWith('temp-') && !id.startsWith('parsed-')) }
                },
                upsert: q.subQuestions.map((sq: any, sqIdx: number) => ({
                  where: { id: (sq.id && !sq.id.startsWith('temp-') && !sq.id.startsWith('parsed-')) ? sq.id : 'fake-non-existent-id' },
                  update: {
                    content: sq.content || `Ý ${sqIdx + 1}`,
                    correctAnswer: normalizeAnswer(sq.correctAnswer) || "T",
                    position: sqIdx
                  },
                  create: {
                    content: sq.content || `Ý ${sqIdx + 1}`,
                    type: 'TRUE_FALSE',
                    correctAnswer: normalizeAnswer(sq.correctAnswer) || "T",
                    position: sqIdx
                  }
                }))
              } : undefined
            }
          });
        }
      }
    }
  });

  // 4. Re-calculate scores for all existing attempts if keys changed
  await reCalculateAllAttempts(testId);

  return { success: true };
}

/**
 * Re-calculates scores for all completed attempts of a test.
 * Used when a teacher updates the answer key or points.
 */
async function reCalculateAllAttempts(testId: string) {
  await prisma.$transaction(async (tx) => {
    const test = await tx.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          include: {
            questions: { include: { subQuestions: true } }
          }
        }
      }
    });

    if (!test) return;

    const attempts = await tx.studentAttempt.findMany({
      where: { testId, completedAt: { not: null } },
      include: { answers: { include: { subAnswers: true } } }
    });

    if (attempts.length === 0) return;

    // Map questions for quick lookup
    const questionMap = new Map<string, any>();
    let maxPointsPossible = 0;
    test.sections.forEach(s => {
      s.questions.forEach(q => {
        questionMap.set(q.id, q);
        maxPointsPossible += (q.points || 0);
      });
    });

    for (const attempt of attempts) {
      let rawTotalScore = 0;
      const updates: Promise<any>[] = [];

      for (const ans of attempt.answers) {
        const q = questionMap.get(ans.questionId);
        if (!q) continue;

        let isCorrect: boolean | null = false;
        let pointsAwarded = 0;

        if (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') {
          isCorrect = checkAnswerMatch(ans.answerProvided, q.correctAnswer, q.type);
        } else if (q.type === 'SHORT_ANSWER') {
          isCorrect = checkAnswerMatch(ans.answerProvided, q.correctAnswer, q.type);
        } else if (q.type === 'ESSAY') {
          // Keep teacher's manual grading for essays
          // Skip ungraded essays entirely to avoid null→false conversion
          if (ans.isCorrect === null) {
            rawTotalScore += 0;
            continue;
          }
          isCorrect = ans.isCorrect;
          pointsAwarded = ans.pointsAwarded;
        } else if (q.type === 'MULTIPLE_CHOICE_GROUP') {
          const subAnsInput = ans.subAnswers || [];
          const subQuestions = q.subQuestions || [];
          let wrongCount = 0;

          subQuestions.forEach((subQ: any) => {
            const studentAnsObj = subAnsInput.find((a: any) => a.subQuestionId === subQ.id);
            const studentValue = studentAnsObj ? studentAnsObj.answerProvided : null;
            const isCorrectSub = checkSubQuestionCorrect(studentValue, subQ.correctAnswer, subQ.type);
            
            if (!isCorrectSub) {
              wrongCount++;
            }

            if (studentAnsObj && studentAnsObj.isCorrect !== isCorrectSub) {
              updates.push(tx.studentSubAnswer.update({
                where: { id: studentAnsObj.id },
                data: { isCorrect: isCorrectSub }
              }));
            }
          });

          const pointsMap: Record<number, number> = {
            0: 1.0,
            1: 0.5,
            2: 0.25,
            3: 0.1,
            4: 0
          };

          const ratio = pointsMap[wrongCount] ?? 0;
          isCorrect = wrongCount === 0; 
          pointsAwarded = q.points * ratio;
        }

        if (q.type !== 'ESSAY' && q.type !== 'MULTIPLE_CHOICE_GROUP' && isCorrect === true) {
          pointsAwarded = q.points;
        }

        if (pointsAwarded > 0) {
          rawTotalScore += pointsAwarded;
        }

        // Only update if something changed to save DB calls
        if (ans.isCorrect !== isCorrect || ans.pointsAwarded !== pointsAwarded) {
          updates.push(tx.studentAnswer.update({
            where: { id: ans.id },
            data: { isCorrect, pointsAwarded }
          }));
        }
      }

      const finalScore = maxPointsPossible > 0 ? Math.round((rawTotalScore / maxPointsPossible) * 10 * 100) / 100 : 0;

      // Run answer updates and attempt update in parallel for this attempt
      await Promise.all([
        ...updates,
        tx.studentAttempt.update({
          where: { id: attempt.id },
          data: { score: finalScore }
        })
      ]);
    }
  });
}


// =============================================
// STUDENT ACTIONS
// =============================================

export async function startTestAttempt(testId: string) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  // Security: Only approved students (or staff) can start tests
  const isAdminOrTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
  const isApproved = (session.user as any).isApproved || isAdminOrTeacher;
  if (!isApproved) {
    throw new Error("Tài khoản của bạn chưa được kích hoạt để tham gia kiểm tra.");
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { dueDate: true },
  });

  if (!test) {
    throw new Error("Test not found");
  }

  if (test.dueDate && new Date() > new Date(test.dueDate)) {
    throw new Error("Hạn nộp bài đã kết thúc.");
  }

  // Check if there is already an uncompleted attempt
  const existingAttempt = await prisma.studentAttempt.findFirst({
    where: {
      testId,
      userId: session.user.id,
      completedAt: null,
    }
  });

  if (existingAttempt) {
    return { success: true, attempt: existingAttempt };
  }

  // Check if there is already a completed attempt → redirect to results
  const completedAttempt = await prisma.studentAttempt.findFirst({
    where: {
      testId,
      userId: session.user.id,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
  });

  if (completedAttempt) {
    return { success: true, attempt: completedAttempt };
  }

  const attempt = await prisma.studentAttempt.create({
    data: {
      testId,
      userId: session.user.id,
    }
  });

  return { success: true, attempt };
}

export async function deleteStudentAttempt(attemptId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          lesson: { include: { chapter: { include: { course: true } } } },
          course: true,
        },
      },
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  // Ownership check: only ADMIN or the course owner can delete
  const ownerId = attempt.test.lesson?.chapter?.course?.userId ?? attempt.test.course?.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("Unauthorized to delete this attempt");
  }

  await prisma.studentAttempt.delete({
    where: { id: attemptId }
  });

  // Revalidate relevant paths
  if (attempt.test.lessonId) {
    revalidatePath(`/watch/${attempt.test.lessonId}`);
  }
  revalidatePath(`/teacher/tests/${attempt.testId}/analytics`);
  revalidatePath(`/admin/global-analytics`);
  
  // Also revalidate course-specific analytics if applicable
  const courseId = attempt.test.courseId || attempt.test.lesson?.chapter?.courseId;
  if (courseId) {
    revalidatePath(`/teacher/courses/${courseId}/analytics`);
    revalidatePath(`/teacher/courses/${courseId}/analytics/students/${attempt.userId}`);
  }

  return { success: true };
}

// Function to normalize short answers
function normalizeShortAnswer(answer: string | null | undefined) {
  if (!answer) return "";
  // Trim spaces at the ends and convert to lower case
  return answer.trim().toLowerCase();
}

function checkAnswerMatch(provided: string | null | undefined, expected: string | null | undefined, type: string): boolean {
  if (!expected) return false;
  if (!provided) return false;

  const providedNorm = normalizeShortAnswer(provided);
  const expectedOptions = expected.split('|').map(s => normalizeShortAnswer(s));

  if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
    const providedParts = providedNorm.split(',').map(s => s.trim()).filter(Boolean);
    const providedSorted = providedParts.sort().join(',');

    return expectedOptions.some(opt => {
      const optParts = opt.split(',').map(s => s.trim()).filter(Boolean);
      const optSorted = optParts.sort().join(',');
      
      // Exact match
      if (providedSorted === optSorted) return true;

      // Partial match: if student provided at least one answer and ALL of their chosen answers are among the correct options
      if (providedParts.length > 0 && providedParts.every(p => optParts.includes(p))) {
        return true;
      }

      return false;
    });
  }

  // SHORT_ANSWER
  const providedMath = parseMathValue(providedNorm);
  return expectedOptions.some(opt => {
    return opt === providedNorm || parseMathValue(opt) === providedMath;
  });
}

function parseMathValue(val: string): string {
  val = val.trim().replace(/,/g, '.');
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return parseFloat((num / den).toFixed(6)).toString();
      }
    }
  }
  // Normalize decimals: "0.50" -> "0.5", ".5" -> "0.5"
  if (/^-?\\d*\\.?\\d+$/.test(val)) {
     const parsed = parseFloat(val);
     if (!isNaN(parsed)) return parsed.toString();
  }
  return val;
}

function checkSubQuestionCorrect(
  studentAns: string | undefined | null, 
  correctAns: string, 
  type: string
): boolean {
  if (!studentAns) return false;

  if (type === 'SHORT_ANSWER') {
    const studentVal = parseMathValue(studentAns.toLowerCase());
    const correctVal = parseMathValue(correctAns.toLowerCase());
    return studentVal === correctVal;
  }

  return studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase();
}

export async function submitTestAttempt(
  attemptId: string, 
  studentAnswers: { questionId: string, answerProvided: string, subAnswers?: { subQuestionId: string, answerProvided: string }[] }[]
) {
  console.log("[submitTestAttempt] attemptId:", attemptId);
  console.log("[submitTestAttempt] studentAnswers:", JSON.stringify(studentAnswers, null, 2));

  const session = await auth();
  if (!session || !session.user.id) {
    return { success: false, error: "Unauthorized" };
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: { include: { sections: { include: { questions: { include: { subQuestions: true } } } } } } }
  });

  if (!attempt || attempt.userId !== session.user.id) {
    return { success: false, error: "Invalid attempt" };
  }

  // Gracefully handle already submitted attempts
  if (attempt.completedAt) {
    return { success: true, score: attempt.score, alreadySubmitted: true };
  }

  // Map questions for quick lookup
  const questionMap = new Map<string, any>();
  let maxPointsPossible = 0;
  attempt.test.sections.forEach(s => {
    s.questions.forEach(q => {
      questionMap.set(q.id, q);
      maxPointsPossible += (q.points || 0);
    });
  });

  // Check due date
  if (attempt.test.dueDate && new Date() > new Date(attempt.test.dueDate)) {
    return { success: false, error: "Hạn nộp bài đã kết thúc." };
  }

  // Anti-Cheat: Validate time spent
  // const now = new Date();
  // const startTime = new Date(attempt.startedAt);
  // const durationMs = attempt.test.duration * 60 * 1000;
  // const bufferMs = 10 * 60 * 1000; // 10 minutes grace period
  // 
  // if (now.getTime() - startTime.getTime() > durationMs + bufferMs) {
  //   return { success: false, error: "Đã quá thời gian làm bài tối đa. Bài làm không được ghi nhận." };
  // }

  let rawTotalScore = 0;
  const answersData: any[] = [];
  
  for (const ans of studentAnswers) {
    const q = questionMap.get(ans.questionId);
    if (!q) continue; // Skip answers for questions that don't exist in this test

    // Commit temp file if the answer is an uploaded file URL
    if (ans.answerProvided) {
      ans.answerProvided = await commitTempFile(ans.answerProvided) || ans.answerProvided;
    }

    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;
    const subAnswersData: any[] = [];

    if (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE' || q.type === 'SHORT_ANSWER') {
      isCorrect = checkAnswerMatch(ans.answerProvided, q.correctAnswer, q.type);
    } else if (q.type === 'ESSAY') {
      isCorrect = null;
    } else if (q.type === 'MULTIPLE_CHOICE_GROUP') {
      const subAnsInput = ans.subAnswers || [];
      const subQuestions = q.subQuestions || [];
      let wrongCount = 0;

      subQuestions.forEach((subQ: any) => {
        const studentAnsObj = subAnsInput.find((a: any) => a.subQuestionId === subQ.id);
        const studentValue = studentAnsObj ? studentAnsObj.answerProvided : null;
        const isCorrectSub = checkSubQuestionCorrect(studentValue, subQ.correctAnswer, subQ.type);
        
        if (!isCorrectSub) {
          wrongCount++;
        }

        subAnswersData.push({
          subQuestionId: subQ.id,
          answerProvided: studentValue,
          isCorrect: isCorrectSub
        });
      });

      const pointsMap: Record<number, number> = {
        0: 1.0,
        1: 0.5,
        2: 0.25,
        3: 0.1,
        4: 0
      };

      const ratio = pointsMap[wrongCount] ?? 0;
      isCorrect = wrongCount === 0; 
      pointsAwarded = q.points * ratio;
    }

    if (q.type !== 'MULTIPLE_CHOICE_GROUP') {
      if (isCorrect === true) {
        pointsAwarded = q.points;
      }
    }

    if (pointsAwarded > 0) {
      rawTotalScore += pointsAwarded;
    }

    answersData.push({
      attemptId,
      questionId: ans.questionId,
      answerProvided: ans.answerProvided,
      isCorrect,
      pointsAwarded,
      subAnswersData
    });
  }

  // Guard: empty submission or no answers matched
  if (studentAnswers.length === 0) {
    return { success: false, error: "Không có đáp án nào được ghi nhận. Vui lòng tải lại trang và làm bài lại." };
  }

  if (answersData.length === 0) {
    console.error(`[Submit ERROR] No answers matched for attempt ${attemptId}. Test structure might have changed.`);
    return { 
      success: false, 
      error: "Cấu trúc bài thi đã thay đổi. Vui lòng tải lại trang và chọn lại đáp án (Hệ thống đã lưu nháp tự động nếu có thể)." 
    };
  }

  const finalScore = maxPointsPossible > 0 ? Math.round((rawTotalScore / maxPointsPossible) * 10 * 100) / 100 : 0;

  // Use FOR UPDATE to prevent race conditions with saveTestDraft
  const alreadySubmitted = await prisma.$transaction(async (tx) => {
    const locked: Array<{ completedAt: Date | null }> = await tx.$queryRaw`
      SELECT "completedAt" FROM "StudentAttempt" WHERE "id" = ${attemptId} FOR UPDATE
    `;
    if (locked.length === 0 || locked[0].completedAt) {
      return true;
    }

    await tx.studentAnswer.deleteMany({
      where: { attemptId }
    });

    for (const ansData of answersData) {
      await tx.studentAnswer.create({
        data: {
          attemptId: ansData.attemptId,
          questionId: ansData.questionId,
          answerProvided: ansData.answerProvided,
          isCorrect: ansData.isCorrect,
          pointsAwarded: ansData.pointsAwarded,
          subAnswers: ansData.subAnswersData && ansData.subAnswersData.length > 0 ? {
            create: ansData.subAnswersData
          } : undefined
        }
      });
    }

    await tx.studentAttempt.update({
      where: { id: attemptId },
      data: {
        score: finalScore,
        completedAt: new Date(),
      }
    });

    // Auto-mark lesson as completed if this is a lesson-level quiz
    if (attempt.test.lessonId) {
      await tx.progress.upsert({
        where: {
          userId_lessonId: {
            userId: session.user.id!,
            lessonId: attempt.test.lessonId,
          },
        },
        update: { isCompleted: true },
        create: {
          userId: session.user.id!,
          lessonId: attempt.test.lessonId,
          isCompleted: true,
        },
      });
    }

    return false;
  });

  if (alreadySubmitted) {
    return { success: true, score: attempt.score, alreadySubmitted: true };
  }

  if (attempt.test.lessonId) {
    revalidatePath(`/watch/${attempt.test.lessonId}`);
  }

  return { success: true, score: finalScore };
}

// =============================================
// MAPPING ACTIONS
// =============================================

export async function getTeacherCoursesWithLessons() {
  const session = await requireTeacherOrAdmin();

  const isAdminOrTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";

  const courses = await prisma.course.findMany({
    where: isAdminOrTeacher ? {} : { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      chapters: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: {
              test: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  return courses;
}

export async function mapTestToLesson(testId: string, lessonId: string) {
  const session = await requireTeacherOrAdmin();

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
    },
  });

  if (!test) throw new Error("Test not found");

  const ownerId = test.lesson?.chapter?.course?.userId ?? test.course?.userId ?? test.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Check if lesson already has a different test
  const existingTest = await prisma.test.findUnique({
    where: { lessonId },
  });
  if (existingTest && existingTest.id !== testId) {
    throw new Error("Bài học này đã có đề thi khác. Vui lòng gỡ đề cũ trước.");
  }

  await prisma.test.update({
    where: { id: testId },
    data: {
      lessonId,
      courseId: null,
    },
  });

  revalidatePath("/teacher/tests");
  return { success: true };
}

export async function unmapTest(testId: string) {
  const session = await requireTeacherOrAdmin();

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
    },
  });

  if (!test) throw new Error("Test not found");

  const ownerId = test.lesson?.chapter?.course?.userId ?? test.course?.userId ?? test.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  await prisma.test.update({
    where: { id: testId },
    data: {
      lessonId: null,
      courseId: null,
    },
  });

  revalidatePath("/teacher/tests");
  return { success: true };
}

export async function gradeStudentAnswer(
  answerId: string,
  points: number,
  isCorrect: boolean,
  feedback?: string,
) {
  const session = await requireTeacherOrAdmin();

  const answer = await prisma.studentAnswer.findUnique({
    where: { id: answerId },
    include: {
      attempt: {
        include: {
          test: {
            include: {
              lesson: { include: { chapter: { include: { course: true } } } },
              course: true,
              sections: { include: { questions: true } }
            },
          },
        },
      },
    },
  });

  if (!answer) throw new Error("Answer not found");

  const ownerId =
    answer.attempt.test.lesson?.chapter?.course?.userId ??
    answer.attempt.test.course?.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new Error("Unauthorized access");
  }

  // Server-side validation: ensure points are within valid range
  const question = answer.attempt.test.sections
    .flatMap(s => s.questions)
    .find(q => q.id === answer.questionId);
  const maxPoints = question?.points || 0;
  if (points < 0 || points > maxPoints) {
    throw new Error(`Điểm phải từ 0 đến ${maxPoints}`);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update the answer
    await tx.studentAnswer.update({
      where: { id: answerId },
      data: {
        pointsAwarded: points,
        isCorrect,
        ...(feedback !== undefined ? { feedback } : {}),
      },
    });

    // 2. Recalculate total score for the attempt
    const allAnswers = await tx.studentAnswer.findMany({
      where: { attemptId: answer.attemptId },
    });

    const rawTotalScore = allAnswers.reduce((acc, curr) => acc + curr.pointsAwarded, 0);
    
    // Calculate max points possible
    let maxPointsPossible = 0;
    answer.attempt.test.sections.forEach(s => {
      s.questions.forEach(q => {
        maxPointsPossible += (q.points || 0);
      });
    });

    const finalScore = maxPointsPossible > 0 ? Math.round((rawTotalScore / maxPointsPossible) * 10 * 100) / 100 : 0;

    await tx.studentAttempt.update({
      where: { id: answer.attemptId },
      data: { score: finalScore },
    });
  });

  revalidatePath(`/watch/${answer.attempt.test.lessonId}/results/${answer.attemptId}`);
  return { success: true };
}

export async function resubmitEssayAnswer(
  attemptId: string,
  questionId: string,
  answerProvided: string,
) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  const answer = await prisma.studentAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    include: {
      attempt: {
        include: {
          test: {
            include: { sections: { include: { questions: true } } },
          },
        },
      },
      question: true,
    },
  });

  if (!answer) throw new Error("Answer not found");
  if (answer.attempt.userId !== session.user.id) throw new Error("Unauthorized");
  if (answer.question.type !== "ESSAY") throw new Error("Not an essay question");

  await prisma.studentAnswer.update({
    where: { attemptId_questionId: { attemptId, questionId } },
    data: {
      answerProvided,
      isCorrect: null,
      pointsAwarded: 0,
      feedback: null,
    },
  });

  // Recalculate score after resetting essay points to 0
  const allAnswers = await prisma.studentAnswer.findMany({
    where: { attemptId },
  });

  let maxPointsPossible = 0;
  answer.attempt.test.sections.forEach(s => {
    s.questions.forEach(q => {
      maxPointsPossible += (q.points || 0);
    });
  });

  const rawTotalScore = allAnswers.reduce((acc, curr) => acc + curr.pointsAwarded, 0);
  const finalScore = maxPointsPossible > 0 ? Math.round((rawTotalScore / maxPointsPossible) * 10 * 100) / 100 : 0;

  await prisma.studentAttempt.update({
    where: { id: attemptId },
    data: { score: finalScore },
  });

  revalidatePath(`/watch/${answer.attempt.test.lessonId}/results/${attemptId}`);

  return { success: true };
}

// =============================================
// AUTO-SAVE DRAFT ACTIONS
// =============================================

export async function saveTestDraft(attemptId: string, answers: { questionId: string, answerProvided: string }[]) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    select: { userId: true, completedAt: true }
  });

  if (!attempt || attempt.userId !== session.user.id) {
    throw new Error("Invalid attempt");
  }

  // Use a transaction with row-level lock to prevent race with submitTestAttempt
  await prisma.$transaction(async (tx) => {
    // Lock the StudentAttempt row (FOR UPDATE) so that submitTestAttempt's
    // concurrent UPDATE blocks until this transaction completes, preventing
    // the race: saveTestDraft deleteMany+createMany after submitTestAttempt
    // has already graded answers and marked completedAt.
    const locked: Array<{ completedAt: Date | null }> = await tx.$queryRaw`
      SELECT "completedAt" FROM "StudentAttempt" WHERE "id" = ${attemptId} FOR UPDATE
    `;
    if (locked.length === 0 || locked[0].completedAt) return;

    await tx.studentAnswer.deleteMany({
      where: { attemptId }
    });

    if (answers.length > 0) {
      await tx.studentAnswer.createMany({
        data: answers.map(ans => ({
          attemptId,
          questionId: ans.questionId,
          answerProvided: ans.answerProvided,
          pointsAwarded: 0,
        }))
      });
    }
  });

  return { success: true };
}

export async function getTestDraft(attemptId: string) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
  });

  if (!attempt || attempt.userId !== session.user.id) {
    throw new Error("Invalid attempt");
  }

  const answers = await prisma.studentAnswer.findMany({
    where: { attemptId },
    select: {
      questionId: true,
      answerProvided: true,
      subAnswers: {
        select: {
          subQuestionId: true,
          answerProvided: true,
        }
      }
    },
  });

  return { success: true, answers };
}

export async function reopenTestAttempt(attemptId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true }
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  await prisma.studentAttempt.update({
    where: { id: attemptId },
    data: {
      completedAt: null,
      score: null,
    },
  });

  // Revalidate paths so UI updates instantly
  revalidatePath(`/watch/${attempt.test.lessonId}`);
  if (attempt.test.courseId) {
    revalidatePath(`/teacher/courses/${attempt.test.courseId}/analytics`);
  } else {
    // If it's a chapter lesson test, find courseId via chapter
    const lesson = await prisma.lesson.findUnique({
      where: { id: attempt.test.lessonId! },
      include: { chapter: true }
    });
    if (lesson?.chapter?.courseId) {
      revalidatePath(`/teacher/courses/${lesson.chapter.courseId}/analytics`);
    }
  }

  return { success: true };
}
