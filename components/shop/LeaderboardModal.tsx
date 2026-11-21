"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ShopModal } from "./ShopModal";

export interface BoardData {
  grade: number;
  rows: { userId: string; name: string | null; levelName: string; xu: number; rank: number }[];
  mine: { rank: number; total: number; xu: number } | null;
}

/** "Bản Tin & Bảng Vàng": top 5 mỗi khối + hạng của mình; xem đầy đủ ở /leaderboard */
export function LeaderboardModal({ open, onOpenChange, boards, myGrade, currentUserId, event }: { open: boolean; onOpenChange: (o: boolean) => void; boards: BoardData[]; myGrade: number | null; currentUserId: string; event?: { title: string; text: string; badge: string } | null }) {
  const [grade, setGrade] = useState<number | null>(myGrade ?? boards[0]?.grade ?? null);
  const board = boards.find((b) => b.grade === grade);
  return (
    <ShopModal open={open} onOpenChange={onOpenChange} title="📰 Bản Tin & Bảng Vàng" testId="leaderboard-modal">
      {event && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-[#f5b61e] bg-[#fff1c2] p-3">
          <span className="text-2xl">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#3b2a14]">{event.title}</p>
            <p className="text-[11px] font-semibold text-[#7a5a35]">{event.text}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#5b3d1e]/40 bg-white px-2 py-0.5 text-[10px] font-black text-[#5b3d1e]">{event.badge}</span>
        </div>
      )}
      <p className="text-sm font-black text-[#3b2a14]">🏆 Bảng Vàng Chăm Chỉ Theo Khối</p>
      {boards.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-[#fff1c2] p-4 text-center text-xs font-semibold text-[#7a5a35]">Admin chưa đặt khối cho lớp nên chưa có bảng theo khối.</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {boards.map((b) => (
              <button key={b.grade} type="button" onClick={() => setGrade(b.grade)} aria-pressed={grade === b.grade} data-testid={`board-g${b.grade}`} className={cn("btn-pill py-1.5 text-xs", grade === b.grade && "btn-pill-yellow")}>
                Khối {b.grade}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {board?.rows.map((r) => (
              <li key={r.userId} className={cn("flex items-center gap-2 rounded-2xl border-2 border-dashed px-3 py-2", r.userId === currentUserId ? "border-[#f5b61e] bg-[#fff8e6]" : r.rank <= 3 ? "border-[#2e8fe0]/50 bg-[#eef6ff]" : "border-[#4fae4a]/50 bg-[#f3fbee]")}>
                <span className={cn("w-7 text-sm font-black", r.rank === 1 ? "text-[#b4531a]" : "text-[#7a5a35]")}>#{r.rank}</span>
                <Link href={`/profile/${r.userId}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-[#3b2a14]">{r.name || "Học sinh"}{r.userId === currentUserId ? " (Bạn)" : ""}</span>
                  <span className="block text-[11px] font-semibold text-[#7a5a35]">{r.levelName}</span>
                </Link>
                <span className="shrink-0 text-sm font-black text-[#b4531a] tabular-nums">🪙 {r.xu.toLocaleString("vi-VN")}</span>
              </li>
            ))}
            {board && board.rows.length === 0 && <li className="rounded-2xl bg-[#fff1c2] p-3 text-center text-xs font-semibold text-[#7a5a35]">Chưa có ai trên bảng khối {board.grade}.</li>}
            {board?.mine && !board.rows.some((r) => r.userId === currentUserId) && (
              <li className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#f5b61e] bg-[#fff8e6] px-3 py-2">
                <span className="w-7 text-sm font-black text-[#7a5a35]">#{board.mine.rank}</span>
                <span className="flex-1 text-sm font-black text-[#3b2a14]">Bạn</span>
                <span className="text-sm font-black text-[#b4531a] tabular-nums">🪙 {board.mine.xu.toLocaleString("vi-VN")}</span>
              </li>
            )}
          </ul>
        </>
      )}
      <Link href="/leaderboard" className="btn-pill btn-pill-brown mt-3 w-full py-2 text-xs">Xem Bảng Vàng đầy đủ →</Link>
    </ShopModal>
  );
}
