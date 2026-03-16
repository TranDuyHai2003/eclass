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
