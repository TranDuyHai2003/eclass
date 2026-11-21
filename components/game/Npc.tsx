"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";

/** NPC Lucky Boy: nhắc học. Câu thoại truyền từ server (xác định), bấm để đổi câu kế tiếp. */
export function Npc({ lines, className, compact }: { lines: string[]; className?: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  const line = lines.length ? lines[i % lines.length] : "";
  return (
    <button
      type="button"
      data-testid="npc"
      onClick={() => { play("tick"); setI((x) => x + 1); }}
      title="Bấm để nghe Lucky Boy nói tiếp"
      className={cn("group flex w-full items-end gap-2 text-left", className)}
    >
      <LuckyBoySvg className={cn("shrink-0 animate-float", compact ? "h-14 w-12" : "h-16 w-14 sm:h-20 sm:w-16")} />
      <span className="relative mb-2 min-w-0 flex-1 break-words rounded-2xl rounded-bl-sm border-2 border-sky-200 bg-white px-3 py-2 text-[13px] font-semibold leading-snug text-slate-700 shadow-[0_3px_0_0_#bae6fd] [overflow-wrap:anywhere]">
        <span className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-sky-600">💬 Lucky Boy nói nhỏ</span>
        {line}
        <span className="mt-0.5 block text-[10px] font-bold text-slate-400 group-hover:text-sky-600">bấm để nghe tiếp ✨</span>
      </span>
    </button>
  );
}

/** Cậu bé may mắn: mũ lưỡi trai xanh, cỏ bốn lá */
export function LuckyBoySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden>
      <ellipse cx="32" cy="76" rx="16" ry="3" fill="#0f172a" opacity="0.08" />
      {/* thân */}
      <path d="M18 52c0-8 6-12 14-12s14 4 14 12v12c0 4-3 6-6 6H24c-3 0-6-2-6-6z" fill="#2563eb" />
      <path d="M26 42l6 7 6-7" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="60" r="4" fill="#fde7d2" /><circle cx="48" cy="60" r="4" fill="#fde7d2" />
      {/* đầu */}
      <ellipse cx="32" cy="28" rx="18" ry="17" fill="#fde7d2" />
      <ellipse cx="22" cy="34" rx="3.5" ry="2" fill="#fb7185" opacity="0.5" /><ellipse cx="42" cy="34" rx="3.5" ry="2" fill="#fb7185" opacity="0.5" />
      <ellipse cx="25" cy="29" rx="3" ry="4" fill="#fff" /><ellipse cx="39" cy="29" rx="3" ry="4" fill="#fff" />
      <ellipse cx="25.5" cy="29.5" rx="2" ry="3" fill="#1e293b" /><ellipse cx="39.5" cy="29.5" rx="2" ry="3" fill="#1e293b" />
      <circle cx="26.3" cy="28.3" r="0.8" fill="#fff" /><circle cx="40.3" cy="28.3" r="0.8" fill="#fff" />
      <path d="M28 37c2 2.5 6 2.5 8 0" fill="none" stroke="#9f1239" strokeWidth="1.8" strokeLinecap="round" />
      {/* tóc + mũ */}
      <path d="M14 26c1-10 8-16 18-16s17 6 18 16c-5-4-10-6-18-5-8-1-13 1-18 5z" fill="#6b3f1d" />
      <path d="M13 22c2-9 9-14 19-14s17 5 19 14c-6-3-12-4-19-4s-13 1-19 4z" fill="#22c55e" />
      <path d="M12 22h40c3 0 4 2 2 3.5-14 1-30 1-44 0-2-1.5-1-3.5 2-3.5z" fill="#15803d" />
      {/* cỏ bốn lá trên mũ */}
      <g transform="translate(32 13)">
        <circle cx="-2.5" cy="-2.5" r="2.4" fill="#86efac" /><circle cx="2.5" cy="-2.5" r="2.4" fill="#86efac" /><circle cx="-2.5" cy="2.5" r="2.4" fill="#86efac" /><circle cx="2.5" cy="2.5" r="2.4" fill="#86efac" />
        <circle cx="0" cy="0" r="1" fill="#166534" />
      </g>
      {/* chân */}
      <path d="M26 70v5M38 70v5" stroke="#1e3a8a" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
