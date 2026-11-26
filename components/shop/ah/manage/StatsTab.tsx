"use client";

import { cn } from "@/lib/utils";
import type { TeacherRewardsPageData } from "@/lib/points/queries";
import { CoinDot, fmt } from "../parts";
import { BOX, Empty, LABEL } from "./ui";

/** Thống kê tháng: xu phát ra / đã tiêu, quà đã trao, chi phí quà; top học sinh tích xu */
export function StatsTab({ data }: { data: TeacherRewardsPageData }) {
  const s = data.stats;
  const cards: [string, string, string][] = [
    ["🪙", "Xu học sinh nhận tháng này", fmt(s.earnedThisMonth)],
    ["🛍️", "Xu đã dùng đổi quà", fmt(s.spentThisMonth)],
    ["🎁", "Quà đã trao tháng này", fmt(s.deliveredThisMonth)],
    ["💵", "Chi phí quà tháng này", `${fmt(s.costThisMonth)}đ`],
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="mgr-stats">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([icon, label, value]) => (
          <div key={label} className={cn(BOX, "p-4")}>
            <p className={LABEL}>{icon} {label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className={BOX}>
        <p className="ah-hand border-b-2 border-[#efe3cc] px-4 py-2.5 text-lg font-bold">Chăm chỉ nhất tháng này</p>
        {s.top.length === 0 ? (
          <Empty>Chưa có dữ liệu.</Empty>
        ) : (
          <ol className="divide-y-2 divide-[#f3e9d6]">
            {s.top.map((t, i) => (
              <li key={t.userId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-7 text-center text-base font-black">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                <p className="line-clamp-1 min-w-0 flex-1 text-sm font-extrabold">
                  {t.name}
                  {t.className && <span className="font-bold text-[#9e6b3f]"> · {t.className}</span>}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-black tabular-nums"><CoinDot size={13} />+{fmt(t.points)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
