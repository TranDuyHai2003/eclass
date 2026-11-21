import { ITEM_BY_ID } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { cn } from "@/lib/utils";

/**
 * Nhân vật chibi — SVG thuần theo cấu hình (không ảnh ngoài, không ngẫu nhiên → HTML server/client khớp).
 * Thứ tự vẽ: nền → khung → tóc sau → thân/áo → đầu → mặt → tóc trước → phụ kiện.
 */
export function Chibi({ config, size = 120, className, title }: { config: AvatarConfig; size?: number; className?: string; title?: string }) {
  const get = (slot: keyof AvatarConfig) => (config[slot] ? ITEM_BY_ID[config[slot] as string] : undefined);
  const skin = get("skin")?.v ?? "#fde7d2";
  const hair = get("hair")?.v ?? "short";
  const hairColor = get("hairColor")?.v ?? "#1f2937";
  const eye = get("eyes")?.v ?? "#4b2e1e";
  const outfit = get("outfit");
  const shirt = outfit?.v ?? "#60a5fa";
  const shirtAccent = outfit?.v2 ?? "#1e3a8a";
  const acc = get("accessory")?.v;
  const frame = get("frame")?.v;
  const bg = get("background");
  const uid = `c${Math.abs(hashStr(JSON.stringify(config)))}`; // id gradient riêng khi nhiều nhân vật trên một trang

  return (
    <svg viewBox="0 0 120 140" width={size} height={size * (140 / 120)} className={cn("select-none", className)} role="img" aria-label={title ?? "Nhân vật"}>
      <defs>
        <linearGradient id={`${uid}-hairRainbow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="65%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg?.v ?? "#eff6ff"} />
          <stop offset="100%" stopColor={bg?.v2 ?? "#dbeafe"} />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={`${uid}-rainbowFrame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* Nền */}
      {bg && <rect x="4" y="4" width="112" height="132" rx="26" fill={`url(#${uid}-bg)`} />}
      {bg?.id === "bg-galaxy" && (
        <g fill="#fff" opacity="0.8">
          <circle cx="24" cy="22" r="1.5" /><circle cx="92" cy="30" r="1.2" /><circle cx="100" cy="100" r="1.6" /><circle cx="18" cy="110" r="1.1" /><circle cx="60" cy="12" r="1" />
        </g>
      )}

      {/* Khung */}
      {frame && (
        <rect
          x="4" y="4" width="112" height="132" rx="26" fill="none" strokeWidth="5"
          stroke={frame === "gold" ? `url(#${uid}-gold)` : frame === "rainbow" ? `url(#${uid}-rainbowFrame)` : frame}
        />
      )}
      {frame === "gold" && (
        <g fill="#fbbf24">
          <path d="M60 2l2.5 5 5 .7-3.7 3.5.9 5.2L60 14l-4.7 2.4.9-5.2L52.5 7.7l5-.7z" />
          <circle cx="12" cy="128" r="2.2" /><circle cx="108" cy="128" r="2.2" />
        </g>
      )}
      {frame === "rainbow" && (
        <g fill="#fff" opacity="0.9">
          <ellipse cx="22" cy="16" rx="9" ry="4.5" /><ellipse cx="98" cy="124" rx="9" ry="4.5" />
        </g>
      )}

      {/* Vòng hào quang (vẽ trước đầu) */}
      {acc === "halo" && <ellipse cx="60" cy="14" rx="20" ry="5" fill="none" stroke="#fbbf24" strokeWidth="3.5" />}

      {/* Tóc sau */}
      <g fill={hairColor === "url(#hairRainbow)" ? `url(#${uid}-hairRainbow)` : hairColor}>
        {hair === "ponytail" && <path d="M88 56c10 10 12 30 4 46-4-10-6-26-10-36z" />}
        {hair === "long" && <path d="M26 60c-4 22-2 40 6 52h56c8-12 10-30 6-52z" />}
        {hair === "twin" && (
          <>
            <path d="M24 58c-8 14-8 30-2 44 4-12 6-30 12-42z" />
            <path d="M96 58c8 14 8 30 2 44-4-12-6-30-12-42z" />
          </>
        )}
        {hair === "bob" && <path d="M24 52c-2 18 2 32 10 40h52c8-8 12-22 10-40z" />}
      </g>

      {/* Thân + áo */}
      <path d="M38 96c0-10 10-16 22-16s22 6 22 16v22c0 6-4 10-10 10H48c-6 0-10-4-10-10z" fill={shirt} />
      <path d="M50 82l10 12 10-12" fill="none" stroke={shirtAccent} strokeWidth="3" strokeLinecap="round" />
      {outfit?.id === "outfit-uniform" && <path d="M56 92h8v26h-8z" fill={shirtAccent} opacity="0.9" />}
      {outfit?.id === "outfit-hoodie" && <path d="M44 96c4-8 28-8 32 0" fill="none" stroke={shirtAccent} strokeWidth="3" />}
      {outfit?.id === "outfit-royal" && <path d="M44 108h32M46 116h28" stroke={shirtAccent} strokeWidth="2.5" strokeLinecap="round" />}
      {outfit?.id === "outfit-astro" && <circle cx="60" cy="106" r="7" fill="none" stroke={shirtAccent} strokeWidth="3" />}
      {outfit?.id === "outfit-ninja" && <path d="M40 100h40" stroke={shirtAccent} strokeWidth="4" strokeLinecap="round" />}
      {outfit?.id === "outfit-scientist" && <path d="M52 84v36M68 84v36" stroke={shirtAccent} strokeWidth="2" />}
      {outfit?.id === "outfit-sport" && <path d="M40 104h40" stroke={shirtAccent} strokeWidth="3" strokeLinecap="round" opacity="0.8" />}
      {outfit?.id === "outfit-dress" && (
        <g fill={shirtAccent}><circle cx="50" cy="104" r="2" /><circle cx="64" cy="112" r="2" /><circle cx="70" cy="100" r="2" /></g>
      )}
      {/* tay */}
      <circle cx="36" cy="112" r="6" fill={skin} /><circle cx="84" cy="112" r="6" fill={skin} />

      {/* Đầu */}
      <ellipse cx="60" cy="56" rx="34" ry="32" fill={skin} />
      <circle cx="26" cy="60" r="6" fill={skin} /><circle cx="94" cy="60" r="6" fill={skin} />
      {/* má hồng */}
      <ellipse cx="40" cy="68" rx="6" ry="3.5" fill="#fb7185" opacity="0.45" /><ellipse cx="80" cy="68" rx="6" ry="3.5" fill="#fb7185" opacity="0.45" />
      {/* mắt */}
      <ellipse cx="46" cy="60" rx="6" ry="8" fill="#fff" /><ellipse cx="74" cy="60" rx="6" ry="8" fill="#fff" />
      <ellipse cx="47" cy="61" rx="4.2" ry="6" fill={eye} /><ellipse cx="75" cy="61" rx="4.2" ry="6" fill={eye} />
      <circle cx="48.5" cy="58.5" r="1.6" fill="#fff" /><circle cx="76.5" cy="58.5" r="1.6" fill="#fff" />
      {/* miệng */}
      <path d="M54 76c3 4 9 4 12 0" fill="none" stroke="#9f1239" strokeWidth="2.2" strokeLinecap="round" />

      {/* Tóc trước */}
      <g fill={hairColor === "url(#hairRainbow)" ? `url(#${uid}-hairRainbow)` : hairColor}>
        {hair === "short" && <path d="M26 54c0-20 14-32 34-32s34 12 34 32c-6-10-14-14-20-10-6-6-12-8-18-4-8-6-18-4-24 6-4 2-5 5-6 8z" />}
        {hair === "bob" && <path d="M26 54c0-20 14-32 34-32s34 12 34 32c-8-8-18-12-28-6-10-6-20-6-30 4-4 1-7 2-10 2z" />}
        {hair === "ponytail" && <path d="M26 52c2-18 16-30 34-30s32 12 34 30c-10-8-20-10-30-4-10-6-22-6-30 2-4 1-6 1-8 2z" />}
        {hair === "spiky" && <path d="M26 54l4-24 10 14 8-22 10 18 8-20 8 20 10-14 2 28c-10-6-20-8-30-4-10-4-20-2-30 4z" />}
        {hair === "twin" && <path d="M26 54c0-20 14-32 34-32s34 12 34 32c-6-8-14-12-22-8-8-6-16-6-24 0-8-2-16 0-22 8z" />}
        {hair === "long" && <path d="M26 54c0-20 14-32 34-32s34 12 34 32c-6-10-12-14-20-10-6-6-12-6-16-2-8-6-18-4-26 4-2 2-4 5-6 8z" />}
        {hair === "bun" && (
          <>
            <circle cx="60" cy="24" r="11" />
            <path d="M26 54c0-18 14-28 34-28s34 10 34 28c-8-8-16-10-26-6-8-6-18-6-28 0-6 1-10 3-14 6z" />
          </>
        )}
        {hair === "mohawk" && <path d="M50 44c2-16 6-26 10-30 4 4 8 14 10 30-4-4-8-6-10-6s-6 2-10 6z" />}
      </g>

      {/* Phụ kiện */}
      {acc === "glasses" && (
        <g fill="none" stroke="#2563eb" strokeWidth="2.5">
          <circle cx="46" cy="61" r="9" /><circle cx="74" cy="61" r="9" /><path d="M55 61h10M37 58l-8-3M83 58l8-3" />
        </g>
      )}
      {acc === "cap" && (
        <g>
          <path d="M26 46c4-18 16-26 34-26s30 8 34 26c-10-6-22-8-34-8s-24 2-34 8z" fill="#ef4444" />
          <path d="M22 46h40c6 0 8 4 4 7-14 2-30 2-44 0-4-3-4-7 0-7z" fill="#b91c1c" />
        </g>
      )}
      {acc === "bow" && (
        <g fill="#ec4899">
          <path d="M80 30l14-8-2 10 2 10-14-8z" /><path d="M80 30l-14-8 2 10-2 10 14-8z" /><circle cx="80" cy="30" r="4" fill="#be185d" />
        </g>
      )}
      {acc === "headphones" && (
        <g fill="none" stroke="#111827" strokeWidth="4">
          <path d="M28 56c0-22 14-34 32-34s32 12 32 34" />
          <rect x="22" y="52" width="10" height="16" rx="4" fill="#111827" /><rect x="88" y="52" width="10" height="16" rx="4" fill="#111827" />
        </g>
      )}
      {acc === "crown" && (
        <path d="M38 30l8 10 14-18 14 18 8-10-4 20H42z" fill={`url(#${uid}-gold)`} stroke="#b45309" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
