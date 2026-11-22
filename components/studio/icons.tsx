/**
 * Icon theo đúng nét SVG trong canvas thiết kế của thầy (artboard Tiệm quà / Hồ sơ) — không dùng bộ icon khác.
 * Nét: stroke currentColor, viewBox 24, bo tròn.
 */
type P = { size?: number; className?: string; strokeWidth?: number };
const base = (size: number, sw: number, className?: string) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className,
});

export const IconEye = ({ size = 16, className, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth, className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconHeart = ({ size = 16, className, filled }: P & { filled?: boolean }) => (
  <svg {...base(size, 2, className)} fill={filled ? "#E0245E" : "none"} stroke={filled ? "#E0245E" : "currentColor"}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>
);
export const IconPlus = ({ size = 16, className }: P) => (
  <svg {...base(size, 2.2, className)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconHelp = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01" /></svg>
);
export const IconSave = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
);
export const IconHistory = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
);
export const IconUndo = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></svg>
);
export const IconLogout = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
);
export const IconCode = ({ size = 16, className }: P) => (
  <svg {...base(size, 2, className)}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h4M7 14h2M15 10v4" /></svg>
);
export const IconCheck = ({ size = 18, className, strokeWidth = 2.4 }: P) => (
  <svg {...base(size, strokeWidth, className)}><path d="M5 12l5 5L20 7" /></svg>
);
export const IconInfo = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconAlert = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
);
export const IconLock = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconTrophy = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" /></svg>
);
export const IconMenu = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconGift = ({ size = 18, className }: P) => (
  <svg {...base(size, 2, className)}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1" /></svg>
);

/** Đồng xu (vòng vàng viền cam) và kim cương — đúng như canvas */
export const Coin = ({ size = 14, border = 2, className }: { size?: number; border?: number; className?: string }) => (
  <span aria-hidden className={className} style={{ display: "inline-block", flex: "none", width: size, height: size, borderRadius: 999, background: "#F5B82E", border: `${border}px solid #D8961B`, boxSizing: "border-box" }} />
);
export const Gem = ({ size = 26, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} style={{ flex: "none" }}>
    <path d="M6 3h12l4 6-10 12L2 9z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M2 9h20M9 3l3 18M15 3l-3 18" stroke="#1D4ED8" strokeWidth="1" fill="none" />
  </svg>
);
/** Kim cương nhỏ trong dòng giá (hình thoi xoay 45°, như canvas) */
export const GemSmall = ({ size = 14 }: { size?: number }) => (
  <span aria-hidden style={{ display: "inline-block", flex: "none", width: size, height: size, background: "#60A5FA", border: "2px solid #1D4ED8", boxSizing: "border-box", transform: "rotate(45deg) scale(0.8)", borderRadius: 3 }} />
);
