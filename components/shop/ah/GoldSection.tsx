"use client";

import Link from "next/link";
import { useState } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import type { BoardData } from "../LeaderboardModal";
import { AvatarRing, CoinDot, PlateBox, fmt } from "./parts";
import { ShowcaseStage } from "@/components/profile/ShowcaseStage";
import { cn } from "@/lib/utils";

/**
 * Hộp "Bảng Vàng Server Khối" — y như mẫu Gemini Canvas (24/11): hộp nổi, nhãn vàng trên đỉnh, nút đóng đỏ,
 * banner sự kiện tuần, tab khối ở giữa, mỗi bạn là thẻ khoe đủ đồ (nền, hiệu ứng, nhân vật, thú cưng, khung, bảng tên, danh hiệu).
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
      <div role="dialog" aria-modal="true" aria-labelledby="gold-title" data-testid="leaderboard-modal" className="ah-dialog ah-panel v2-pop relative flex max-h-[88vh] w-full max-w-[560px] flex-col gap-3.5 px-4 pb-4 pt-8">
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
                <button key={b.grade} type="button" role="tab" aria-selected={grade === b.grade} data-testid={`board-g${b.grade}`} onClick={() => { play("click"); setGrade(b.grade); }} className={`ah-btn ${grade === b.grade ? "ah-gold" : "ah-cream"} h-9 px-3.5 text-[13px] max-sm:h-8 max-sm:px-2.5 max-sm:text-[12px]`}>
                  <span className="max-sm:hidden">Server&nbsp;</span>Khối {b.grade}
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

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * Một bạn trên Bảng Vàng = thẻ khoe đồ (28/11: thầy muốn lên bảng là khoe được hết như ở Hồ sơ):
 * sân khấu Hình nền + Hiệu ứng + nhân vật cả người + thú cưng, ảnh đại diện có Khung viền, tên trên Bảng tên,
 * danh hiệu đang đeo, cấp và số xu.
 */
function Row({ rank, name, sub, xu, avatar, mine, href }: { rank: number; name: string; sub: string; xu: number; avatar: AvatarConfig; mine?: boolean; href?: string }) {
  const dark = !!avatar.nameplate && ITEM_BY_ID[avatar.nameplate]?.v2 === "dark";
  const title = avatar.title ? ITEM_BY_ID[avatar.title]?.name : null;
  const body = (
    <ShowcaseStage config={avatar} name={name} className="h-[136px]" chibiSize={88} petSize={44} align="right" sceneMinW={540}>
      {/* Xu ở góc phải trên (không chen vào bảng tên → điện thoại không bị cắt) */}
      <span className="absolute right-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full border-2 border-[#241e1a] bg-[#fffdf8] px-2 py-0.5 text-[12px] font-black tabular-nums text-[#241e1a] shadow-[0_2px_0_#241e1a]" data-testid="board-xu">
        <CoinDot size={12} />
        {fmt(xu)} Xu
      </span>
      <div className="absolute inset-y-0 left-0 flex w-[62%] items-center gap-2 py-2 pl-2.5 sm:w-[min(70%,330px)]">
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <span className={cn("ah-hand flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[#241e1a] px-1 text-sm font-bold shadow-[0_2px_0_#241e1a]", rank <= 3 ? "bg-[#fde047]" : "bg-[#fffdf8]")} data-testid="board-rank">
            {MEDAL[rank] ?? `#${rank}`}
          </span>
          <AvatarRing config={avatar} size={56} inset={12} />
        </div>
        <PlateBox id={avatar.nameplate} className="min-w-0 flex-1 rounded-[14px] border-2 shadow-[0_2px_0_#241e1a]">
          <div className={cn("flex min-w-0 flex-col gap-0.5 px-2.5 py-1.5", dark ? "text-white" : "text-[#241e1a]")}>
            <span className="ah-hand truncate text-[15px] font-bold leading-tight">{name}</span>
            <span className="truncate text-[11px] font-bold opacity-90 max-sm:hidden">{sub}</span>
            {title && <span className="max-w-full self-start truncate rounded-full border border-[#241e1a] bg-[#2A1F5C] px-2 py-px text-[10px] font-black text-[#FDE68A]" data-testid="board-title">« {title} »</span>}
          </div>
        </PlateBox>
      </div>
    </ShowcaseStage>
  );
  return (
    <li className="list-none shrink-0 overflow-hidden rounded-[18px] border-[2.5px] border-[#241e1a] shadow-[0_3px_0_#241e1a]" style={mine ? { boxShadow: "0 0 0 3px #fde047, 0 3px 0 #241e1a" } : undefined} data-testid="board-row">
      {href ? <Link href={href} className="block">{body}</Link> : body}
    </li>
  );
}
