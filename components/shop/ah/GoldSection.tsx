"use client";

import Link from "next/link";
import { useState } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import type { BoardData } from "../LeaderboardModal";
import { AvatarRing, CoinDot, PlateBox, fmt } from "./parts";

/**
 * Hộp "Bảng Vàng Server Khối" — y như mẫu Gemini Canvas (24/11): hộp nổi, nhãn vàng trên đỉnh, nút đóng đỏ,
 * banner sự kiện tuần, tab khối ở giữa, mỗi hàng là bảng tên + khung viền của bạn đó; dữ liệu thật.
 */
export function GoldModal({ boards, myGrade, me, event, onClose }: {
  boards: BoardData[];
  myGrade: number | null;
  me: { id: string; avatar: AvatarConfig; name: string | null };
  event?: { title: string; text: string; badge: string } | null;
  onClose: () => void;
}) {
  const [grade, setGrade] = useState<number | null>(myGrade ?? boards[0]?.grade ?? null);
  const board = boards.find((b) => b.grade === grade);
  return (
    <div className="fixed inset-0 z-[62] flex items-center justify-center bg-[rgba(36,30,26,0.55)] p-4 pt-8" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="gold-title" data-testid="leaderboard-modal" className="ah-dialog ah-panel v2-pop relative flex max-h-[88vh] w-full max-w-[440px] flex-col gap-3.5 px-4 pb-4 pt-8">
        <h2 id="gold-title" className="ah-hand ah-gold absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-[2.5px] border-[#241e1a] px-5 py-1.5 text-base font-bold">
          🏆 Bảng Vàng Server Khối
        </h2>
        <button type="button" aria-label="Đóng" data-testid="shop-modal-close" onClick={() => { play("click"); onClose(); }} className="absolute -right-3 -top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#241e1a] bg-[#ef5b4c] text-lg font-black leading-none text-white shadow-[0_3px_0_#241e1a]">
          ×
        </button>

        <div className="flex items-center gap-2.5 rounded-[14px] border-2 border-[#f2cf7a] bg-[#fff4d1] px-3 py-2.5">
          <span aria-hidden className="text-2xl">🎉</span>
          <div className="min-w-0 flex-1">
            <div className="ah-hand text-sm font-bold leading-snug">{event ? event.title : "Sự Kiện Tuần: Đua Top Đeo Bảng Tên VIP!"}</div>
            <div className="text-xs font-bold text-[#c2410c]">{event ? event.text : "Viền Avatar & Hiệu Ứng Bảng Tên của bạn sẽ tỏa sáng ngay trên Bảng Vàng này!"}</div>
          </div>
          {event && <span className="shrink-0 rounded-full border-2 border-[#241e1a] bg-[#fffdf8] px-2.5 py-0.5 text-[11px] font-black">{event.badge}</span>}
        </div>

        {boards.length === 0 ? (
          <div className="ah-hand rounded-[18px] border-2 border-dashed border-[#d6c3a5] p-6 text-center text-sm">Thầy chưa đặt khối cho lớp nên chưa có Bảng Vàng theo khối.</div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Chọn khối">
              {boards.map((b) => (
                <button key={b.grade} type="button" role="tab" aria-selected={grade === b.grade} data-testid={`board-g${b.grade}`} onClick={() => { play("click"); setGrade(b.grade); }} className={`ah-btn ${grade === b.grade ? "ah-gold" : "ah-cream"} h-9 px-3.5 text-[13px]`}>
                  Server Khối {b.grade}
                </button>
              ))}
            </div>
            <ol className="-mx-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto px-1 pb-1">
              {board?.rows.map((r) => (
                <Row key={r.userId} rank={r.rank} name={`${r.name || "Học sinh"}${r.userId === me.id ? " (Bạn)" : ""}`} sub={r.levelName} xu={r.xu} avatar={r.userId === me.id ? me.avatar : r.avatar ?? {}} mine={r.userId === me.id} href={`/profile/${r.userId}`} />
              ))}
              {board && board.rows.length === 0 && <li className="ah-hand list-none rounded-[18px] border-2 border-dashed border-[#d6c3a5] p-5 text-center text-sm">Chưa có ai trên bảng khối {board.grade}.</li>}
              {board?.mine && !board.rows.some((r) => r.userId === me.id) && (
                <Row rank={board.mine.rank} name={`${me.name || "Học sinh"} (Bạn)`} sub={`Hạng ${board.mine.rank}/${board.mine.total}`} xu={board.mine.xu} avatar={me.avatar} mine />
              )}
            </ol>
          </>
        )}
        <p className="self-center text-[11px] font-bold text-[#6e4722]">Top 20 mỗi khối · xếp theo tổng xu tích lũy, đổi quà không tụt hạng</p>
      </div>
    </div>
  );
}

function Row({ rank, name, sub, xu, avatar, mine, href }: { rank: number; name: string; sub: string; xu: number; avatar: AvatarConfig; mine?: boolean; href?: string }) {
  const dark = !!avatar.nameplate && ITEM_BY_ID[avatar.nameplate]?.v2 === "dark";
  const body = (
    <div className={`flex min-h-[60px] items-center gap-2.5 px-3 py-2 ${dark ? "text-white" : "text-[#241e1a]"}`}>
      <b className="ah-hand w-8 shrink-0 text-base">#{rank}</b>
      <AvatarRing config={avatar} size={46} inset={9} />
      <div className="min-w-0 flex-1">
        <div className="ah-hand truncate text-sm font-bold">{name}</div>
        <div className="truncate text-[11px] font-bold opacity-90">{sub}</div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-black tabular-nums ${dark ? "border-white/25 bg-black/35 text-white" : "border-[#241e1a] bg-[#fffdf8] text-[#241e1a]"}`}
      >
        <CoinDot size={13} />
        {fmt(xu)} Xu
      </span>
    </div>
  );
  return (
    <li className="list-none rounded-[16px]" style={mine ? { boxShadow: "0 0 0 3px #fde047" } : undefined}>
      <PlateBox id={avatar.nameplate} className="rounded-[16px] shadow-[0_3px_0_#241e1a]">
        {href ? <Link href={href} className="block">{body}</Link> : body}
      </PlateBox>
    </li>
  );
}
