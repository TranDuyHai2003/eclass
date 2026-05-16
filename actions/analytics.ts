"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

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
        select: { id: true, name: true, email: true, image: true }
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

export async function getCourseProgressMatrix(courseId: string, month: number, year: number) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    console.log(`[MATRIX] Fetching progress for course: ${courseId}, month: ${month}/${year}`);

    // 1. Get all students enrolled in the course (ACTIVE or PENDING)
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: { in: ["ACTIVE", "PENDING"] } },
        include: { user: { select: { id: true, name: true, email: true } } }
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

    // 3. Find any additional students who took tests in this course but aren't in the enrollment list
    const attemptsForThisCourse = await prisma.studentAttempt.findMany({
        where: { testId: { in: testIds } },
        select: { userId: true },
        distinct: ['userId']
    });
    
    const extraStudentIds = attemptsForThisCourse
        .map(a => a.userId)
        .filter(id => !enrollments.some(e => e.userId === id));
    
    const extraStudents = extraStudentIds.length > 0 
        ? await prisma.user.findMany({
            where: { id: { in: extraStudentIds } },
            select: { id: true, name: true, email: true }
          })
        : [];

    const allStudents = [
        ...enrollments.map(e => e.user),
        ...extraStudents
    ];
    
    console.log(`[MATRIX] Total students to show: ${allStudents.length} (${enrollments.length} enrolled, ${extraStudents.length} from attempts)`);

    // Filter tests assigned in the specific month/year - REMOVED strictly for createdAt
    // Instead, we show ALL tests if no specific filter matches, or we keep it for now but maybe broaden it.
    // THE BUG: Filtering by test.createdAt makes the matrix columns disappear if tests were created in old months.
    // SOLUTION: Show all tests that have AT LEAST ONE attempt in the selected month OR all tests in course.
    
    // For now, let's show ALL tests in the course to ensure nothing is missed.
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
            
            // If month/year filter is provided, we might want to prioritize attempts in that month
            // but for a matrix, usually we want the best score ever or latest.
            const bestAttempt = studentTestAttempts.length > 0 ? studentTestAttempts[0] : null;

            if (bestAttempt) {
                totalScore += (bestAttempt.score || 0);
                completedCount++;
                return {
                    testId: test.id,
                    status: "COMPLETED",
                    score: bestAttempt.score,
                    completedAt: bestAttempt.completedAt
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
        matrix
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
}) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    const { startDate, endDate, courseIds } = filters;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // 1. Get all relevant students
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            enrollments: courseIds && courseIds.length > 0
                ? { some: { courseId: { in: courseIds } } }
                : undefined,
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            enrollments: {
                select: {
                    course: {
                        select: { id: true, title: true }
                    }
                }
            },
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
                                        select: { courseId: true }
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
            courseId: true,
            lesson: {
                select: {
                    chapter: {
                        select: {
                            courseId: true
                        }
                    }
                }
            }
        }
    });

    // Map tests to their courseId for easy lookup
    const testToCourseMap = new Map<string, string>();
    allTests.forEach(t => {
        const cId = t.courseId || t.lesson?.chapter?.courseId;
        if (cId) testToCourseMap.set(t.id, cId);
    });

    // 3. Process data
    const results = students.map(student => {
        const studentEnrollments = student.enrollments.map(e => e.course.id);
        
        // Tests that this student *should* have done (tests in courses they are enrolled in)
        const testsInStudentCourses = allTests.filter(t => {
            const cId = t.courseId || t.lesson?.chapter?.courseId;
            return cId && studentEnrollments.includes(cId);
        });

        const studentAttempts = student.attempts;
        // Group by testId to get unique completed tests
        const completedTestIds = new Set(studentAttempts.map(a => a.testId));
        
        const totalAssigned = testsInStudentCourses.length;
        const completedCount = completedTestIds.size;
        
        // Calculate average score (best attempt per test)
        const bestScoresMap = new Map<string, number>();
        studentAttempts.forEach(a => {
            const currentBest = bestScoresMap.get(a.testId) || 0;
            if (a.score !== null && a.score > currentBest) {
                bestScoresMap.set(a.testId, a.score);
            }
        });

        const totalBestScores = Array.from(bestScoresMap.values()).reduce((a, b) => a + b, 0);
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

        const courseProgress = student.enrollments.map(e => {
            return {
                id: e.course.id,
                title: e.course.title,
                tests: attemptsByCourse.get(e.course.id) || []
            };
        });

        return {
            id: student.id,
            name: student.name || student.email,
            email: student.email,
            image: student.image,
            courses: courseProgress,
            stats: {
                totalAssigned,
                completedCount,
                averageScore: Math.round(averageScore * 100) / 100,
                completionRate: totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0
            },
            // For the expandable row (backwards compatibility)
            details: studentAttempts.map(a => ({
                testId: a.testId,
                testTitle: a.test.lesson?.title || (a.test.courseId ? "Bài kiểm tra cuối khóa" : a.test.title),
                score: a.score,
                completedAt: a.completedAt,
                courseId: a.test.courseId || a.test.lesson?.chapter?.courseId
            }))
        };
    });

    return {
        students: results,
        totalTestsAcrossFilteredCourses: allTests.length
    };
}


