"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, Search } from "lucide-react";
import type { HomeworkReviewLevel } from "@prisma/client";
import { cn } from "@/lib/utils";
import { setHomeworkDeadline, setHomeworkReview } from "@/actions/homework-review";
import type { CheckClass, CheckLesson, CheckList } from "@/lib/points/homework-queries";

/**
 * "Duyệt chữa bài" (26/11/2026): thầy chọn lớp + bài tập → đặt hạn nộp cho lớp → kiểm tra vở từng bạn trong giờ,
 * bấm 1 trong 3 nút (Chưa chữa 0 / Có chữa +280 / Chữa đủ, tốt +400) — lưu ngay, bấm lại nút khác thì xu tự điều chỉnh.
 */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const vnLocal = (iso: string | null) => {
  if (!iso) return "";
  // datetime-local theo giờ Việt Nam
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
};
const vnText = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
const vnDay = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });

type Row = CheckList["students"][number];

export function HomeworkCheck({ classes, classId, lessons, lessonId, list, xu }: {
  classes: CheckClass[];
  classId: string | null;
  lessons: CheckLesson[];
  lessonId: string | null;
  list: CheckList | null;
  xu: { submit: number; partial: number; full: number };
}) {
  const router = useRouter();
  const go = (c: string | null, l: string | null) => router.push(`/teacher/homework/check${c ? `?class=${c}${l ? `&lesson=${l}` : ""}` : ""}`);
  const [rows, setRows] = useState<Row[]>(list?.students ?? []);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "todo" | "done">("all");
  // Đang lưu từng bạn (bấm liên tiếp nhiều bạn không phải chờ nhau)
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [due, setDue] = useState(vnLocal(list?.dueDate ?? null));
  const [savedDue, setSavedDue] = useState(list?.dueDate ?? null);
  const [pending, start] = useTransition();
  // 28/11: mặc định chỉ bài 30 ngày gần đây (mới nhất lên đầu); bài đang mở dù cũ vẫn hiện
  const [showOld, setShowOld] = useState(false);
  const oldCount = lessons.filter((l) => !l.recent).length;
  const options = lessons.filter((l) => showOld || l.recent || l.id === lessonId);

  const LEVELS: { level: HomeworkReviewLevel; label: string; xu: number; on: string }[] = [
    { level: "NONE", label: "Chưa chữa", xu: 0, on: "border-slate-500 bg-slate-600 text-white" },
    { level: "PARTIAL", label: "Có chữa", xu: xu.partial, on: "border-amber-600 bg-amber-500 text-white" },
    { level: "FULL", label: "Chữa đủ, tốt", xu: xu.full, on: "border-emerald-700 bg-emerald-600 text-white" },
  ];

  const shown = useMemo(() => {
    const k = norm(q.trim());
    return rows.filter((r) => (!k || norm(r.name).includes(k) || norm(r.email ?? "").includes(k)) && (only === "all" || (only === "todo" ? !r.level : !!r.level)));
  }, [rows, q, only]);
  const done = rows.filter((r) => r.level).length;
  const submitted = rows.filter((r) => r.submittedAt || r.doneAt).length;

  // Mức thầy chọn cuối cùng cho bạn đang lưu dở: bấm nút khác khi chưa lưu xong → lưu tiếp ngay sau (không bỏ qua lần bấm)
  const wanted = useRef(new Map<string, HomeworkReviewLevel>());
  /** Mức đã lưu thành công trên server (để hoàn lại khi lỗi) */
  const savedLevel = useRef(new Map<string, HomeworkReviewLevel | null>((list?.students ?? []).map((s) => [s.id, s.level])));

  const review = async (r: Row, level: HomeworkReviewLevel) => {
    if (!lessonId) return;
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, level } : x)));
    if (busy.has(r.id)) {
      wanted.current.set(r.id, level);
      return;
    }
    if ((savedLevel.current.get(r.id) ?? null) === level) return;
    setBusy((b) => new Set(b).add(r.id));
    let next: HomeworkReviewLevel | undefined = level;
    let total = 0;
    let ok = true;
    while (next) {
      const lv: HomeworkReviewLevel = next;
      wanted.current.delete(r.id);
      const res = await setHomeworkReview({ lessonId, userId: r.id, level: lv }).catch(() => ({ success: false as const, error: "Mất kết nối, thử lại nhé." }));
      if (!res.success) {
        ok = false;
        toast.error(res.error);
        wanted.current.delete(r.id);
        break;
      }
      savedLevel.current.set(r.id, lv);
      total += res.delta;
      const w = wanted.current.get(r.id);
      next = w && w !== lv ? w : undefined;
    }
    setBusy((b) => {
      const n = new Set(b);
      n.delete(r.id);
      return n;
    });
    const final = savedLevel.current.get(r.id) ?? null;
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, level: final as Row["level"] } : x)));
    if (ok) toast.success(`${r.name}: ${LEVELS.find((x) => x.level === final)?.label ?? "—"}${total ? ` (${total > 0 ? "+" : ""}${total.toLocaleString("vi-VN")} xu)` : ""}`, { duration: 1800 });
  };

  const saveDue = (value: string | null) =>
    start(async () => {
      if (!lessonId || !classId) return;
      const res = await setHomeworkDeadline({ lessonId, classId, dueDate: value });
      if (!res.success) return void toast.error(res.error);
      setSavedDue(res.dueDate);
      if (!value) setDue("");
      toast.success(res.message);
    });

  const lesson = lessons.find((l) => l.id === lessonId);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4" data-testid="homework-check">
      <div className="grid gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-500">
          Lớp
          <select value={classId ?? ""} data-testid="hc-class" onChange={(e) => go(e.target.value || null, null)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.students} HS)</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500">
          Bài tập về nhà
          <select value={lessonId ?? ""} disabled={!classId} data-testid="hc-lesson" onChange={(e) => go(classId, e.target.value || null)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-50">
            <option value="">{classId ? (options.length ? "— Chọn bài (mới nhất ở trên) —" : lessons.length ? "Không có bài trong 30 ngày gần đây" : "Lớp chưa có bài tập về nhà") : "Chọn lớp trước"}</option>
            {options.map((l) => (
              <option key={l.id} value={l.id}>
                {vnDay(l.activityAt)} · {l.title}{l.online ? " 💻" : ""}{l.dueDate ? " ⏰" : ""}
              </option>
            ))}
          </select>
        </label>
        {classId && oldCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 sm:col-span-2">
            <input type="checkbox" checked={showOld} data-testid="hc-show-old" onChange={(e) => setShowOld(e.target.checked)} className="h-4 w-4" />
            Hiện cả {oldCount} bài cũ hơn 30 ngày
            <span className="font-semibold text-slate-400">· 💻 làm online · ⏰ đã đặt hạn</span>
          </label>
        )}
      </div>

      {list && lesson && (
        <>
          <div className="flex flex-wrap items-end gap-2 rounded-3xl border border-sky-200 bg-sky-50 p-4" data-testid="hc-deadline">
            <label className="min-w-[200px] flex-1 text-xs font-bold text-sky-800">
              <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Hạn nộp của lớp (giờ Việt Nam)</span>
              <input type="datetime-local" value={due} data-testid="hc-due" onChange={(e) => setDue(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-slate-800" />
            </label>
            <button type="button" disabled={pending || !due} data-testid="hc-due-save" onClick={() => saveDue(due)} className="h-11 rounded-xl bg-sky-600 px-4 text-sm font-black text-white disabled:opacity-50">Lưu hạn</button>
            {savedDue && <button type="button" disabled={pending} onClick={() => saveDue(null)} className="h-11 rounded-xl border border-sky-300 bg-white px-3 text-sm font-bold text-sky-700">Bỏ hạn</button>}
            <p className="w-full text-[12px] font-semibold text-sky-800">
              {savedDue ? (
                <>Nộp {list.online ? "(làm online hoặc nộp ảnh) " : ""}trước <b>{vnText(savedDue)}</b> được <b>+{xu.submit} xu</b> (lần nộp đầu); nộp sau hạn không được xu.</>
              ) : lesson.recent ? (
                <>Chưa đặt hạn — bài giao trong 30 ngày nên nộp lần đầu được <b>+{xu.submit} xu</b>.</>
              ) : (
                <>Bài cũ hơn 30 ngày, chưa đặt hạn → nộp <b>không</b> được xu. Muốn cho xu thì đặt hạn mới.</>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên học sinh…" data-testid="hc-search" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold" />
              </div>
              {([["all", `Tất cả ${rows.length}`], ["todo", `Chưa duyệt ${rows.length - done}`], ["done", `Đã duyệt ${done}`]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)} className={cn("h-9 rounded-full border px-3 text-xs font-black", only === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600")}>{label}</button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-500">{lesson.course} · {lesson.chapter} · <b className="text-slate-700">{lesson.title}</b> — {submitted}/{rows.length} bạn đã {list.online ? "làm / nộp" : "nộp ảnh"} online.</p>
            <ul className="flex flex-col divide-y divide-slate-100">
              {shown.map((r) => (
                <li key={r.id} data-testid="hc-row" data-user={r.id} data-level={r.level ?? ""} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-black text-slate-800">{r.name}{!r.approved && <span className="ml-1 text-[11px] font-bold text-amber-600">(chưa duyệt TK — không cộng xu)</span>}</p>
                    <p className="text-[12px] font-semibold">
                      {r.doneAt && (
                        <span className={cn("mr-2", r.doneLate ? "text-rose-600" : "text-emerald-700")} data-testid="hc-done">
                          💻 Làm {vnText(r.doneAt)}{r.score !== null ? ` · ${String(Math.round(r.score * 100) / 100).replace(".", ",")}đ` : ""} · {r.doneLate ? "trễ hạn" : "đúng hạn"}
                        </span>
                      )}
                      {r.submittedAt ? (
                        <span className={r.late ? "text-rose-600" : "text-emerald-700"}>📸 Nộp {vnText(r.submittedAt)} · {r.late ? "trễ hạn" : "đúng hạn"}</span>
                      ) : (
                        !r.doneAt && <span className="text-slate-400">{list.online ? "Chưa làm online" : "Chưa nộp ảnh online"}</span>
                      )}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:w-[330px]" role="group" aria-label={`Duyệt chữa bài: ${r.name}`}>
                    {LEVELS.map((L) => {
                      const on = r.level === L.level;
                      return (
                        <button
                          key={L.level}
                          type="button"
                          aria-pressed={on}
                          data-testid={`hc-${L.level}`}
                          onClick={() => review(r, L.level)}
                          className={cn("flex h-12 flex-col items-center justify-center rounded-xl border-2 px-1 text-[12px] font-black leading-tight transition active:scale-95", on ? L.on : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
                        >
                          <span className="flex items-center gap-0.5">{on && <Check className="h-3.5 w-3.5" />}{L.label}</span>
                          <span className={cn("text-[11px]", on ? "text-white/90" : "text-slate-400")}>{L.xu ? `+${L.xu}` : "0"} xu</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
              {shown.length === 0 && <li className="py-6 text-center text-sm text-slate-400">{rows.length ? "Không có bạn nào khớp." : "Lớp chưa có học sinh."}</li>}
            </ul>
            {(pending || busy.size > 0) && <p className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Đang lưu…</p>}
          </div>
        </>
      )}
    </div>
  );
}
