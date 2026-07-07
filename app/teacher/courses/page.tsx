import { getCourses } from "@/actions/course"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import CreateCourseButton from "@/components/teacher/CreateCourseButton"
import AnalyticsButton from "@/components/teacher/AnalyticsButton"
import { ChevronRight } from "lucide-react"
import { SortSelect } from "@/components/ui/SortSelect"

type TeacherCourse = {
    id: string
    title: string
    thumbnail: string | null
    chapters?: {
        lessons?: unknown[]
    }[]
}

export default async function TeacherCoursesPage({ searchParams }: { searchParams: Promise<{ sort?: "desc" | "asc" | "default" }> }) {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const isAdminOrTeacher = session.user.role === "ADMIN" || session.user.role === "TEACHER";
    
    const params = await searchParams;
    const sortOrder = params.sort === "asc" ? "asc" : (params.sort === "desc" ? "desc" : "default");
    const courses = (await getCourses({
      ...(isAdminOrTeacher ? {} : { userId: session.user.id }),
      sort: sortOrder
    })) as unknown as TeacherCourse[]

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">Khóa học của tôi</h1>
                    <p className="text-slate-500 font-medium">Quản lý nội dung bài giảng và lộ trình học tập của bạn.</p>
                </div>
                <div className="flex items-center gap-3">
                    <SortSelect />
                    <CreateCourseButton />
                </div>
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
                            <div 
                                key={course.id} 
                                className="group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 flex flex-col h-full relative"
                            >
                                <Link href={`/teacher/courses/${course.id}`} className="absolute inset-0 z-0" aria-label={`Xem chi tiết khóa học ${course.title}`} />
                                
                                {/* Thumbnail */}
                                <div className="aspect-[16/10] relative bg-slate-50 overflow-hidden shrink-0 pointer-events-none">
                                    {course.thumbnail ? (
                                        <img 
                                            src={course.thumbnail} 
                                            alt={course.title} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50">
                                            <span className="text-4xl">🎓</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                <div className="p-6 flex-1 flex flex-col space-y-4 pointer-events-none">
                                    <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 uppercase tracking-tight">
                                        {course.title}
                                    </h3>
                                    
                                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cấu trúc</span>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="flex items-center gap-1 text-[11px] font-black text-slate-700">
                                                        <span className="w-1 h-1 bg-blue-600 rounded-full" />
                                                        {course.chapters?.length ?? 0} Chương
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[11px] font-black text-slate-700">
                                                        <span className="w-1 h-1 bg-blue-600 rounded-full" />
                                                        {course.chapters?.reduce((acc, ch) => acc + (ch.lessons?.length ?? 0), 0) ?? 0} Bài
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 pointer-events-auto relative z-10">
                                            <AnalyticsButton href={`/teacher/courses/${course.id}/analytics`} />
                                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-lg">
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
    )
}
