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
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fffbeb" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient>
            <linearGradient id={`${id}-rb2`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fee2e2" /><stop offset="50%" stopColor="#ef4444" /><stop offset="100%" stopColor="#7f1d1d" /></linearGradient>
          </defs>
          {/* tia hào quang toả quanh */}
          {around(16, 48, (i) => <path d={i % 2 ? "M-3 2 0-6 3 2z" : "M-4 3 0-9 4 3z"} fill={`url(#${id}-sun)`} stroke="#92400e" strokeWidth="0.9" />)}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#78350f" strokeWidth="10" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="7" />
          <circle cx="60" cy="60" r="38" fill="none" stroke="#fef3c7" strokeWidth="1.4" />
          <circle cx="60" cy="60" r="43" fill="none" stroke="#fffbeb" strokeWidth="1" strokeDasharray="2 7" opacity="0.9" />
          {/* đá quý hai bên + đáy */}
          {[[17, 60], [103, 60]].map(([x, y]) => (
            <path key={x} d={`M${x} ${y - 6}l5 6-5 6-5-6z`} fill="#38bdf8" stroke="#1e3a8a" strokeWidth="1.3" />
          ))}
          <path d="M60 97l6 7-6 8-6-8z" fill={`url(#${id}-rb2)`} stroke="#7f1d1d" strokeWidth="1.4" />
          {/* mặt trời huy hiệu trên đỉnh */}
          <g transform="translate(60 14)">
            <circle r="10" fill={`url(#${id}-gold)`} stroke="#78350f" strokeWidth="1.8" />
            <path d="M0-6l1.8 3.8 4.2.6-3 2.9.7 4.2L0 3.5l-3.7 2 .7-4.2-3-2.9 4.2-.6z" fill="#fffbeb" stroke="#b45309" strokeWidth="0.8" />
          </g>
          <path d="M44 16l-8-4 2 7zM76 16l8-4-2 7z" fill={`url(#${id}-gold)`} stroke="#78350f" strokeWidth="1.2" />
        </g>
      )}
      {kind === "rainbow" && (
        <g strokeLinejoin="round">
          <circle cx="60" cy="60" r="43" fill="none" stroke="#241e1a" strokeWidth="11" />
          {(["#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#c084fc"] as const).map((c, i) => (
            <circle key={c} cx="60" cy="60" r={47 - i * 2} fill="none" stroke={c} strokeWidth="2.1" />
          ))}
          {/* mây bông */}
          {([[24, 96, 1.1], [98, 26, 0.95]] as const).map(([x, y, k]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${k})`} stroke="#475569" strokeWidth="1.4">
              <path d="M-16 6c-5 0-6-7-1-8 0-6 7-8 10-4 2-6 11-6 13 0 5-1 8 4 5 8 3 3 0 6-3 6z" fill="#fff" />
              <path d="M-10 0c1-2 3-3 5-3" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          ))}
          {[[18, 30], [102, 92], [60, 112]].map(([x, y]) => (
            <path key={x} transform={`translate(${x} ${y})`} d="M0-5l1.4 3.6L5 0 1.4 1.4 0 5-1.4 1.4-5 0l3.6-1.4z" fill="#fde68a" stroke="#92400e" strokeWidth="0.7" />
          ))}
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
          <defs>
            <linearGradient id={`${id}-sk`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0f9ff" /><stop offset="50%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#2563eb" /></linearGradient>
            <linearGradient id={`${id}-fe`} x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#dbeafe" /></linearGradient>
            <linearGradient id={`${id}-ha`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fde68a" /><stop offset="50%" stopColor="#fffbeb" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient>
          </defs>
          {/* đôi cánh lông vũ 3 lớp */}
          {[1, -1].map((d) => (
            <g key={d} transform={d === 1 ? undefined : "translate(120 0) scale(-1 1)"} stroke="#1e3a8a" strokeWidth="1.3">
              <path d="M22 40C12 36 4 28 2 16c8 4 14 8 20 14 0-6 2-10 6-14 0 8 0 14-2 20z" fill={`url(#${id}-fe)`} />
              <path d="M18 54C8 54 1 48 0 38c6 4 12 6 20 6z" fill={`url(#${id}-fe)`} />
              <path d="M19 66C10 70 3 66 1 58c6 3 11 3 18 0z" fill={`url(#${id}-fe)`} />
              <path d="M8 22c4 4 8 8 12 14M6 42c4 1 9 2 13 2" fill="none" stroke="#93c5fd" strokeWidth="1" />
            </g>
          ))}
          <circle cx="60" cy="60" r="43" fill="none" stroke="#1e3a8a" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-sk)`} strokeWidth="6" />
          <circle cx="60" cy="60" r="38.5" fill="none" stroke="#e0f2fe" strokeWidth="1.2" strokeDasharray="2 4" />
          {/* vầng hào quang */}
          <ellipse cx="60" cy="9" rx="19" ry="5.5" fill="none" stroke="#78350f" strokeWidth="6.5" />
          <ellipse cx="60" cy="9" rx="19" ry="5.5" fill="none" stroke={`url(#${id}-ha)`} strokeWidth="4" />
          {/* trái tim đáy */}
          <path d="M60 112c-7-5-11-8-11-12 0-3 2-5 5-5 2 0 4 1 6 3 2-2 4-3 6-3 3 0 5 2 5 5 0 4-4 7-11 12z" fill="#f9a8d4" stroke="#1e3a8a" strokeWidth="1.5" />
          <path d="M54 99c-1 1-1 3 0 4" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      {kind === "clover" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-gr`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dcfce7" /><stop offset="50%" stopColor="#4ade80" /><stop offset="100%" stopColor="#15803d" /></linearGradient>
            <radialGradient id={`${id}-lf`} cx="0.35" cy="0.35" r="0.8"><stop offset="0%" stopColor="#bbf7d0" /><stop offset="100%" stopColor="#16a34a" /></radialGradient>
          </defs>
          <circle cx="60" cy="60" r="43" fill="none" stroke="#14532d" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-gr)`} strokeWidth="6" />
          {/* lá nhỏ mọc dọc vòng */}
          {around(14, 47, (i) => <path d="M0 0c-3-3-3-8 0-10 3 2 3 7 0 10z" fill={i % 2 ? "#4ade80" : "#22c55e"} stroke="#14532d" strokeWidth="0.8" transform={`rotate(${i % 2 ? 30 : -30})`} />, 8)}
          {/* cỏ 4 lá lớn góc trên phải */}
          <g transform="translate(96 22) rotate(15)" stroke="#14532d" strokeWidth="1.4">
            <path d="M0 0c2 6 4 12 10 16" fill="none" stroke="#14532d" strokeWidth="2.4" strokeLinecap="round" />
            {[0, 90, 180, 270].map((r) => (
              <path key={r} transform={`rotate(${r + 45})`} d="M0 0C-6-4-9-11-5-14c2-1 4 0 5 2 1-2 3-3 5-2 4 3 1 10-5 14z" fill={`url(#${id}-lf)`} />
            ))}
            <circle r="1.8" fill="#fde047" />
          </g>
          {/* bọ rùa đáy trái */}
          <g transform="translate(24 98) rotate(-25)" stroke="#241e1a" strokeWidth="1.2">
            <circle cx="0" cy="-6" r="3" fill="#241e1a" />
            <ellipse rx="6.5" ry="7" fill="#ef4444" />
            <path d="M0-7v14" fill="none" />
            <circle cx="-3" cy="-1" r="1.3" fill="#241e1a" stroke="none" /><circle cx="3" cy="2" r="1.3" fill="#241e1a" stroke="none" /><circle cx="-2.5" cy="4" r="1" fill="#241e1a" stroke="none" />
          </g>
          {/* hoa cúc nhỏ */}
          {[[16, 40], [104, 78], [60, 113]].map(([x, y]) => (
            <g key={x} transform={`translate(${x} ${y})`} stroke="#a16207" strokeWidth="0.6">
              {[0, 60, 120, 180, 240, 300].map((r) => <ellipse key={r} cy="-3" rx="1.6" ry="3" fill="#fff" transform={`rotate(${r})`} />)}
              <circle r="1.6" fill="#facc15" />
            </g>
          ))}
        </g>
      )}
      {kind === "butterfly" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-bf`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fce7f3" /><stop offset="50%" stopColor="#c084fc" /><stop offset="100%" stopColor="#6d28d9" /></linearGradient>
            <linearGradient id={`${id}-w1`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fdf4ff" /><stop offset="55%" stopColor="#e879f9" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient>
            <linearGradient id={`${id}-w2`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ecfeff" /><stop offset="55%" stopColor="#67e8f9" /><stop offset="100%" stopColor="#6366f1" /></linearGradient>
          </defs>
          <circle cx="60" cy="60" r="43" fill="none" stroke="#3b0764" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-bf)`} strokeWidth="6" />
          <circle cx="60" cy="60" r="43" fill="none" stroke="#fdf4ff" strokeWidth="1.2" strokeDasharray="1 6" />
          {/* dây leo + hoa */}
          <path d="M30 100c-8-6-14-16-16-28M90 100c8-6 14-16 16-28" fill="none" stroke="#86198f" strokeWidth="1.6" strokeLinecap="round" />
          {[[14, 74], [106, 74], [22, 92], [98, 92]].map(([x, y]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y})`} stroke="#86198f" strokeWidth="0.6">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cy="-2.6" rx="1.8" ry="2.6" fill="#fbcfe8" transform={`rotate(${r})`} />)}
              <circle r="1.3" fill="#fde047" />
            </g>
          ))}
          {/* ba con bướm */}
          {([[22, 22, 1.25, -20, "w1"], [98, 100, 0.95, 25, "w2"], [100, 20, 0.7, 15, "w2"]] as const).map(([x, y, k, r, g]) => (
            <g key={x * y} transform={`translate(${x} ${y}) scale(${k}) rotate(${r})`} stroke="#3b0764" strokeWidth="1.3">
              <path d="M0 0C-4-10-14-12-14-4c0 5 6 6 14 4z" fill={`url(#${id}-${g})`} />
              <path d="M0 0C4-10 14-12 14-4 14 1 8 2 0 0z" fill={`url(#${id}-${g})`} />
              <path d="M0 0c-3 4-10 8-11 3 0-3 5-4 11-3zM0 0c3 4 10 8 11 3 0-3-5-4-11-3z" fill="#f0abfc" />
              <circle cx="-8" cy="-5" r="1.6" fill="#fff" stroke="none" /><circle cx="8" cy="-5" r="1.6" fill="#fff" stroke="none" />
              <ellipse rx="1.4" ry="5" fill="#3b0764" stroke="none" />
              <path d="M0-4c-1-3-3-5-5-6M0-4c1-3 3-5 5-6" fill="none" strokeWidth="0.8" />
            </g>
          ))}
        </g>
      )}
      {kind === "rose" && (
        <g strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-rb`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f8fafc" /><stop offset="45%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#334155" /></linearGradient>
            <radialGradient id={`${id}-rs`} cx="0.4" cy="0.35" r="0.75"><stop offset="0%" stopColor="#fda4af" /><stop offset="55%" stopColor="#e11d48" /><stop offset="100%" stopColor="#881337" /></radialGradient>
          </defs>
          {/* dây gai quấn vòng */}
          <circle cx="60" cy="60" r="47.5" fill="none" stroke="#14532d" strokeWidth="1.6" strokeDasharray="5 3" />
          <circle cx="60" cy="60" r="43" fill="none" stroke="#1e1b4b" strokeWidth="9" />
          <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${id}-rb)`} strokeWidth="6" />
          <circle cx="60" cy="60" r="38.5" fill="none" stroke="#fecdd3" strokeWidth="1.2" />
          {/* lá */}
          {([[48, 14, -150], [72, 14, -30], [22, 88, 160], [36, 104, 100], [98, 88, 20], [84, 104, 80]] as const).map(([x, y, r]) => (
            <path key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r})`} d="M0 0c4-5 11-5 14 0-3 5-10 5-14 0z" fill="#22c55e" stroke="#14532d" strokeWidth="1.1" />
          ))}
          {/* ba bông hồng */}
          {([[60, 12, 1.15], [27, 96, 1], [93, 96, 1]] as const).map(([x, y, k]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${k})`} stroke="#4c0519" strokeWidth="1.2">
              <circle r="9" fill={`url(#${id}-rs)`} />
              <path d="M-7 2c0-6 5-9 9-7 4 2 3 7-1 8-3 1-5-1-4-3 1-2 3-2 4-1" fill="none" stroke="#4c0519" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M-9 1c2 5 6 8 9 8s7-3 9-8" fill="none" stroke="#9f1239" strokeWidth="1.1" />
              <path d="M-5-6c1-1 3-2 4-2" fill="none" stroke="#ffe4e6" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          ))}
          {/* viên đá đáy */}
          <path d="M60 104l5 6-5 6-5-6z" fill="#fda4af" stroke="#4c0519" strokeWidth="1.2" />
        </g>
      )}
    </svg>
    <FrameFx frameId={item.id} className={className} />
    </>
  );
}
