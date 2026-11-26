"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { deliverRedemptions, rejectRedemption } from "@/actions/points";
import type { TeacherRewardsPageData } from "@/lib/points/queries";
import { CoinDot, fmt } from "../parts";
import { BOX, Check, ClassSelect, Empty, FIELD, HINT, LABEL, Sheet, fmtDate, useRun } from "./ui";

type Data = TeacherRewardsPageData;
type Row = Data["pending"][number];

const STATUS: Record<string, [string, string]> = {
  DELIVERED: ["Đã trao", "bg-[#d1fae5] text-[#065f46]"],
  CANCELLED: ["HS huỷ", "bg-[#f1f5f9] text-[#475569]"],
  REJECTED: ["Từ chối", "bg-[#fde2dc] text-[#b83d27]"],
  EXPIRED: ["Hết hạn", "bg-[#f1f5f9] text-[#475569]"],
};

/** Đơn đổi quà chờ trao: lọc lớp, chọn nhiều → Đã trao; trao từng đơn; từ chối (bắt buộc lý do, hoàn xu); xuất Excel danh sách đi phát quà */
export function RequestsTab({ data }: { data: Data }) {
  const { pending, run } = useRun();
  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const classes = [...new Map(data.pending.map((p) => [p.user.studyClass?.id ?? "__none__", { id: p.user.studyClass?.id ?? "__none__", name: p.user.studyClass?.name ?? "Chưa xếp lớp" }])).values()];
  const rows = data.pending.filter((p) => !classId || (p.user.studyClass?.id ?? "__none__") === classId);
  const chosen = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allChecked = rows.length > 0 && chosen.length === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Quà cần trao");
    ws.columns = [
      { header: "STT", key: "i", width: 6 },
      { header: "Học sinh", key: "name", width: 28 },
      { header: "Lớp", key: "cls", width: 16 },
      { header: "Quà", key: "gift", width: 30 },
      { header: "Xu", key: "price", width: 8 },
      { header: "Ngày đổi", key: "date", width: 16 },
      { header: "Đã trao", key: "done", width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r, i) => ws.addRow({ i: i + 1, name: r.user.name || r.user.email, cls: r.user.studyClass?.name ?? "", gift: r.reward.title, price: r.price, date: fmtDate(r.createdAt), done: "☐" }));
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `qua-can-trao-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="mgr-requests">
      <div className={cn(BOX, "flex flex-col")}>
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#efe3cc] p-3">
          {classes.length > 1 && <ClassSelect classes={classes} value={classId} onChange={(v) => { setClassId(v); setSelected(new Set()); }} />}
          <span className="text-sm font-extrabold text-[#6e4722]">{rows.length} quà đang chờ trao</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={exportExcel} disabled={!rows.length} className="ah-btn ah-cream h-10 px-3 text-sm">⬇️ Excel</button>
            <button type="button" data-testid="req-deliver" disabled={pending || chosen.length === 0} onClick={() => run(() => deliverRedemptions(chosen), () => setSelected(new Set()))} className="ah-btn ah-mint h-10 px-3.5 text-sm">
              ✅ Đã trao ({chosen.length})
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty>Không có quà nào đang chờ trao 🎉</Empty>
        ) : (
          <ul className="divide-y-2 divide-[#f3e9d6]">
            <li>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-xs font-black text-[#9e6b3f]">
                <Check checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} />
                Chọn tất cả
              </label>
            </li>
            {rows.map((r) => (
              <li key={r.id} data-testid="req-row" className={cn("flex items-center gap-3 px-4 py-2.5", selected.has(r.id) && "bg-[#fff6e0]")}>
                <Check checked={selected.has(r.id)} onChange={() => toggle(r.id)} label={`Chọn ${r.user.name ?? ""}`} />
                <span className="text-2xl leading-none" aria-hidden>{r.reward.emoji || "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black">
                    {r.user.name || r.user.email}
                    {r.user.studyClass && <span className="ml-1.5 font-bold text-[#9e6b3f]">· {r.user.studyClass.name}</span>}
                  </p>
                  <p className="line-clamp-1 flex items-center gap-1 text-xs font-bold text-[#6e4722]">
                    {r.reward.title} · <CoinDot size={11} /> {fmt(r.price)} · {fmtDate(r.createdAt)}
                  </p>
                </div>
                <button type="button" disabled={pending} data-testid="req-give" onClick={() => run(() => deliverRedemptions([r.id]))} className="ah-btn ah-mint h-9 shrink-0 px-2.5 text-xs">Trao</button>
                <button type="button" disabled={pending} data-testid="req-reject" onClick={() => { setRejecting(r); setNote(""); }} className="ah-btn ah-cream h-9 shrink-0 px-2.5 text-xs text-[#b83d27]">Từ chối</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.recent.length > 0 && (
        <div className={BOX}>
          <p className={cn(LABEL, "border-b-2 border-[#efe3cc] px-4 py-2.5")}>Đã xử lý gần đây</p>
          <ul className="max-h-[320px] divide-y-2 divide-[#f3e9d6] overflow-y-auto">
            {data.recent.map((r) => {
              const [label, cls] = STATUS[r.status] ?? [r.status, ""];
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="text-xl leading-none" aria-hidden>{r.reward.emoji || "🎁"}</span>
                  <p className="line-clamp-1 min-w-0 flex-1 text-sm font-bold">
                    {r.user.name || r.user.email} · <span className="font-semibold text-[#6e4722]">{r.reward.title}</span>
                    {r.note ? <span className="font-semibold text-[#9e6b3f]"> · {r.note}</span> : null}
                  </p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black", cls)}>{label}</span>
                  <span className="hidden shrink-0 text-xs font-bold text-[#9e6b3f] sm:block">{r.handledAt ? fmtDate(r.handledAt) : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {rejecting && (
        <Sheet
          title="Từ chối đơn đổi quà"
          testId="reject-sheet"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <button type="button" onClick={() => setRejecting(null)} className="ah-btn ah-cream h-11 px-5">Thôi</button>
              <button type="button" data-testid="reject-confirm" disabled={pending || !note.trim()} onClick={() => run(() => rejectRedemption(rejecting.id, note), () => setRejecting(null))} className="ah-btn ah-coral h-11 px-5">
                Từ chối &amp; hoàn xu
              </button>
            </>
          }
        >
          <p className="mb-3 text-sm font-bold">
            {rejecting.user.name || rejecting.user.email} · {rejecting.reward.title}. Học sinh được hoàn lại {fmt(rejecting.price)} xu.
          </p>
          <label>
            <span className={LABEL}>Lý do (học sinh sẽ thấy) *</span>
            <textarea data-testid="reject-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder="VD: hết hàng, em đổi quà khác nhé" className={cn(FIELD, "mt-1 h-auto py-2 text-sm")} />
          </label>
          <p className={cn(HINT, "mt-1")}>Chọn nhanh:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {["Hết hàng, em đổi quà khác nhé", "Quà chỉ dành cho lớp offline", "Đổi nhầm, thầy hoàn xu"].map((t) => (
              <button key={t} type="button" onClick={() => setNote(t)} className="cursor-pointer rounded-full border-2 border-[#d6c3a5] bg-[#fffdf8] px-2.5 py-1 text-xs font-extrabold hover:border-[#241e1a]">{t}</button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
