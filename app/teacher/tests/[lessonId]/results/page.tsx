import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function TeacherTestResultsPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    redirect("/login");
  }

  const { lessonId } = await params;

  const test = await prisma.test.findUnique({
    where: { lessonId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
      attempts: {
        include: { user: true },
        orderBy: { score: "desc" }
      }
    }
  });

  if (!test) {
    return notFound();
  }

  // Teacher authorization check
  const ownerId = test.lesson?.chapter?.course?.userId ?? test.course?.userId ?? test.userId;
  if (ownerId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/teacher/courses");
  }

  // Calculate stats
  const totalAttempts = test.attempts.length;
  const averageScore = totalAttempts > 0 
    ? (test.attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalAttempts).toFixed(1)
    : 0;

  const backLink = test.lesson 
    ? `/teacher/courses/${test.lesson.chapter.courseId}`
    : test.courseId 
      ? `/teacher/courses/${test.courseId}`
      : "/teacher/courses";

  const testTitle = test.lesson?.title || test.title || "Bài kiểm tra";

  return (
    <div className="page-shell pb-20">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
              <Link href={backLink} className="flex items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-4 h-4" /> Quay lại khóa học
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kết quả bài kiểm tra: {testTitle}</h1>
          </div>
          <Link href={`/teacher/tests/${lessonId}`}>
            <Button variant="outline">Chỉnh sửa đề thi</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Lượt nộp bài</p>
              <p className="text-2xl font-bold text-gray-900">{totalAttempts}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-full">
              <span className="font-bold text-xl px-1">Đ</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Điểm trung bình</p>
              <p className="text-2xl font-bold text-gray-900">{averageScore}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">STT</th>
                <th className="px-6 py-4">Học viên</th>
                <th className="px-6 py-4">Điểm số</th>
                <th className="px-6 py-4">Thời gian nộp</th>
                <th className="px-6 py-4">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {test.attempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Chưa có học viên nào nộp bài.
                  </td>
                </tr>
              ) : (
                test.attempts.map((attempt, index) => (
                  <tr key={attempt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                        {attempt.user.image ? (
                           <img src={attempt.user.image} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                              {attempt.user.name?.charAt(0).toUpperCase() || "U"}
                           </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span>{attempt.user.name || "Khách"}</span>
                        <span className="text-xs text-gray-500 font-normal">{attempt.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-blue-600">{attempt.score}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : "Đang làm..."}
                    </td>
                    <td className="px-6 py-4">
                      {attempt.completedAt ? (
                         <Link href={`/watch/${lessonId}/results/${attempt.id}`}>
                           <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                             <Eye className="w-4 h-4 mr-2" /> Chi tiết
                           </Button>
                         </Link>
                      ) : (
                         <span className="text-xs text-gray-400 italic">Chưa nộp</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
