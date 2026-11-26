"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";

/** Mảnh giao diện dùng chung cho khu "Quản lý tiệm" (cùng phong cách Adorable Home của tiệm: viền mực, nền kem) */
export const FIELD =
  "h-11 w-full rounded-[14px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] px-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#fbd048] disabled:opacity-60";
export const LABEL = "text-xs font-black text-[#6e4722]";
export const BOX = "rounded-[20px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] shadow-[0_4px_0_#241e1a]";
export const HINT = "text-[11px] font-bold text-[#6e4722]";

export type ActionResult = { success: boolean; message?: string; error?: string };

/** Chạy server action: âm thanh + thông báo + làm mới dữ liệu trang */
export function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        if (res.success) {
          play("coin");
          if (res.message) toast.success(res.message);
          after?.();
          router.refresh();
        } else {
          play("error");
          toast.error(res.error || "Có lỗi xảy ra");
        }
      } catch {
        play("error");
        toast.error("Có lỗi xảy ra, thầy thử lại nhé.");
      }
    });
  return { pending, run, refresh: () => router.refresh() };
}

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Tìm tên không dấu: "hoc sinh" khớp "Học Sinh" */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function ClassSelect({ classes, value, onChange, all = "Tất cả lớp", testId }: { classes: { id: string; name: string }[]; value: string; onChange: (v: string) => void; all?: string | null; testId?: string }) {
  return (
    <select value={value} data-testid={testId} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "w-auto min-w-[150px] cursor-pointer pr-8 text-sm")}>
      {all !== null && <option value="">{all}</option>}
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#ea6a51]" />;
}

/** Hộp nổi kiểu tiệm (đáy màn hình trên điện thoại, giữa màn hình trên máy tính) */
export function Sheet({ title, onClose, children, footer, testId, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; testId?: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[63] flex items-end justify-center bg-[rgba(36,30,26,0.55)] sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} data-testid={testId} className={cn("ah-dialog ah-panel v2-pop flex max-h-[94vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-[26px]", wide ? "sm:max-w-[860px]" : "sm:max-w-[480px]")}>
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#efe3cc] px-4 py-3 sm:px-5">
          <h2 className="ah-hand flex-1 text-[22px] font-bold">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#241e1a] bg-[#ef5b4c] text-lg font-black text-white shadow-[0_3px_0_#241e1a]">
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t-2 border-[#efe3cc] px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="ah-hand p-6 text-center text-[17px] text-[#6e4722]">{children}</p>;
}
