"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { StudentType } from "@prisma/client"

export async function getAnalytics() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Unauthorized")
    }

    // 1. Overall Stats
    const totalUsers = await prisma.user.count()
    const totalCourses = await prisma.course.count()
    const totalViews = await prisma.progress.count() // Basic "views" metric

    // 2. Top Lessons (by number of Progress entries)
    // Note: Prisma doesn't support complex group-by + relation fetch easily in one go.
    // We'll use groupBy to get IDs and counts, then fetch details.
    const topLessonsGrouped = await prisma.progress.groupBy({
        by: ['lessonId'],
        _count: {
            lessonId: true
        },
        orderBy: {
            _count: {
                lessonId: 'desc'
            }
        },
        take: 5
    })

    const topLessonIds = topLessonsGrouped.map(item => item.lessonId)
    const topLessonsDetails = await prisma.lesson.findMany({
        where: { id: { in: topLessonIds } },
        include: {
            chapter: {
                include: {
                    course: {
                        select: { title: true }
                    }
                }
            }
        }
    })

    // Merge count back into details
    const topLessons = topLessonsDetails.map(lesson => {
        const stats = topLessonsGrouped.find(g => g.lessonId === lesson.id)
        return {
            ...lesson,
            viewCount: stats?._count.lessonId || 0
        }
    }).sort((a, b) => b.viewCount - a.viewCount)


    // 3. Top Learners (by number of Progress entries)
    const topUsersGrouped = await prisma.progress.groupBy({
        by: ['userId'],
        _count: {
            userId: true
        },
        orderBy: {
            _count: {
                userId: 'desc'
            }
        },
        take: 5
    })

    const topUserIds = topUsersGrouped.map(item => item.userId)
    const topUsersDetails = await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, name: true, email: true, image: true, studentType: true }
    })

    const topUsers = topUsersDetails.map(user => {
        const stats = topUsersGrouped.find(u => u.userId === user.id)
        return {
            ...user,
            completedLessons: stats?._count.userId || 0
        }
    }).sort((a, b) => b.completedLessons - a.completedLessons)

    return {
        overall: {
            totalUsers,
            totalCourses,
            totalViews
        },
        topLessons,
        topUsers
    }
}

export async function getAttemptStatistics(attemptId: string) {
  const session = await auth();
  if (!session || !session.user.id) {
    throw new Error("Unauthorized");
  }

  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          lesson: { select: { title: true } },
          course: { select: { title: true } },
          sections: {
            include: {
              questions: {
                orderBy: { position: "asc" }
              }
            }
          }
        }
      },
      answers: {
        include: {
          question: true
        }
      }
    }
  });

  if (!attempt) throw new Error("Attempt not found");

  // Synchronize test title with parent name
  const effectiveTestTitle = attempt.test.lesson?.title || (attempt.test.courseId ? "Bài kiểm tra cuối khóa" : attempt.test.title || "Bài kiểm tra");
  
  // Authorization: Student who made the attempt, or Admin/Teacher
  const isOwner = attempt.userId === session.user.id;
  const isAuthorized = isOwner || session.user.role === "ADMIN" || session.user.role === "TEACHER";
  
  if (!isAuthorized) {
    throw new Error("Unauthorized");
  }

  const answers = attempt.answers;
  const totalQuestions = attempt.test.sections.reduce((acc, section) => acc + section.questions.length, 0);
  const correctAnswers = answers.filter(a => a.isCorrect === true).length;
  const wrongAnswers = answers.filter(a => a.isCorrect === false).length;
  const unanswered = totalQuestions - answers.length;

  // Analytics by category
  const categoryStats: Record<string, { total: number, correct: number, wrong: number }> = {};

  // Initialize categories from all questions in the test to show 0% if none answered
  attempt.test.sections.forEach(s => {
    s.questions.forEach(q => {
      const cat = q.category || "Chưa phân loại";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, correct: 0, wrong: 0 };
      }
      categoryStats[cat].total++;
    });
  });

  answers.forEach(ans => {
    const cat = ans.question.category || "Chưa phân loại";
    if (ans.isCorrect === true) categoryStats[cat].correct++;
    else if (ans.isCorrect === false) categoryStats[cat].wrong++;
  });

  const analytics = Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    ...stats,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  }));

  // Recommendations: Find categories with low accuracy (< 60%)
  const weakCategories = analytics
    .filter(a => a.accuracy < 60 && a.total > 0)
    .map(a => a.category);

  let recommendations: any[] = [];
  if (weakCategories.length > 0) {
     // Search for lessons that might be relevant
     recommendations = await prisma.lesson.findMany({
       where: {
         OR: weakCategories.map(cat => ({
           title: { contains: cat, mode: 'insensitive' }
         }))
       },
       take: 3,
       select: { id: true, title: true, type: true }
     });
  }

  // List of wrong questions with their explanations
  const wrongQuestions = answers
    .filter(a => a.isCorrect === false)
    .map(a => ({
      id: a.question.id,
      content: "Câu hỏi " + (a.question.position + 1), // Simplification: we might need actual content if stored
      userAnswer: a.answerProvided,
      correctAnswer: a.question.correctAnswer,
      explanation: a.question.explanation,
      category: a.question.category,
      subCategory: a.question.subCategory,
      difficulty: a.question.difficulty,
      videoUrl: a.question.videoUrl
    }));

  return {
    attempt, // Return the full object for the UI to use
    summary: {
      score: attempt.score,
      correct: correctAnswers,
      wrong: wrongAnswers,
      unanswered,
      total: totalQuestions,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    },
    analytics,
    wrongQuestions,
    recommendations
  };
}

export async function getCourseProgressMatrix(courseId: string, month: number, year: number, studentType?: StudentType) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    console.log(`[MATRIX] Fetching progress for course: ${courseId}, month: ${month}/${year}, type: ${studentType}`);

    // 1. Get all approved students (universal access model)
    const allStudents = await prisma.user.findMany({
        where: { 
            role: "STUDENT",
            isApproved: true,
            studentType: studentType ? studentType : undefined
        },
        select: { id: true, name: true, email: true, studentType: true }
    });
    
    // 2. Get all tests in this course
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            chapters: { include: { lessons: { include: { test: true } } } },
            finalTest: true
        }
    });

    if (!course) {
        console.error(`[MATRIX] Course not found: ${courseId}`);
        throw new Error("Course not found");
    }

    const allTests: any[] = [];
    course.chapters.forEach(chapter => {
        chapter.lessons.forEach(lesson => {
            if (lesson.test) {
                allTests.push({ ...lesson.test, lessonTitle: lesson.title });
            }
        });
    });
    if (course.finalTest) {
        allTests.push({ ...course.finalTest, lessonTitle: "Bài kiểm tra cuối khóa" });
    }
    
    const testIds = allTests.map(t => t.id);

    // 3. Filter tests (show all tests in the course)
    const filteredTests = allTests; 
    
    const studentIds = allStudents.map(s => s.id);

    // 4. Get all attempts for these students and tests
    const attempts = await prisma.studentAttempt.findMany({
        where: {
            testId: { in: testIds },
            userId: { in: studentIds },
            completedAt: { not: null }
        },
        orderBy: [
            { userId: 'asc' },
            { testId: 'asc' },
            { score: 'desc' } // First one per (user, test) will be highest score
        ]
    });
    console.log(`[MATRIX] Found ${attempts.length} valid student attempts`);

    // 5. Group attempts by student and test
    const matrix = allStudents.map(student => {
        let totalScore = 0;
        let completedCount = 0;
        
        const testStatuses = filteredTests.map(test => {
            // Find all attempts for this student and this test
            const studentTestAttempts = attempts.filter(a => a.userId === student.id && a.testId === test.id);
            
            // For a matrix, we want the best score.
            const bestAttempt = studentTestAttempts.length > 0 ? studentTestAttempts[0] : null;

            if (bestAttempt) {
                totalScore += (bestAttempt.score || 0);
                completedCount++;
                return {
                    testId: test.id,
                    status: "COMPLETED",
                    score: bestAttempt.score,
                    completedAt: bestAttempt.completedAt,
                    attemptId: bestAttempt.id
                };
            } else {
                return {
                    testId: test.id,
                    status: "MISSED",
                    score: 0
                };
            }
        });

        const missedCount = filteredTests.length - completedCount;

        return {
            studentId: student.id,
            studentName: student.name || student.email,
            studentEmail: student.email,
            studentType: student.studentType,
            testStatuses,
            totalScore,
            completedCount,
            missedCount,
            averageScore: completedCount > 0 ? Math.round((totalScore / completedCount) * 100) / 100 : 0
        };
    });

    // Sort by total score for leaderboard
    matrix.sort((a, b) => b.totalScore - a.totalScore);
    console.log(`[MATRIX] Matrix generation complete`);

    return {
        tests: filteredTests.map(t => ({ id: t.id, title: t.lessonTitle })),
        matrix,
        summary: {
            totalStudents: matrix.length,
            onlineStudents: matrix.filter(s => s.studentType === 'ONLINE').length,
            offlineStudents: matrix.filter(s => s.studentType === 'OFFLINE').length,
            averageScore: matrix.length > 0 ? matrix.reduce((acc, s) => acc + s.averageScore, 0) / matrix.length : 0,
            averageCompletion: matrix.length > 0 ? matrix.reduce((acc, s) => acc + (s.completedCount / (s.completedCount + s.missedCount)) * 100, 0) / matrix.length : 0,
        }
    };
}

export async function getStudentCourseProgress(courseId: string, studentId: string) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER" && session.user.id !== studentId)) {
        throw new Error("Unauthorized");
    }

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
            chapters: {
                include: {
                    lessons: {
                        include: {
                            test: {
                                include: {
                                    attempts: {
                                        where: { userId: studentId, completedAt: { not: null } },
                                        orderBy: { score: 'desc' },
                                        take: 1
                                    }
                                }
                            }
                        }
                    }
                }
            },
            finalTest: {
                include: {
                    attempts: {
                        where: { userId: studentId, completedAt: { not: null } },
                        orderBy: { score: 'desc' },
                        take: 1
                    }
                }
            }
        }
    });

    if (!course) throw new Error("Course not found");

    const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, email: true, image: true }
    });

    if (!student) throw new Error("Student not found");

    const progressData: any[] = [];
    
    course.chapters.forEach(chapter => {
        chapter.lessons.forEach(lesson => {
            if (lesson.test) {
                const bestAttempt = lesson.test.attempts[0];
                progressData.push({
                    testId: lesson.test.id,
                    lessonId: lesson.id,
                    title: lesson.title,
                    score: bestAttempt ? bestAttempt.score : null,
                    completedAt: bestAttempt ? bestAttempt.completedAt : null,
                    attemptId: bestAttempt ? bestAttempt.id : null,
                    status: bestAttempt ? "COMPLETED" : "MISSED"
                });
            }
        });
    });

    if (course.finalTest) {
        const bestAttempt = course.finalTest.attempts[0];
        progressData.push({
            testId: course.finalTest.id,
            lessonId: null,
            title: "Bài kiểm tra cuối khóa",
            score: bestAttempt ? bestAttempt.score : null,
            completedAt: bestAttempt ? bestAttempt.completedAt : null,
            attemptId: bestAttempt ? bestAttempt.id : null,
            status: bestAttempt ? "COMPLETED" : "MISSED"
        });
    }

    return {
        student,
        courseTitle: course.title,
        progress: progressData
    };
}

export async function getAnalyticsCourses() {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    return await prisma.course.findMany({
        select: { id: true, title: true },
        orderBy: { title: 'asc' }
    });
}

export async function getGlobalTestAnalytics(filters: {
    startDate?: string;
    endDate?: string;
    courseIds?: string[];
    studentType?: StudentType;
}) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    const { startDate, endDate, courseIds, studentType } = filters;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // 1. Get all approved students (universal access model)
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            isApproved: true,
            studentType: studentType ? studentType : undefined,
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            studentType: true,
            attempts: {
                where: {
                    completedAt: {
                        not: null,
                        ...(start || end ? {
                            gte: start,
                            lte: end
                        } : {})
                    },
                    test: courseIds && courseIds.length > 0
                        ? {
                            OR: [
                                { courseId: { in: courseIds } },
                                { lesson: { chapter: { courseId: { in: courseIds } } } }
                            ]
                        }
                        : undefined
                },
                select: {
                    id: true,
                    score: true,
                    completedAt: true,
                    testId: true,
                    test: {
                        select: {
                            id: true,
                            title: true,
                            courseId: true,
                            lesson: {
                                select: {
                                    title: true,
                                    chapter: {
                                        select: { 
                                            courseId: true,
                                            course: { select: { title: true } }
                                        }
                                    }
                                }
                            },
                            course: {
                                select: { title: true }
                            }
                        }
                    }
                }
            }
        }
    });

    // 2. Get all tests in the selected courses to calculate "Total Assigned"
    const allTests = await prisma.test.findMany({
        where: (courseIds && courseIds.length > 0)
            ? {
                OR: [
                    { courseId: { in: courseIds } },
                    { lesson: { chapter: { courseId: { in: courseIds } } } }
                ]
            }
            : {
                OR: [
                    { courseId: { not: null } },
                    { lesson: { chapter: {} } }
                ]
            },
        select: {
            id: true,
            title: true,
            courseId: true,
            lesson: {
                select: {
                    title: true,
                    position: true,
                    chapter: {
                        select: {
                            courseId: true,
                            position: true,
                            course: { select: { title: true } }
                        }
                    }
                }
            },
            course: {
                select: { title: true }
            }
        }
    });

    // 3. Build global courses schema (Universal Access) with natural sorting
    const coursesSchemaMap = new Map<string, { id: string, title: string, tests: { id: string, title: string, position: number }[] }>();

    // Custom sort: Course Title -> Chapter Position -> Lesson Position
    const sortedAllTests = [...allTests].sort((a, b) => {
        const aCourseTitle = a.course?.title || a.lesson?.chapter?.course?.title || "";
        const bCourseTitle = b.course?.title || b.lesson?.chapter?.course?.title || "";

        if (aCourseTitle !== bCourseTitle) return aCourseTitle.localeCompare(bCourseTitle);

        const aChapterPos = a.lesson?.chapter?.position ?? 999;
        const bChapterPos = b.lesson?.chapter?.position ?? 999;

        if (aChapterPos !== bChapterPos) return aChapterPos - bChapterPos;

        const aLessonPos = a.lesson?.position ?? 999;
        const bLessonPos = b.lesson?.position ?? 999;

        return aLessonPos - bLessonPos;
    });

    sortedAllTests.forEach((t, idx) => {
        const cId = t.courseId || t.lesson?.chapter?.courseId;
        const cTitle = t.course?.title || t.lesson?.chapter?.course?.title || "Khóa học";
        const testTitle = t.title || t.lesson?.title || (t.courseId ? "Bài kiểm tra cuối khóa" : `Bài ${idx + 1}`);
        if (cId) {
            if (!coursesSchemaMap.has(cId)) {
                coursesSchemaMap.set(cId, { id: cId, title: cTitle, tests: [] }); 
            }
            coursesSchemaMap.get(cId)!.tests.push({ id: t.id, title: testTitle, position: t.lesson?.position ?? 999 });
        }
    });

    const coursesSchema = Array.from(coursesSchemaMap.values());
    // 4. Process student data
    const results = students.map(student => {
        const studentAttemptsRaw = student.attempts;
        
        // Group by testId and keep only the best attempt for each test
        const bestAttemptsMap = new Map<string, any>();
        studentAttemptsRaw.forEach(a => {
            const currentBest = bestAttemptsMap.get(a.testId);
            if (!currentBest || (a.score !== null && a.score > (currentBest.score || 0))) {
                bestAttemptsMap.set(a.testId, a);
            }
        });
        
        const studentAttempts = Array.from(bestAttemptsMap.values());
        const completedTestIds = new Set(studentAttempts.map(a => a.testId));
        
        // Universal access: totalAssigned is all tests in filtered view
        const totalAssigned = allTests.length;
        const completedCount = completedTestIds.size;
        
        const totalBestScores = studentAttempts.reduce((acc, a) => acc + (a.score || 0), 0);
        const averageScore = completedCount > 0 ? totalBestScores / completedCount : 0;

        // Group student attempts by course for better reporting
        const attemptsByCourse = new Map<string, any[]>();
        studentAttempts.forEach(a => {
            const cId = a.test.courseId || a.test.lesson?.chapter?.courseId;
            if (cId) {
                if (!attemptsByCourse.has(cId)) attemptsByCourse.set(cId, []);
                attemptsByCourse.get(cId)!.push({
                    testId: a.testId,
                    title: a.test.lesson?.title || (a.test.courseId ? "Bài kiểm tra cuối khóa" : a.test.title),
                    score: a.score,
                    completedAt: a.completedAt
                });
            }
        });

        const courseProgress = coursesSchema.map(schema => {
            return {
                id: schema.id,
                title: schema.title,
                tests: attemptsByCourse.get(schema.id) || []
            };
        });

        return {
            id: student.id,
            name: student.name || student.email,
            email: student.email,
            image: student.image,
            studentType: student.studentType,
            courses: courseProgress,
            stats: {
                totalAssigned,
                completedCount,
                averageScore: Math.round(averageScore * 100) / 100,
                completionRate: totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0
            },
            // For the expandable row (backwards compatibility)
            details: studentAttempts.map(a => ({
                id: a.id,
                testId: a.testId,
                testTitle: a.test.lesson?.title || (a.test.courseId ? "Bài kiểm tra cuối khóa" : a.test.title),
                score: a.score,
                completedAt: a.completedAt,
                courseId: a.test.courseId || a.test.lesson?.chapter?.courseId
            }))
        };
    });

    // Calculate additional statistics for summary
    const distribution = {
        excellent: results.filter(s => s.stats.averageScore >= 8).length,
        good: results.filter(s => s.stats.averageScore >= 6.5 && s.stats.averageScore < 8).length,
        average: results.filter(s => s.stats.averageScore >= 5 && s.stats.averageScore < 6.5).length,
        weak: results.filter(s => s.stats.averageScore < 5).length,
    };

    const scores = results.map(s => s.stats.averageScore).filter(s => s > 0);
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    return {
        students: results,
        coursesSchema,
        totalTestsAcrossFilteredCourses: allTests.length,
        summary: {
            totalStudents: results.length,
            onlineStudents: results.filter(s => s.studentType === 'ONLINE').length,
            offlineStudents: results.filter(s => s.studentType === 'OFFLINE').length,
            averageScore: results.length > 0 ? results.reduce((acc, s) => acc + s.stats.averageScore, 0) / results.length : 0,
            averageCompletion: results.length > 0 ? results.reduce((acc, s) => acc + s.stats.completionRate, 0) / results.length : 0,
            maxScore,
            minScore,
            distribution
        }
    };
}


