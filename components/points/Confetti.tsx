"use client";

import { useEffect, useState } from "react";

const COLORS = ["#fbbf24", "#f97316", "#ec4899", "#8b5cf6", "#3b82f6", "#10b981"];

interface Piece {
  left: number;
  color: string;
  dx: number;
  rot: number;
  dur: number;
  delay: number;
}

/**
 * Pháo giấy khi đổi quà thành công. Tăng `burst` để bắn một đợt.
 * Khung luôn nằm trong DOM (data-testid="confetti"); mảnh giấy sinh ngẫu nhiên trong useEffect (không lệch HTML server/client),
 * tự xoá sau ~2 giây, CSS ẩn khi người dùng bật "giảm chuyển động".
 */
export function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (burst <= 0) return;
    setPieces(
      Array.from({ length: 28 }, () => ({
        left: 10 + Math.random() * 80,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        dx: (Math.random() - 0.5) * 240,
        rot: 180 + Math.random() * 540,
        dur: 1.3 + Math.random() * 0.8,
        delay: Math.random() * 0.25,
      })),
    );
    const t = setTimeout(() => setPieces([]), 2400);
    return () => clearTimeout(t);
  }, [burst]);

  return (
    <div aria-hidden data-testid="confetti" data-active={pieces.length > 0} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={`${burst}-${i}`}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
              "--rot": `${p.rot}deg`,
              "--dur": `${p.dur}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
