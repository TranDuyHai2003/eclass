import { cn } from "@/lib/utils";

/** Hộp quà có huy hiệu mèo (mockup "Hộp Sao Mèo" đỏ / "Hộp Tinh Tú VIP" xanh) */
export function GiftBoxSvg({ tone = "red", size = 120, open = false, className }: { tone?: "red" | "blue"; size?: number; open?: boolean; className?: string }) {
  const c = tone === "red" ? { body: "#ef5a5a", dark: "#b23a3a", side: "#d84848", dots: "#ffd2d2" } : { body: "#4aa8ef", dark: "#1f6fb2", side: "#3a91d6", dots: "#d6ecff" };
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden className={cn("drop-shadow-[0_6px_0_rgba(0,0,0,.18)]", className)}>
      <ellipse cx="60" cy="110" rx="38" ry="6" fill="#000" opacity=".22" />
      {/* thân */}
      <path d="M20 54h80v44a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill={c.body} stroke="#3b2a14" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M86 54h14v44a6 6 0 0 1-6 6h-8z" fill={c.side} stroke="#3b2a14" strokeWidth="3.5" strokeLinejoin="round" />
      {[[30, 66], [40, 90], [74, 64], [80, 92], [30, 96]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill={c.dots} />)}
      {/* nắp */}
      <g className={cn("transition-transform duration-300", open && "-translate-y-3 -rotate-6")} style={{ transformOrigin: "60px 50px" }}>
        <path d="M14 40h92v16H14z" fill={c.body} stroke="#3b2a14" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M54 40h12v16H54z" fill="#ffd84d" stroke="#3b2a14" strokeWidth="3" />
        {/* nơ */}
        <path d="M60 40c-6-14-26-16-22-4 3 7 14 6 22 4zM60 40c6-14 26-16 22-4-3 7-14 6-22 4z" fill="#ffd84d" stroke="#3b2a14" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="60" cy="38" r="5" fill="#ffd84d" stroke="#3b2a14" strokeWidth="3" />
      </g>
      {/* dải ruy băng */}
      <path d="M54 56h12v48H54z" fill="#ffd84d" stroke="#3b2a14" strokeWidth="3" />
      {/* huy hiệu mèo */}
      <circle cx="60" cy="78" r="15" fill="#fffaf0" stroke="#3b2a14" strokeWidth="3" />
      <path d="M50 74l-2-9 7 5h10l7-5-2 9v6q0 8-10 8t-10-8z" fill="#ffd84d" stroke="#3b2a14" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="56" cy="77" r="1.5" fill="#3b2a14" /><circle cx="64" cy="77" r="1.5" fill="#3b2a14" />
      <path d="M57.5 81q2.5 2 5 0" stroke="#3b2a14" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
