"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Season } from "@/lib/seasonal-theme";

/** Màn cần tập trung (làm bài, chữa bài, soạn đề…) → không chạy hiệu ứng rơi. */
const FOCUS_ROUTES = [
  /^\/watch\/[^/]+\/quiz/,
  /^\/watch\/[^/]+\/results\//,
  /^\/tests\//,
  /^\/courses\/[^/]+\/final-test/,
  /^\/teacher\/tests\/(?!$)/,
  /^\/teacher\/courses\/[^/]+\/final-test/,
];

interface Flake {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}

/**
 * Hiệu ứng rơi theo mùa: tuyết (Giáng sinh) / cánh hoa mai (Tết).
 * Chỉ dùng transform (GPU), không chặn chuột, tắt khi người dùng bật "giảm chuyển động".
 * Sinh ngẫu nhiên sau khi mount để không lệch HTML giữa server và trình duyệt.
 */
export function SeasonalEffects({ season }: { season: Season | null }) {
  const pathname = usePathname();
  const [flakes, setFlakes] = useState<Flake[]>([]);

  useEffect(() => {
    if (!season) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Rất thưa và chậm: chỉ gợi không khí lễ hội, gần như không tốn hiệu năng
    const count = window.innerWidth < 640 ? 8 : 14;
    setFlakes(
      Array.from({ length: count }, (_, i) => ({
        // rải đều theo chiều ngang để vài bông không dồn một chỗ
        left: ((i + Math.random() * 0.8) / count) * 100,
        size: season === "tet" ? 9 + Math.random() * 5 : 10 + Math.random() * 8,
        duration: 18 + Math.random() * 12,
        delay: -Math.random() * 30,
        drift: (Math.random() - 0.5) * 80,
        opacity: 0.55 + Math.random() * 0.35,
      })),
    );
  }, [season]);

  if (!season || flakes.length === 0) return null;
  if (FOCUS_ROUTES.some((re) => re.test(pathname))) return null;

  return (
    <>
      <div aria-hidden className="season-fall pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {flakes.map((f, i) => {
          const style = {
            left: `${f.left}%`,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            "--drift": `${f.drift}px`,
          } as React.CSSProperties;
          return season === "tet" ? (
            <span key={i} className="season-petal" style={{ ...style, width: f.size, height: f.size }} />
          ) : (
            <span key={i} className="season-snowflake" style={{ ...style, fontSize: f.size }}>
              ❄
            </span>
          );
        })}
      </div>
      {/* Góc màn hình (máy tính): cây thông + hộp quà / cành mai */}
      <div aria-hidden className="season-corner">
        <i className="tree" />
        <i className="gift" />
      </div>
    </>
  );
}
