import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { auth } from "@/auth";
import { HomeworkCheck } from "@/components/teacher/HomeworkCheck";
import { getCheckClasses, getClassHomeworkLessons, getHomeworkCheckList } from "@/lib/points/homework-queries";
import { loadGameConfig } from "@/lib/game/game-config";
import { POINTS } from "@/lib/points/config";

/** Duyệt chữa bài tập về nhà trên lớp (cơ chế xu 26/11/2026) — giáo viên + admin */
export default async function HomeworkCheckPage({ searchParams }: { searchParams: Promise<{ class?: string; lesson?: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) redirect("/login");
  const sp = await searchParams;
  await loadGameConfig();
  const classes = await getCheckClasses();
  const classId = classes.some((c) => c.id === sp.class) ? sp.class! : null;
  const lessons = classId ? await getClassHomeworkLessons(classId) : [];
  const lessonId = classId && lessons.some((l) => l.id === sp.lesson) ? sp.lesson! : null;
  const list = classId && lessonId ? await getHomeworkCheckList(lessonId, classId) : null;

  return (
    <div className="page-shell min-h-screen bg-[#EBF3FF] px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_4px_0_0_#047857]"><ClipboardCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-[1_1_200px]">
          <h1 className="text-xl font-black text-slate-800">Duyệt chữa bài tập</h1>
          <p className="text-xs font-semibold text-slate-500">Kiểm tra vở trên lớp: Chưa chữa 0 · Có chữa +{POINTS.homeworkReview.partial} · Chữa đủ, tốt +{POINTS.homeworkReview.full} xu</p>
        </div>
        <Link href="/teacher/homework" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-600 hover:bg-slate-50 sm:w-auto">Chấm bài nộp online →</Link>
      </div>
      <HomeworkCheck
        key={`${classId}-${lessonId}`}
        classes={classes}
        classId={classId}
        lessons={lessons}
        lessonId={lessonId}
        list={list}
        xu={{ submit: POINTS.homeworkSubmit, partial: POINTS.homeworkReview.partial, full: POINTS.homeworkReview.full }}
      />
    </div>
  );
}
