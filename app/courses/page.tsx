
import { getCourses } from "@/actions/course";
import CourseCard from "@/components/course/CourseCard";

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <div className="page-shell min-h-screen">
      <main className="container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">
              Tất cả Khóa học
            </h1>
            <p className="text-sm text-gray-500">
              Khám phá và bắt đầu hành trình chinh phục tri thức của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {courses.length === 0 ? (
              <div className="col-span-full py-20 text-center text-gray-500 card-surface rounded-[2rem]">
                Chưa có khóa học nào được đăng tải.
              </div>
            ) : (
              courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
