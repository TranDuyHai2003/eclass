import { ITEM_BY_ID } from "@/lib/game/items";
import { cn } from "@/lib/utils";

const COAT: Record<string, { body: string; dark: string; belly: string; crown?: boolean; patches?: boolean; stripes?: boolean }> = {
  tabby: { body: "#b9a58a", dark: "#6b5a44", belly: "#f5ebdc", stripes: true },
  orange: { body: "#f4a94a", dark: "#b86d12", belly: "#fde7c4", stripes: true },
  calico: { body: "#fff7ea", dark: "#5b3d1e", belly: "#fff7ea", patches: true },
  black: { body: "#3b3540", dark: "#1f1b24", belly: "#5b5464" },
  snow: { body: "#ffffff", dark: "#8d7b6a", belly: "#fff", crown: true },
};

/** Mèo cưng (ô "pet") — SVG thuần, 5 bộ lông; vẽ theo itemId */
export function PetSvg({ itemId, size = 96, className }: { itemId: string; size?: number; className?: string }) {
  const item = ITEM_BY_ID[itemId];
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
