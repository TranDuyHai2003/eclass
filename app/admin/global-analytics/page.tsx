import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getGlobalTestAnalytics,
  getAnalyticsCourses,
  getCourseProgressMatrix,
} from "@/actions/analytics";
import { GlobalFilters } from "./_components/GlobalFilters";
import { GlobalOverviewTable } from "./_components/GlobalOverviewTable";
import { AnalyticsExportButton } from "@/components/analytics/AnalyticsExportButton";
import { SmartMatrix } from "@/app/teacher/courses/[courseId]/analytics/_components/SmartMatrix";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function GlobalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    courseIds?: string;
  }>;
}) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/");
  }

  const { startDate, endDate, courseIds: courseIdsRaw } = await searchParams;
  const courseIds = courseIdsRaw ? courseIdsRaw.split(",").filter(Boolean) : [];

  const allCourses = await getAnalyticsCourses();

  // Decide which data to fetch
  const isSingleCourse = courseIds.length === 1;

  let globalData = null;
  let matrixData = null;

  if (isSingleCourse && !startDate && !endDate) {
    // If exactly one course and no date range, use the high-perf matrix view
    // (Note: we could also enhance matrix view to support dates later)
    matrixData = await getCourseProgressMatrix(
      courseIds[0],
      new Date().getMonth() + 1,
      new Date().getFullYear(),
    );
  } else {
    globalData = await getGlobalTestAnalytics({
      startDate,
      endDate,
      courseIds,
    });
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.2em]">
            <TrendingUp className="w-3 h-3" />
            LMS Analytics Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Thống kê{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              toàn cục
            </span>
          </h1>
          <p className="text-slate-500 font-medium">
            {" "}
            Theo dõi tiến độ học tập của toàn bộ hệ thống eClass.
          </p>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                Học sinh
              </div>
              <div className="text-lg font-black text-slate-900">
                {globalData?.students.length || matrixData?.matrix.length || 0}
              </div>
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                Khóa học
              </div>
              <div className="text-lg font-black text-slate-900">
                {courseIds.length > 0 ? courseIds.length : allCourses.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <GlobalFilters courses={allCourses} />

      {/* Content Section */}
      <div className="space-y-6">
        {matrixData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                Chế độ Ma trận (Single Course Mode)
              </h2>
            </div>
            <SmartMatrix
              courseId={courseIds[0]}
              tests={matrixData.tests}
              matrix={matrixData.matrix}
            />
          </div>
        ) : globalData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                Bảng tổng hợp (
                {courseIds.length === 0
                  ? "Tất cả khóa học"
                  : `${courseIds.length} khóa học`}
                )
              </h2>
            </div>
            <GlobalOverviewTable data={globalData.students} />
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <LayoutDashboard className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-bold">Đang tải dữ liệu thống kê...</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-900 rounded-[2.5rem] text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold">Mẹo tối ưu</p>
            <p className="text-xs text-white/60">
              Sử dụng bộ lọc khóa học để xem bảng Ma trận chi tiết điểm số của
              từng học sinh.
            </p>
          </div>
        </div>
        <AnalyticsExportButton 
          apiUrl={matrixData 
            ? `/api/courses/${courseIds[0]}/analytics/export?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`
            : `/api/analytics/global-export?${new URLSearchParams({
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(courseIdsRaw && { courseIds: courseIdsRaw })
              }).toString()}`
          }
          filename={matrixData ? `Thong_ke_Ma_tran_${courseIds[0]}` : `Bao_cao_tong_hop_eClass`}
          variant="premium"
          className="border-white/20 hover:bg-white/10 shadow-none"
        />
      </div>
    </div>
  );
}
