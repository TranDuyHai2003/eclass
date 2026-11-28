"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { grantPoints } from "@/actions/points";
import type { TeacherRewardsPageData } from "@/lib/points/queries";
import { CoinDot, fmt } from "../parts";
import { BOX, Check, ClassSelect, Empty, FIELD, HINT, LABEL, fold, useRun } from "./ui";

const REASONS = ["Phát biểu xây dựng bài", "Giúp đỡ bạn", "Đi học đầy đủ", "Làm bài tốt trên lớp", "Tiến bộ rõ rệt"];

/** Thưởng / trừ xu tay: chọn lớp → tick học sinh (tìm tên không dấu) → chọn mức + lý do. Giới hạn mỗi lần / mỗi ngày do admin đặt. */
export function GrantTab({ data, manualMax, manualDailyCap }: { data: TeacherRewardsPageData; manualMax: number; manualDailyCap: number }) {
  const { pending, run } = useRun();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(Math.min(100, manualMax));
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");

  const students = useMemo(() => {
    const list = data.classes.find((c) => c.id === classId)?.students ?? [];
    const q = fold(query.trim());
    return q ? list.filter((s) => fold(s.name || s.email).includes(q)) : list;
  }, [data.classes, classId, query]);
  const chosen = students.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allChecked = students.length > 0 && chosen.length === students.length;
  const presets = [...new Set([100, 200, 300, manualMax])].filter((v) => v > 0 && v <= manualMax);
  const valid = Number.isInteger(amount) && amount !== 0 && Math.abs(amount) <= manualMax;

  if (data.classes.length === 0) return <div className={BOX}><Empty>Chưa có lớp hoặc học sinh nào được duyệt.</Empty></div>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="mgr-grant">
      <div className={cn(BOX, "flex min-w-0 flex-col")}>
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#efe3cc] p-3">
          <ClassSelect classes={data.classes.map((c) => ({ id: c.id, name: `${c.name} (${c.students.length})` }))} all={null} value={classId} onChange={(v) => { setClassId(v); setSelected(new Set()); }} testId="grant-class" />
          <input value={query} data-testid="grant-search" onChange={(e) => setQuery(e.target.value)} placeholder="🔎 Tìm tên (gõ không dấu được)" className={cn(FIELD, "min-w-[160px] flex-1 text-sm")} />
        </div>
        <label className="flex cursor-pointer items-center gap-3 border-b-2 border-[#efe3cc] px-4 py-2 text-xs font-black text-[#9e6b3f]">
          <Check checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(students.map((s) => s.id)))} />
          Chọn cả danh sách ({students.length})
        </label>
        <ul className="grid max-h-[55dvh] grid-cols-1 gap-x-2 overflow-y-auto p-2 sm:grid-cols-2">
          {students.map((s) => (
            <li key={s.id}>
              <label data-testid="grant-student" className={cn("flex cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3 py-2", selected.has(s.id) ? "border-[#241e1a] bg-[#fff1c9]" : "border-transparent hover:bg-[#fff6e5]")}>
                <Check
                  checked={selected.has(s.id)}
                  onChange={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(s.id)) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                />
                <span className="line-clamp-1 min-w-0 flex-1 text-sm font-extrabold">{s.name || s.email}</span>
                {s.studentType === "ONLINE" && <span className="text-[10px] font-black text-[#2b7bb9]">ONLINE</span>}
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black tabular-nums text-[#9e6b3f]"><CoinDot size={11} />{fmt(s.balance)}</span>
              </label>
            </li>
          ))}
          {students.length === 0 && <li className="col-span-full"><Empty>Không có học sinh khớp.</Empty></li>}
        </ul>
      </div>

      <div className={cn(BOX, "flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-4")}>
        <p className="ah-hand text-lg font-bold">Đã chọn {chosen.length} học sinh</p>
        <div>
          <span className={LABEL}>Số xu (số âm để trừ)</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {presets.map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)} className={cn("ah-btn h-10 min-w-[58px] flex-1 px-2 text-sm", amount === v ? "ah-gold" : "ah-cream")}>+{v}</button>
            ))}
            <input type="number" inputMode="numeric" data-testid="grant-amount" aria-label="Số xu" value={Number.isFinite(amount) ? amount : ""} min={-manualMax} max={manualMax} onChange={(e) => setAmount(Math.trunc(Number(e.target.value)))} className={cn(FIELD, "h-10 w-24 text-center")} />
          </div>
        </div>
        <div>
          <span className={LABEL}>Lý do (học sinh sẽ thấy) *</span>
          <input value={reason} data-testid="grant-reason" maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="VD: Phát biểu xây dựng bài" className={cn(FIELD, "mt-1 text-sm")} />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn("cursor-pointer rounded-full border-2 px-2 py-0.5 text-[11px] font-extrabold", reason === r ? "border-[#241e1a] bg-[#fbd048]" : "border-[#d6c3a5] bg-[#fffdf8] hover:border-[#241e1a]")}>{r}</button>
            ))}
          </div>
        </div>
        <button
          type="button"
          data-testid="grant-submit"
          disabled={pending || chosen.length === 0 || !valid || !reason.trim()}
          onClick={() => run(() => grantPoints({ userIds: chosen, amount, reason }), () => setSelected(new Set()))}
          className={cn("ah-btn h-12 w-full text-[15px]", amount < 0 ? "ah-coral" : "ah-gold")}
        >
          {pending ? "Đang lưu…" : amount < 0 ? `Trừ ${fmt(-amount)} xu` : `💰 Thưởng ${fmt(Math.max(0, amount))} xu`}
        </button>
        <p className={HINT}>
          Mỗi lần tối đa {fmt(manualMax)} xu; mỗi học sinh nhận tối đa {fmt(manualDailyCap)} xu thưởng tay mỗi ngày. Học sinh nhận thông báo kèm lý do.
        </p>
      </div>
    </div>
  );
}
