import { getCourses } from "@/actions/course"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import CreateCourseButton from "@/components/teacher/CreateCourseButton"
import { ChevronRight } from "lucide-react"

type TeacherCourse = {
    id: string
    title: string
    thumbnail: string | null
    chapters?: {
        lessons?: unknown[]
    }[]
}

export default async function TeacherCoursesPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const courses = (await getCourses({ userId: session.user.id })) as unknown as TeacherCourse[]

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">Khóa học của tôi</h1>
                    <p className="text-slate-500 font-medium">Quản lý nội dung bài giảng và lộ trình học tập của bạn.</p>
                </div>
                <CreateCourseButton />
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {courses.length === 0 ? (
                        <div className="col-span-full text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center space-y-6">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl">
                                📚
                            </div>
                            <div className="space-y-1 text-center px-6">
                                <p className="text-slate-900 text-xl font-black uppercase">Chưa có khóa học nào</p>
                                <p className="text-slate-400 font-medium">Hãy tạo khóa học đầu tiên để bắt đầu hành trình giảng dạy.</p>
                            </div>
                        </div>
                    ) : (
                        courses.map((course) => (
                            <Link 
                                key={course.id} 
                                href={`/teacher/courses/${course.id}`}
                                className="group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-red-500/5 transition-all duration-500 flex flex-col h-full relative"
                            >
                                {/* Thumbnail */}
                                <div className="aspect-[16/10] relative bg-slate-50 overflow-hidden shrink-0">
                                    {course.thumbnail ? (
                                        <img 
                                            src={course.thumbnail} 
                                            alt={course.title} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
                                            <span className="text-4xl">🎓</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                <div className="p-6 flex-1 flex flex-col space-y-4">
                                    <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-red-600 transition-colors line-clamp-2 uppercase tracking-tight">
                                        {course.title}
                                    </h3>
                                    
                                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cấu trúc</span>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="flex items-center gap-1 text-[11px] font-black text-slate-700">
                                                        <span className="w-1 h-1 bg-red-600 rounded-full" />
                                                        {course.chapters?.length ?? 0} Chương
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[11px] font-black text-slate-700">
                                                        <span className="w-1 h-1 bg-red-600 rounded-full" />
                                                        {course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length ?? 0), 0) ?? 0} Bài
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:bg-red-600 transition-colors shadow-lg">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
    )
}
