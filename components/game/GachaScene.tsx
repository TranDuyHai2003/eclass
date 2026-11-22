"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GachaCinematic } from "@/components/studio/effects";
import { describeOutcome, type ChestId } from "@/lib/game/gacha-shared";
import { ITEM_BY_ID, RARITY_LABEL } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { RARITY } from "@/lib/points/rarity";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "./CoinBurst";
import { useGachaPull } from "./useGachaPull";

/** Cảnh mở rương: rương lắc → tia sáng → lật thẻ theo bậc; kết quả do server trả về */
export function GachaScene({
  wallet: w0, pity: pity0, pullsToday: today0, canEarn, avatar, owned: owned0, initialChest = "xu",
}: {
  wallet: { balance: number; gems: number };
  pity: number;
  pullsToday: number;
  canEarn: boolean;
  avatar: AvatarConfig;
  owned: string[];
  initialChest?: ChestId;
}) {
  const { wallet, pity, pityMax, limit, left, owned, phase, chest, result, pending, burst, confetti, open, reset, incoming, skip } = useGachaPull({
    wallet: w0, pity: pity0, pullsToday: today0, owned: owned0, initialChest,
  });

  const rar = result ? RARITY[result.outcome.rarity] : null;
  const preview = result?.outcome.kind === "item" ? { ...avatar, [ITEM_BY_ID[result.outcome.itemId].slot]: result.outcome.itemId } : null;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="gacha-scene" data-phase={phase}>
      <CoinBurst burst={burst} />
      <Confetti burst={confetti} />
      {/* Sân khấu */}
      <div className="dots-bg relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 p-4 shadow-[0_6px_0_0_#fcd34d]" style={{ "--dot": "rgba(245,158,11,.25)" } as React.CSSProperties}>
        {phase === "shaking" && <GachaCinematic rarity={incoming} onSkip={skip} />}
      <div aria-hidden className={cn("animate-rays absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 transition-opacity", phase === "idle" ? "opacity-30" : "opacity-90")} style={{ background: "conic-gradient(from 0deg, rgba(253,224,71,.0) 0deg, rgba(253,224,71,.55) 20deg, rgba(253,224,71,.0) 40deg, rgba(253,224,71,.0) 60deg, rgba(253,224,71,.55) 80deg, rgba(253,224,71,.0) 100deg, rgba(253,224,71,.0) 120deg, rgba(253,224,71,.55) 140deg, rgba(253,224,71,.0) 160deg, rgba(253,224,71,.0) 180deg, rgba(253,224,71,.55) 200deg, rgba(253,224,71,.0) 220deg, rgba(253,224,71,.0) 240deg, rgba(253,224,71,.55) 260deg, rgba(253,224,71,.0) 280deg, rgba(253,224,71,.0) 300deg, rgba(253,224,71,.55) 320deg, rgba(253,224,71,.0) 340deg)" }} />

        {phase !== "reveal" && (
          <div className={cn("relative", phase === "shaking" && "animate-shake")}>
            <ChestSvg open={false} gem={chest === "gem"} />
            <span aria-hidden className="sparkle -left-2 top-4" /><span aria-hidden className="sparkle sparkle-2 -right-3 top-10" /><span aria-hidden className="sparkle sparkle-3 left-10 -top-3" />
          </div>
        )}

        {phase === "reveal" && result && rar && (
          <div data-testid="gacha-result" data-rarity={result.outcome.rarity} className={cn("animate-flip-in relative w-full max-w-xs rounded-3xl border-4 bg-white p-4 text-center", rar.card)}>
            <span className={cn("absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wide", rar.chip)}>
              {RARITY_LABEL[result.outcome.rarity]}{result.guaranteed ? " · bảo hiểm 🛡️" : ""}
            </span>
            <div className={cn("dots-bg mt-2 flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br", rar.art)} style={{ "--dot": rar.dot } as React.CSSProperties}>
              {preview ? <Chibi config={preview} size={120} className="animate-float" /> : <span className="animate-float text-6xl">{result.outcome.kind === "xu" ? "🪙" : "💎"}</span>}
            </div>
            <p className="mt-3 text-lg font-black text-slate-900">{describeOutcome(result.outcome)}</p>
            {result.outcome.kind === "item" && !result.outcome.duplicate && <p className="text-xs font-semibold text-emerald-700">Đã vào túi đồ — vào Tuỳ chỉnh nhân vật để mặc ✨</p>}
            {result.outcome.kind === "item" && result.outcome.duplicate && <p className="text-xs font-semibold text-slate-500">Bạn đã có món này nên được trả lại xu.</p>}
            <button type="button" onClick={() => { play("click"); reset(); }} className="btn-3d btn-3d-white mt-3 px-4 py-1.5 text-xs">Mở tiếp</button>
          </div>
        )}
      </div>

      {/* Bảng điều khiển */}
      <div className="space-y-3">
        <div className="rounded-3xl border-2 border-blue-100/80 bg-white p-4 shadow-[0_4px_0_0_#e3ecff]">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-amber-50 px-2 py-2"><p className="text-lg font-black text-amber-700 tabular-nums" data-testid="gacha-xu">🪙 {wallet.balance.toLocaleString("vi-VN")}</p><p className="text-[11px] font-bold text-amber-600">xu</p></div>
            <div className="rounded-2xl bg-pink-50 px-2 py-2"><p className="text-lg font-black text-pink-700 tabular-nums">💎 {wallet.gems}</p><p className="text-[11px] font-bold text-pink-600">ngọc</p></div>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-3">
          <div className="flex items-center justify-between text-xs font-black text-emerald-800">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Bảo hiểm nhân phẩm</span>
            <span data-testid="pity">{Math.min(pity + 1, pityMax)}/{pityMax} lần</span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: pityMax }, (_, i) => (
              <span key={i} className={cn("h-2.5 flex-1 rounded-full", i < pity ? "bg-emerald-500" : i === pity ? "bg-emerald-300" : "bg-white")} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-emerald-700/80">Chắc chắn nhận Sử thi/Huyền thoại ở lần mở thứ {pityMax} liên tiếp chưa ra Sử thi.</p>
        </div>

        <button
          type="button"
          data-testid="open-xu"
          disabled={pending || phase === "shaking" || !canEarn || left === 0}
          onClick={() => open("xu")}
          className={cn("btn-3d btn-shine relative min-h-12 w-full py-2 text-sm", canEarn && left > 0 ? "btn-3d-amber" : "btn-3d-muted")}
        >
          <span aria-hidden className="sparkle -left-1 -top-1" /><span aria-hidden className="sparkle sparkle-2 -right-1 top-1" />
          {pending && chest === "xu" ? <Loader2 className="h-4 w-4 animate-spin" /> : "🧰"} Mở Rương Xu (600 xu) · còn {left}/{limit} hôm nay
        </button>
        <button
          type="button"
          data-testid="open-gem"
          disabled={pending || phase === "shaking" || !canEarn}
          onClick={() => open("gem")}
          className={cn("btn-3d btn-shine min-h-12 w-full py-2 text-sm", canEarn ? "bg-pink-500 text-white [--btn-edge:#9d174d] hover:bg-pink-400" : "btn-3d-muted")}
        >
          {pending && chest === "gem" ? <Loader2 className="h-4 w-4 animate-spin" /> : "💎"} Mở Rương Ngọc (3 ngọc) · không Phổ thông
        </button>
        {!canEarn && <p className="text-xs font-semibold text-amber-700">Tài khoản cần được thầy duyệt mới mở được rương.</p>}
        <p className="text-[11px] text-slate-400">Túi đồ: {owned.size} món. Trúng đồ đã có → nhận lại xu theo bậc.</p>
      </div>
    </section>
  );
}

function ChestSvg({ open, gem }: { open: boolean; gem: boolean }) {
  const body = gem ? "#8b5cf6" : "#f97316";
  const dark = gem ? "#5b21b6" : "#c2410c";
  const band = gem ? "#c4b5fd" : "#fbbf24";
  return (
    <svg viewBox="0 0 160 140" width="220" height="193" aria-hidden className="drop-shadow-xl">
      <ellipse cx="80" cy="128" rx="60" ry="8" fill="#0f172a" opacity="0.12" />
      <rect x="20" y="60" width="120" height="60" rx="10" fill={body} stroke={dark} strokeWidth="4" />
      <path d={open ? "M20 60c0-30 30-46 60-46s60 16 60 46" : "M20 62c0-28 30-42 60-42s60 14 60 42z"} fill={body} stroke={dark} strokeWidth="4" />
      <rect x="20" y="58" width="120" height="10" fill={dark} />
      <rect x="44" y="20" width="12" height="100" fill={band} stroke={dark} strokeWidth="3" />
      <rect x="104" y="20" width="12" height="100" fill={band} stroke={dark} strokeWidth="3" />
      <rect x="66" y="66" width="28" height="26" rx="6" fill={band} stroke={dark} strokeWidth="3" />
      <path d="M80 70l3.5 7 7.5 1-5.5 5 1.5 7.5L80 87l-7 3.5 1.5-7.5-5.5-5 7.5-1z" fill="#ec4899" stroke="#9d174d" strokeWidth="1.5" />
      <path d="M128 30l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="#38bdf8" />
      <path d="M30 40l2 4 4 .6-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4-.6z" fill="#fde68a" />
    </svg>
  );
}
