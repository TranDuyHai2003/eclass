"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHESTS, RARITY_ORDER, ratesTable, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { RARITY_LABEL } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { RARITY } from "@/lib/points/rarity";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SoundToggle } from "./SoundToggle";

// Cảnh rương (hoạt ảnh + âm thanh) chỉ chạy ở trình duyệt, tải lười để trang nhẹ
const GachaScene = dynamic(() => import("./GachaScene").then((m) => m.GachaScene), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center rounded-3xl border-2 border-amber-200 bg-amber-50 text-sm font-bold text-amber-700">Đang mở kho báu…</div>,
});

const fmtTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function GachaPage({
  wallet, pity, pullsToday, history, canEarn, avatar, owned,
}: {
  wallet: { balance: number; gems: number };
  pity: number;
  pullsToday: number;
  history: { id: string; chest: ChestId; outcome: Outcome; createdAt: string }[];
  canEarn: boolean;
  avatar: AvatarConfig;
  owned: string[];
}) {
  const [ratesFor, setRatesFor] = useState<ChestId | null>(null);
  return (
    <div className="space-y-4" data-testid="gacha-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-violet-700">✨ Vòng quay nhân phẩm học đường</span>
          <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Rương kho báu bí ẩn 🎁</h1>
          <p className="text-sm font-medium text-slate-500">Chỉ đồ ảo: trang phục, khung, danh hiệu, xu, ngọc. Tỉ lệ công khai, mỗi ngày tối đa {CHESTS.xu.dailyLimit} Rương Xu.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rewards" className="btn-3d btn-3d-white px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" /> Tiệm quà</Link>
          <button type="button" onClick={() => setRatesFor("xu")} data-testid="rates-open" className="btn-3d btn-3d-white px-3 py-2 text-sm"><BarChart3 className="h-4 w-4" /> Tỉ lệ rơi quà</button>
          <SoundToggle />
        </div>
      </div>

      <GachaScene wallet={wallet} pity={pity} pullsToday={pullsToday} canEarn={canEarn} avatar={avatar} owned={owned} />

      <section className="rounded-3xl border-2 border-blue-100/80 bg-white p-4 shadow-[0_4px_0_0_#e3ecff] sm:p-5">
        <h2 className="text-base font-black text-slate-900">Lịch sử mở rương</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa mở rương nào. Thử vận may với 600 xu nhé!</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {history.map((h) => {
              const rar = RARITY[h.outcome.rarity];
              return (
                <li key={h.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", rar.chip)}>{RARITY_LABEL[h.outcome.rarity]}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-800">{describe(h.outcome)}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{CHESTS[h.chest].emoji} {fmtTime(h.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={!!ratesFor} onOpenChange={(o) => !o && setRatesFor(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>📊 Tỉ lệ rơi quà</DialogTitle>
            <DialogDescription>Kết quả tính ngẫu nhiên ở máy chủ theo đúng tỉ lệ dưới đây. Trúng đồ đã có sẽ được trả lại xu.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1.5">
            {(Object.keys(CHESTS) as ChestId[]).map((id) => (
              <button key={id} type="button" onClick={() => setRatesFor(id)} className={cn("rounded-xl px-3 py-1.5 text-sm font-black", ratesFor === id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}>
                {CHESTS[id].emoji} {CHESTS[id].name}
              </button>
            ))}
          </div>
          {ratesFor && (
            <div className="space-y-2" data-testid="rates-table">
              {ratesTable(ratesFor).map((row) => (
                <div key={row.rarity} className={cn("rounded-2xl border-2 p-3", RARITY[row.rarity].card)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-black", RARITY[row.rarity].chip)}>{RARITY_LABEL[row.rarity]}</span>
                    <span className="text-lg font-black text-slate-900 tabular-nums">{row.percent}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{row.prizes.join(" · ")}</p>
                </div>
              ))}
              {CHESTS[ratesFor].pity && (
                <p className="text-xs font-semibold text-emerald-700">🛡️ Bảo hiểm: lượt thứ {CHESTS[ratesFor].pity} liên tiếp chưa ra Sử thi sẽ chắc chắn Sử thi trở lên.</p>
              )}
              <p className="text-[11px] text-slate-400">Thứ tự bậc: {RARITY_ORDER.map((r) => RARITY_LABEL[r]).join(" → ")}.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function describe(o: Outcome) {
  if (o.kind === "item") return o.duplicate ? `${o.name} (trùng → +${o.refundXu.toLocaleString("vi-VN")} xu)` : o.name;
  if (o.kind === "xu") return `+${o.amount.toLocaleString("vi-VN")} xu`;
  return `+${o.amount} ngọc`;
}
