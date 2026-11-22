import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";

/**
 * Vòng khung quanh ảnh đại diện tròn (ô "frame"). Vẽ đè lên ảnh: tâm (60,60), ảnh nằm trong bán kính ~40.
 * Kiểu lấy từ item.v2 (khung GĐ8) hoặc item.v ("gold" | "rainbow" | màu).
 */
export function FrameRing({ frameId, className }: { frameId?: string | null; className?: string }) {
  const item = frameId ? ITEM_BY_ID[frameId] : undefined;
  if (!item) return null;
  const kind = item.v2 ?? (item.v === "gold" || item.v === "rainbow" ? item.v : "plain");
  const color = item.v && item.v.startsWith("#") ? item.v : "#60a5fa";
  const id = `ring-${item.id}`;
  const around = (n: number, r: number, el: (i: number) => React.ReactNode, offset = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((360 / n) * i + offset) * (Math.PI / 180);
      const x = 60 + r * Math.cos(a);
      const y = 60 + r * Math.sin(a);
      return (
        <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((360 / n) * i + offset + 90).toFixed(1)})`}>
          {el(i)}
        </g>
      );
    });

  return (
    <svg viewBox="0 0 120 120" className={cn("pointer-events-none select-none", className)} aria-hidden data-frame={item.id}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="45%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`${id}-rainbow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6" /><stop offset="50%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#dc2626" /><stop offset="60%" stopColor="#f97316" /><stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>

      {kind === "plain" && <circle cx="60" cy="60" r="44" fill="none" stroke={color} strokeWidth="6" />}
      {kind === "gold" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="7" />
          <path d="M60 6l3 6 6.6.9-4.8 4.6 1.2 6.5L60 21l-6 3 1.2-6.5-4.8-4.6 6.6-.9z" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
        </g>
      )}
      {kind === "rainbow" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke={`url(#${id}-rainbow)`} strokeWidth="7" />
          <g fill="#fff" stroke="#e2e8f0"><ellipse cx="22" cy="28" rx="11" ry="6" /><ellipse cx="98" cy="94" rx="11" ry="6" /></g>
        </g>
      )}
      {kind === "royal" && (
        <g>
          <circle cx="60" cy="60" r="45" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="8" />
          <circle cx="60" cy="60" r="41" fill="none" stroke="#7c3aed" strokeWidth="3" />
          {around(4, 45, () => <path d="M0-6l5 6-5 6-5-6z" fill="#a78bfa" stroke="#4c1d95" strokeWidth="1.2" />, 45)}
          <path d="M44 14l4-10 6 6 6-9 6 9 6-6 4 10z" fill={`url(#${id}-gold)`} stroke="#92400e" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="60" cy="10" r="2" fill="#ef4444" />
        </g>
      )}
      {kind === "laurel" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" />
          {around(18, 47, (i) => <ellipse cx="0" cy="0" rx="3" ry="6.5" fill={i % 2 ? "#eab308" : "#ca8a04"} stroke="#854d0e" strokeWidth="0.8" transform="rotate(35)" />)}
        </g>
      )}
      {kind === "sakura" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#f9a8d4" strokeWidth="5" />
          {around(6, 44, () => (
            <g stroke="#db2777" strokeWidth="0.8">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-5" rx="3.4" ry="5" fill="#fce7f3" transform={`rotate(${r})`} />)}
              <circle r="2.2" fill="#facc15" stroke="#ca8a04" />
            </g>
          ), -90)}
        </g>
      )}
      {kind === "ice" && (
        <g>
          {around(16, 47, () => <path d="M-3.5 3L0-7l3.5 10z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" strokeLinejoin="round" />)}
          <circle cx="60" cy="60" r="44" fill="none" stroke="#7dd3fc" strokeWidth="6" />
          <circle cx="60" cy="60" r="44" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="6 10" />
        </g>
      )}
      {kind === "catear" && (
        <g strokeLinejoin="round">
          <path d="M24 34L20 6l26 14zM96 34l4-28-26 14z" fill="#f9a8d4" stroke="#be185d" strokeWidth="1.6" />
          <path d="M26 26l-2-13 12 7zM94 26l2-13-12 7z" fill="#fff1f2" />
          <circle cx="60" cy="60" r="44" fill="none" stroke="#f9a8d4" strokeWidth="6" />
          {[[36, 104], [84, 104]].map(([x, y]) => (
            <g key={x} fill="#fff1f2" stroke="#be185d" strokeWidth="1.1">
              <ellipse cx={x} cy={y} rx="7" ry="5.6" /><circle cx={x - 6} cy={y - 6} r="2.4" /><circle cx={x} cy={y - 8} r="2.4" /><circle cx={x + 6} cy={y - 6} r="2.4" />
            </g>
          ))}
        </g>
      )}
      {kind === "fire" && (
        <g>
          {around(12, 46, (i) => <path d="M0 4c-5 0-6-5-3-9 0 3 2 3 2 1 0-4 2-7 5-8-1 4 3 6 3 10 0 4-3 6-7 6z" fill={`url(#${id}-fire)`} transform={`scale(${i % 2 ? 1 : 1.3})`} />)}
          <circle cx="60" cy="60" r="44" fill="none" stroke={`url(#${id}-fire)`} strokeWidth="6" />
        </g>
      )}
      {kind === "neon" && (
        <g fill="none">
          <circle cx="60" cy="60" r="45" stroke="#22d3ee" strokeWidth="10" opacity="0.25" />
          <circle cx="60" cy="60" r="45" stroke="#22d3ee" strokeWidth="4" />
          <path d="M18 44a44 44 0 0 1 30-28" stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />
          <path d="M102 76a44 44 0 0 1-30 28" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="60" r="38" stroke="#e0f2fe" strokeWidth="1" strokeDasharray="2 5" />
        </g>
      )}
      {kind === "moon" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#4338ca" strokeWidth="7" />
          <circle cx="60" cy="60" r="44" fill="none" stroke="#c7d2fe" strokeWidth="1.2" strokeDasharray="1 7" />
          <path d="M104 26a20 20 0 1 1-24-14 15 15 0 0 0 24 14z" fill="#fde68a" stroke="#ca8a04" strokeWidth="1.4" />
          {[[16, 22, 1], [12, 92, 0.8], [96, 110, 0.9]].map(([x, y, k]) => (
            <path key={x} transform={`translate(${x} ${y}) scale(${k})`} d="M0-6l1.6 4.4L6 0 1.6 1.6 0 6-1.6 1.6-6 0l4.4-1.6z" fill="#e0e7ff" />
          ))}
        </g>
      )}
    </svg>
  );
}
