import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { getCourseById } from "@/actions/course"
import { CourseBuilder } from "@/components/teacher/course-builder/CourseBuilder"
import { ArrowLeft, BarChart3 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
    params: Promise<{ courseId: string }>
}

export default async function TeacherCourseEditPage({ params }: Props) {
    const session = await auth()
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
        redirect("/login")
    }

    const { courseId } = await params
    const course = await getCourseById(courseId)

    if (!course) {
        return notFound()
    }

    return (
        <div className="page-shell pb-20">
             <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-5xl">
                  {/* Header & Back Button */}
                  <div className="flex flex-col gap-4 mb-8">
                      <Button variant="ghost" asChild className="w-fit rounded-xl -ml-2 text-slate-500 hover:text-slate-900">
                          <Link href="/teacher/courses">
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Quay lại danh sách
                          </Link>
                      </Button>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Quản lý khóa học</h1>
                              <p className="text-slate-500 text-sm font-medium uppercase tracking-tight">Thiết lập chương trình và nội dung bài giảng.</p>
                          </div>
                          <Button asChild className="rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-black uppercase text-xs h-12 px-6">
                              <Link href={`/teacher/courses/${courseId}/analytics`}>
                                  <BarChart3 className="w-4 h-4 mr-2" />
                                  Thống kê điểm & Tiến độ
                              </Link>
                          </Button>
                      </div>
                  </div>

                  {/* MAIN COURSE BUILDER */}
                  {/* @ts-ignore - known relation type mismatch that is actually compatible at runtime */}
                  <CourseBuilder course={course} />
             </div>
        </div>
    )
}
