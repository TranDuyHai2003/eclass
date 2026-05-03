import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  BarChart3,
  Pencil,
  BookOpen,
  Trophy,
  GraduationCap,
  Plus,
  FileUp,
  ShieldCheck,
  LayoutGrid,
  Link2,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function TeacherTestsPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/login");
  }

  const testBankRecords = await prisma.test.findMany({
    where: {
      lessonId: null,
      courseId: null,
      userId: session.user.role === "ADMIN" ? undefined : session.user.id,
    },
    include: {
      sections: {
        include: {
          questions: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const testBank = testBankRecords.map((test) => {
    const questions = test.sections.reduce(
      (total, section) => total + section.questions.length,
      0,
    );
    const status = questions > 0 ? "San sang" : "Dang nhap dap an";

    return {
      id: test.id,
      title: test.title || "De thi doc lap",
      subject: test.subject || "Khong ro",
      questions,
      duration: test.duration,
      lastUpdated: new Intl.DateTimeFormat("vi-VN").format(test.updatedAt),
      status,
      usageCount: 0,
    };
  });

  // Fetch courses and their tests (mapping area)
  const courses = await prisma.course.findMany({
    where: session.user.role === "ADMIN" ? {} : { userId: session.user.id },
    include: {
      finalTest: {
        include: {
          attempts: { select: { id: true, score: true, completedAt: true } },
        },
      },
      chapters: {
        include: {
          lessons: {
            where: { test: { isNot: null } },
            include: {
              test: {
                include: {
                  attempts: {
                    select: { id: true, score: true, completedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Test Bank Workflow
          </p>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Quản lý Bài kiểm tra
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl">
            Tạo đề độc lập, tái sử dụng cho nhiều khóa học và theo dõi kết quả ở
            một nơi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            className="rounded-2xl h-12 px-6 font-black bg-slate-900 hover:bg-black"
          >
            <Link href="/teacher/tests/create">
              <Plus className="w-4 h-4 mr-2" /> Tạo đề mới
            </Link>
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 font-bold border-slate-200"
          >
            <FileUp className="w-4 h-4 mr-2" /> Nhập PDF
          </Button>
        </div>
      </div>

      <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 uppercase tracking-tight">
                Ngân hàng đề
              </h2>
              <p className="text-xs text-slate-500">
                Mỗi đề thi tồn tại độc lập, gắn vào khóa học khi cần.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className="rounded-full text-[10px] uppercase font-black tracking-widest"
              variant="outline"
            >
              {testBank.length} đề thi
            </Badge>
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Quy trình chuẩn
            </Button>
          </div>
        </div>

        <div className="p-8 grid gap-6 lg:grid-cols-[2.2fr_1fr]">
          <div className="grid gap-4">
            {testBank.map((test) => (
              <Link
                key={test.id}
                href={`/teacher/tests/bank/${test.id}`}
                className="group rounded-[28px] border border-slate-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                        {test.title}
                      </h3>
                      <Badge
                        className={cn(
                          "rounded-full text-[10px] font-black uppercase tracking-widest",
                          test.status === "San sang"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {test.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      {test.subject}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> {test.questions}{" "}
                        câu
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> {test.duration}{" "}
                        phút
                      </span>
                      <span className="flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> {test.usageCount} khóa học
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Cập nhật
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {test.lastUpdated}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="rounded-[28px] border border-slate-100 bg-slate-50/60 p-6 space-y-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              Quy trình nhanh
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-800">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-800">Tạo đề độc lập</p>
                  <p className="text-xs">
                    Upload PDF, nhập đáp án và lưu vào ngân hàng.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-800">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-800">Gắn vào khóa học</p>
                  <p className="text-xs">
                    Chọn đề từ ngân hàng và map vào bài học.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-800">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-800">Theo dõi thống kê</p>
                  <p className="text-xs">
                    Xem phổ điểm và phân tích câu hỏi ngay trong đề.
                  </p>
                </div>
              </div>
            </div>
            <Button
              asChild
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 font-black"
            >
              <Link href="/teacher/tests/create">Bắt đầu tạo đề</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Gắn đề vào khóa học
            </h2>
            <p className="text-slate-500 text-sm">
              Chọn đề từ ngân hàng và map vào bài học hoặc bài cuối khóa.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl border-slate-200 font-bold"
          >
            <Link2 className="w-4 h-4 mr-2" /> Chọn từ ngân hàng đề
          </Button>
        </div>

        <div className="grid gap-6">
          {courses.map((course) => {
            const lessonTests = course.chapters
              .flatMap((c) =>
                c.lessons.map((l) => ({
                  id: l.id,
                  title: l.title,
                  type: "LESSON",
                  test: l.test,
                  attempts: l.test?.attempts || [],
                })),
              )
              .filter((t) => t.test !== null);

            const finalTest = course.finalTest
              ? {
                  id: course.id,
                  title: "Bài kiểm tra cuối khóa",
                  type: "FINAL",
                  test: course.finalTest,
                  attempts: course.finalTest.attempts || [],
                }
              : null;

            const allTests = finalTest
              ? [finalTest, ...lessonTests]
              : lessonTests;

            if (allTests.length === 0) return null;

            return (
              <div
                key={course.id}
                className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                  </div>
                  <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">
                    {course.title}
                  </h2>
                  <Badge
                    variant="outline"
                    className="ml-auto bg-white rounded-full font-bold text-[10px] uppercase px-3"
                  >
                    {allTests.length} bài thi
                  </Badge>
                </div>

                <div className="divide-y divide-slate-50">
                  {allTests.map((t) => {
                    const finishedAttempts = t.attempts.filter(
                      (a) => a.completedAt !== null,
                    );
                    const avgScore =
                      finishedAttempts.length > 0
                        ? finishedAttempts.reduce(
                            (acc, curr) => acc + (curr.score || 0),
                            0,
                          ) / finishedAttempts.length
                        : 0;

                    return (
                      <div
                        key={t.id}
                        className="px-8 py-6 hover:bg-slate-50/50 transition-colors group"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-start gap-4">
                            <div
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                                t.type === "FINAL"
                                  ? "bg-yellow-50"
                                  : "bg-blue-50",
                              )}
                            >
                              {t.type === "FINAL" ? (
                                <Trophy className="w-6 h-6 text-yellow-600" />
                              ) : (
                                <GraduationCap className="w-6 h-6 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                {t.title}
                              </h3>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">
                                {t.type === "FINAL"
                                  ? "Đề thi tổng kết"
                                  : "Đề thi bài học"}{" "}
                                • {t.test?.duration} phút
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-12">
                            <div className="text-center">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                Lượt nộp
                              </p>
                              <p className="text-xl font-black text-slate-900">
                                {finishedAttempts.length}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                Điểm TB
                              </p>
                              <p className="text-xl font-black text-blue-600">
                                {avgScore.toFixed(1)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="rounded-xl font-bold border-slate-200"
                              >
                                <Link
                                  href={
                                    t.type === "FINAL"
                                      ? `/teacher/courses/${course.id}/final-test`
                                      : `/teacher/tests/${t.id}`
                                  }
                                >
                                  <Pencil className="w-4 h-4 mr-2" /> Chỉnh sửa
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                asChild
                                className="rounded-xl font-black bg-slate-900 hover:bg-black"
                              >
                                <Link
                                  href={
                                    t.type === "FINAL"
                                      ? `/teacher/courses/${course.id}/final-test/analytics`
                                      : `/teacher/tests/${t.id}/analytics`
                                  }
                                >
                                  <BarChart3 className="w-4 h-4 mr-2" /> Thống
                                  kê
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {courses.length === 0 && (
            <div className="bg-white rounded-[32px] border border-dashed border-slate-200 p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <ClipboardList className="w-10 h-10 text-slate-300" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Chưa có khóa học nào
              </h2>
              <p className="text-slate-500 max-w-sm mx-auto">
                Tạo đề trong ngân hàng trước, sau đó gắn vào bài học khi cần.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                <Button
                  asChild
                  className="rounded-2xl px-8 h-14 bg-blue-600 hover:bg-blue-700 font-black shadow-lg shadow-blue-200"
                >
                  <Link href="/teacher/tests/create">Tạo đề mới</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-2xl px-8 h-14 font-bold"
                >
                  <Link href="/teacher/courses">Đến Quản lý Khóa học</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
