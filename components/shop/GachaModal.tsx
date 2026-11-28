"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHESTS, describeOutcome, ratesTable, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { ITEM_BY_ID, RARITY_LABEL } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { useGachaPull } from "@/components/game/useGachaPull";
import { ShopModal } from "./ShopModal";
import { GiftBoxSvg } from "./GiftBoxSvg";
import { BAND } from "./ProductCard";
import { PityBar } from "./PityBar";
import { GachaCinematic } from "@/components/studio/effects";
import { PetImage } from "@/components/studio/CutArt";

/** Cực phẩm trưng hai bên sân khấu (đều có trong bể quà của rương) */
export const FEATURED = { left: ["acc-halo", "outfit-astro"], right: ["pet-shadow", "frame-rainbow"] };

export function ItemThumb({ itemId, avatar, size = 40 }: { itemId: string; avatar: AvatarConfig; size?: number }) {
  const item = ITEM_BY_ID[itemId];
  if (!item) return null;
  return item.slot === "pet" ? <PetImage id={itemId} size={size} className="object-contain" /> : <Chibi config={{ ...avatar, [item.slot]: itemId }} size={size} />;
}

function Featured({ ids, avatar }: { ids: string[]; avatar: AvatarConfig }) {
  return (
    <div className="hidden w-40 shrink-0 flex-col gap-2 sm:flex">
      {ids.map((id) => {
        const it = ITEM_BY_ID[id];
        if (!it) return null;
        return (
          <div key={id} className="flex items-center gap-2 rounded-2xl border-2 border-white/25 bg-white/10 p-1.5 backdrop-blur-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fffaf0]"><ItemThumb itemId={id} avatar={avatar} size={40} /></span>
            <span className="min-w-0">
              <span className={cn("block text-[10px] font-black", it.rarity === "legendary" ? "text-[#ffd84d]" : "text-[#d8c4ff]")}>{it.rarity === "legendary" ? "👑" : "🔮"} {RARITY_LABEL[it.rarity]}</span>
              <span className="line-clamp-2 block text-[11px] font-bold leading-tight text-white">{it.name}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** "Đài Cầu Nguyện Hộp Bí Ẩn" — mở rương ngay trong tiệm (tải lười khi mở hộp thoại) */
export function GachaModal({
  open, onOpenChange, initialChest, initialRates = false, wallet, pity, pullsToday, owned, avatar, canEarn, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialChest: ChestId;
  initialRates?: boolean;
  wallet: { balance: number; gems: number };
  pity: number;
  pullsToday: number;
  owned: string[];
  avatar: AvatarConfig;
  canEarn: boolean;
  onDone: (r: { outcome: Outcome; wallet?: { balance: number; gems: number } }) => void;
}) {
  const g = useGachaPull({ wallet, pity, pullsToday, owned, initialChest, onDone });
  const [showRates, setShowRates] = useState(initialRates);
  const busy = g.pending || g.phase === "shaking";
  const xuCost = "xu" in CHESTS.xu.cost ? CHESTS.xu.cost.xu : 0;
  const gemCost = "gem" in CHESTS.gem.cost ? CHESTS.gem.cost.gem : 0;
  const res = g.result;
  const resItem = res?.outcome.kind === "item" ? res.outcome.itemId : null;

  return (
    <ShopModal open={open} onOpenChange={(o) => !busy && onOpenChange(o)} title="🌠 Đài Cầu Nguyện Hộp Bí Ẩn" testId="gacha-modal" className="sm:max-w-3xl">
      <CoinBurst burst={g.burst} />
      <Confetti burst={g.confetti} />
      {g.phase === "shaking" && <GachaCinematic rarity={g.incoming} onSkip={g.skip} />}
      <div className="gacha-stage relative overflow-hidden rounded-[1.25rem] border-[2.5px] border-[#2a1b4a] p-3 sm:p-4" data-testid="gacha-stage" data-phase={g.phase}>
        <span aria-hidden className="gacha-stars" />
        <div className="relative flex items-center justify-between gap-2">
          <button type="button" onClick={() => setShowRates((v) => !v)} data-testid="gacha-rates" className="btn-pill px-2.5 py-1 text-[11px]">📊 Tỉ lệ rơi</button>
          <span className="hidden rounded-full border border-[#ffd84d]/60 bg-white/10 px-3 py-0.5 text-[11px] font-black text-[#ffe9a8] sm:inline">✨ Săn cực phẩm Huyền thoại ✨</span>
          <span className="rounded-full border-2 border-[#5b3d1e] bg-white px-2.5 py-0.5 text-[11px] font-black text-[#3b2a14]" data-testid="gacha-pity">
            Bảo hiểm: <span className="text-[#ef5a3c]">{g.pity}/{g.pityMax}</span> 🐾
          </span>
        </div>

        <div className="relative mt-3 flex min-h-[250px] items-center justify-center gap-3">
          <Featured ids={FEATURED.left} avatar={avatar} />
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
            {g.phase !== "reveal" && (
              <>
                <button type="button" data-testid="gacha-box" disabled={busy || !canEarn || (g.chest === "xu" && g.left === 0)} onClick={() => g.open(g.chest)} aria-label="Mở hộp" className={cn("relative rounded-full", g.phase === "shaking" && "animate-shake")}>
                  <span aria-hidden className="gacha-halo" />
                  <GiftBoxSvg tone={g.chest === "gem" ? "blue" : "red"} size={150} open={g.phase === "shaking"} className="relative" />
                  <span aria-hidden className="sparkle -left-2 top-6" /><span aria-hidden className="sparkle sparkle-2 -right-2 top-12" /><span aria-hidden className="sparkle sparkle-3 left-12 -top-2" />
                </button>
                <p className="mt-2 text-[12px] font-bold text-[#e9ddff]">{g.phase === "shaking" ? "Sao băng đang bay tới…" : "Chạm vào hộp hoặc bấm nút Cầu Nguyện bên dưới ✨"}</p>
              </>
            )}
            {g.phase === "reveal" && res && (
              <div data-testid="gacha-result" data-rarity={res.outcome.rarity} className="animate-flip-in w-full max-w-[260px] rounded-[1.25rem] border-[3px] border-[#5b3d1e] bg-[#fffaf0] p-3 shadow-[0_6px_0_0_#5b3d1e]">
                <p className="text-lg font-black text-[#b4531a]">🎉 CHÚC MỪNG! 🎉</p>
                <span className={cn("mt-1 inline-block rounded-full border border-[#5b3d1e]/40 px-2 py-0.5 text-[10px] font-black", BAND[res.outcome.rarity].chip)}>
                  {RARITY_LABEL[res.outcome.rarity]}{res.guaranteed ? " · bảo hiểm 🛡️" : ""}
                </span>
                <div className={cn("dots-bg mt-2 flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-[#5b3d1e]/30", BAND[res.outcome.rarity].art)} style={{ "--dot": "rgba(91,61,30,.14)" } as React.CSSProperties}>
                  {resItem ? <span className="animate-float"><ItemThumb itemId={resItem} avatar={avatar} size={104} /></span> : <span className="animate-float text-6xl">{res.outcome.kind === "xu" ? "💰" : "💎"}</span>}
                </div>
                <p className="mt-2 text-[15px] font-black text-[#3b2a14]">{describeOutcome(res.outcome)}</p>
                {res.outcome.kind === "item" && !res.outcome.duplicate && <p className="text-[11px] font-semibold text-[#1f6b22]">Đã vào túi đồ ✨</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { play("click"); g.reset(); }} className="btn-pill btn-pill-red px-2 py-1.5 text-[12px]" data-testid="gacha-again">🌠 Mở tiếp</button>
                  <button type="button" onClick={() => { play("click"); g.reset(); onOpenChange(false); }} className="btn-pill btn-pill-yellow px-2 py-1.5 text-[12px]">Tuyệt vời!</button>
                </div>
              </div>
            )}
          </div>
          <Featured ids={FEATURED.right} avatar={avatar} />

          {showRates && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#1d1236]/85 p-2 backdrop-blur-sm" data-testid="gacha-rates-table">
              <div className="w-full max-w-md">
                <p className="text-center text-sm font-black text-white">📊 Tỉ lệ cầu nguyện hộp bí ẩn</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["xu", "gem"] as ChestId[]).map((id) => (
                    <div key={id} className="rounded-xl border-2 border-[#5b3d1e] bg-[#fffaf0] p-2 text-[11px]">
                      <p className="font-black text-[#3b2a14]">{id === "xu" ? `🎁 Hộp Sao Mèo (${xuCost} xu)` : `💎 Hộp Tinh Tú VIP (${gemCost} KC)`}</p>
                      {ratesTable(id).map((r) => (
                        <p key={r.rarity} className="flex justify-between font-bold text-[#5b3d1e]"><span>{RARITY_LABEL[r.rarity]}</span><span className="tabular-nums">{r.percent}%</span></p>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-center text-[10px] font-semibold text-[#e9ddff]">Kết quả tính ở máy chủ. Trúng đồ đã có thì được trả lại xu theo bậc.</p>
                <div className="mt-2 text-center"><button type="button" onClick={() => setShowRates(false)} className="btn-pill btn-pill-yellow px-3 py-1 text-[11px]">Đóng bảng tỉ lệ</button></div>
              </div>
            </div>
          )}
        </div>

        <PityBar pity={g.pity} pityMax={g.pityMax} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" data-testid="pray-xu" disabled={busy || !canEarn || g.left === 0} onClick={() => g.open("xu")} className="btn-pill btn-pill-yellow btn-shine relative flex-col gap-0 py-2 text-sm">
          <span aria-hidden className="sparkle -right-1 -top-1" />
          <span className="inline-flex items-center gap-1">{g.pending && g.chest === "xu" ? <Loader2 className="h-4 w-4 animate-spin" /> : "🌠"} Cầu Nguyện Hộp Sao</span>
          <span className="text-[11px] font-bold text-[#5b3d1e]" data-testid="pray-xu-left">💰 {xuCost} Xu · còn {g.left}/{g.limit} hôm nay</span>
        </button>
        <button type="button" data-testid="pray-gem" disabled={busy || !canEarn} onClick={() => g.open("gem")} className="btn-pill btn-pill-blue btn-shine relative flex-col gap-0 py-2 text-sm">
          <span aria-hidden className="sparkle sparkle-2 -right-1 -top-1" />
          <span className="inline-flex items-center gap-1">{g.pending && g.chest === "gem" ? <Loader2 className="h-4 w-4 animate-spin" /> : "✨"} Cầu Nguyện Tinh Tú VIP</span>
          <span className="text-[11px] font-bold text-[#0b2a44]">💎 {gemCost} Kim Cương · không có Phổ thông</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#7a5a35]">
        <span data-testid="gacha-wallet">💰 {g.wallet.balance.toLocaleString("vi-VN")} xu · 💎 {g.wallet.gems} KC</span>
        {!canEarn && <span className="text-[#b4531a]">Tài khoản cần được thầy duyệt mới mở được hộp.</span>}
        <Link href="/rewards/gacha" className="underline decoration-dotted">Lịch sử mở hộp →</Link>
      </div>
    </ShopModal>
  );
}
