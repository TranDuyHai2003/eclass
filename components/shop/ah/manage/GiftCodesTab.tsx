"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createGiftCodes, deactivateGiftBatch } from "@/actions/giftcode";
import { MAX_AMOUNT, MAX_BATCH, MAX_CODE_LENGTH, MIN_CODE_LENGTH, codeLengthOk, normalizeCode } from "@/lib/game/giftcode-shared";
import type { GiftCodeBatch, UnusedGiftCode } from "@/lib/game/giftcode-queries";
import { play } from "@/lib/sound";
import { BOX, Empty, FIELD, HINT, LABEL, fmtDate, useRun } from "./ui";

/** Escape HTML trước khi ghép vào trang in (ghi chú do thầy nhập có thể chứa < > ") */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const unit = (c: "GEM" | "XU") => (c === "GEM" ? "ngọc" : "xu");

/** Mã quà tặng: tạo mã (tự đặt chữ hoặc ngẫu nhiên theo lô), in thẻ, xem mã chưa dùng, vô hiệu lô */
export function GiftCodesTab({ batches, unused, classes }: { batches: GiftCodeBatch[]; unused: UnusedGiftCode[]; classes: { id: string; name: string }[] }) {
  const { pending, run } = useRun();
  const [count, setCount] = useState(10);
  // Cơ chế 26/11: mã quà là 1 trong 3 cách nhận xu → mặc định tặng xu
  const [currency, setCurrency] = useState<"GEM" | "XU">("XU");
  const [amount, setAmount] = useState(300);
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [classId, setClassId] = useState("");
  const [note, setNote] = useState("Điểm 10 trên lớp");
  const [justCreated, setJustCreated] = useState<{ codes: string[]; label: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const custom = normalizeCode(customCode);
  const n = custom ? 1 : count;

  const create = () => {
    // datetime-local không có múi giờ → đổi sang ISO trên trình duyệt (giờ máy thầy) trước khi gửi
    const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;
    const label = `${amount.toLocaleString("vi-VN")} ${unit(currency)} · ${note.trim() || "Thẻ quà tặng"}`;
    run(
      async () => {
        const res = await createGiftCodes({ count: n, currency, amount, maxUses, expiresAt: expiresIso, classId: classId || null, note, customCode: custom || null });
        // Chụp nhãn lúc tạo → sửa form sau đó không làm thẻ in sai
        if (res.success) setJustCreated({ codes: res.codes ?? [], label });
        return res;
      },
      () => setCustomCode(""),
    );
  };

  const printCodes = (codes: string[], label: string) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast.error("Trình duyệt chặn cửa sổ in.");
    const cards = codes
      .map((c) => `<div class="card"><div class="t">🎁 Thẻ quà tặng</div><div class="c">${esc(c)}</div><div class="s">${esc(label)}</div><div class="s">Nhập mã tại Tiệm quà → Nhập code</div></div>`)
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Thẻ quà tặng</title><style>
        body{font-family:system-ui,sans-serif;margin:16px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .card{border:2px dashed #ea6a51;border-radius:14px;padding:12px;text-align:center;break-inside:avoid}
        .t{font-weight:800;color:#b83d27;font-size:13px}
        .c{font-family:ui-monospace,monospace;font-size:22px;font-weight:900;letter-spacing:4px;margin:8px 0;color:#111}
        .s{font-size:11px;color:#555}
        @media print{body{margin:6mm}}
      </style></head><body><div class="grid">${cards}</div><script>window.onload=()=>window.print()</script></body></html>`,
    );
    w.document.close();
  };

  const shown = showAll ? unused : unused.slice(0, 12);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" data-testid="mgr-codes">
      {/* Tạo mã */}
      <div className={cn(BOX, "flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-4")}>
        <p className="ah-hand text-lg font-bold">🎟️ Tạo mã quà tặng</p>
        <label>
          <span className={LABEL}>Mã tự đặt (để trống → web tạo mã ngẫu nhiên)</span>
          <input value={customCode} maxLength={MAX_CODE_LENGTH + 4} placeholder="VD: CHAMNGOAN" data-testid="giftcode-custom" onChange={(e) => setCustomCode(e.target.value.toUpperCase())} className={cn(FIELD, "mt-1 font-mono tracking-wider")} />
          {customCode && !codeLengthOk(custom) && <span className="mt-0.5 block text-[11px] font-bold text-[#b83d27]">{MIN_CODE_LENGTH}–{MAX_CODE_LENGTH} chữ / số, không dấu.</span>}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label>
            <span className={LABEL}>Tặng</span>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {(["XU", "GEM"] as const).map((c) => (
                <button key={c} type="button" aria-pressed={currency === c} data-testid={`giftcode-cur-${c}`} onClick={() => { setCurrency(c); setAmount(c === "GEM" ? 3 : 300); }} className={cn("ah-btn h-11 px-1 text-sm", currency === c ? "ah-gold" : "ah-cream")}>
                  {c === "XU" ? "💰 Xu" : "💎 Ngọc"}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span className={LABEL}>Mỗi mã ({unit(currency)})</span>
            <input type="number" inputMode="numeric" data-testid="giftcode-amount" min={1} max={MAX_AMOUNT[currency]} value={amount} onChange={(e) => setAmount(Math.trunc(Number(e.target.value)))} className={cn(FIELD, "mt-1")} />
          </label>
          <label>
            <span className={LABEL}>Số mã</span>
            <input type="number" inputMode="numeric" min={1} max={MAX_BATCH} value={n} disabled={!!custom} onChange={(e) => setCount(Math.trunc(Number(e.target.value)))} className={cn(FIELD, "mt-1")} />
          </label>
          <label>
            <span className={LABEL}>Lượt dùng / mã</span>
            <input type="number" inputMode="numeric" min={1} max={500} value={maxUses} onChange={(e) => setMaxUses(Math.trunc(Number(e.target.value)))} className={cn(FIELD, "mt-1")} />
          </label>
        </div>
        <label>
          <span className={LABEL}>Ghi chú (in trên thẻ)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className={cn(FIELD, "mt-1 text-sm")} />
        </label>
        <details className="rounded-[14px] border-2 border-dashed border-[#d6c3a5] px-3 py-2">
          <summary className="cursor-pointer text-xs font-black text-[#6e4722]">Tuỳ chọn thêm: hạn dùng, chỉ một lớp</summary>
          <div className="mt-2 flex flex-col gap-2.5">
            <label>
              <span className={LABEL}>Hạn dùng</span>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={cn(FIELD, "mt-1 text-sm")} />
            </label>
            <label>
              <span className={LABEL}>Chỉ lớp</span>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={cn(FIELD, "mt-1 cursor-pointer text-sm")}>
                <option value="">Mọi lớp</option>
                {classes.filter((c) => c.id !== "__none__").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        </details>
        <button type="button" disabled={pending || (!!customCode && !codeLengthOk(custom))} onClick={create} data-testid="giftcode-create" className="ah-btn ah-coral h-12 w-full text-[15px]">
          {pending ? "Đang tạo…" : `Tạo ${n} mã × ${amount.toLocaleString("vi-VN")} ${unit(currency)}`}
        </button>
        <p className={HINT}>Mã ngẫu nhiên 8 ký tự, không có chữ dễ nhầm (O/0, I/1). Mỗi học sinh dùng mỗi mã một lần; mã 1 lượt dùng xong là hết. Xu từ mã được tính vào xu tích luỹ.</p>
        {justCreated && (
          <div data-testid="giftcode-created" className="rounded-[14px] border-2 border-[#241e1a] bg-[#fff1c9] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black">Vừa tạo {justCreated.codes.length} mã</p>
              <button type="button" onClick={() => printCodes(justCreated.codes, justCreated.label)} className="ah-btn ah-cream h-8 px-2.5 text-xs">🖨️ In thẻ</button>
            </div>
            <p className="mt-2 break-all font-mono text-sm font-black leading-6 tracking-wider">{justCreated.codes.join("  ")}</p>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Mã còn dùng được (gom mọi lô) — web giữ mã tới khi được dùng */}
        <div className={cn(BOX, "p-4")} data-testid="giftcode-unused">
          <div className="flex flex-wrap items-center gap-2">
            <p className="ah-hand flex-1 text-lg font-bold">Mã chưa dùng ({unused.length})</p>
            {unused.length > 12 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="ah-btn ah-cream h-8 px-2.5 text-xs">{showAll ? "Thu gọn" : `Xem cả ${unused.length}`}</button>
            )}
          </div>
          {unused.length === 0 ? (
            <Empty>Không còn mã nào chưa dùng.</Empty>
          ) : (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {shown.map((u) => (
                <li key={u.code} className="flex items-center gap-2 rounded-[12px] border-2 border-[#efe3cc] bg-white px-3 py-1.5">
                  <span className="font-mono text-sm font-black tracking-wider">{u.code}</span>
                  <span className="line-clamp-1 min-w-0 text-[11px] font-bold text-[#6e4722]">
                    {u.amount.toLocaleString("vi-VN")} {unit(u.currency)}{u.maxUses > 1 ? ` · còn ${u.left}/${u.maxUses} lượt` : ""}{u.className ? ` · ${u.className}` : ""}
                  </span>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(u.code).then(() => { play("click"); toast.success(`Đã chép ${u.code}`); })} className="ml-auto shrink-0 cursor-pointer rounded-full border-2 border-[#d6c3a5] bg-[#fffdf8] px-2 py-0.5 text-[11px] font-black hover:border-[#241e1a]">Chép</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="ah-hand px-1 text-lg font-bold">Các lô đã tạo</p>
        {batches.length === 0 && <div className={BOX}><Empty>Chưa có mã nào. Tạo mã đầu tiên để tặng học sinh được điểm 10 nhé!</Empty></div>}
        {batches.map((b) => (
          <div key={b.batchId} className={cn(BOX, "p-4")} data-testid="giftcode-batch">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black">
                  {b.total} mã × {b.amount.toLocaleString("vi-VN")} {b.currency === "GEM" ? "💎 ngọc" : "💰 xu"}
                  {b.maxUses > 1 && <span className="ml-1 text-xs font-bold text-[#6e4722]">· {b.maxUses} lượt/mã</span>}
                </p>
                <p className="mt-0.5 text-xs font-bold text-[#6e4722]">
                  {fmtDate(b.createdAt)} · {b.note || "không ghi chú"} · {b.className ? `Lớp ${b.className}` : "Mọi lớp"}
                  {b.expiresAt && ` · hạn ${fmtDate(b.expiresAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
                <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[#065f46]">{b.used} lượt đã dùng</span>
                <span className="rounded-full bg-[#e0f2fe] px-2 py-0.5 text-[#075985]">{b.active} mã còn dùng được</span>
                <button type="button" onClick={() => printCodes(b.codes.filter((c) => c.isActive && c.usedCount < b.maxUses).map((c) => c.code), `${b.amount.toLocaleString("vi-VN")} ${unit(b.currency)} · ${b.note ?? "Thẻ quà tặng"}`)} className="ah-btn ah-cream h-8 px-2.5 text-xs">🖨️ In</button>
                {b.active > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    data-testid="giftcode-deactivate"
                    onClick={() => (armed === b.batchId ? run(() => deactivateGiftBatch(b.batchId), () => setArmed(null)) : (play("click"), setArmed(b.batchId)))}
                    onBlur={() => armed === b.batchId && setArmed(null)}
                    className={cn("ah-btn h-8 px-2.5 text-xs", armed === b.batchId ? "ah-coral" : "ah-cream")}
                  >
                    {armed === b.batchId ? "Vô hiệu thật?" : "Vô hiệu"}
                  </button>
                )}
                <button type="button" onClick={() => setOpen(open === b.batchId ? null : b.batchId)} className="ah-btn ah-cream h-8 px-2.5 text-xs">{open === b.batchId ? "Ẩn mã" : "Xem mã"}</button>
              </div>
            </div>
            {open === b.batchId && (
              <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {b.codes.map((c) => (
                  <li key={c.code} className={cn("rounded-[12px] border-2 px-2 py-1.5 font-mono text-xs font-black tracking-wider", c.usedCount >= b.maxUses ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46] line-through" : c.isActive ? "border-[#efe3cc] bg-white" : "border-[#efe3cc] bg-[#f5efe4] text-[#9e8b74] line-through")}>
                    {c.code}
                    {c.users.length > 0 && <span className="block truncate font-sans text-[10px] font-bold text-[#6e4722] no-underline">{c.users.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
