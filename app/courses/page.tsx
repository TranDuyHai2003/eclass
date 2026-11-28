import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { getCourses } from "@/actions/course";
import { CourseTile } from "@/components/course/CourseTile";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { beVietnam } from "@/lib/fonts/be-vietnam";
import { cn } from "@/lib/utils";
import { COURSE_GROUPS, getCourseGroup, groupCover, groupOrder, type CourseGroup } from "@/lib/course-grade";

export const metadata = { title: "Khóa học" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ query?: string; grade?: string }> }) {
  const session = await auth();
  const { query, grade } = await searchParams;
  const courses = await getCourses({ search: query });
  const isStudent = session?.user?.role === "STUDENT" && !!session.user.id;

  // Khối của từng khoá; tab chỉ hiện các khối có khoá (≥ 2 nhóm mới cần lọc)
  const withGroup = courses
    .map((c) => ({ course: c, group: getCourseGroup(c) }))
    .sort((a, b) => groupOrder(a.group) - groupOrder(b.group));
  const groups = COURSE_GROUPS.filter((g) => withGroup.some((x) => x.group === g.id));
  const active = groups.some((g) => g.id === grade) ? (grade as CourseGroup) : null;
  const shown = active ? withGroup.filter((x) => x.group === active) : withGroup;

  const lessonIdsOf = (c: (typeof courses)[number]) => (c.chapters ?? []).flatMap((ch) => (ch.lessons ?? []).map((l) => l.id));
  const totalLessons = courses.reduce((n, c) => n + lessonIdsOf(c).length, 0);

  // Tiến độ của học sinh trên từng khoá + bài học gần nhất (dải "Tiếp tục học")
  const progressByCourse = new Map<string, number>();
  let resume: { href: string; courseTitle: string; done: number; total: number; group: CourseGroup | null; advanced: boolean } | null = null;
  if (isStudent) {
    const lessonCourse = new Map<string, string>();
    for (const c of courses) for (const id of lessonIdsOf(c)) lessonCourse.set(id, c.id);
    const done = lessonCourse.size
      ? await prisma.progress.findMany({
          where: { userId: session!.user!.id!, isCompleted: true, lessonId: { in: [...lessonCourse.keys()] } },
          select: { lessonId: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        })
      : [];
    const doneCount = new Map<string, number>();
    for (const d of done) {
      const cid = lessonCourse.get(d.lessonId)!;
      doneCount.set(cid, (doneCount.get(cid) ?? 0) + 1);
    }
    for (const c of courses) {
      const total = lessonIdsOf(c).length;
      progressByCourse.set(c.id, total ? Math.round(((doneCount.get(c.id) ?? 0) / total) * 100) : 0);
    }
    // Bài vừa hoàn thành gần nhất → học tiếp bài kế sau nó (bài cuối thì mở lại chính bài đó)
    const last = done[0];
    const course = last && courses.find((c) => c.id === lessonCourse.get(last.lessonId));
    if (last && course) {
      const ids = lessonIdsOf(course);
      const doneSet = new Set(done.map((d) => d.lessonId));
      const next = ids.slice(ids.indexOf(last.lessonId) + 1).find((id) => !doneSet.has(id)) ?? last.lessonId;
      resume = {
        href: `/watch/${next}`,
        courseTitle: course.title,
        done: doneCount.get(course.id) ?? 0,
        total: ids.length,
        group: getCourseGroup(course),
        advanced: course.level === "ADVANCED",
      };
    }
  }

  const tabHref = (g: CourseGroup | null) => {
    const p = new URLSearchParams();
    if (query) p.set("query", query);
    if (g) p.set("grade", g);
    const s = p.toString();
    return s ? `/courses?${s}` : "/courses";
  };
  const resumeCover = resume ? groupCover(resume.group, resume.advanced) : null;

  return (
    <div className={cn(beVietnam.variable, "min-h-screen bg-[#F6F5FB] font-[family-name:var(--font-bvp)] text-[#1E1B2E]")}>
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <aside className="hidden w-[250px] shrink-0 border-r border-[#ECE9F5] bg-white/70 p-3 backdrop-blur-xl lg:block">
          <div className="sticky top-24 h-[calc(100vh-7rem)]">
            <HomeSidebar user={session?.user} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="text-[28px] font-extrabold tracking-tight">Khóa học</h1>
                <p className="text-[#5F5B73]">{query ? `Tìm thấy ${courses.length} khóa học cho "${query}"` : "Chọn mục tiêu của bạn và bắt đầu ngay."}</p>
              </div>
              <p className="flex gap-4 text-sm text-[#5F5B73]" data-testid="courses-stats">
                <span>
                  <b className="text-lg text-[#1E1B2E]">{courses.length}</b> khóa học
                </span>
                <span>
                  <b className="text-lg text-[#1E1B2E]">{totalLessons}</b> bài học
                </span>
              </p>
            </div>

            {resume && resumeCover && (
              <Link
                href={resume.href}
                data-testid="courses-resume"
                className="flex flex-wrap items-center gap-5 rounded-[20px] bg-[#1E1745] px-5 py-[18px] text-white transition-shadow hover:shadow-[0_14px_30px_rgba(30,23,69,0.3)] sm:px-[22px]"
              >
                <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-[26px] font-extrabold" style={{ background: resumeCover.bg, color: resumeCover.fg }}>
                  {resumeCover.big}
                </span>
                <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-wide text-[#C9BEFF]">TIẾP TỤC HỌC</span>
                  <span className="truncate text-[17px] font-extrabold">{resume.courseTitle}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 max-w-[320px] flex-1 overflow-hidden rounded-full bg-white/16">
                      <span className="block h-full rounded-full bg-[#A78BFA]" style={{ width: `${resume.total ? Math.round((resume.done / resume.total) * 100) : 0}%` }} />
                    </span>
                    <span className="shrink-0 text-[13px] text-[#D9D3F5]">
                      {resume.done}/{resume.total} bài
                    </span>
                  </span>
                </span>
                <span className="flex h-12 items-center gap-2 rounded-[14px] bg-white px-5 font-extrabold text-[#2A1F5C]">
                  Học tiếp <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {groups.length >= 2 && (
                <nav aria-label="Lọc theo khối" className="flex max-w-full gap-1.5 overflow-x-auto rounded-[14px] bg-[#ECE9F5] p-1 [scrollbar-width:none]">
                  {[{ id: null, label: "Tất cả" } as { id: CourseGroup | null; label: string }, ...groups].map((g) => {
                    const on = active === g.id;
                    return (
                      <Link
                        key={g.id ?? "all"}
                        href={tabHref(g.id)}
                        aria-current={on ? "page" : undefined}
                        scroll={false}
                        className={cn(
                          "flex h-[38px] shrink-0 items-center rounded-[10px] px-4 text-sm font-bold transition-colors",
                          on ? "bg-white text-[#2A1F5C] shadow-[0_1px_3px_rgba(30,27,46,0.12)]" : "text-[#5F5B73] hover:text-[#2A1F5C]",
                        )}
                      >
                        {g.label}
                      </Link>
                    );
                  })}
                </nav>
              )}
              <form action="/courses" role="search" className="flex h-11 w-full items-center gap-2 rounded-xl border border-[#E4E0F0] bg-white px-3.5 focus-within:border-[#5B2BD6] focus-within:shadow-[0_0_0_4px_rgba(91,43,214,0.14)] sm:ml-auto sm:w-auto sm:min-w-[260px]">
                <Search className="h-4 w-4 shrink-0 text-[#6B6680]" aria-hidden />
                <input type="search" name="query" defaultValue={query ?? ""} aria-label="Tìm khóa học" placeholder="Tìm theo tên khóa học" className="min-w-0 flex-1 bg-transparent text-[#1E1B2E] outline-none placeholder:text-[#8A85A0]" />
                {active && <input type="hidden" name="grade" value={active} />}
              </form>
            </div>

            {shown.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]" data-testid="courses-grid">
                {shown.map(({ course }) => (
                  <CourseTile key={course.id} course={course} progress={isStudent ? progressByCourse.get(course.id) : undefined} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-[#E4E0F0] bg-white px-6 py-20 text-center">
                <SearchX className="h-10 w-10 text-[#B9B3CF]" aria-hidden />
                <p className="text-lg font-extrabold">{query ? "Không tìm thấy khóa học phù hợp" : "Chưa có khóa học nào"}</p>
                {query && <p className="max-w-xs text-sm text-[#5F5B73]">Thử từ khoá khác hoặc xem toàn bộ danh mục.</p>}
                {(query || active) && (
                  <Link href="/courses" className="mt-1 inline-flex h-11 items-center rounded-xl bg-[#5B2BD6] px-5 font-bold text-white hover:bg-[#4319A8]">
                    Xem tất cả khóa học
                  </Link>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
