"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ClassDeadline {
  classId: string;
  className: string;
  /** ISO hoặc null (dùng hạn chung) */
  dueDate: string | null;
}

/** Chuyển ISO → giá trị cho <input type="datetime-local"> theo giờ máy thầy */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Hạn nộp riêng theo lớp của một đề (popover trong trang Quản lý bài kiểm tra) */
export default function ClassDeadlinesClient({ testId, classes, generalDueDate }: { testId: string; classes: ClassDeadline[]; generalDueDate: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => classes.map((c) => ({ ...c, value: toLocalInput(c.dueDate) })));
  const [pending, setPending] = useState(false);
  const customCount = classes.filter((c) => c.dueDate).length;

  const save = async () => {
    setPending(true);
    try {
      const deadlines = rows.map((r) => ({ classId: r.classId, dueDate: r.value ? new Date(r.value).toISOString() : null }));
      const res = await fetch(`/api/tests/${testId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deadlines }) });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Đã lưu hạn theo lớp.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Không lưu được hạn theo lớp.");
    } finally {
      setPending(false);
    }
  };

  if (classes.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="class-deadlines"
          title="Hạn nộp riêng theo lớp"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold",
            customCount ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
          )}
        >
          <CalendarClock className="h-3 w-3" /> Hạn theo lớp{customCount ? ` (${customCount})` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] space-y-2 rounded-2xl p-3">
        <p className="text-xs font-black text-slate-800">Hạn nộp riêng theo lớp</p>
        <p className="text-[11px] text-slate-500">
          Lớp để trống dùng hạn chung{generalDueDate ? ` (${new Date(generalDueDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})` : " — hiện chưa đặt hạn chung nên không có hạn"}.
          Nộp đúng hạn được +150 xu.
        </p>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {rows.map((r, i) => (
            <label key={r.classId} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate font-bold text-slate-700" title={r.className}>{r.className}</span>
              <input
                type="datetime-local"
                value={r.value}
                data-testid={`deadline-${r.classId}`}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold"
              />
              <button type="button" aria-label="Bỏ hạn riêng" disabled={!r.value} onClick={() => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, value: "" } : x)))} className="rounded-md p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </label>
          ))}
        </div>
        <button type="button" disabled={pending} onClick={save} data-testid="deadline-save" className="btn-3d btn-3d-blue h-9 w-full text-xs">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Lưu hạn theo lớp
        </button>
      </PopoverContent>
    </Popover>
  );
}
