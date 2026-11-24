"use client";

import { useEffect, useRef } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";
import { pauseOffscreen } from "@/lib/offscreen";
import "./frame-fx.css";

/**
 * Lớp hiệu ứng động phủ lên viền avatar (tiệm, Bảng Vàng, hồ sơ, tủ đồ): lấp lánh theo độ hiếm + hiệu ứng riêng theo chủ đề
 * (cánh hoa rơi, tuyết, tàn lửa, bướm, tim, sao, neon…). Toạ độ theo khung 120×120, tâm (60,60), vòng ≈ bán kính 46.
 * Tắt hết khi máy bật "giảm chuyển động".
 */
const STAR = "M0-5 1.3-1.3 5 0 1.3 1.3 0 5-1.3 1.3-5 0-1.3-1.3z";
const PETAL = "M0-3.6c2.6 0 3.4 2.6 0 6.2-3.4-3.6-2.6-6.2 0-6.2z";
const HEART = "M0 3.2-3.4-.2a2.1 2.1 0 0 1 3.4-2.4 2.1 2.1 0 0 1 3.4 2.4z";
const FLAKE = "M0-4v8M-3.5-2l7 4M-3.5 2l7-4";

type Kind = "angel" | "clover" | "rainbow" | "gold" | "catear" | "laurel" | "sakura" | "ice" | "royal" | "neon" | "fire" | "moon" | "butterfly" | "rose" | "rank-diamond" | "rank-master" | "rank-challenger" | "galaxy" | "fairy" | "phoenix" | "plain";

const at = (deg: number, r = 47): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [60 + r * Math.cos(a), 60 + r * Math.sin(a)];
};

function Twinkles({ n, color, size = 1, r = 49, offset = -60 }: { n: number; color: string; size?: number; r?: number; offset?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = at(offset + (360 / n) * i + (i % 2 ? 11 : 0), r + (i % 3) * 3);
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(1.6 * size * (i % 2 ? 0.72 : 1)).toFixed(2)})`}>
            <path d={STAR} fill={color} stroke="#fff" strokeWidth="0.7" className="ffx-tw" style={{ animationDelay: `${((i * 0.53) % 2.2).toFixed(2)}s` }} />
          </g>
        );
      })}
    </>
  );
}

/** Dải sáng ngắn chạy quanh vòng */
function Sheen({ color, slow, width = 5 }: { color: string; slow?: boolean; width?: number }) {
  return (
    <g className={slow ? "ffx-spin-slow" : "ffx-spin"}>
      <path d="M60 13a47 47 0 0 1 33 13.7" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity="0.85" />
    </g>
  );
}

function Falling({ n, render, from = 18, to = 102, delayStep = 0.7 }: { n: number; render: (i: number) => React.ReactNode; from?: number; to?: number; delayStep?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = from + ((to - from) / Math.max(1, n - 1)) * i;
        const y = i % 2 ? 10 : 22;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y})`}>
            <g className="ffx-fall" style={{ animationDelay: `${(i * delayStep).toFixed(2)}s` }}>{render(i)}</g>
          </g>
        );
      })}
    </>
  );
}

function Rising({ points, render, dur }: { points: [number, number][]; render: (i: number) => React.ReactNode; dur?: number }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className="ffx-rise" style={{ animationDelay: `${(i * 0.55).toFixed(2)}s`, ...(dur ? { animationDuration: `${dur}s` } : {}) }}>{render(i)}</g>
        </g>
      ))}
    </>
  );
}

function Butterfly({ x, y, k, c1, c2, delay }: { x: number; y: number; k: number; c1: string; c2: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k}) rotate(-18)`}>
      <g className="ffx-hover" style={{ animationDelay: `${delay}s` }}>
        <g className="ffx-wing" style={{ animationDelay: `${delay}s` }} stroke="#4c1d95" strokeWidth="1.2">
          <ellipse cx="-5" cy="-3" rx="5.5" ry="4.2" fill={c1} />
          <ellipse cx="5" cy="-3" rx="5.5" ry="4.2" fill={c2} />
          <ellipse cx="-3.5" cy="4" rx="3.4" ry="2.8" fill={c2} />
          <ellipse cx="3.5" cy="4" rx="3.4" ry="2.8" fill={c1} />
        </g>
        <path d="M0-6v11" stroke="#4c1d95" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Theme({ kind }: { kind: Kind }) {
  switch (kind) {
    case "angel":
      return (
        <>
          <ellipse cx="60" cy="10" rx="20" ry="7" fill="#fde68a" className="ffx-pulse" />
          <Twinkles n={4} color="#7dd3fc" size={0.9} />
        </>
      );
    case "clover":
      return <Twinkles n={5} color="#4ade80" size={0.9} />;
    case "rainbow":
      return (
        <>
          <Sheen color="#f9a8d4" />
          <g className="ffx-spin" style={{ animationDelay: "-1.5s" }}><path d="M60 13a47 47 0 0 1 33 13.7" fill="none" stroke="#fde047" strokeWidth="5" strokeLinecap="round" opacity="0.8" /></g>
          <g className="ffx-spin" style={{ animationDelay: "-3s" }}><path d="M60 13a47 47 0 0 1 33 13.7" fill="none" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" opacity="0.8" /></g>
          <Twinkles n={4} color="#facc15" />
        </>
      );
    case "gold":
    case "royal":
    case "laurel":
      return (
        <>
          <circle cx="60" cy="60" r="47" fill="none" stroke="#fde68a" strokeWidth="9" className="ffx-glow" />
          <Sheen color="#fffbeb" width={4} />
          <Twinkles n={kind === "laurel" ? 4 : 6} color="#fde047" size={kind === "gold" ? 1.15 : 1} />
        </>
      );
    case "catear":
      return (
        <>
          <Rising points={[[30, 30], [92, 34], [96, 84]]} render={() => <path d={HEART} fill="#f472b6" stroke="#be185d" strokeWidth="0.7" transform="scale(1.6)" />} />
          <Twinkles n={3} color="#f472b6" size={0.8} offset={-130} />
        </>
      );
    case "sakura":
      return (
        <>
          <Falling n={5} render={(i) => <path d={PETAL} fill={i % 2 ? "#f9a8d4" : "#fbcfe8"} stroke="#db2777" strokeWidth="0.5" transform="scale(1.5)" />} />
          <Twinkles n={3} color="#f9a8d4" size={0.8} />
        </>
      );
    case "ice":
      return (
        <>
          <Falling n={5} delayStep={0.8} render={() => <path d={FLAKE} stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round" transform="scale(1.3)" />} />
          <Twinkles n={4} color="#7dd3fc" />
        </>
      );
    case "fire":
      return (
        <>
          <circle cx="60" cy="60" r="47" fill="none" stroke="#fb923c" strokeWidth="8" className="ffx-glow" />
          <Rising points={[[26, 70], [40, 96], [60, 104], [82, 96], [96, 68], [60, 14]]} dur={1.8} render={(i) => <circle r={i % 2 ? 1.6 : 2.2} fill={i % 3 ? "#fde047" : "#f97316"} />} />
        </>
      );
    case "neon":
      return (
        <>
          <circle cx="60" cy="60" r="45" fill="none" stroke="#22d3ee" strokeWidth="10" className="ffx-flicker" />
          <Sheen color="#f0abfc" width={4} />
        </>
      );
    case "moon":
      return (
        <>
          <circle cx="60" cy="60" r="47" fill="none" stroke="#a5b4fc" strokeWidth="8" className="ffx-glow" />
          <Twinkles n={7} color="#a5b4fc" size={0.9} />
          <Sheen color="#fde68a" slow width={3} />
        </>
      );
    case "butterfly":
      return (
        <>
          <Butterfly x={22} y={22} k={1} c1="#e9d5ff" c2="#c4b5fd" delay={0} />
          <Butterfly x={98} y={96} k={0.7} c1="#bae6fd" c2="#e9d5ff" delay={0.8} />
          <Twinkles n={3} color="#c084fc" size={0.8} offset={20} />
        </>
      );
    case "rose":
      return (
        <>
          <circle cx="60" cy="60" r="47" fill="none" stroke="#c7d2fe" strokeWidth="8" className="ffx-glow" />
          <Sheen color="#ffffff" width={4} />
          <Twinkles n={5} color="#c7d2fe" />
        </>
      );
    case "rank-diamond":
      return (
        <>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#67e8f9" strokeWidth="9" className="ffx-glow" />
          <Sheen color="#ffffff" width={3.5} />
          <Twinkles n={6} color="#22d3ee" />
        </>
      );
    case "rank-master":
      return (
        <>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#e879f9" strokeWidth="11" className="ffx-glow" />
          <Sheen color="#fdf4ff" width={4} />
          <g className="ffx-spin" style={{ animationDelay: "-2.2s" }}><path d="M60 13a47 47 0 0 1 33 13.7" fill="none" stroke="#f0abfc" strokeWidth="3" strokeLinecap="round" opacity="0.8" /></g>
          <Twinkles n={7} color="#e879f9" />
          <Rising points={[[44, 104], [76, 104], [60, 110]]} dur={2.2} render={() => <circle r="1.6" fill="#f5d0fe" />} />
        </>
      );
    case "rank-challenger":
      return (
        <>
          {/* tia sáng xoay chậm sau vương miện */}
          <g className="ffx-spin-slow" opacity="0.55">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M57 13 60 1l3 12z" fill={i % 2 ? "#fde68a" : "#bae6fd"} transform={`rotate(${i * 30} 60 60)`} />
            ))}
          </g>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#fcd34d" strokeWidth="12" className="ffx-glow" />
          <Sheen color="#ffffff" width={4} />
          <g className="ffx-spin" style={{ animationDelay: "-2.2s" }}><path d="M60 13a47 47 0 0 1 33 13.7" fill="none" stroke="#7dd3fc" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" /></g>
          <Twinkles n={8} color="#facc15" size={1.1} />
          <Rising points={[[30, 100], [90, 100], [20, 80], [100, 80]]} dur={2} render={(i) => <circle r={i % 2 ? 1.4 : 2} fill={i % 2 ? "#e0f2fe" : "#fef08a"} />} />
        </>
      );
    case "galaxy":
      return (
        <>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#818cf8" strokeWidth="10" className="ffx-glow" />
          {/* tiểu hành tinh bay quanh vòng */}
          <g className="ffx-spin-slow"><circle cx="60" cy="16" r="3" fill="#fde68a" stroke="#1e1b4b" strokeWidth="1" /></g>
          <g className="ffx-spin" style={{ animationDuration: "6s", animationDelay: "-3s" }}><circle cx="60" cy="16" r="2" fill="#a5f3fc" /></g>
          <Twinkles n={7} color="#c4b5fd" />
        </>
      );
    case "fairy":
      return (
        <>
          <Falling n={6} delayStep={0.6} render={(i) => <path d={STAR} fill={i % 2 ? "#f0abfc" : "#a5f3fc"} transform="scale(0.7)" />} />
          <Twinkles n={5} color="#e879f9" size={0.9} />
        </>
      );
    case "phoenix":
      return (
        <>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#f97316" strokeWidth="11" className="ffx-glow" />
          <Sheen color="#fef08a" width={4} />
          <Rising points={[[22, 40], [98, 40], [16, 64], [104, 64], [60, 4], [48, 108], [72, 108]]} dur={1.7} render={(i) => <circle r={i % 2 ? 1.5 : 2.2} fill={i % 3 ? "#fde047" : "#fb923c"} />} />
          <Twinkles n={4} color="#fbbf24" />
        </>
      );
    default:
      return <Twinkles n={3} color="#facc15" size={0.8} />;
  }
}

/** Kiểu hiệu ứng của một viền: theo item.v2 (kiểu vòng), "gold"/"rainbow" cũ theo item.v */
export function frameFxKind(frameId?: string | null): Kind | null {
  const it = frameId ? ITEM_BY_ID[frameId] : undefined;
  if (!it || it.slot !== "frame") return null;
  return (it.v2 ?? (it.v === "gold" || it.v === "rainbow" ? it.v : "plain")) as Kind;
}

export function FrameFx({ frameId, className }: { frameId?: string | null; className?: string }) {
  const kind = frameFxKind(frameId);
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => pauseOffscreen(ref.current), [kind]);
  if (!kind) return null;
  return (
    <svg ref={ref} viewBox="0 0 120 120" aria-hidden className={cn("ffx pointer-events-none absolute inset-0 h-full w-full select-none", className)} data-frame-fx={kind}>
      <Theme kind={kind} />
    </svg>
  );
}
