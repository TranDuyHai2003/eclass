import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";

const COAT: Record<string, { body: string; dark: string; belly: string; crown?: boolean; patches?: boolean; stripes?: boolean }> = {
  tabby: { body: "#b9a58a", dark: "#6b5a44", belly: "#f5ebdc", stripes: true },
  orange: { body: "#f4a94a", dark: "#b86d12", belly: "#fde7c4", stripes: true },
  calico: { body: "#fff7ea", dark: "#5b3d1e", belly: "#fff7ea", patches: true },
  black: { body: "#3b3540", dark: "#1f1b24", belly: "#5b5464" },
  snow: { body: "#ffffff", dark: "#8d7b6a", belly: "#fff", crown: true },
};

/** Thú cưng (ô "pet") — SVG thuần: mèo 5 bộ lông + các loài khác (SPECIES); vẽ theo itemId */
export function PetSvg({ itemId, size = 96, className }: { itemId: string; size?: number; className?: string }) {
  const item = ITEM_BY_ID[itemId];
  const Species = SPECIES[item?.v ?? ""];
  if (Species)
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={cn("select-none", className)} role="img" aria-label={item?.name ?? "Thú cưng"}>
        <ellipse cx="50" cy="93" rx="24" ry="4" fill="#0f172a" opacity="0.1" />
        <Species />
      </svg>
    );
  const c = COAT[item?.v ?? "tabby"] ?? COAT.tabby;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cn("select-none", className)} role="img" aria-label={item?.name ?? "Mèo cưng"}>
      <ellipse cx="50" cy="92" rx="26" ry="4" fill="#0f172a" opacity="0.1" />
      {/* đuôi */}
      <path d="M74 70c12-2 16-12 10-20" fill="none" stroke={c.dark} strokeWidth="6" strokeLinecap="round" />
      {/* thân */}
      <ellipse cx="50" cy="70" rx="24" ry="20" fill={c.body} stroke={c.dark} strokeWidth="2.5" />
      <ellipse cx="50" cy="75" rx="13" ry="11" fill={c.belly} opacity="0.9" />
      {c.stripes && (
        <g stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" opacity="0.7">
          <path d="M34 62l6 2M66 62l-6 2M36 72l5 1M64 72l-5 1" />
        </g>
      )}
      {c.patches && (
        <g>
          <path d="M30 62c4-8 12-8 14 0-4 4-10 4-14 0z" fill="#f4a94a" />
          <path d="M60 60c4-6 10-5 12 2-4 3-9 2-12-2z" fill="#4b3a2a" />
        </g>
      )}
      {/* chân */}
      <ellipse cx="38" cy="88" rx="7" ry="4" fill={c.body} stroke={c.dark} strokeWidth="2" />
      <ellipse cx="62" cy="88" rx="7" ry="4" fill={c.body} stroke={c.dark} strokeWidth="2" />
      {/* đầu */}
      <path d="M26 30l6-14 10 10zM74 30l-6-14-10 10z" fill={c.body} stroke={c.dark} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M31 28l3-7 5 5zM69 28l-3-7-5 5z" fill="#fda4af" />
      <ellipse cx="50" cy="40" rx="25" ry="21" fill={c.body} stroke={c.dark} strokeWidth="2.5" />
      {c.patches && <path d="M28 36c6-10 16-8 18 2-6 4-12 3-18-2z" fill="#4b3a2a" />}
      {c.stripes && <path d="M44 22l2 6M50 21v6M56 22l-2 6" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />}
      {/* mắt */}
      <ellipse cx="41" cy="40" rx="3.2" ry="4.2" fill="#1e293b" />
      <ellipse cx="59" cy="40" rx="3.2" ry="4.2" fill="#1e293b" />
      <circle cx="42.3" cy="38.3" r="1.1" fill="#fff" /><circle cx="60.3" cy="38.3" r="1.1" fill="#fff" />
      {/* má, mũi, miệng, ria */}
      <ellipse cx="34" cy="47" rx="4" ry="2.4" fill="#fb7185" opacity="0.5" /><ellipse cx="66" cy="47" rx="4" ry="2.4" fill="#fb7185" opacity="0.5" />
      <path d="M48 47l2 2 2-2z" fill="#f472b6" />
      <path d="M50 49c0 3-3 4-5 3M50 49c0 3 3 4 5 3" fill="none" stroke={c.dark} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 44l12 1M22 50l12-1M78 44l-12 1M78 50l-12-1" stroke={c.dark} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
      {/* vòng cổ */}
      <path d="M32 57c8 6 28 6 36 0" fill="none" stroke="#e11d48" strokeWidth="3" />
      <circle cx="50" cy="60" r="3" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
      {c.crown && (
        <path d="M36 20l6 8 8-12 8 12 6-8-3 14H39z" fill="#fbbf24" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ============================== Các loài khác (GĐ8) ============================== */

const L = "#3b2a1e";
/** Mắt to long lanh dùng chung */
function Eyes({ y = 44, dx = 9, cx = 50, r = 4.2, color = "#1e293b" }: { y?: number; dx?: number; cx?: number; r?: number; color?: string }) {
  return (
    <g>
      <ellipse cx={cx - dx} cy={y} rx={r} ry={r * 1.2} fill={color} /><ellipse cx={cx + dx} cy={y} rx={r} ry={r * 1.2} fill={color} />
      <circle cx={cx - dx + 1.4} cy={y - 1.8} r={r * 0.38} fill="#fff" /><circle cx={cx + dx + 1.4} cy={y - 1.8} r={r * 0.38} fill="#fff" />
      <circle cx={cx - dx - 1.2} cy={y + 1.6} r={r * 0.18} fill="#fff" /><circle cx={cx + dx - 1.2} cy={y + 1.6} r={r * 0.18} fill="#fff" />
    </g>
  );
}
function Blush({ y = 52, dx = 16, cx = 50 }: { y?: number; dx?: number; cx?: number }) {
  return (
    <g fill="#fb7185" opacity="0.5">
      <ellipse cx={cx - dx} cy={y} rx="4" ry="2.4" /><ellipse cx={cx + dx} cy={y} rx="4" ry="2.4" />
    </g>
  );
}

const SPECIES: Record<string, () => React.ReactElement> = {
  slime: () => (
    <g>
      <defs>
        <radialGradient id="slime-g" cx="40%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff7c2" /><stop offset="55%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#f59e0b" /></radialGradient>
      </defs>
      <path d="M14 86c-4-30 14-58 36-58s40 28 36 58c-8 4-20 6-36 6s-28-2-36-6z" fill="url(#slime-g)" stroke="#b45309" strokeWidth="2.5" />
      <ellipse cx="34" cy="44" rx="7" ry="4" fill="#fff" opacity="0.8" transform="rotate(-30 34 44)" />
      <Eyes y={62} dx={11} />
      <Blush y={70} dx={20} />
      <path d="M45 72q5 5 10 0" fill="none" stroke={L} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 30l4-10 6 7 6-7 4 10z" fill="#fde047" stroke="#b45309" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M84 30l2 4 4 1-4 1-2 4-2-4-4-1 4-1z" fill="#fff" />
    </g>
  ),
  bunny: () => (
    <g stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 84c0-8 8-12 14-10 2-8 14-10 18-4 6-6 18-4 20 4 8-2 16 2 16 10z" fill="#e0f2fe" stroke="#7dd3fc" />
      <path d="M36 34c-6-14-4-28 2-30 6 0 8 14 6 30z" fill="#fff" /><path d="M64 34c6-14 4-28-2-30-6 0-8 14-6 30z" fill="#fff" />
      <path d="M38 30c-3-9-2-18 1-20 3 1 4 10 3 20zM62 30c3-9 2-18-1-20-3 1-4 10-3 20z" fill="#fbcfe8" stroke="none" />
      <ellipse cx="50" cy="66" rx="20" ry="16" fill="#fff" />
      <ellipse cx="50" cy="46" rx="19" ry="16" fill="#fff" />
      <Eyes y={45} dx={8} r={3.6} color="#7c3aed" />
      <Blush y={52} dx={13} />
      <path d="M48 51l2 2 2-2M50 53c0 2-2 3-3 2M50 53c0 2 2 3 3 2" fill="none" stroke={L} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  shiba: () => (
    <g stroke="#7c2d12" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M72 66c14-2 16-16 8-22 0 8-4 12-10 12" fill="#f59e0b" />
      <ellipse cx="50" cy="70" rx="22" ry="18" fill="#f59e0b" />
      <ellipse cx="50" cy="76" rx="12" ry="10" fill="#fff7ed" stroke="none" />
      <path d="M26 30l4-16 12 10zM74 30l-4-16-12 10z" fill="#f59e0b" />
      <path d="M30 26l2-8 6 5zM70 26l-2-8-6 5z" fill="#fde68a" stroke="none" />
      <ellipse cx="50" cy="42" rx="25" ry="20" fill="#f59e0b" />
      <path d="M30 48c4 10 12 14 20 14s16-4 20-14c-6-4-14-6-20-6s-14 2-20 6z" fill="#fff7ed" stroke="none" />
      <Eyes y={40} dx={10} r={3.6} />
      <ellipse cx="50" cy="49" rx="3.4" ry="2.4" fill={L} stroke="none" />
      <path d="M50 51c0 3-3 4-5 3M50 51c0 3 3 4 5 3" fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <Blush y={52} dx={17} />
      <path d="M33 60c8 5 26 5 34 0" fill="none" stroke="#2563eb" strokeWidth="3" />
    </g>
  ),
  owl: () => (
    <g stroke="#451a03" strokeWidth="2" strokeLinejoin="round">
      <rect x="22" y="80" width="56" height="10" rx="2" fill="#dc2626" />
      <path d="M24 82h52" stroke="#fef3c7" strokeWidth="1.6" />
      <ellipse cx="50" cy="56" rx="26" ry="28" fill="#a16207" />
      <ellipse cx="50" cy="64" rx="16" ry="16" fill="#fde68a" stroke="none" />
      <path d="M42 62l2 3M50 66l2 3M58 62l2 3M46 72l2 3M54 72l2 3" stroke="#a16207" strokeWidth="1.4" />
      <circle cx="40" cy="46" r="10" fill="#fff" /><circle cx="60" cy="46" r="10" fill="#fff" />
      <Eyes y={46} dx={10} r={4.6} color="#78350f" />
      <g fill="none" stroke="#1e293b" strokeWidth="1.8"><circle cx="40" cy="46" r="10.5" /><circle cx="60" cy="46" r="10.5" /><path d="M50.5 46h-1" /></g>
      <path d="M47 55l3 5 3-5z" fill="#f59e0b" />
      <path d="M30 26l40 0-20-9z" fill="#1e293b" />
      <rect x="40" y="25" width="20" height="6" fill="#1e293b" />
      <path d="M70 26v10" stroke="#facc15" strokeWidth="1.8" /><circle cx="70" cy="37" r="2" fill="#facc15" stroke="none" />
    </g>
  ),
  dragon: () => (
    <g stroke="#3b0764" strokeWidth="2" strokeLinejoin="round">
      <path d="M30 56C12 44 10 30 16 26c4 8 10 10 16 12zM70 56c18-12 20-26 14-30-4 8-10 10-16 12z" fill="#c4b5fd" />
      <path d="M68 76c14 2 20-6 18-14l-6 6" fill="#8b5cf6" />
      <ellipse cx="50" cy="70" rx="20" ry="17" fill="#8b5cf6" />
      <ellipse cx="50" cy="75" rx="11" ry="10" fill="#ede9fe" stroke="none" />
      <path d="M36 28l-4-12 10 8zM64 28l4-12-10 8z" fill="#fde047" />
      <ellipse cx="50" cy="42" rx="23" ry="19" fill="#8b5cf6" />
      <Eyes y={42} dx={9} r={4} color="#facc15" />
      <ellipse cx="41" cy="42.5" rx="1.4" ry="3.6" fill="#1e1b4b" stroke="none" /><ellipse cx="59" cy="42.5" rx="1.4" ry="3.6" fill="#1e1b4b" stroke="none" />
      <path d="M44 52q6 4 12 0" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <Blush y={50} dx={16} />
      <path d="M82 14l-6 9h5l-4 8 9-11h-5l4-6z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.2" />
    </g>
  ),
  robot: () => (
    <g stroke="#1e3a8a" strokeWidth="2" strokeLinejoin="round">
      <path d="M50 18v-8" /><circle cx="50" cy="8" r="3.6" fill="#f472b6" />
      <rect x="34" y="62" width="32" height="22" rx="8" fill="#e0e7ff" />
      <circle cx="50" cy="73" r="4" fill="#22d3ee" />
      <rect x="22" y="18" width="56" height="44" rx="16" fill="#f8fafc" />
      <rect x="28" y="26" width="44" height="28" rx="11" fill="#0f172a" />
      <path d="M36 40q4-6 8 0M56 40q4-6 8 0" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 46q5 4 10 0" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
      <rect x="15" y="32" width="7" height="16" rx="3.5" fill="#60a5fa" /><rect x="78" y="32" width="7" height="16" rx="3.5" fill="#60a5fa" />
      <path d="M30 88q20 6 40 0" fill="none" stroke="#a5f3fc" strokeWidth="2.4" opacity="0.8" />
    </g>
  ),
  phoenix: () => (
    <g stroke="#7c2d12" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M50 70c-6 10-18 16-30 14 8-2 12-8 14-14-8 4-16 2-22-4 10 0 18-4 22-10z" fill="#fb923c" />
      <path d="M50 70c6 10 18 16 30 14-8-2-12-8-14-14 8 4 16 2 22-4-10 0-18-4-22-10z" fill="#fb923c" />
      <path d="M50 72c-4 8-4 14 0 20 4-6 4-12 0-20z" fill="#fde047" />
      <path d="M26 50C14 40 14 28 20 24c2 10 10 14 16 16zM74 50c12-10 12-22 6-26-2 10-10 14-16 16z" fill="#ef4444" />
      <ellipse cx="50" cy="56" rx="17" ry="18" fill="#f97316" />
      <circle cx="50" cy="38" r="15" fill="#f97316" />
      <path d="M50 24c-2-8 2-14 6-16-1 5 2 6 4 4 0 6-4 10-10 12zM44 25c-4-6-3-12 0-14 0 4 2 6 4 6" fill="#fde047" />
      <Eyes y={37} dx={6.4} r={3} />
      <path d="M47 43l3 5 3-5z" fill="#facc15" />
      <Blush y={44} dx={11} />
    </g>
  ),
};
