import { getCourses } from "@/actions/course"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import CreateCourseButton from "@/components/teacher/CreateCourseButton"

type TeacherCourse = {
    id: string
    title: string
    thumbnail: string | null
    chapters?: {
        lessons?: unknown[]
    }[]
}

export default async function TeacherCoursesPage() {
    const courses = (await getCourses()) as unknown as TeacherCourse[]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Khóa học của tôi</h1>
                    <p className="text-gray-500 mt-1">Quản lý và tạo khóa học mới của bạn</p>
                </div>
                <CreateCourseButton />
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {courses.length === 0 ? (
                        <div className="col-span-full text-center py-20 card-surface rounded-3xl border-dashed border-border/60">
                            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <p className="text-gray-500 text-lg font-medium">Chưa có khóa học nào.</p>
                            <p className="text-gray-400 mt-1">Bấm &quot;Tạo khóa học&quot; để bắt đầu.</p>
                        </div>
                    ) : (
                        courses.map((course) => (
                            <Link 
                                key={course.id} 
                                href={`/teacher/courses/${course.id}`}
                                className="group card-surface rounded-3xl overflow-hidden card-hover"
                            >
                                {/* Image background or default gradient */}
                                <div className="aspect-video relative bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center overflow-hidden">
                                    {course.thumbnail ? (
                                        <img 
                                            src={course.thumbnail} 
                                            alt={course.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <svg className="w-12 h-12 text-red-300 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2">{course.title}</h3>
                                    <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                            {course.chapters?.length ?? 0} chương
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            {course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length ?? 0), 0) ?? 0} bài
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
    )
}
