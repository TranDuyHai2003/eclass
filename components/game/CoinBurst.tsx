"use client";

import { useEffect, useState } from "react";

/**
 * Mưa xu: các đồng xu SVG bay từ `from` (hoặc giữa màn) về chip ví trên header (`[data-wallet-chip]`), rồi chip nảy.
 * Toạ độ chỉ tính trong useEffect (không lệch HTML server/client); tự xoá sau ~1,4 giây; CSS ẩn khi "giảm chuyển động".
 */
export function CoinBurst({ burst, from, count = 14 }: { burst: number; from?: { x: number; y: number } | null; count?: number }) {
  const [coins, setCoins] = useState<{ id: string; x: number; y: number; dx: number; dy: number; delay: number; mx: number }[]>([]);

  useEffect(() => {
    if (burst <= 0) return;
    const chip = document.querySelector<HTMLElement>("[data-wallet-chip]");
    const r = chip?.getBoundingClientRect();
    const target = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 60, y: 40 };
    const origin = from ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const list = Array.from({ length: count }, (_, i) => {
      const spread = (Math.random() - 0.5) * 160;
      return {
        id: `${burst}-${i}`,
        x: origin.x + spread,
        y: origin.y + (Math.random() - 0.5) * 60,
        dx: target.x - (origin.x + spread),
        dy: target.y - origin.y,
        mx: (Math.random() - 0.5) * 120,
        delay: i * 0.035,
      };
    });
    setCoins(list);
    const bounce = setTimeout(() => {
      chip?.classList.add("wallet-bounce");
      setTimeout(() => chip?.classList.remove("wallet-bounce"), 500);
    }, 800);
    const t = setTimeout(() => setCoins([]), 1500);
    return () => {
      clearTimeout(t);
      clearTimeout(bounce);
    };
  }, [burst, from, count]);

  return (
    <div aria-hidden data-testid="coin-burst" data-active={coins.length > 0} className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
      {coins.map((c) => (
        <span
          key={c.id}
          className="coin-fly"
          style={{ left: c.x, top: c.y, "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--mx": `${c.mx}px`, animationDelay: `${c.delay}s` } as React.CSSProperties}
        >
          <CoinSvg />
        </span>
      ))}
    </div>
  );
}

export function CoinSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-6 w-6"} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#f59e0b" />
      <circle cx="12" cy="12" r="8.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
      <path d="M12 6.5v11M9.2 9.2c0-1.3 1.3-2 2.8-2s2.8.7 2.8 2-1.3 1.8-2.8 2.1-2.8.9-2.8 2.2 1.3 2 2.8 2 2.8-.7 2.8-2" fill="none" stroke="#92400e" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.5" cy="8" r="1.6" fill="#fff" opacity="0.7" />
    </svg>
  );
}

/** Số đếm tăng dần tới `value` (khoảng 0,8 giây), dùng cho "+300 xu" */
export function CountUp({ value, duration = 800, className }: { value: number; duration?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{n.toLocaleString("vi-VN")}</span>;
}
