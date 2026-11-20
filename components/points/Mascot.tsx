"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Cú Học — linh vật nhỏ của tiệm quà. Câu nhắc truyền từ ngoài (tính sẵn, không ngẫu nhiên) → HTML server/client khớp. */
export function Mascot({ tips, className }: { tips: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const tip = tips.length ? tips[i % tips.length] : "";
  return (
    <button
      type="button"
      onClick={() => setI((x) => x + 1)}
      title="Bấm để nghe Cú Học nói tiếp"
      className={cn("group flex w-full items-end gap-2 text-left", className)}
    >
      <OwlSvg className="h-14 w-12 shrink-0 animate-float sm:h-16 sm:w-14" />
      <span className="relative mb-2 min-w-0 flex-1 break-words rounded-2xl rounded-bl-sm border-2 border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold leading-snug text-slate-700 shadow-[0_3px_0_0_#e2e8f0] [overflow-wrap:anywhere]">
        {tip}
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-500">Cú Học · bấm để nghe tiếp</span>
      </span>
    </button>
  );
}

function OwlSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 76" className={className} aria-hidden>
      <ellipse cx="32" cy="72" rx="18" ry="3" fill="#0f172a" opacity="0.08" />
      {/* thân */}
      <path d="M10 34c0-14 10-24 22-24s22 10 22 24v18c0 12-10 20-22 20S10 64 10 52z" fill="#8b5a2b" />
      <path d="M20 46c0-7 5-12 12-12s12 5 12 12v8c0 7-5 11-12 11s-12-4-12-11z" fill="#f5deb3" />
      <path d="M26 50l3 2m6-2l-3 2m-6 6l3 2m6-2l-3 2" stroke="#d2a679" strokeWidth="1.6" strokeLinecap="round" />
      {/* tai */}
      <path d="M14 16l6 10-9 2zM50 16l-6 10 9 2z" fill="#6b4423" />
      {/* mắt */}
      <circle cx="23" cy="30" r="9" fill="#fff" />
      <circle cx="41" cy="30" r="9" fill="#fff" />
      <circle cx="24" cy="31" r="4.2" fill="#1e293b" />
      <circle cx="40" cy="31" r="4.2" fill="#1e293b" />
      <circle cx="25.4" cy="29.4" r="1.4" fill="#fff" />
      <circle cx="41.4" cy="29.4" r="1.4" fill="#fff" />
      {/* kính học bá */}
      <circle cx="23" cy="30" r="10.5" fill="none" stroke="#2563eb" strokeWidth="2" />
      <circle cx="41" cy="30" r="10.5" fill="none" stroke="#2563eb" strokeWidth="2" />
      <path d="M33.5 30h-3" stroke="#2563eb" strokeWidth="2" />
      {/* mỏ, má */}
      <path d="M29 37l3 5 3-5z" fill="#f59e0b" />
      <circle cx="16" cy="40" r="2.6" fill="#fb7185" opacity="0.5" />
      <circle cx="48" cy="40" r="2.6" fill="#fb7185" opacity="0.5" />
      {/* cánh */}
      <path d="M10 44c-4 6-3 14 3 18 1-7 1-12-3-18zM54 44c4 6 3 14-3 18-1-7-1-12 3-18z" fill="#6b4423" />
      {/* chân */}
      <path d="M25 70v3m3-3v3m8-3v3m3-3v3" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
