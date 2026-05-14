import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Target,
  Award,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PDFViewerClientWrapper } from "@/components/course/PDFViewerClientWrapper";
import ScoreboardTable, {
  type ScoreboardAttempt,
} from "@/components/teacher/tests/ScoreboardTable";

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
          Chua co bai kiem tra
        </h1>
        <p className="text-slate-500 max-w-sm mb-8">
          Bai hoc nay chua co bai kiem tra duoc tao.
        </p>
        <Button
          asChild
          variant="outline"
          className="rounded-2xl px-8 font-bold"
        >
          <Link href={`/teacher/tests/${lessonId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lai
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
  const allAttempts = test.attempts;
  const finishedAttempts = allAttempts.filter((a) => a.completedAt !== null);
  const totalAttempts = finishedAttempts.length;

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
  const maxDistribution = Math.max(1, ...distribution);

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

  const scoreboardAttempts: ScoreboardAttempt[] = allAttempts.map((a) => ({
    id: a.id,
    user: {
      name: a.user.name,
      email: a.user.email,
      image: a.user.image,
    },
    score: a.score ?? null,
    startedAt: a.startedAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    answersCount: a.answers.length,
  }));

  return (
    <Tabs defaultValue="scores" className="min-h-screen bg-[#F8F9FB] pb-20 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" asChild className="rounded-2xl shrink-0">
              <Link href={`/teacher/tests/${lessonId}`}>
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 truncate max-w-[300px] lg:max-w-[400px]">
                {testTitle}
              </h1>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate max-w-[300px]">
                {courseTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <TabsList className="bg-slate-100/80 p-1 rounded-xl h-auto flex flex-wrap gap-0.5">
              <TabsTrigger
                value="scores"
                className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white"
              >
                Bang diem
              </TabsTrigger>
              <TabsTrigger
                value="overview"
                className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white"
              >
                Tong quan
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white"
              >
                Thong so cau
              </TabsTrigger>
              <TabsTrigger
                value="exam"
                className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white"
              >
                De bai
              </TabsTrigger>
              <TabsTrigger
                value="solutions"
                className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white"
              >
                Loi giai
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 space-y-8 flex-1">
        <TabsContent value="scores" className="mt-0">
          <ScoreboardTable
            attempts={scoreboardAttempts}
            resultsBasePath={`/watch/${lessonId}/results`}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-0 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={Users}
              label="Tong so luot nop"
              value={totalAttempts.toString()}
              color="bg-blue-500"
            />
            <StatCard
              icon={Target}
              label="Diem trung binh"
              value={totalAttempts > 0 ? averageScore.toFixed(1) : "--"}
              color="bg-purple-500"
            />
            <StatCard
              icon={Award}
              label="Ti le Gioi (>=8.0)"
              value={totalAttempts > 0 ? `${Math.round((highScores / totalAttempts) * 100)}%` : "--"}
              color="bg-emerald-500"
            />
            <StatCard
              icon={Users}
              label="Hoc sinh dat"
              value={finishedAttempts
                .filter((a) => (a.score || 0) >= 5)
                .length.toString()}
              color="bg-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <h4 className="font-black text-slate-900 uppercase tracking-tight">
                  Pho diem hoc sinh
                </h4>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Don vi: So luong
                </div>
              </div>

              <div className="flex items-end justify-between h-[300px] gap-4 px-4">
                {distribution.map((count, i) => {
                  const ranges = ["0-2", "2-4", "4-6", "6-8", "8-10"];
                  const height =
                    totalAttempts > 0 ? (count / maxDistribution) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-4 group"
                    >
                      <div className="w-full relative flex flex-col justify-end h-full">
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {count} hoc sinh
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

            <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
              <h4 className="font-black text-slate-900 uppercase tracking-tight mb-6">
                Luot lam gan day
              </h4>
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
                  Xem toan bo danh sach
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="mt-0">
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100">
              <h4 className="font-black text-slate-900 uppercase tracking-tight">
                Thong so cau hoi
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Thong ke ti le dung/sai de xac dinh cac cau hoi hoc sinh thuong
                mac loi.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Cau hoi
                    </th>
                    <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Phan loai
                    </th>
                    <th className="px-8 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Ti le dung
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Thao tac
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
                        stats.total > 0
                          ? (stats.correct / stats.total) * 100
                          : 0;

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
                                Cau hoi trac nghiem
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
                                ? "Kho"
                                : correctRate < 70
                                  ? "Trung binh"
                                  : "De"}
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
                              Xem chi tiet
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="exam" className="mt-0">
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100">
              <h4 className="font-black text-slate-900 uppercase tracking-tight">
                De bai
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Xem nhanh noi dung goc cua de thi.
              </p>
            </div>
            {test.pdfUrl ? (
              <div className="h-[70vh]">
                <PDFViewerClientWrapper url={test.pdfUrl} />
              </div>
            ) : (
              <div className="p-8 text-sm text-slate-500">
                Chua co file PDF de bai. Vui long tai len de bai trong phan thiet lap.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="solutions" className="mt-0">
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100">
              <h4 className="font-black text-slate-900 uppercase tracking-tight">
                Loi giai
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Xem dap an chuan va loi giai chi tiet cho tung cau hoi.
              </p>
            </div>
            {test.sections.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {test.sections.map((section) => (
                  <div key={section.id}>
                    <div className="px-8 py-4 bg-slate-50/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {section.name}
                      </p>
                    </div>
                    {section.questions.map((q, idx) => (
                      <div key={q.id} className="px-8 py-6 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-black text-blue-600">
                            #{idx + 1}
                          </div>
                          <span className="text-sm font-bold text-slate-800">
                            Cau hoi {q.type === "MULTIPLE_CHOICE" ? "trac nghiem" : "dien khuyet"}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                            q.type === "MULTIPLE_CHOICE"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-purple-50 text-purple-600",
                          )}>
                            {q.points} diem
                          </span>
                        </div>
                        {q.correctAnswer && (
                          <div className="ml-11 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                              Dap an:
                            </span>
                            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                              {q.correctAnswer}
                            </span>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="ml-11">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Giai thich:
                            </span>
                            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                              {q.explanation}
                            </p>
                          </div>
                        )}
                        {!q.correctAnswer && !q.explanation && (
                          <div className="ml-11 text-sm text-slate-400 italic">
                            Chua co dap an hoac loi giai cho cau hoi nay.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-sm text-slate-500">
                Chua co cau hoi de hien thi loi giai.
              </div>
            )}
          </div>
        </TabsContent>
      </main>
    </Tabs>
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
