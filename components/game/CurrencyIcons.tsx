"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Biểu tượng tiền của tiệm (vẽ SVG, viền mực như theme tiệm):
 * - Xu: đồng vàng có vành nổi, ngôi sao dập nổi, vệt bóng.
 * - Kim cương (ngọc): viên cắt giác, mặt trên sáng, mặt dưới đậm, điểm lấp lánh.
 * useId cho gradient riêng từng biểu tượng (gradient trùng id trong hộp đang ẩn sẽ không hiện trên Chrome).
 */
export function CoinIcon({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={cn("inline-block shrink-0 align-middle", className)} data-icon="coin">
      <defs>
        <linearGradient id={`${id}c`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fff7c2" />
          <stop offset="45%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#e09b12" />
        </linearGradient>
        <linearGradient id={`${id}i`} x1="0.8" y1="1" x2="0.2" y2="0">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12.6" r="10.4" fill="#b7791f" />
      <circle cx="12" cy="11.6" r="10.4" fill={`url(#${id}c)`} stroke="#241e1a" strokeWidth="1.5" />
      <circle cx="12" cy="11.6" r="7.3" fill={`url(#${id}i)`} stroke="#c2850c" strokeWidth="1.1" />
      <path d="M12 6.9l1.45 2.95 3.25.47-2.35 2.29.56 3.24L12 14.32l-2.91 1.53.56-3.24-2.35-2.29 3.25-.47z" fill="#fff7d6" stroke="#b45309" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M5.6 8.2a7.4 7.4 0 0 1 4.3-3.9" fill="none" stroke="#fffbea" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function GemIcon({ size = 18, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={cn("inline-block shrink-0 align-middle", className)} data-icon="gem">
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0fdff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* thân viên: mặt trên (crown) + mặt dưới (pavilion) */}
      <path d="M2.6 9.2 7 3.6h10l4.4 5.6L12 21.2z" fill={`url(#${id}b)`} stroke="#241e1a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.6 9.2 7 3.6h10l4.4 5.6z" fill={`url(#${id}t)`} />
      {/* các giác cắt */}
      <path d="M7 3.6 9.4 9.2 12 3.6l2.6 5.6L17 3.6M2.6 9.2h18.8M9.4 9.2 12 21.2l2.6-12" fill="none" stroke="#0c4a6e" strokeWidth="0.9" strokeLinejoin="round" opacity="0.75" />
      <path d="M2.6 9.2 7 3.6h10l4.4 5.6L12 21.2z" fill="none" stroke="#241e1a" strokeWidth="1.5" strokeLinejoin="round" />
      {/* lấp lánh */}
      <path d="M8.2 5.4 7.1 7.8" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
      <path d="M19.4 2.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#ffffff" stroke="#0c4a6e" strokeWidth="0.4" />
    </svg>
  );
}
