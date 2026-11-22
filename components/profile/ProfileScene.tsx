import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";

/**
 * Cảnh banner hồ sơ theo Hình nền đang dùng (ô "background") — SVG thuần 400×200, phủ kín khung (slice).
 * Vị trí cố định (không ngẫu nhiên) để HTML server/client khớp.
 */
export function ProfileScene({ bgId, className }: { bgId?: string | null; className?: string }) {
  const item = bgId ? ITEM_BY_ID[bgId] : undefined;
  const id = `scene-${item?.id ?? "none"}`;
  const top = item?.v ?? "#bfdbfe";
  const bottom = item?.v2 ?? "#eff6ff";
  const stars = (n: number, color = "#fff") =>
    Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={(i * 97) % 400} cy={(i * 53) % 120} r={i % 3 === 0 ? 1.6 : 1} fill={color} opacity={0.5 + (i % 4) * 0.12} />
    ));
  const clouds = (fill: string, ys: number[] = [40, 70]) => (
    <g fill={fill}>
      {ys.map((y, i) => (
        <g key={y} transform={`translate(${i % 2 ? 300 : 60} ${y})`}>
          <ellipse cx="0" cy="0" rx="34" ry="12" /><ellipse cx="18" cy="-8" rx="20" ry="12" /><ellipse cx="-16" cy="-4" rx="16" ry="10" />
        </g>
      ))}
    </g>
  );

  let body: React.ReactNode;
  switch (item?.id) {
    case "bg-library":
      body = (
        <g>
          {stars(28)}
          {/* cửa sổ vòm + trăng */}
          <path d="M160 200V90a40 40 0 0 1 80 0v110z" fill="#312e81" stroke="#a5b4fc" strokeWidth="3" />
          <path d="M200 50v150M160 120h80" stroke="#a5b4fc" strokeWidth="2" />
          <path d="M226 70a14 14 0 1 1-16-12 11 11 0 0 0 16 12z" fill="#fde68a" />
          {/* giá sách hai bên */}
          {[0, 300].map((x0) => (
            <g key={x0}>
              <rect x={x0} y="20" width="100" height="180" fill="#3b2463" />
              {[44, 92, 140, 188].map((y) => <rect key={y} x={x0} y={y} width="100" height="5" fill="#5b3a8a" />)}
              {[0, 1, 2, 3].map((row) =>
                Array.from({ length: 9 }, (_, i) => (
                  <rect key={`${row}-${i}`} x={x0 + 4 + i * 10.6} y={20 + row * 48 + 4 + (i % 3) * 3} width="8" height={20 - (i % 3) * 3} rx="1" fill={["#7c3aed", "#db2777", "#2563eb", "#059669", "#d97706"][(i + row) % 5]} opacity="0.85" />
                )),
              )}
            </g>
          ))}
          {/* đốm sáng lơ lửng */}
          {[[130, 60], [270, 50], [120, 150], [285, 140], [200, 30]].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="3" fill="#fde68a" opacity="0.8" />
          ))}
        </g>
      );
      break;
    case "bg-dusk":
      body = (
        <g>
          <circle cx="300" cy="120" r="34" fill="#fda4af" opacity="0.9" />
          {clouds("#fbcfe8", [60, 120])}
          {clouds("#ede9fe", [150, 100])}
          <path d="M0 170q100-30 200 0t200 0v30H0z" fill="#a78bfa" opacity="0.6" />
        </g>
      );
      break;
    case "bg-classroom":
      body = (
        <g>
          <rect x="0" y="150" width="400" height="50" fill="#d6a76c" />
          <rect x="110" y="40" width="180" height="90" rx="4" fill="#166534" stroke="#92400e" strokeWidth="6" />
          <text x="130" y="78" fill="#f0fdf4" fontSize="18" fontFamily="Georgia, serif" opacity="0.9">x² + y² = r²</text>
          <text x="150" y="110" fill="#f0fdf4" fontSize="20" fontFamily="Georgia, serif" opacity="0.9">π ≈ 3,14</text>
          <rect x="310" y="30" width="70" height="90" fill="#bae6fd" stroke="#fff" strokeWidth="5" />
          <path d="M345 30v90M310 75h70" stroke="#fff" strokeWidth="3" />
          <path d="M310 120L250 200h70l40-80z" fill="#fef9c3" opacity="0.45" />
          <rect x="20" y="40" width="60" height="70" rx="6" fill="#fde68a" stroke="#d97706" strokeWidth="3" />
          <circle cx="50" cy="75" r="18" fill="#fff" stroke="#d97706" strokeWidth="3" /><path d="M50 75V63M50 75l8 4" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
      break;
    case "bg-sakura":
      body = (
        <g>
          <path d="M150 200q50-80 100 0z" fill="#fde7f3" />
          {[[40, 0.9], [360, 1], [120, 0.7], [290, 0.75]].map(([x, k]) => (
            <g key={x} transform={`translate(${x} 200) scale(${k})`}>
              <path d="M-6 0c2-40 0-70-4-90h20c-4 20-6 50-4 90z" fill="#7c4a2a" />
              <g fill="#f9a8d4"><circle cx="0" cy="-110" r="40" /><circle cx="-34" cy="-90" r="30" /><circle cx="34" cy="-92" r="30" /></g>
              <g fill="#fbcfe8"><circle cx="-10" cy="-120" r="20" /><circle cx="20" cy="-100" r="16" /></g>
            </g>
          ))}
          {[[200, 40], [230, 90], [170, 120], [260, 140], [100, 60]].map(([x, y]) => (
            <ellipse key={x} cx={x} cy={y} rx="4" ry="2.6" fill="#f472b6" transform={`rotate(30 ${x} ${y})`} />
          ))}
        </g>
      );
      break;
    case "bg-neon":
      body = (
        <g>
          {stars(18, "#e9d5ff")}
          {[[0, 90, 60], [56, 60, 50], [104, 110, 44], [150, 70, 60], [212, 120, 40], [254, 50, 58], [314, 100, 46], [362, 80, 40]].map(([x, h, w]) => (
            <g key={x}>
              <rect x={x} y={200 - h - 40} width={w} height={h + 40} fill="#1e1b4b" stroke="#4c1d95" strokeWidth="1.5" />
              {Array.from({ length: Math.floor(h / 18) }, (_, r) =>
                Array.from({ length: Math.floor(w / 14) }, (_, c) => (
                  <rect key={`${r}-${c}`} x={x + 5 + c * 14} y={200 - h - 32 + r * 18} width="6" height="8" fill={(r + c + x) % 3 ? "#fde68a" : "#22d3ee"} opacity={(r * c + x) % 4 ? 0.85 : 0.25} />
                )),
              )}
            </g>
          ))}
          <rect x="160" y="40" width="70" height="20" rx="10" fill="none" stroke="#f472b6" strokeWidth="3" />
          <rect x="268" y="56" width="44" height="14" rx="7" fill="none" stroke="#22d3ee" strokeWidth="3" />
        </g>
      );
      break;
    case "bg-forest":
      body = (
        <g>
          {[[20, 1.2], [90, 0.9], [330, 1.1], [380, 0.8], [260, 0.7], [150, 0.6]].map(([x, k]) => (
            <path key={x} transform={`translate(${x} 200) scale(${k})`} d="M-6 0v-30h12v30zM0-150l40 70H22l30 50H-52l30-50H-40z" fill="#022c22" opacity="0.85" />
          ))}
          <path d="M0 185q200-25 400 0v15H0z" fill="#065f46" />
          {[[120, 180], [290, 178]].map(([x, y]) => (
            <g key={x}><path d={`M${x - 10} ${y}q10-18 20 0z`} fill="#a78bfa" /><rect x={x - 2} y={y} width="4" height="8" fill="#ecfccb" /></g>
          ))}
          {[[60, 80], [140, 50], [210, 100], [250, 40], [320, 70], [180, 150], [100, 130], [360, 140]].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2.6" fill="#fef08a" opacity="0.9" />
          ))}
        </g>
      );
      break;
    case "bg-galaxy":
      body = (
        <g>
          {stars(40)}
          <circle cx="320" cy="60" r="26" fill="#f472b6" opacity="0.85" /><ellipse cx="320" cy="60" rx="44" ry="9" fill="none" stroke="#fde68a" strokeWidth="3" opacity="0.8" />
          <circle cx="70" cy="140" r="10" fill="#93c5fd" opacity="0.8" />
        </g>
      );
      break;
    case "bg-gold":
      body = (
        <g opacity="0.55">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M200 220L190 -40h20z" fill="#fff" transform={`rotate(${i * 30 - 165} 200 220)`} />
          ))}
        </g>
      );
      break;
    default:
      body = clouds("#ffffff", [50, 90]);
  }

  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className={cn("block h-full w-full select-none", className)} aria-hidden data-scene={item?.id ?? "none"}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id}-sky)`} />
      {body}
    </svg>
  );
}
