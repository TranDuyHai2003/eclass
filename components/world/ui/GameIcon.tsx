"use client";
/**
 * Game-style icon badge: vector icon (lucide) inside a glossy gradient disc with a halo ring —
 * bright, clean anime-game UI look. No emoji anywhere in the world UI.
 */
import type { LucideIcon } from "lucide-react";

const TONES = {
  gold: "from-amber-200 via-amber-300 to-orange-400 text-amber-950 shadow-[0_0_14px_rgba(255,200,90,.75)]",
  sky: "from-sky-100 via-sky-300 to-indigo-400 text-indigo-950 shadow-[0_0_14px_rgba(120,200,255,.75)]",
  pink: "from-pink-100 via-pink-300 to-fuchsia-400 text-fuchsia-950 shadow-[0_0_14px_rgba(255,140,200,.75)]",
  white: "from-white via-slate-50 to-slate-200 text-indigo-900 shadow-[0_2px_10px_rgba(30,27,75,.25)]",
  mint: "from-emerald-100 via-emerald-300 to-teal-400 text-emerald-950 shadow-[0_0_14px_rgba(90,209,168,.75)]",
} as const;

export function GameIcon({ icon: Icon, tone = "white", size = 32, className = "" }: { icon: LucideIcon; tone?: keyof typeof TONES; size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-white/80 ${TONES[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Vệt bóng kính phía trên */}
      <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/70 to-transparent" />
      <Icon className="relative" size={Math.round(size * 0.55)} strokeWidth={2.4} />
    </span>
  );
}
