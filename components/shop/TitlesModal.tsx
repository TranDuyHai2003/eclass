"use client";

import { cn } from "@/lib/utils";
import { LEVELS, getLevel } from "@/lib/points/levels";
import { ShopModal } from "./ShopModal";

/** "Hệ Thống Danh Hiệu": tổng xu tích luỹ (không giảm khi tiêu) và các mốc Đã mở / Chưa đạt */
export function TitlesModal({ open, onOpenChange, lifetimeEarned }: { open: boolean; onOpenChange: (o: boolean) => void; lifetimeEarned: number }) {
  const level = getLevel(lifetimeEarned);
  return (
    <ShopModal open={open} onOpenChange={onOpenChange} title="🏅 Hệ Thống Danh Hiệu" testId="titles-modal" description="Tích luỹ xu từ học tập (tiêu xu không bị mất) để mở khoá danh hiệu mới!">
      <div className="flex items-center justify-between gap-2 rounded-2xl border-[2.5px] border-[#5b3d1e] bg-[#fff1c2] px-3 py-2">
        <div>
          <p className="text-[11px] font-bold text-[#7a5a35]">Tổng xu tích luỹ</p>
          <p className="text-lg font-black text-[#3b2a14] tabular-nums">{lifetimeEarned.toLocaleString("vi-VN")} Xu</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-[#7a5a35]">Danh hiệu hiện tại</p>
          <p className="text-sm font-black text-[#b4531a]">{level.icon} {level.name}</p>
        </div>
      </div>
      {level.next && (
        <p className="mt-2 text-center text-[11px] font-bold text-[#7a5a35]">
          Còn <b className="text-[#b4531a]">{level.toNext.toLocaleString("vi-VN")} xu</b> nữa lên {level.next.icon} {level.next.name}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {LEVELS.map((lv, i) => {
          const unlocked = lifetimeEarned >= lv.min;
          const current = i === level.level - 1;
          return (
            <li
              key={lv.name}
              data-testid="title-row"
              data-unlocked={unlocked ? "1" : "0"}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2",
                current ? "border-[#f5b61e] bg-[#fff8e6]" : unlocked ? "border-[#f5b61e]/60 bg-[#fffaf0]" : "border-[#5b3d1e]/25 bg-white opacity-75",
              )}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl", unlocked ? "bg-[#ffe9a8]" : "bg-slate-100 grayscale")}>{lv.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-black", unlocked ? "text-[#3b2a14]" : "text-[#9a8a74]")}>{lv.name} (Lv.{i + 1})</p>
                <p className="text-[11px] font-semibold text-[#7a5a35]">Mốc yêu cầu: {lv.min.toLocaleString("vi-VN")} Xu tích luỹ</p>
              </div>
              <span className={cn("shrink-0 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-black", unlocked ? "border-[#1f6b22] bg-[#d6f3cf] text-[#1f6b22]" : "border-[#9a8a74] bg-white text-[#9a8a74]")}>
                {current ? "Đang giữ ✨" : unlocked ? "Đã mở ✨" : "Chưa đạt"}
              </span>
            </li>
          );
        })}
      </ul>
    </ShopModal>
  );
}
