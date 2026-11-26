import { useId } from "react";

/**
 * Trang trí thẻ Hộp bí ẩn theo mẫu thầy gửi 26/11/2026: khung tối viền kim loại có hoa văn góc, ruy băng tên,
 * vòng phép dưới rương, vòng quỹ đạo (VIP), viên đá độ hiếm, nút cầu nguyện có lông vũ. Vẽ SVG (nhẹ, sắc nét mọi cỡ).
 */
export type ChestTone = "gold" | "lilac";

const METAL: Record<ChestTone, [string, string, string]> = {
  gold: ["#fff1c2", "#d9a441", "#8a5a1c"],
  lilac: ["#f5f3ff", "#b9b0ec", "#6d5fb8"],
};

/** Hoa văn 4 góc + viền kép + hạt kim cương giữa hai cạnh bên, phủ toàn thẻ (HTML định vị, SVG nhỏ cho từng góc) */
export function CardOrnaments({ tone }: { tone: ChestTone }) {
  const id = useId().replace(/:/g, "");
  const [hi, mid, lo] = METAL[tone];
  const grad = (
    <defs>
      <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={hi} />
        <stop offset="55%" stopColor={mid} />
        <stop offset="100%" stopColor={lo} />
      </linearGradient>
    </defs>
  );
  const corner = (pos: string) => (
    <svg viewBox="0 0 70 70" className={`cx-corner ${pos}`}>
      {grad}
      <g fill="none" stroke={`url(#${id}m)`} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 64V16Q3 3 16 3H64" strokeWidth="2.4" />
        <path d="M10 54V20Q10 10 20 10H54" strokeWidth="1.1" opacity="0.8" />
        <path d="M3 36c9 0 13-7 8-11-4-3-9 1-6 5 2 2 5 1 5-1" strokeWidth="1.6" />
        <path d="M36 3c0 9-7 13-11 8-3-4 1-9 5-6 2 2 1 5-1 5" strokeWidth="1.6" />
        <path d="M20 20c6 0 10 4 10 10" strokeWidth="1.2" opacity="0.7" />
        <path d="M14 6l6 6-6 6-6-6z" fill={`url(#${id}m)`} strokeWidth="1" stroke={lo} />
      </g>
    </svg>
  );
  return (
    <span aria-hidden className="cx-ornaments" style={{ "--cx-metal": mid, "--cx-metal-lo": lo } as React.CSSProperties}>
      <span className="cx-border" />
      {corner("tl")}
      {corner("tr")}
      {corner("bl")}
      {corner("br")}
      {["l", "r"].map((side) => (
        <svg key={side} viewBox="0 0 12 20" className={`cx-edge-gem ${side}`}>
          <path d="M6 1l5 9-5 9-5-9z" fill={mid} stroke={lo} strokeWidth="1" />
          <path d="M6 1 3.5 10h5z" fill="#fff" opacity="0.4" />
        </svg>
      ))}
    </span>
  );
}

/** Ruy băng tên hộp: dải giữa + hai đuôi gấp */
export function Ribbon({ tone, children }: { tone: ChestTone; children: React.ReactNode }) {
  const id = useId().replace(/:/g, "");
  const [hi, mid, lo] = tone === "gold" ? ["#fff4c4", "#f3c75a", "#a8741f"] : ["#f4f0ff", "#c4b5fd", "#7a68c9"];
  return (
    <div className="cx-ribbon" data-tone={tone}>
      <svg aria-hidden viewBox="0 0 320 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hi} />
            <stop offset="55%" stopColor={mid} />
            <stop offset="100%" stopColor={lo} />
          </linearGradient>
        </defs>
        {/* đuôi gấp hai bên (phía sau) */}
        <path d="M0 20h40v40H0l12-20z" fill={lo} />
        <path d="M320 20h-40v40h40l-12-20z" fill={lo} />
        <path d="M28 52l12 8V48z M292 52l-12 8V48z" fill="#000" opacity="0.35" />
        {/* dải chính */}
        <path d="M24 6h272l-4 22 4 22H24l4-22z" fill={`url(#${id}b)`} stroke={lo} strokeWidth="2" strokeLinejoin="round" />
        <path d="M34 12h252" stroke="#fff" strokeWidth="2" opacity="0.45" strokeLinecap="round" />
      </svg>
      <span className="relative">{children}</span>
    </div>
  );
}

/** Vòng phép nằm dưới rương (nghiêng phối cảnh, xoay chậm) */
export function MagicCircle({ tone }: { tone: ChestTone }) {
  const c = tone === "gold" ? "#fcd34d" : "#e9d5ff";
  const star = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(100 + 62 * Math.cos(a)).toFixed(1)},${(100 + 62 * Math.sin(a)).toFixed(1)}`;
  });
  return (
    <span aria-hidden className="cx-circle" style={{ color: c }}>
      <svg viewBox="0 0 200 200" className="cx-circle-spin">
        <g fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="96" strokeWidth="2" opacity="0.9" />
          <circle cx="100" cy="100" r="86" strokeWidth="5" strokeDasharray="2 7" opacity="0.7" />
          <circle cx="100" cy="100" r="76" strokeWidth="1.2" opacity="0.8" />
          <polygon points={[star[0], star[2], star[4]].join(" ")} strokeWidth="1.4" opacity="0.75" />
          <polygon points={[star[1], star[3], star[5]].join(" ")} strokeWidth="1.4" opacity="0.75" />
          <circle cx="100" cy="100" r="40" strokeWidth="1.2" opacity="0.6" />
        </g>
        {star.map((p) => {
          const [x, y] = p.split(",");
          return <circle key={p} cx={x} cy={y} r="3.2" fill="currentColor" />;
        })}
      </svg>
    </span>
  );
}

/** Ngôi sao lấp lánh 4 cánh */
export function Twinkle({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} style={style}>
      <path d="M10 0c.8 5.2 4 8.6 10 10-6 1.4-9.2 4.8-10 10-.8-5.2-4-8.6-10-10C6 8.6 9.2 5.2 10 0z" fill="currentColor" />
    </svg>
  );
}

/** Viên đá độ hiếm (cắt giác) */
export function RarityGem({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-[14px] w-[14px] shrink-0 drop-shadow-[0_0_4px_currentColor]" style={{ color }}>
      <path d="M8 1l6 7-6 7-6-7z" fill="currentColor" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      <path d="M8 1L5 8h6zM2 8h12" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** Lông vũ trên nút Cầu nguyện */
export function Feather() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
      <path d="M20 3C11 4 6 10 5 18l2-1c1-5 4-9 9-12-4 4-6 8-7 12 6-1 10-6 11-14z" fill="#dbeafe" stroke="#1e3a8a" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 18 3 22" stroke="#1e3a8a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 16c2-3 5-7 9-10" stroke="#60a5fa" strokeWidth="1" fill="none" />
    </svg>
  );
}
