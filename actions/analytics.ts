"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { StudentType, Level } from "@prisma/client"
import { compareVietnameseName } from "@/lib/utils"

export async function getAnalytics() {
    const session = await auth()
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized")
    }

    // 1. Overall Statistics
    const totalUsers = await prisma.user.count({ where: { role: 'STUDENT' } })
    const totalCourses = await prisma.course.count()
    const totalViews = await prisma.progress.count({ where: { isCompleted: true } })

    // 2. Top Lessons (by completion count as proxy for views)
    const topLessonsRaw = await prisma.progress.groupBy({
        by: ['lessonId'],
        _count: {
            _all: true
        },
        orderBy: {
            _count: {
                lessonId: 'desc'
            }
        },
        take: 5
    });

    const topLessons = await Promise.all(topLessonsRaw.map(async (item) => {
        const lesson = await prisma.lesson.findUnique({
            where: { id: item.lessonId },
            select: {
                id: true,
                title: true,
                chapter: {
                    select: {
                        course: {
                            select: { title: true }
                        }
                    }
                }
            }
        });
        return {
            id: lesson?.id || item.lessonId,
            title: lesson?.title || "N/A",
            viewCount: item._count._all,
            chapter: lesson?.chapter
        };
    }));

    // 3. Top Users (by completed lessons)
    const topUsersRaw = await prisma.progress.groupBy({
        by: ['userId'],
        where: { isCompleted: true },
        _count: {
            _all: true
        },
        orderBy: {
            _count: {
                userId: 'desc'
            }
        },
        take: 5
    });

    const topUsers = await Promise.all(topUsersRaw.map(async (item) => {
        const user = await prisma.user.findUnique({
            where: { id: item.userId },
            select: {
                id: true,
                name: true,
                email: true,
                studentType: true
            }
        });
        return {
            id: user?.id || item.userId,
            name: user?.name || "N/A",
            email: user?.email || "N/A",
            completedLessons: item._count._all,
            studentType: user?.studentType || "ONLINE"
        };
    }));

    return {
        overall: {
            totalUsers,
            totalCourses,
            totalViews
        },
        topLessons,
        topUsers
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

    // Sort by student name for leaderboard
    matrix.sort((a, b) => compareVietnameseName(a.studentName, b.studentName));
    console.log(`[MATRIX] Matrix generation complete`);

    const allAverageScores = matrix.map(s => s.averageScore).filter(s => s > 0);
    const maxScore = allAverageScores.length > 0 ? Math.max(...allAverageScores) : 0;
    const minScore = allAverageScores.length > 0 ? Math.min(...allAverageScores) : 0;

    return {
        tests: filteredTests.map(t => ({ id: t.id, title: t.lessonTitle })),
        matrix,
        summary: {
            totalStudents: matrix.length,
            onlineStudents: matrix.filter(s => s.studentType === 'ONLINE').length,
            offlineStudents: matrix.filter(s => s.studentType === 'OFFLINE').length,
            averageScore: matrix.length > 0 ? matrix.reduce((acc, s) => acc + s.averageScore, 0) / matrix.length : 0,
            averageCompletion: matrix.length > 0 ? matrix.reduce((acc, s) => acc + (s.completedCount / (s.completedCount + s.missedCount)) * 100, 0) / matrix.length : 0,
            maxScore,
            minScore,
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
                    score: bestAttempt ? (bestAttempt.score !== null ? Math.round(bestAttempt.score * 100) / 100 : null) : null,
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
            score: bestAttempt ? (bestAttempt.score !== null ? Math.round(bestAttempt.score * 100) / 100 : null) : null,
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
    level?: Level;
    search?: string;
    sortBy?: string;
}) {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        throw new Error("Unauthorized");
    }

    const { startDate, endDate, courseIds, studentType, level, search, sortBy } = filters;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // 1. Get all approved students (universal access model) with optional search
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            isApproved: true,
            studentType: studentType ? studentType : undefined,
            level: level ? level : undefined,
            OR: search ? [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ] : undefined
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

    sortedAllTests.forEach((t) => {
        const cId = t.courseId || t.lesson?.chapter?.courseId;
        const cTitle = t.course?.title || t.lesson?.chapter?.course?.title || "Khóa học";
        const testTitle = t.title || t.lesson?.title || (t.courseId ? "Bài kiểm tra cuối khóa" : `Bài ${t.id.slice(-4)}`);
        if (cId) {
            if (!coursesSchemaMap.has(cId)) {
                coursesSchemaMap.set(cId, { id: cId, title: cTitle, tests: [] }); 
            }
            coursesSchemaMap.get(cId)!.tests.push({ id: t.id, title: testTitle, position: t.lesson?.position ?? 999 });
        }
    });

    const coursesSchema = Array.from(coursesSchemaMap.values());
    // 4. Process student data
    let results = students.map(student => {
        const studentAttemptsRaw = student.attempts.filter(a => a.completedAt !== null);
        
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

    // 5. Apply Sorting
    if (sortBy === "score_desc") {
        results.sort((a, b) => b.stats.averageScore - a.stats.averageScore);
    } else if (sortBy === "score_asc") {
        results.sort((a, b) => a.stats.averageScore - b.stats.averageScore);
    } else {
        results.sort((a, b) => compareVietnameseName(a.name, b.name));
    }

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

export async function getAttemptStatistics(attemptId: string) {
    const session = await auth();
    if (!session) throw new Error("Unauthorized");

    const attempt = await prisma.studentAttempt.findUnique({
        where: { id: attemptId },
        include: {
            answers: {
                include: {
                    question: true,
                    subAnswers: true
                }
            },
            test: {
                include: {
                    sections: {
                        include: {
                            questions: {
                                include: { subQuestions: true },
                                orderBy: { position: 'asc' }
                            }
                        },
                        orderBy: { position: 'asc' }
                    }
                }
            }
        }
    });

    return { attempt };
}
