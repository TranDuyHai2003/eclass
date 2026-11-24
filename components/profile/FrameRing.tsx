import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";
import { FrameFx } from "@/components/avatar/FrameFx";

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
    <>
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
      {kind === "rank-diamond" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ecfeff" /><stop offset="50%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#0e7490" /></linearGradient>
            <linearGradient id={`${id}-shard`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0fdff" /><stop offset="60%" stopColor="#67e8f9" /><stop offset="100%" stopColor="#0891b2" /></linearGradient>
          </defs>
          {/* mảnh pha lê toả quanh vòng */}
          {around(8, 47, (i) => <path d={i % 2 ? "M0-7 3 0 0 5-3 0z" : "M0-10 4 0 0 6-4 0z"} fill={`url(#${id}-shard)`} stroke="#155e75" strokeWidth="1" />, 22.5)}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#155e75" strokeWidth="8" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-ice)`} strokeWidth="5.5" />
          <circle cx="60" cy="60" r="39" fill="none" stroke="#cffafe" strokeWidth="1.2" strokeDasharray="1.5 4" />
          {/* viên kim cương trên đỉnh */}
          <path d="M48 12 54 4h12l6 8-12 16z" fill={`url(#${id}-shard)`} stroke="#155e75" strokeWidth="1.6" />
          <path d="M48 12h24M54 4l6 8 6-8M60 12v16" fill="none" stroke="#ecfeff" strokeWidth="0.9" opacity="0.9" />
          <path d="M53 108l7-9 7 9-7 7z" fill={`url(#${id}-shard)`} stroke="#155e75" strokeWidth="1.4" />
        </g>
      )}
      {kind === "rank-master" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-mag`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fae8ff" /><stop offset="45%" stopColor="#c026d3" /><stop offset="100%" stopColor="#4a044e" /></linearGradient>
            <linearGradient id={`${id}-blade`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#f5d0fe" /><stop offset="100%" stopColor="#7e22ce" /></linearGradient>
          </defs>
          {/* cánh lưỡi kiếm hai bên */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"} stroke="#3b0764" strokeWidth="1.4">
              <path d="M22 44 4 30l8 16-10 2 12 8-10 6 14 2z" fill={`url(#${id}-blade)`} />
              <path d="M22 70 6 80l14-2-4 10 10-12z" fill={`url(#${id}-blade)`} />
            </g>
          ))}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#3b0764" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-mag)`} strokeWidth="6" />
          <circle cx="60" cy="60" r="38.5" fill="none" stroke="#f0abfc" strokeWidth="1.3" />
          {/* huy hiệu đỉnh: khiên ngũ giác + sao */}
          <path d="M60 1 72 9 68 25H52L48 9z" fill={`url(#${id}-mag)`} stroke="#3b0764" strokeWidth="1.8" />
          <path d="M60 7l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#fef08a" stroke="#a16207" strokeWidth="0.8" />
          {/* ba viên đá đáy */}
          {[[46, 101, 3.2], [60, 106, 4.2], [74, 101, 3.2]].map(([x, y, r]) => (
            <path key={x} d={`M${x} ${y - r * 1.4}l${r} ${r * 1.4}-${r} ${r * 1.4}-${r}-${r * 1.4}z`} fill="#e879f9" stroke="#3b0764" strokeWidth="1.2" />
          ))}
        </g>
      )}
      {kind === "rank-challenger" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-au`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fffbeb" /><stop offset="40%" stopColor="#fbbf24" /><stop offset="75%" stopColor="#b45309" /><stop offset="100%" stopColor="#fde68a" /></linearGradient>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0f2fe" /><stop offset="55%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#1d4ed8" /></linearGradient>
            <linearGradient id={`${id}-wing`} x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient>
          </defs>
          {/* cánh lông vũ nhiều lớp */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"} stroke="#78350f" strokeWidth="1.2">
              <path d="M20 40C10 34 4 24 6 12c6 10 12 16 18 20z" fill={`url(#${id}-wing)`} />
              <path d="M18 52C8 50 1 42 1 30c6 9 12 13 19 15z" fill={`url(#${id}-wing)`} />
              <path d="M18 64C9 66 2 60 0 50c7 6 12 8 19 8z" fill={`url(#${id}-wing)`} />
              <path d="M20 76c-8 4-14 1-18-6 7 3 11 3 17 0z" fill={`url(#${id}-wing)`} />
            </g>
          ))}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#78350f" strokeWidth="9.5" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-au)`} strokeWidth="6.5" />
          <circle cx="60" cy="60" r="38.5" fill="none" stroke={`url(#${id}-sky)`} strokeWidth="2.6" />
          {/* nguyệt quế đáy */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"}>
              {[0, 1, 2, 3].map((i) => (
                <ellipse key={i} cx={40 + i * 4.5} cy={104 - i * 1.2} rx="2.4" ry="5" fill={i % 2 ? "#facc15" : "#eab308"} stroke="#78350f" strokeWidth="0.8" transform={`rotate(${-60 + i * 12} ${40 + i * 4.5} ${104 - i * 1.2})`} />
              ))}
            </g>
          ))}
          <path d="M54 108l6-8 6 8-6 6z" fill={`url(#${id}-sky)`} stroke="#78350f" strokeWidth="1.3" />
          {/* vương miện + viên đá xanh trên đỉnh */}
          <path d="M44 22 46 6l7 7 7-12 7 12 7-7 2 16z" fill={`url(#${id}-au)`} stroke="#78350f" strokeWidth="1.6" />
          {[[46, 6], [60, 1], [74, 6]].map(([x, y]) => <circle key={x} cx={x} cy={y + 1} r="2" fill="#fef3c7" stroke="#78350f" strokeWidth="0.8" />)}
          <path d="M60 11l5 6-5 7-5-7z" fill={`url(#${id}-sky)`} stroke="#1e3a8a" strokeWidth="1" />
        </g>
      )}
      {kind === "galaxy" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-gx`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c4b5fd" /><stop offset="40%" stopColor="#4338ca" /><stop offset="75%" stopColor="#1e1b4b" /><stop offset="100%" stopColor="#db2777" /></linearGradient>
          </defs>
          <circle cx="60" cy="60" r="43" fill="none" stroke="#1e1b4b" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-gx)`} strokeWidth="6.5" />
          {around(18, 43, (i) => <circle r={i % 3 ? 0.7 : 1.2} fill="#fff" opacity={i % 2 ? 0.9 : 0.6} />)}
          {/* hành tinh có vành ở góc trên phải */}
          <g transform="translate(95 22)">
            <circle r="9" fill="#f9a8d4" stroke="#1e1b4b" strokeWidth="1.6" />
            <path d="M-6-3a7 7 0 0 1 10 0" fill="none" stroke="#fdf2f8" strokeWidth="1.4" strokeLinecap="round" />
            <ellipse rx="15" ry="4" fill="none" stroke="#fde68a" strokeWidth="2" transform="rotate(-20)" />
          </g>
          <path d="M18 96l1.6 4.4L24 102l-4.4 1.6L18 108l-1.6-4.4L12 102l4.4-1.6z" fill="#fde68a" stroke="#1e1b4b" strokeWidth="0.8" />
        </g>
      )}
      {kind === "fairy" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-fw`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fdf4ff" stopOpacity="0.95" /><stop offset="60%" stopColor="#e9d5ff" stopOpacity="0.8" /><stop offset="100%" stopColor="#a5f3fc" stopOpacity="0.75" /></linearGradient>
            <linearGradient id={`${id}-fr`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fbcfe8" /><stop offset="100%" stopColor="#c084fc" /></linearGradient>
          </defs>
          {/* cánh tiên trong suốt hai bên */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"} stroke="#a855f7" strokeWidth="1.2">
              <path d="M20 52C6 46 0 30 6 18c10 4 16 18 18 30z" fill={`url(#${id}-fw)`} />
              <path d="M20 66C8 72 4 86 12 94c8-6 12-16 12-26z" fill={`url(#${id}-fw)`} />
              <path d="M10 26c4 6 8 12 10 20M12 86c3-5 6-10 8-16" fill="none" stroke="#f0abfc" strokeWidth="0.9" />
            </g>
          ))}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#86198f" strokeWidth="7.5" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-fr)`} strokeWidth="5" />
          {/* chùm hoa nhỏ trên đỉnh */}
          {[[50, 15, "#fbcfe8"], [60, 11, "#f9a8d4"], [70, 15, "#e9d5ff"]].map(([x, y, c]) => (
            <g key={String(x)} transform={`translate(${x} ${y})`} stroke="#9d174d" strokeWidth="0.7">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-3.4" rx="2.4" ry="3.4" fill={String(c)} transform={`rotate(${r})`} />)}
              <circle r="1.6" fill="#fde047" />
            </g>
          ))}
        </g>
      )}
      {kind === "phoenix" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-pf`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#991b1b" /><stop offset="45%" stopColor="#f97316" /><stop offset="100%" stopColor="#fde047" /></linearGradient>
            <linearGradient id={`${id}-pr`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fef3c7" /><stop offset="40%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b91c1c" /></linearGradient>
          </defs>
          {/* cánh lửa */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"} stroke="#7f1d1d" strokeWidth="1.2">
              <path d="M22 42C12 30 10 18 14 6c4 10 8 16 14 22-2-8 0-14 4-18 0 10 2 18 6 24z" fill={`url(#${id}-pf)`} />
              <path d="M18 58C6 54 0 44 0 32c6 8 12 12 20 14z" fill={`url(#${id}-pf)`} />
              <path d="M19 72C8 74 2 68 0 58c7 5 13 6 20 4z" fill={`url(#${id}-pf)`} />
            </g>
          ))}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#7f1d1d" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-pr)`} strokeWidth="6" />
          {/* lông đuôi ở đáy */}
          {[-18, 0, 18].map((r) => (
            <g key={r} transform={`rotate(${r} 60 102)`}>
              <path d="M60 102c-4 6-4 12 0 17 4-5 4-11 0-17z" fill={`url(#${id}-pf)`} stroke="#7f1d1d" strokeWidth="1" />
              <circle cx="60" cy="112" r="1.6" fill="#22d3ee" />
            </g>
          ))}
          {/* mào lửa trên đỉnh */}
          <path d="M60 2c-6 6-7 12-3 18 0-5 2-8 3-10 1 2 3 5 3 10 4-6 3-12-3-18z" fill={`url(#${id}-pf)`} stroke="#7f1d1d" strokeWidth="1.2" />
        </g>
      )}
      {kind === "angel" && (
        <g strokeLinejoin="round">
          <circle cx="60" cy="60" r="44" fill="none" stroke="#bae6fd" strokeWidth="6" />
          <ellipse cx="60" cy="10" rx="17" ry="5" fill="none" stroke="#fbbf24" strokeWidth="5" />
          <ellipse cx="60" cy="10" rx="17" ry="5" fill="none" stroke="#241e1a" strokeWidth="1.6" />
          {[1, -1].map((d) => (
            <path key={d} transform={`translate(60 0) scale(${d} 1)`} d="M-44 38c-8-6-10 4-4 8-6 2-6 10 2 10 4 0 6-4 6-8z" fill="#fffdf8" stroke="#241e1a" strokeWidth="2" />
          ))}
        </g>
      )}
      {kind === "clover" && (
        <g>
          <circle cx="60" cy="60" r="44" fill="none" stroke="#86efac" strokeWidth="6" />
          {around(5, 44, () => (
            <g fill="#22c55e" stroke="#14532d" strokeWidth="0.9">
              {[0, 90, 180, 270].map((r) => <circle key={r} cx="0" cy="-3.4" r="3.3" transform={`rotate(${r + 45})`} />)}
              <circle r="1.3" fill="#bbf7d0" stroke="none" />
            </g>
          ), -90)}
        </g>
      )}
      {kind === "butterfly" && (
        <g strokeLinejoin="round">
          <circle cx="60" cy="60" r="44" fill="none" stroke="#c084fc" strokeWidth="5" strokeDasharray="9 7" />
          {[[24, 24, 1], [96, 98, 0.65]].map(([x, y, k]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${k}) rotate(-20)`} stroke="#4c1d95" strokeWidth="1.6">
              <ellipse cx="-7" cy="-5" rx="8" ry="6" fill="#e9d5ff" /><ellipse cx="7" cy="-5" rx="8" ry="6" fill="#c4b5fd" />
              <ellipse cx="-5" cy="6" rx="5" ry="4" fill="#d8b4fe" /><ellipse cx="5" cy="6" rx="5" ry="4" fill="#a78bfa" />
            </g>
          ))}
        </g>
      )}
      {kind === "rose" && (
        <g>
          <circle cx="60" cy="60" r="45" fill="none" stroke="#312e81" strokeWidth="7" />
          <circle cx="60" cy="60" r="41" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          {[[60, 15], [33, 91], [87, 91]].map(([x, y], i) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <circle r={i ? 9 : 8} fill="#eef2ff" stroke="#312e81" strokeWidth="2.4" />
              {i > 0 && <path d="M-4 1c0-4 7-5 8-1 1 3-3 5-5 3" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />}
            </g>
          ))}
        </g>
      )}
    </svg>
    <FrameFx frameId={item.id} className={className} />
    </>
  );
}
