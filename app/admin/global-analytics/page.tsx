import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getGlobalTestAnalytics,
  getAnalyticsCourses,
  getCourseProgressMatrix,
} from "@/actions/analytics";
import { GlobalFilters } from "./_components/GlobalFilters";
import { MultiLevelMatrixTable } from "./_components/MultiLevelMatrixTable";
import { AnalyticsExportButton } from "@/components/analytics/AnalyticsExportButton";
import { SmartMatrix } from "@/app/teacher/courses/[courseId]/analytics/_components/SmartMatrix";
import { GlobalSummaryCards } from "./_components/GlobalSummaryCards";
import { ScoreDistributionChart } from "./_components/ScoreDistributionChart";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { StudentType } from "@prisma/client";

export default async function GlobalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    courseIds?: string;
    studentType?: string;
  }>;
}) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/");
  }

  const { startDate, endDate, courseIds: courseIdsRaw, studentType: studentTypeRaw } = await searchParams;
  const courseIds = courseIdsRaw ? courseIdsRaw.split(",").filter(Boolean) : [];
  const studentType = (studentTypeRaw === "ONLINE" || studentTypeRaw === "OFFLINE") ? studentTypeRaw as StudentType : undefined;

  const allCourses = await getAnalyticsCourses();

  // Decide which data to fetch
  const isSingleCourse = courseIds.length === 1;

  let globalData: any = null;
  let matrixData = null;

  if (isSingleCourse && !startDate && !endDate) {
    // If exactly one course and no date range, use the high-perf matrix view
    // (Note: we could also enhance matrix view to support dates later)
    matrixData = await getCourseProgressMatrix(
      courseIds[0],
      new Date().getMonth() + 1,
      new Date().getFullYear(),
      studentType
    );
  } else {
    globalData = await getGlobalTestAnalytics({
      startDate,
      endDate,
      courseIds,
      studentType
    });
  }

  const summary = globalData?.summary || matrixData?.summary;

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
      </div>

      {/* Summary Cards */}
      {summary && (
        <GlobalSummaryCards summary={summary} />
      )}

      {/* Score Distribution Chart */}
      {summary && summary.distribution && (
        <ScoreDistributionChart distribution={summary.distribution} />
      )}

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
            <MultiLevelMatrixTable 
              students={globalData.students} 
              coursesSchema={globalData.coursesSchema} 
            />
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <LayoutDashboard className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-bold">Đang tải dữ liệu thống kê...</p>
          </div>
        )}
      </div>
    </div>
  );
}
