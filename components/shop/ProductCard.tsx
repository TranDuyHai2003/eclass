"use client";

import { cn } from "@/lib/utils";
import type { Rarity } from "@/lib/points/rarity";
import { RARITY_LABEL } from "@/lib/game/items";

/** Màu dải tiêu đề và viền theo độ hiếm (mockup: xanh lá / xanh dương / tím / vàng "CỰC PHẨM") */
export const BAND: Record<Rarity, { band: string; border: string; art: string; chip: string; glow?: boolean }> = {
  common: { band: "bg-[#4fae4a] text-white", border: "border-[#4fae4a] bg-[#eef9ea]", art: "bg-[#f3fbee]", chip: "bg-[#d6f3cf] text-[#1f6b22]" },
  rare: { band: "bg-[#2e8fe0] text-white", border: "border-[#2e8fe0] bg-[#e9f4fe]", art: "bg-[#eef6ff]", chip: "bg-[#cfe6fb] text-[#0f4c81]" },
  epic: { band: "bg-[#8b5cf6] text-white", border: "border-[#8b5cf6] bg-[#f3eefe]", art: "bg-[#f5f0ff]", chip: "bg-[#e4d8fd] text-[#4c1d95]" },
  legendary: { band: "bg-[#b4531a] text-[#fff5d6]", border: "border-[#d9a52a] bg-[#fff1c2]", art: "bg-[radial-gradient(circle_at_50%_40%,#fff6cc,#ffe08a)]", chip: "bg-[#ffe9a8] text-[#7c4a03]", glow: true },
};

export interface ProductCardProps {
  title: string;
  rarity: Rarity;
  /** Nhãn góc phải: "Còn 5", "Vĩnh viễn", "1/2 tháng này" */
  meta?: string;
  art: React.ReactNode;
  /** Nút chính */
  action: { label: string; tone: "yellow" | "blue" | "green" | "brown" | "muted"; onClick?: () => void; href?: string; disabled?: boolean; testId?: string; title?: string };
  /** Nút phụ nhỏ (ghim mục tiêu) */
  corner?: React.ReactNode;
  testId?: string;
  dataTitle?: string;
  dataRarity?: string;
  extra?: Record<string, string>;
  selected?: boolean;
}

export function ProductCard({ title, rarity, meta, art, action, corner, testId, dataTitle, dataRarity, extra, selected }: ProductCardProps) {
  const b = BAND[rarity];
  const tone = {
    yellow: "btn-pill-yellow",
    blue: "btn-pill-blue",
    green: "btn-pill-green",
    brown: "btn-pill-brown",
    muted: "",
  }[action.tone];
  const Btn = action.href ? "a" : "button";
  return (
    <div
      data-testid={testId}
      data-title={dataTitle}
      data-rarity={dataRarity ?? rarity}
      {...extra}
      className={cn(
        "relative flex flex-col rounded-[1.25rem] border-[2.5px] p-2 shadow-[0_5px_0_0_#5b3d1e] transition-transform duration-200 hover:-translate-y-1",
        b.border,
        selected && "ring-4 ring-[#8fdc75]",
      )}
    >
      {(rarity === "epic" || rarity === "legendary") && (
        <>
          <span aria-hidden className={cn("card-star -right-1.5 -top-1.5", b.glow && "card-star-gold")}>✦</span>
          <span aria-hidden className={cn("card-star -bottom-1.5 -left-1.5", b.glow && "card-star-gold")} style={{ animationDelay: "1.2s" }}>✦</span>
        </>
      )}
      {b.glow && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#5b3d1e] bg-[#ffd84d] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5b3d1e]">
          🏅 Cực phẩm
        </span>
      )}
      <div className={cn("rounded-xl border-2 border-[#5b3d1e]/70 px-2 py-1.5 text-center text-[13px] font-black leading-tight shadow-[0_3px_0_0_rgba(91,61,30,.6)]", b.band)}>
        <span className="line-clamp-1">{title}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
        <span className={cn("rounded-full border border-[#5b3d1e]/40 px-2 py-0.5 text-[10px] font-black", b.chip)}>{RARITY_LABEL[rarity]}</span>
        {meta && <span className="rounded-full border border-[#5b3d1e]/40 bg-white px-2 py-0.5 text-[10px] font-bold text-[#5b3d1e]">{meta}</span>}
      </div>
      <div className={cn("dots-bg relative mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#5b3d1e]/30", b.art)} style={{ "--dot": "rgba(91,61,30,.14)" } as React.CSSProperties}>
        {corner && <div className="absolute right-1.5 top-1.5 z-[1]">{corner}</div>}
        {(rarity === "epic" || rarity === "legendary") && (
          <>
            <span aria-hidden className={cn("card-star left-2 top-2", b.glow && "card-star-gold")} style={{ animationDelay: ".6s" }}>✧</span>
            <span aria-hidden className={cn("card-star bottom-2 right-2", b.glow && "card-star-gold")} style={{ animationDelay: "1.8s" }}>✧</span>
          </>
        )}
        <div className="group-hover-float">{art}</div>
      </div>
      <Btn
        {...(action.href ? { href: action.href } : { type: "button" as const, onClick: action.onClick, disabled: action.disabled })}
        data-testid={action.testId}
        title={action.title}
        className={cn("btn-pill mt-2 h-10 w-full text-[13px]", tone, action.tone === "muted" && "bg-[#efe6d6] text-[#8a7458]")}
      >
        {action.label}
      </Btn>
    </div>
  );
}
