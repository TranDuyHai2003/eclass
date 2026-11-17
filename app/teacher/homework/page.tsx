import { TeacherHomeworkReview } from "@/components/teacher/TeacherHomeworkReview";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { APPROVED_PAGE_SIZE, reviewOrderBy, reviewSubmissionSelect } from "@/lib/homework-review";

export default async function HomeworkManagementPage() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    redirect("/login");
  }

  // Bài cần chấm + chưa đạt là phần việc đang làm → tải đủ; "Đã đạt" (thường rất nhiều) chỉ tải trang đầu,
  // phần còn lại tải dần qua listApprovedHomework để trang không phải gửi hàng MB dữ liệu.
  const [working, approved, approvedTotal, courses] = await Promise.all([
    prisma.homeworkSubmission.findMany({
      where: { status: { in: ["PENDING", "UNSATISFACTORY"] } },
      select: reviewSubmissionSelect,
      orderBy: reviewOrderBy,
    }),
    prisma.homeworkSubmission.findMany({
      where: { status: "SATISFACTORY" },
      select: reviewSubmissionSelect,
      orderBy: reviewOrderBy,
      take: APPROVED_PAGE_SIZE,
    }),
    prisma.homeworkSubmission.count({ where: { status: "SATISFACTORY" } }),
    prisma.course.findMany({
      where: { chapters: { some: { lessons: { some: { homeworkSubmissions: { some: {} } } } } } },
      select: { title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const pendingCount = working.filter((s) => s.status === "PENDING").length;
  const reviewedCount = working.length - pendingCount + approvedTotal;
  const courseTitles = Array.from(new Set(courses.map((c) => c.title)));

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-blue-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="w-12 h-12 bg-[#2563EB] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-2">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tight">
            Duyệt Bài Tự Luận
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Quản lý và chấm điểm bài tập của học viên toàn hệ thống
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-3xl font-black text-blue-600">{pendingCount}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cần chấm</span>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-3xl font-black text-emerald-600">{reviewedCount}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đã duyệt</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-blue-100 shadow-sm">
        <TeacherHomeworkReview
          submissions={[...working, ...approved]}
          approvedTotal={approvedTotal}
          courseTitles={courseTitles}
        />
      </div>
    </div>
  );
}
