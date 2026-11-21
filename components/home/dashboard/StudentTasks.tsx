import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  PartyPopper,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeRecentResult, HomeTodoItem } from "@/lib/home/student-home";

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
  });

/** Còn ≤ 2 ngày tới hạn (hoặc đã quá hạn) → tô đỏ */
const dueSoon = (d: Date | string) =>
  new Date(d).getTime() - Date.now() < 2 * 24 * 3600 * 1000;

function scoreTone(score: number | null) {
  if (score === null)
    return "bg-slate-100 text-slate-500 shadow-[0_3px_0_0_#e2e8f0]";
  if (score >= 8) return "bg-emerald-500 text-white shadow-[0_3px_0_0_#047857]";
  if (score >= 5) return "bg-blue-600 text-white shadow-[0_3px_0_0_#1e3a8a]";
  return "bg-rose-500 text-white shadow-[0_3px_0_0_#be123c]";
}

const card =
  "min-w-0 rounded-3xl border-2 border-blue-100/80 bg-white p-4 shadow-[0_4px_0_0_#e3ecff] sm:p-5";

/** "Bài cần làm" + "Kết quả gần đây" trên trang chủ học sinh */
export function StudentTasks({
  todo,
  todoTotal,
  recent,
}: {
  todo: HomeTodoItem[];
  todoTotal: number;
  recent: HomeRecentResult[];
}) {
  // Chỉ một khối có nội dung → khối đó trải cả hàng (không để một thẻ trống bị kéo cao bên cạnh)
  const showTodo = todo.length > 0 || recent.length === 0;
  const showRecent = recent.length > 0;
  const both = showTodo && showRecent;
  return (
    <section
      id="bai-can-lam"
      data-testid="student-tasks"
      className={cn("grid grid-cols-1 gap-4", both && "lg:grid-cols-2")}
    >
      {showTodo && (
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-slate-900">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-amber-950">
                <ClipboardList className="h-4 w-4" />
              </span>
              <span className="truncate">Bài cần làm</span>
              {todoTotal > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                  {todoTotal}
                </span>
              )}
            </h2>
            {todoTotal > todo.length && (
              <span className="shrink-0 text-xs font-bold text-slate-400">
                +{todoTotal - todo.length} bài nữa
              </span>
            )}
          </div>

          {todo.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              <PartyPopper className="h-5 w-5 shrink-0" />
              {/* Chỉ hiện khối này một mình khi chưa có kết quả nào → chưa có đề nào để làm */}
              Chưa có bài kiểm tra nào cần làm. Xem bài giảng trong lộ trình bên dưới nhé!
            </div>
          ) : (
            <ul className={cn("grid grid-cols-1 gap-2", !both && "lg:grid-cols-2")}>
              {todo.map((t) => (
                <li key={t.lessonId}>
                  <Link
                    href={`/watch/${t.lessonId}`}
                    className="group flex items-center gap-3 rounded-2xl border-2 border-transparent bg-slate-50 p-2.5 transition-colors hover:border-amber-200 hover:bg-amber-50/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold sm:line-clamp-1 text-slate-900 group-hover:text-amber-800">
                        {t.title}
                      </p>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span className="truncate">{t.chapterTitle}</span>
                        {t.duration > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5">
                            · <Clock className="h-3 w-3" /> {t.duration} phút
                          </span>
                        )}
                      </p>
                    </div>
                    {t.dueDate && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black",
                          dueSoon(t.dueDate)
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-200/70 text-slate-600",
                        )}
                      >
                        Hạn {fmtDate(t.dueDate)}
                      </span>
                    )}
                    <span className="btn-3d btn-3d-amber shrink-0 px-3 py-1.5 text-xs">
                      Làm bài
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showRecent && (
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-slate-900">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Trophy className="h-4 w-4" />
              </span>
              <span className="truncate">Kết quả gần đây</span>
              {!showTodo && (
                <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700 sm:inline-flex">
                  <PartyPopper className="h-3 w-3" /> Đã làm hết bài
                </span>
              )}
            </h2>
            <Link
              href="/ranking"
              className="inline-flex shrink-0 items-center text-xs font-black text-blue-600 hover:text-blue-700"
            >
              Bảng xếp hạng <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              Chưa có bài nào được chấm. Làm bài đầu tiên để xem điểm và lời
              giải từng câu nhé!
            </div>
          ) : (
            <ul
              className={cn(
                "grid grid-cols-1 gap-2",
                !both && "lg:grid-cols-2",
              )}
            >
              {recent.map((r) => (
                <li key={r.attemptId}>
                  <Link
                    href={`/watch/${r.lessonId}/results/${r.attemptId}`}
                    className="group flex items-center gap-3 rounded-2xl border-2 border-transparent bg-slate-50 p-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/60"
                  >
                    <span
                      className={cn(
                        "flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
                        scoreTone(r.score),
                      )}
                    >
                      <span className="text-base font-black tabular-nums">
                        {r.score === null
                          ? "—"
                          : r.score.toFixed(r.score % 1 === 0 ? 0 : 1)}
                      </span>
                      <span className="text-[9px] font-bold opacity-80">
                        /10
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold sm:line-clamp-1 text-slate-900 group-hover:text-blue-700">
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        Nộp ngày {fmtDate(r.completedAt)}
                      </p>
                    </div>
                    <span className="hidden shrink-0 items-center text-xs font-black text-blue-600 sm:inline-flex">
                      Xem chữa <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
