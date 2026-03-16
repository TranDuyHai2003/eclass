import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { getCourseById } from "@/actions/course"
import { CourseBuilder } from "@/components/teacher/course-builder/CourseBuilder"

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
        <div className="min-h-screen bg-gray-50/50 pb-20">
             <div className="container mx-auto py-6 max-w-5xl">
                  {/* Breadcrumb or Back link could go here */}
                  <div className="mb-6">
                      <h1 className="text-2xl font-bold text-gray-900">Quản lý nội dung khóa học</h1>
                      <p className="text-gray-500 text-sm">Xây dựng chương trình giảng dạy và cài đặt thông tin.</p>
                  </div>

                  {/* MAIN COURSE BUILDER */}
                  {/* @ts-ignore - known relation type mismatch that is actually compatible at runtime */}
                  <CourseBuilder course={course} />
             </div>
        </div>
    )
}
