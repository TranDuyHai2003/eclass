"use client";

import Link from "next/link";
import { useState } from "react";
import { ITEM_BY_ID } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import type { BoardData } from "../LeaderboardModal";
import { AvatarRing, CoinDot, PlateBox, fmt } from "./parts";

/** Mục "Bảng Vàng server khối" (canvas v2): sự kiện tuần, chọn khối, mỗi hàng là bảng tên + khung viền của bạn đó */
export function GoldSection({ boards, myGrade, me, event, onPlates }: {
  boards: BoardData[];
  myGrade: number | null;
  me: { id: string; avatar: AvatarConfig; name: string | null };
  event?: { title: string; text: string; badge: string } | null;
  onPlates: () => void;
}) {
  const [grade, setGrade] = useState<number | null>(myGrade ?? boards[0]?.grade ?? null);
  const board = boards.find((b) => b.grade === grade);
  return (
    <div className="flex flex-col gap-4" data-testid="leaderboard-modal">
      <div className="ah-panel flex flex-wrap items-center gap-3.5 bg-[#fff1c9] px-5 py-4">
        <div className="flex-[1_1_300px]">
          <div className="ah-hand text-[17px] font-bold">{event ? event.title : "Sự kiện tuần: Đua top đeo bảng tên VIP!"}</div>
          <div className="text-[13px] font-bold text-[#6e4722]">{event ? event.text : "Viền avatar và hiệu ứng bảng tên của bạn sẽ tỏa sáng ngay trên Bảng Vàng này."}</div>
        </div>
        {event && <span className="rounded-full border-2 border-[#241e1a] bg-[#fffdf8] px-3 py-0.5 text-xs font-black">{event.badge}</span>}
        <button type="button" onClick={onPlates} className="ah-btn ah-gold h-[42px] px-[18px]">Xem bảng tên</button>
      </div>
      {boards.length === 0 ? (
        <div className="ah-panel ah-hand p-8 text-center text-base">Thầy chưa đặt khối cho lớp nên chưa có Bảng Vàng theo khối.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            {boards.map((b) => (
              <button key={b.grade} type="button" aria-pressed={grade === b.grade} data-testid={`board-g${b.grade}`} onClick={() => { play("click"); setGrade(b.grade); }} className={`ah-btn ${grade === b.grade ? "ah-gold" : "ah-cream"} h-10 px-[18px]`}>
                Server Khối {b.grade}
              </button>
            ))}
            <span className="ml-auto text-xs font-extrabold text-[#6e4722]">Xếp theo tổng xu tích lũy · đổi quà không làm tụt hạng</span>
          </div>
          <ol className="flex flex-col gap-3">
            {board?.rows.map((r) => (
              <Row key={r.userId} rank={r.rank} name={`${r.name || "Học sinh"}${r.userId === me.id ? " (Bạn)" : ""}`} sub={r.levelName} xu={r.xu} avatar={r.userId === me.id ? me.avatar : r.avatar ?? {}} mine={r.userId === me.id} href={`/profile/${r.userId}`} />
            ))}
            {board && board.rows.length === 0 && <li className="ah-panel ah-hand p-6 text-center">Chưa có ai trên bảng khối {board.grade}.</li>}
            {board?.mine && !board.rows.some((r) => r.userId === me.id) && (
              <Row rank={board.mine.rank} name={`${me.name || "Học sinh"} (Bạn)`} sub={`Hạng ${board.mine.rank}/${board.mine.total}`} xu={board.mine.xu} avatar={me.avatar} mine />
            )}
          </ol>
        </>
      )}
      <Link href="/leaderboard" className="ah-btn ah-woodbtn h-11 self-center px-5">Xem Bảng Vàng đầy đủ →</Link>
    </div>
  );
}

function Row({ rank, name, sub, xu, avatar, mine, href }: { rank: number; name: string; sub: string; xu: number; avatar: AvatarConfig; mine?: boolean; href?: string }) {
  const dark = !!avatar.nameplate && ITEM_BY_ID[avatar.nameplate]?.v2 === "dark";
  const body = (
    <div className="flex min-h-20 items-center gap-3.5 px-4 py-2.5">
      <b className="ah-hand w-[38px] shrink-0 text-[22px]" style={{ color: rank === 1 ? (dark ? "#FDE68A" : "#B45309") : undefined }}>#{rank}</b>
      <AvatarRing config={avatar} size={60} inset={12} />
      <div className="min-w-0 flex-1">
        <div className="ah-hand truncate text-[17px] font-bold">{name}</div>
        <div className="text-xs font-extrabold">{sub}</div>
      </div>
      <span className="ah-ink inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fffdf8] px-3.5 py-1.5 font-black text-[#241e1a] tabular-nums"><CoinDot size={16} />{fmt(xu)}</span>
    </div>
  );
  return (
    <li className="list-none" style={mine ? { outline: "3px solid #ea6a51", outlineOffset: 2, borderRadius: 18 } : undefined}>
      <PlateBox id={avatar.nameplate} className="rounded-[18px]">
        {href ? <Link href={href} className="block">{body}</Link> : body}
      </PlateBox>
    </li>
  );
}
