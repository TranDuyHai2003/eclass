"use client"

import { useEffect, useState } from "react"
import { getAnalytics } from "@/actions/analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"

type AnalyticsData = {
    overall: {
        totalUsers: number
        totalCourses: number
        totalViews: number
    }
    topLessons: {
        id: string
        title: string
        viewCount: number
        chapter?: {
            course?: {
                title: string
            } | null
        } | null
    }[]
    topUsers: {
        id: string
        name: string | null
        email: string
        completedLessons: number
    }[]
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const res = await getAnalytics()
            setData(res)
        } catch {
            toast.error("Không thể tải dữ liệu thống kê")
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải thống kê...</div>
    if (!data) return <div className="p-8 text-center text-gray-500">Không có dữ liệu.</div>

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Thống kê hệ thống</h1>

            {/* Overall Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="card-surface rounded-[2rem] border-border/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng người dùng</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.overall.totalUsers}</div>
                    </CardContent>
                </Card>
                <Card className="card-surface rounded-3xl border-border/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng khóa học</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.overall.totalCourses}</div>
                    </CardContent>
                </Card>
                <Card className="card-surface rounded-3xl border-border/60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng lượt học</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.overall.totalViews}</div>
                        <p className="text-xs text-muted-foreground">
                             Số bài học đã được xem
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Top Lessons */}
                <Card className="col-span-1 card-surface rounded-3xl border-border/60">
                    <CardHeader>
                        <CardTitle>Bài học xem nhiều nhất</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bài học</TableHead>
                                    <TableHead className="text-right">Lượt xem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.topLessons.map((lesson) => (
                                    <TableRow key={lesson.id}>
                                        <TableCell>
                                            <div className="font-medium">{lesson.title}</div>
                                            <div className="text-sm text-muted-foreground hidden sm:block">
                                                {lesson.chapter?.course?.title}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold w-[100px]">
                                            {lesson.viewCount}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.topLessons.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Top Users */}
                <Card className="col-span-1 card-surface rounded-3xl border-border/60">
                    <CardHeader>
                        <CardTitle>Học viên chăm chỉ nhất</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Học viên</TableHead>
                                    <TableHead className="text-right">Bài đã học</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.topUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.name || "N/A"}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold w-[100px]">
                                            {user.completedLessons}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {data.topUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground">Chưa có dữ liệu</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
