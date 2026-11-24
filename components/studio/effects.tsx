"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buzz, play } from "@/lib/sound";
import type { Rarity } from "@/lib/points/rarity";
import { ShopArt, SHOP_MASCOT } from "./Sprite";
import { IconHeart } from "./icons";
import { mali, nunito } from "@/lib/fonts";
import "@/components/shop/ah/theme.css";

/* Hiệu ứng theo canvas "Tiệm quà v2": sao băng mở rương, lên cấp, mèo linh vật, mất mạng, số xu nhảy */

const TAIL: Record<Rarity, [string, string]> = {
  common: ["#86EFAC", "rgba(134,239,172,0.55)"],
  rare: ["#93C5FD", "rgba(147,197,253,0.6)"],
  epic: ["#C4B5FD", "rgba(196,181,253,0.65)"],
  legendary: ["#FDE68A", "rgba(253,230,138,0.75)"],
};

/** Cảnh mở rương toàn màn hình: sao băng bay vào (màu theo độ hiếm khi đã biết) rồi nổ sáng; "Bỏ qua" để xem ngay */
export function GachaCinematic({ rarity, onSkip }: { rarity?: Rarity | null; onSkip: () => void }) {
  const [c, glow] = TAIL[rarity ?? "rare"];
  useEffect(() => {
    play("build");
    buzz(20);
  }, []);
  // Portal ra body: nằm trong hộp thoại Radix thì "fixed" bị lệch và vùng ngoài bị chặn bấm → bật lại pointer-events
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Đang mở hộp" className={`${mali.variable} ${nunito.variable} ah-dialog pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[#0F0B2B]`} data-testid="gacha-cinematic">
      {[[18, 22, 4, 0], [72, 16, 3, 0.4], [84, 64, 4, 0.8], [28, 76, 3, 1.1], [50, 10, 2, 0.2]].map(([l, t, z, d]) => (
        <span key={`${l}-${t}`} className="v2-tw rounded-full bg-[#fffdf8]" style={{ left: `${l}%`, top: `${t}%`, width: z, height: z, animationDelay: `${d}s` }} />
      ))}
      <div className="v2-shoot absolute left-1/2 top-1/2 -ml-[210px] -mt-[3px] h-1.5 w-[220px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${c})`, boxShadow: `0 0 18px ${glow}` }} />
      <div className="v2-burst h-[180px] w-[180px] rounded-full" style={{ background: `radial-gradient(circle, #fff 0%, ${c} 35%, transparent 70%)`, boxShadow: `0 0 80px ${glow}` }} />
      <p className="ah-hand absolute inset-x-0 bottom-16 text-center text-[17px] font-bold text-[#fef08a]">Đang triệu hồi ngôi sao ước nguyện…</p>
      <button type="button" onClick={onSkip} data-testid="gacha-skip" className="ah-btn ah-cream absolute right-6 top-6 h-[42px] px-[18px]">Bỏ qua</button>
    </div>,
    document.body,
  );
}

/** Hộp thoại "LÊN CẤP" (canvas v2: khung kem vàng, viền mực, vòng vàng ghi cấp) */
export function LevelUpDialog({ level, title, note, onClose, onSee }: { level: number; title: string; note: string; onClose: () => void; onSee?: () => void }) {
  useEffect(() => {
    play("levelup");
    buzz([30, 40, 30]);
  }, []);
  return (
    <div className={`${mali.variable} ${nunito.variable} fixed inset-0 z-[61] flex items-center justify-center bg-[rgba(36,30,26,0.6)] p-4`}>
      <div role="dialog" aria-modal="true" aria-label="Lên cấp" data-testid="level-up" className="ah-dialog ah-panel v2-pop flex w-full max-w-[420px] flex-col items-center gap-3 bg-[#fff1c9] p-[26px] text-center">
        <span className="rounded-full border-2 border-[#241e1a] bg-[#fbd048] px-3 py-0.5 text-xs font-black">LÊN CẤP</span>
        <div className="ah-hand flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-[#241e1a] bg-gradient-to-b from-[#ffe27a] to-[#f4b731] text-[30px] font-bold shadow-[0_4px_0_#241e1a]">Lv.{level}</div>
        <h2 className="ah-hand text-2xl font-bold">{title}</h2>
        <p className="font-bold leading-normal">{note}</p>
        <div className="flex w-full gap-2.5 pt-1.5">
          <button type="button" onClick={onClose} className="ah-btn ah-cream h-12 flex-1">Để sau</button>
          <button type="button" onClick={onSee ?? onClose} className="ah-btn ah-gold h-12 flex-1">Xem món mới</button>
        </div>
      </div>
    </div>
  );
}

/** Mèo linh vật trôi ở góc trái dưới: bấm vuốt ve → tim bay + "meo" + lời nhắc tiếp; ẩn được lời nhắc (nhớ trong trình duyệt) */
export function Mascot({ name, tips, art }: { name: string; tips: string[]; art?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  const [hearts, setHearts] = useState<number[]>([]);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mascot-tip") === "off") setOpen(false);
    } catch {
      /* bỏ qua */
    }
  }, []);
  const pet = () => {
    play("meow");
    buzz(15);
    const k = Date.now();
    setHearts((h) => [...h.slice(-4), k]);
    setTimeout(() => setHearts((h) => h.filter((x) => x !== k)), 1200);
    setI((n) => n + 1);
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    try {
      sessionStorage.setItem("mascot-tip", "off");
    } catch {
      /* bỏ qua */
    }
  };
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[15] flex items-end gap-2.5 max-sm:bottom-3 max-sm:left-3" data-testid="mascot">
      <div className="pointer-events-auto relative">
        <button type="button" onClick={pet} aria-label={`Vuốt ve ${name}`} data-testid="pet-card" className="v2-float relative h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-white bg-[#FFF6DB] p-0 shadow-[0_10px_24px_rgba(42,31,92,0.2)] max-sm:h-14 max-sm:w-14">
          <span className="absolute inset-1">{art ?? <ShopArt index={SHOP_MASCOT} className="h-full w-full" />}</span>
        </button>
        {hearts.map((k, n) => (
          <span key={k} className="v2-heart text-[#F472B6]" style={{ left: 20 + (n % 3) * 12, top: -6 }}><IconHeart size={18} filled /></span>
        ))}
      </div>
      {open && tips.length > 0 && (
        <div role="status" className="v2-rise pointer-events-auto mb-[18px] flex max-w-[260px] flex-col gap-1.5 rounded-[16px_16px_16px_4px] border border-[#ECE9F5] bg-white px-3.5 py-3 shadow-[0_10px_24px_rgba(42,31,92,0.14)] max-sm:max-w-[200px]" data-testid="mascot-tip">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[13px]">{name}</b>
            <button type="button" onClick={hide} aria-label="Ẩn lời nhắc" className="h-7 w-7 rounded-lg bg-[#F6F5FB] text-[#5F5B73]">×</button>
          </div>
          <p className="text-[13px] leading-normal text-[#3B3650]" data-testid="pet-line">{tips[i % tips.length]}</p>
        </div>
      )}
    </div>
  );
}

/** Theo dõi mạng: mất mạng thì hiện băng đỏ (vẫn xem được tiệm nhưng chưa đổi/mở hộp được) */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  return online;
}

export function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F3B4B4] bg-[#FDECEC] px-[18px] py-3.5 text-[#7F1D1D]" data-testid="offline">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5a15 15 0 0 1 11.3 3.8M5 12.9a10 10 0 0 1 5.2-2.8M18.9 12.9a10 10 0 0 0-2.1-1.6M12 20h.01" /></svg>
      <div className="flex-[1_1_260px]"><b>Mất kết nối mạng.</b> Bạn vẫn xem được tiệm, nhưng chưa đổi quà hay mở hộp được.</div>
      <button type="button" onClick={onRetry} className="h-10 rounded-[10px] bg-[#7F1D1D] px-3.5 font-bold text-white">Thử lại</button>
    </div>
  );
}

/** Số đếm dần tới giá trị mới (như ví xu của design) và trả cờ "nhảy" khi vừa đổi */
export function useTweenNumber(value: number) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      // Mốc khung hình đầu (t) có thể SỚM hơn t0 → k âm → số tụt dưới giá trị cũ một khung (12.500 → 12.373 → 12.800)
      const k = Math.min(1, Math.max(0, (t - t0) / 600));
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        from.current = value;
        setBump((n) => n + 1);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return { shown, bump };
}
