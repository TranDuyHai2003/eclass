"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, Printer, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { createGiftCodes, deactivateGiftBatch } from "@/actions/giftcode";
import { MAX_AMOUNT, MAX_BATCH } from "@/lib/game/giftcode-shared";
import type { GiftCodeBatch } from "@/lib/game/giftcode-queries";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Tab "Mã quà tặng" của thầy: tạo lô thẻ cào, in, vô hiệu, xem lượt dùng */
export function GiftCodesTab({ batches, classes }: { batches: GiftCodeBatch[]; classes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [count, setCount] = useState(10);
  const [currency, setCurrency] = useState<"GEM" | "XU">("GEM");
  const [amount, setAmount] = useState(3);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [classId, setClassId] = useState("");
  const [note, setNote] = useState("Điểm 10 trên lớp");
  const [justCreated, setJustCreated] = useState<string[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      const res = await createGiftCodes({ count, currency, amount, maxUses, expiresAt: expiresAt || null, classId: classId || null, note });
      if (res.success) {
        toast.success(res.message);
        setJustCreated(res.codes ?? []);
        router.refresh();
      } else toast.error(res.error);
    });

  const printCodes = (codes: string[], label: string) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast.error("Trình duyệt chặn cửa sổ in.");
    const cards = codes
      .map(
        (c) =>
          `<div class="card"><div class="t">🎁 Thẻ quà tặng</div><div class="c">${c}</div><div class="s">${label}</div><div class="s">Nhập mã tại thatdehoctoan → Tiệm quà → Nhập code</div></div>`,
      )
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Thẻ quà tặng</title><style>
        body{font-family:system-ui,sans-serif;margin:16px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .card{border:2px dashed #f472b6;border-radius:14px;padding:12px;text-align:center;break-inside:avoid}
        .t{font-weight:800;color:#be185d;font-size:13px}
        .c{font-family:ui-monospace,monospace;font-size:22px;font-weight:900;letter-spacing:4px;margin:8px 0;color:#111}
        .s{font-size:11px;color:#555}
        @media print{body{margin:6mm}}
      </style></head><body><div class="grid">${cards}</div><script>window.onload=()=>window.print()</script></body></html>`,
    );
    w.document.close();
  };

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Tạo lô */}
      <div className="h-fit space-y-3 rounded-3xl border-2 border-pink-200 bg-white p-4 shadow-[0_4px_0_0_#fbcfe8] lg:sticky lg:top-24">
        <p className="flex items-center gap-2 text-sm font-black text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500 text-white"><Ticket className="h-4 w-4" /></span>
          Tạo lô thẻ cào
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-bold text-slate-500">
            Số mã
            <input type="number" min={1} max={MAX_BATCH} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-black" />
          </label>
          <label className="text-xs font-bold text-slate-500">
            Loại tiền
            <select value={currency} onChange={(e) => { setCurrency(e.target.value as "GEM" | "XU"); setAmount(e.target.value === "GEM" ? 3 : 300); }} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black">
              <option value="GEM">💎 Ngọc</option>
              <option value="XU">🪙 Xu</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-500">
            Giá trị mỗi mã
            <input type="number" min={1} max={MAX_AMOUNT[currency]} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-black" />
          </label>
          <label className="text-xs font-bold text-slate-500">
            Lượt dùng / mã
            <input type="number" min={1} max={500} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-black" />
          </label>
          <label className="col-span-2 text-xs font-bold text-slate-500">
            Hạn dùng (tuỳ chọn)
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
          </label>
          <label className="col-span-2 text-xs font-bold text-slate-500">
            Chỉ lớp (tuỳ chọn)
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
              <option value="">Mọi lớp</option>
              {classes.filter((c) => c.id !== "__none__").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-xs font-bold text-slate-500">
            Ghi chú (in trên thẻ)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
          </label>
        </div>
        <button type="button" disabled={pending} onClick={create} data-testid="giftcode-create" className="btn-3d btn-shine h-11 w-full bg-pink-500 text-sm text-white [--btn-edge:#9d174d] hover:bg-pink-400 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Tạo {count} mã × {amount.toLocaleString("vi-VN")} {currency === "GEM" ? "ngọc" : "xu"}
        </button>
        <p className="text-[11px] text-slate-400">Mỗi mã 8 ký tự, không có chữ dễ nhầm (O/0, I/1). Mỗi học sinh chỉ dùng mỗi mã một lần. Lô đã tạo có thể vô hiệu bất cứ lúc nào.</p>
        {justCreated && (
          <div data-testid="giftcode-created" className="animate-pop-in rounded-2xl border border-pink-200 bg-pink-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-pink-700">Vừa tạo {justCreated.length} mã</p>
              <button type="button" onClick={() => printCodes(justCreated, `${amount} ${currency === "GEM" ? "ngọc" : "xu"} · ${note}`)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-black text-pink-700 ring-1 ring-pink-200 hover:bg-pink-100">
                <Printer className="h-3.5 w-3.5" /> In thẻ
              </button>
            </div>
            <p className="mt-2 break-all font-mono text-xs font-bold leading-6 tracking-wider text-slate-700">{justCreated.join("  ")}</p>
          </div>
        )}
      </div>

      {/* Danh sách lô */}
      <div className="space-y-3">
        {batches.length === 0 && <p className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center text-sm text-slate-500">Chưa có lô mã nào. Tạo lô đầu tiên để phát thẻ cào cho học sinh được điểm 10 nhé!</p>}
        {batches.map((b) => (
          <div key={b.batchId} className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-slate-800">
                  {b.total} mã × {b.amount.toLocaleString("vi-VN")} {b.currency === "GEM" ? "💎 ngọc" : "🪙 xu"}
                  {b.maxUses > 1 && <span className="ml-1 text-xs font-bold text-slate-500">· {b.maxUses} lượt/mã</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmtDate(b.createdAt)} · {b.note || "không ghi chú"} · {b.className ? `Lớp ${b.className}` : "Mọi lớp"}
                  {b.expiresAt && ` · hạn ${fmtDate(b.expiresAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{b.used} lượt đã dùng</span>
                <span className={cn("rounded-full px-2 py-0.5", b.active ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500")}>{b.active} mã còn dùng được</span>
                <button type="button" onClick={() => printCodes(b.codes.filter((c) => c.isActive && c.usedCount < b.maxUses).map((c) => c.code), `${b.amount} ${b.currency === "GEM" ? "ngọc" : "xu"} · ${b.note ?? ""}`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50">
                  <Printer className="h-3.5 w-3.5" /> In
                </button>
                {b.active > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => confirm("Vô hiệu toàn bộ mã chưa dùng của lô này?") && start(async () => { const r = await deactivateGiftBatch(b.batchId); if (r.success) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Vô hiệu
                  </button>
                )}
                <button type="button" onClick={() => setOpen(open === b.batchId ? null : b.batchId)} className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50">
                  {open === b.batchId ? "Ẩn mã" : "Xem mã"}
                </button>
              </div>
            </div>
            {open === b.batchId && (
              <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {b.codes.map((c) => (
                  <li key={c.code} className={cn("rounded-xl border px-2 py-1.5 font-mono text-xs font-bold tracking-wider", c.usedCount >= b.maxUses ? "border-emerald-200 bg-emerald-50 text-emerald-700 line-through" : c.isActive ? "border-slate-200 text-slate-700" : "border-slate-100 bg-slate-50 text-slate-400 line-through")}>
                    {c.code}
                    {c.users.length > 0 && <span className="block truncate font-sans text-[10px] font-semibold no-underline text-slate-500">{c.users.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
