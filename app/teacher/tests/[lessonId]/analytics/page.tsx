import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Target,
  Award,
  BarChart3,
  Calendar,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default async function TestAnalyticsPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/login");
  }

  const { lessonId } = await params;

  // 1. Fetch Lesson to get its Test
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      test: {
        include: {
          attempts: {
            include: {
              user: true,
              answers: true,
            },
            orderBy: { completedAt: "desc" },
          },
          sections: {
            include: {
              questions: true,
            },
          },
        },
      },
      chapter: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!lesson) return notFound();

  const test = lesson.test;
  if (!test) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
          <BarChart3 className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          Chưa có bài kiểm tra
        </h1>
        <p className="text-slate-500 max-w-sm mb-8">
          Bài học này chưa có bài kiểm tra được tạo.
        </p>
        <Button
          asChild
          variant="outline"
          className="rounded-2xl px-8 font-bold"
        >
          <Link href={`/teacher/tests/${lessonId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Link>
        </Button>
      </div>
    );
  }

  // Ownership check
  if (
    lesson.chapter.course.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return redirect("/");
  }

  const courseTitle = lesson.chapter.course.title;
  const testTitle = lesson.title;

  // 2. Process Analytics Data
  const finishedAttempts = test.attempts.filter((a) => a.completedAt !== null);
  const totalAttempts = finishedAttempts.length;

  if (totalAttempts === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
          <BarChart3 className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          Chưa có dữ liệu thống kê
        </h1>
        <p className="text-slate-500 max-w-sm mb-8">
          Hiện chưa có học sinh nào hoàn thành bài kiểm tra này để tổng hợp số
          liệu.
        </p>
        <Button
          asChild
          variant="outline"
          className="rounded-2xl px-8 font-bold"
        >
          <Link href={`/teacher/tests/${lessonId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Link>
        </Button>
      </div>
    );
  }

  const averageScore =
    finishedAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0) /
    totalAttempts;
  const highScores = finishedAttempts.filter((a) => (a.score || 0) >= 8).length;

  // Score Distribution (0-2, 2-4, 4-6, 6-8, 8-10)
  const distribution = [0, 0, 0, 0, 0];
  finishedAttempts.forEach((a) => {
    const score = a.score || 0;
    if (score < 2) distribution[0]++;
    else if (score < 4) distribution[1]++;
    else if (score < 6) distribution[2]++;
    else if (score < 8) distribution[3]++;
    else distribution[4]++;
  });

  // Question Analysis
  const questionStats = new Map<string, { correct: number; total: number }>();
  test.sections.forEach((s) => {
    s.questions.forEach((q) => {
      questionStats.set(q.id, { correct: 0, total: 0 });
    });
  });

  finishedAttempts.forEach((a) => {
    a.answers.forEach((ans) => {
      const stats = questionStats.get(ans.questionId);
      if (stats) {
        stats.total++;
        if (ans.isCorrect) stats.correct++;
      }
    });
  });

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-20">
      {/* Analytics Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-2xl">
              <Link href={`/teacher/tests/${lessonId}`}>
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 truncate max-w-[400px]">
                {testTitle}
              </h1>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                {courseTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">
                Thống kê đến {format(new Date(), "dd/MM/yyyy", { locale: vi })}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-10 space-y-8">
        {/* Overview Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            label="Tổng số lượt nộp"
            value={totalAttempts.toString()}
            color="bg-blue-500"
          />
          <StatCard
            icon={Target}
            label="Điểm trung bình"
            value={averageScore.toFixed(1)}
            color="bg-purple-500"
          />
          <StatCard
            icon={Award}
            label="Tỉ lệ Giỏi (≥8.0)"
            value={`${Math.round((highScores / totalAttempts) * 100)}%`}
            color="bg-emerald-500"
          />
          <StatCard
            icon={Users}
            label="Học sinh đạt"
            value={finishedAttempts
              .filter((a) => (a.score || 0) >= 5)
              .length.toString()}
            color="bg-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Score Distribution Chart (CSS-based) */}
          <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">
                Phổ điểm học sinh
              </h3>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Đơn vị: Số lượng
              </div>
            </div>

            <div className="flex items-end justify-between h-[300px] gap-4 px-4">
              {distribution.map((count, i) => {
                const ranges = ["0-2", "2-4", "4-6", "6-8", "8-10"];
                const height =
                  totalAttempts > 0
                    ? (count / Math.max(...distribution)) * 100
                    : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-4 group"
                  >
                    <div className="w-full relative flex flex-col justify-end h-full">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {count} học sinh
                      </div>
                      <div
                        className={cn(
                          "w-full rounded-t-xl transition-all duration-700 delay-100 shadow-lg",
                          i === 4
                            ? "bg-emerald-500 shadow-emerald-100"
                            : "bg-blue-500 shadow-blue-100",
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                      {ranges[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions / Recent Activity */}
          <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <h3 className="font-black text-slate-900 uppercase tracking-tight mb-6">
              Lượt làm gần đây
            </h3>
            <div className="space-y-4">
              {finishedAttempts.slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-white shadow-sm">
                      <img
                        src={
                          a.user.image ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(a.user.name || "User")}`
                        }
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate w-32">
                        {a.user.name}
                      </p>
                      <p className="text-[9px] font-black text-slate-400 uppercase">
                        {format(a.completedAt!, "HH:mm dd/MM")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-black",
                        (a.score || 0) >= 8
                          ? "text-emerald-600"
                          : (a.score || 0) >= 5
                            ? "text-blue-600"
                            : "text-red-500",
                      )}
                    >
                      {a.score?.toFixed(1)}
                    </span>
                    <Link href={`/watch/${lessonId}/results/${a.id}`}>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </Link>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full rounded-xl text-slate-400 font-bold text-xs"
              >
                Xem toàn bộ danh sách
              </Button>
            </div>
          </div>
        </div>

        {/* Detailed Question Analytics */}
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100">
            <h3 className="font-black text-slate-900 uppercase tracking-tight">
              Phân tích chi tiết câu hỏi
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Thống kê tỉ lệ Đúng/Sai để xác định các câu hỏi học sinh thường
              mắc lỗi.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Câu hỏi
                  </th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Phân loại
                  </th>
                  <th className="px-8 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Tỉ lệ đúng
                  </th>
                  <th className="px-8 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {test.sections
                  .flatMap((s) => s.questions)
                  .map((q, idx) => {
                    const stats = questionStats.get(q.id) || {
                      correct: 0,
                      total: 0,
                    };
                    const correctRate =
                      stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                              #{idx + 1}
                            </div>
                            <span className="text-sm font-bold text-slate-700">
                              Câu hỏi trắc nghiệm
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                              correctRate < 40
                                ? "bg-red-50 text-red-600"
                                : correctRate < 70
                                  ? "bg-orange-50 text-orange-600"
                                  : "bg-emerald-50 text-emerald-600",
                            )}
                          >
                            {correctRate < 40
                              ? "Khó"
                              : correctRate < 70
                                ? "Trung bình"
                                : "Dễ"}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  correctRate < 40
                                    ? "bg-red-500"
                                    : correctRate < 70
                                      ? "bg-orange-500"
                                      : "bg-emerald-500",
                                )}
                                style={{ width: `${correctRate}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-slate-500">
                              {Math.round(correctRate)}% ({stats.correct}/
                              {stats.total})
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 font-bold hover:bg-blue-50"
                          >
                            Xem chi tiết
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex items-center gap-5 group hover:border-blue-200 transition-all hover:shadow-xl hover:shadow-blue-500/5">
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-500 shadow-lg",
          color,
        )}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] mb-1">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
