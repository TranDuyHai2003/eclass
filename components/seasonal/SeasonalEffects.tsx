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
    const count = window.innerWidth < 640 ? 14 : 26;
    setFlakes(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: season === "tet" ? 10 + Math.random() * 8 : 4 + Math.random() * 6,
        duration: 9 + Math.random() * 10,
        delay: -Math.random() * 18,
        drift: (Math.random() - 0.5) * 120,
        opacity: 0.45 + Math.random() * 0.45,
      })),
    );
  }, [season]);

  if (!season || flakes.length === 0) return null;
  if (FOCUS_ROUTES.some((re) => re.test(pathname))) return null;

  return (
    <div aria-hidden className="season-fall pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {flakes.map((f, i) => (
        <span
          key={i}
          className={season === "tet" ? "season-petal" : "season-snowflake"}
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
