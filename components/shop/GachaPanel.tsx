"use client";

import { CHESTS, type ChestId } from "@/lib/game/gacha-shared";
import { ITEM_BY_ID } from "@/lib/game/items";
import { play } from "@/lib/sound";
import { GiftBoxSvg } from "./GiftBoxSvg";
import { PityBar } from "./PityBar";

const CHIPS = ["pet-snow", "acc-halo", "pet-shadow", "frame-rainbow", "outfit-astro"];

/** Khối tím "Đài Cầu Nguyện Học Đường" trong danh mục Hộp bí ẩn — bấm hộp/nút mở hộp thoại cầu nguyện */
export function GachaPanel({ pity, pullsToday, onOpen, onRates }: { pity: number; pullsToday: number; onOpen: (c: ChestId) => void; onRates: () => void }) {
  const xu = CHESTS.xu;
  const gem = CHESTS.gem;
  const pityMax = xu.pity ?? 5;
  const left = Math.max(0, (xu.dailyLimit ?? 0) - pullsToday);
  const boxes: { id: ChestId; name: string; tag: string; note: string; tone: "red" | "blue"; btn: string; cls: string }[] = [
    {
      id: "xu",
      name: "🌟 Hộp Sao Mèo",
      tag: "Phổ thông → Huyền thoại",
      note: `Thử vận may bằng xu chăm chỉ — có cơ hội rinh Mèo Hoàng Thượng và Vòng hào quang! Còn ${left}/${xu.dailyLimit} lượt hôm nay.`,
      tone: "red",
      btn: `🌠 Cầu Nguyện · 🪙 ${"xu" in xu.cost ? xu.cost.xu : 0} Xu`,
      cls: "btn-pill-yellow",
    },
    {
      id: "gem",
      name: "💎 Hộp Tinh Tú VIP",
      tag: "Tối thiểu Hiếm",
      note: `Không có đồ Phổ thông: Sử thi ${gem.rates.epic}% và Huyền thoại ${gem.rates.legendary}%. Kim Cương chỉ có từ thẻ cào thầy phát.`,
      tone: "blue",
      btn: `✨ Cầu Nguyện VIP · 💎 ${"gem" in gem.cost ? gem.cost.gem : 0} Kim Cương`,
      cls: "btn-pill-blue",
    },
  ];
  return (
    <section className="gacha-stage relative overflow-hidden rounded-[1.25rem] border-[2.5px] border-[#2a1b4a] p-3 shadow-[0_5px_0_0_#2a1b4a] sm:p-5" data-testid="gacha-panel">
      <span aria-hidden className="gacha-stars" />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-block rounded-full border-2 border-[#5b3d1e] bg-[#ffd84d] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#3b2a14]">🌠 Đài cầu nguyện học đường</span>
          <h3 className="mt-1.5 text-lg font-black text-white sm:text-xl">Hộp Quà Tinh Tú — Săn Cực Phẩm Huyền Thoại</h3>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => { play("click"); onRates(); }} className="btn-pill px-2.5 py-1 text-[11px]" data-testid="panel-rates">📊 Xem tỉ lệ rơi</button>
          <span className="rounded-full border-2 border-[#5b3d1e] bg-white px-2.5 py-1 text-[11px] font-black text-[#3b2a14]">Bảo hiểm: <span className="text-[#ef5a3c]">{pity}/{pityMax}</span> 🐾</span>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {boxes.map((b) => (
          <div key={b.id} data-testid="chest-card" data-chest={b.id} className="flex flex-col rounded-2xl border border-white/25 bg-[#1d1236]/55 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className={b.tone === "red" ? "rounded-full border-2 border-[#5b3d1e] bg-[#ffd84d] px-2 py-0.5 text-[11px] font-black text-[#3b2a14]" : "rounded-full border-2 border-[#5b3d1e] bg-[#9fd3f5] px-2 py-0.5 text-[11px] font-black text-[#0b2a44]"}>{b.name}</span>
              <span className={b.tone === "red" ? "text-[11px] font-black text-[#ffe9a8]" : "text-[11px] font-black text-[#9fd3f5]"}>{b.tag}</span>
            </div>
            <button type="button" onClick={() => { play("click"); onOpen(b.id); }} aria-label={`Mở ${b.name}`} className="group relative mx-auto my-2 rounded-full">
              <span aria-hidden className="gacha-halo" />
              <GiftBoxSvg tone={b.tone} size={128} className="relative animate-float transition-transform group-hover:scale-105" />
              <span aria-hidden className="sparkle -left-1 top-6" /><span aria-hidden className="sparkle sparkle-2 -right-2 top-10" />
            </button>
            <p className="min-h-[2.5rem] text-center text-[11px] font-semibold leading-snug text-[#e9ddff]">{b.note}</p>
            <button type="button" data-testid={`chest-open-${b.id}`} onClick={() => { play("click"); onOpen(b.id); }} className={`btn-pill ${b.cls} btn-shine mt-2 py-2 text-sm`}>{b.btn}</button>
          </div>
        ))}
      </div>

      <div className="relative mt-3 flex flex-col gap-2 border-t border-dashed border-white/25 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-[#ffe9a8]">⭐ Cực phẩm trong hộp:</span>
          {CHIPS.map((id) => {
            const it = ITEM_BY_ID[id];
            return it ? <span key={id} className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{it.rarity === "legendary" ? "👑" : "🔮"} {it.name}</span> : null;
          })}
        </div>
        <div className="lg:w-[340px]"><PityBar pity={pity} pityMax={pityMax} compact /></div>
      </div>
    </section>
  );
}
