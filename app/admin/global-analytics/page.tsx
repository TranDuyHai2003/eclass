import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  getGlobalTestAnalytics,
  getAnalyticsCourses,
} from "@/actions/analytics";
import { MultiLevelMatrixTable } from "./_components/MultiLevelMatrixTable";
import { GlobalSummaryCards } from "./_components/GlobalSummaryCards";
import {
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";

import { StudentType, Level } from "@prisma/client";

export default async function GlobalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    courseIds?: string;
    classIds?: string;
    studentType?: string;
    level?: string;
    search?: string;
    sortBy?: string;
  }>;
}) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/");
  }

  const { 
    startDate, 
    endDate, 
    courseIds: courseIdsRaw, 
    classIds: classIdsRaw,
    studentType: studentTypeRaw,
    level: levelRaw,
    search,
    sortBy
  } = await searchParams;
  const courseIds = courseIdsRaw ? courseIdsRaw.split(",").filter(Boolean) : [];
  const classIds = classIdsRaw ? classIdsRaw.split(",").filter(Boolean) : [];
  const studentType = (studentTypeRaw === "ONLINE" || studentTypeRaw === "OFFLINE") ? studentTypeRaw as StudentType : undefined;
  const level = (levelRaw === "BASIC" || levelRaw === "ADVANCED") ? levelRaw as Level : undefined;

  const [allCourses, allClasses] = await Promise.all([
    getAnalyticsCourses(classIds),
    prisma.studyClass.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ]);

  const globalData = await getGlobalTestAnalytics({
    startDate,
    endDate,
    courseIds,
    classIds,
    studentType,
    level,
    search,
    sortBy
  });

  const summary = globalData.summary;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.2em]">
              <TrendingUp className="w-3 h-3" />
              LMS Analytics Engine
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Quản lý{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                điểm số
              </span>
            </h1>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {summary && (
                <GlobalSummaryCards summary={summary} />
              )}
            </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-6">
        {globalData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
                Bảng tổng hợp (
                {courseIds.length === 0
                  ? "Tất cả khóa học"
                  : courseIds.length === 1 
                    ? `Khóa học: ${allCourses.find(c => c.id === courseIds[0])?.title || "Đang chọn"}`
                    : `${courseIds.length} khóa học`}
                )
              </h2>
            </div>
            <MultiLevelMatrixTable 
              students={globalData.students} 
              coursesSchema={globalData.coursesSchema} 
              allCourses={allCourses}
              allClasses={allClasses}
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
