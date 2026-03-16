import CourseCard from "@/components/course/CourseCard"
import { ComponentProps } from "react"
import { getCourses } from "@/actions/course"

export default async function Home() {
  const courses = await getCourses()

  return (

    <div className="min-h-screen bg-gray-50 text-gray-900 selection:bg-purple-100 selection:text-purple-900">


      <main className="container mx-auto py-16 px-6 sm:px-8">
        <div className="mb-16 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900">
            <span className="block mb-2">Khám Phá Tri Thức Mới</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 pb-2">
              Hệ thống học tập trực tuyến
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-500">
            Truy cập các khóa học chất lượng cao và nâng cao kỹ năng của bạn ngay hôm nay.
          </p>
        </div>
        
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl border border-dashed border-gray-200 bg-white">
            <div className="bg-purple-50 p-4 rounded-full mb-4">
              <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-xl font-medium text-gray-900">Chưa có khóa học nào.</p>
            <p className="text-gray-500 mt-2">Hãy quay lại sau để xem các khóa học mới nhất.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {courses.map((course: ComponentProps<typeof CourseCard>['course']) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
