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
  Search,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SortSelect } from "@/components/ui/SortSelect";
import TestTypeSwitcherClient from "./_components/TestTypeSwitcherClient";
import DueDateUpdaterClient from "./_components/DueDateUpdaterClient";
import { DeleteTestButton } from "./_components/DeleteTestButton";
import CourseTestListClient, { TestItem } from "./_components/CourseTestListClient";

export default async function TeacherTestsPage({ searchParams }: { searchParams: Promise<{ sort?: "desc" | "asc" | "default"; q?: string }> }) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/login");
  }

  const isAdminOrTeacher =
    session.user.role === "ADMIN" || session.user.role === "TEACHER";
  
  const params = await searchParams;
  const sortOrder = params.sort === "asc" ? "asc" : (params.sort === "desc" ? "desc" : "default");
  const searchQuery = params.q || "";

  const testBankRecords = await prisma.test.findMany({
    where: {
      lessonId: null,
      courseId: null,
      userId: isAdminOrTeacher ? undefined : session.user.id,
      ...(searchQuery ? {
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { subject: { contains: searchQuery, mode: "insensitive" } }
        ]
      } : {})
    },
    include: {
      sections: {
        include: {
          questions: true,
        },
      },
    },
    orderBy: sortOrder === "default" ? { createdAt: "desc" } : { updatedAt: sortOrder },
  });

  const testBank = testBankRecords.map((test) => {
    const questions = test.sections.reduce(
      (total, section) => total + section.questions.length,
      0,
    );
    const status = questions > 0 ? "Sẵn sàng" : "Đang nhập đáp án";

    return {
      id: test.id,
      title: test.title || "Đề thi độc lập",
      subject: test.subject || "Không rõ",
      questions,
      duration: test.duration,
      lastUpdated: new Intl.DateTimeFormat("vi-VN").format(test.updatedAt),
      status,
      usageCount: 0,
    };
  });

  // Fetch courses and their tests (mapping area)
  const courses = await prisma.course.findMany({
    where: {
      ...(isAdminOrTeacher ? {} : { userId: session.user.id }),
      ...(searchQuery ? {
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          {
            chapters: {
              some: {
                lessons: {
                  some: {
                    title: { contains: searchQuery, mode: "insensitive" }
                  }
                }
              }
            }
          }
        ]
      } : {})
    },
    include: {
      finalTest: {
        include: {
          attempts: { select: { id: true, score: true, completedAt: true } },
        },
      },
      chapters: {
        include: {
          lessons: {
            where: {
              test: { isNot: null },
              ...(searchQuery ? { title: { contains: searchQuery, mode: "insensitive" } } : {})
            },
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
    orderBy: sortOrder === "default" ? { createdAt: "desc" } : { updatedAt: sortOrder },
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
        <div className="flex flex-wrap items-center gap-3">
          <form className="relative" method="GET">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
            <Input 
              name="q"
              defaultValue={searchQuery}
              className="pl-9 h-12 rounded-2xl border-slate-200 w-full sm:w-64"
              placeholder="Tìm kiếm đề thi..."
            />
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          </form>
          <SortSelect />
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
            asChild
          >
            <Link href="/teacher/tests/create">
              <FileUp className="w-4 h-4 mr-2" /> Nhập PDF
            </Link>
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

        <div className="p-8">
          {testBank.length > 0 ? (
            <div className="grid gap-4">
              {testBank.map((test) => (
                <div
                  key={test.id}
                  className="group rounded-[28px] border border-slate-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/teacher/tests/bank/${test.id}`}
                          className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors"
                        >
                          {test.title}
                        </Link>
                        <Badge
                          className={cn(
                            "rounded-full text-[10px] font-black uppercase tracking-widest",
                            test.status === "Sẵn sàng"
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
                          <ClipboardList className="w-4 h-4" /> {test.questions} câu
                        </span>
                        <span className="flex items-center gap-2">
                          <CalendarClock className="w-4 h-4" /> {test.duration} phút
                        </span>
                        <span className="flex items-center gap-2">
                          <Link2 className="w-4 h-4" /> {test.usageCount} khóa học
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:flex-col md:items-end">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Cập nhật
                        </p>
                        <p className="text-sm font-bold text-slate-700">
                          {test.lastUpdated}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl font-bold border-slate-200"
                          asChild
                        >
                          <Link href={`/teacher/tests/bank/${test.id}`}>Chỉnh sửa</Link>
                        </Button>
                        <DeleteTestButton testId={test.id} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center items-center">
              <div className="rounded-[28px] border border-slate-100 bg-slate-50/60 p-6 space-y-4 max-w-md">
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
          )}
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
                  testId: l.test?.id,
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
                  testId: course.finalTest.id,
                  title: "Bài kiểm tra cuối khóa",
                  type: "FINAL",
                  test: course.finalTest,
                  attempts: course.finalTest.attempts || [],
                }
              : null;

            const allTests = finalTest
              ? [finalTest, ...lessonTests]
              : lessonTests;

            if (sortOrder === "asc") {
              allTests.sort(
                (a, b) =>
                  new Date(a.test!.createdAt || a.test!.updatedAt).getTime() -
                  new Date(b.test!.createdAt || b.test!.updatedAt).getTime(),
              );
            } else {
              // Default or desc: newest tests first
              allTests.sort(
                (a, b) =>
                  new Date(b.test!.createdAt || b.test!.updatedAt).getTime() -
                  new Date(a.test!.createdAt || a.test!.updatedAt).getTime(),
              );
            }

            if (allTests.length === 0) return null;

            const formattedTests: TestItem[] = allTests.map((t) => ({
              id: t.id,
              testId: t.testId,
              title: t.title,
              type: t.type,
              test: t.test
                ? {
                    id: t.test.id,
                    duration: t.test.duration,
                    type: t.test.type,
                    dueDate: t.test.dueDate ? t.test.dueDate.toISOString() : null,
                    createdAt: t.test.createdAt.toISOString(),
                    updatedAt: t.test.updatedAt.toISOString(),
                  }
                : null,
              attempts: t.attempts.map((a) => ({
                completedAt: a.completedAt ? a.completedAt.toISOString() : null,
                score: a.score,
              })),
            }));

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

                <CourseTestListClient
                  courseId={course.id}
                  tests={formattedTests}
                  initialLimit={5}
                />
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
