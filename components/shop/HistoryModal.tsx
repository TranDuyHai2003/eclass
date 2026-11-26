"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ShopModal } from "./ShopModal";
import { earningRules, SOURCE_LABEL } from "@/lib/points/config";
import { LEVELS } from "@/lib/points/levels";
import type { StudentPointsPageData } from "@/lib/points/queries";

const SOURCE_ICON: Record<string, string> = {
  TEST_SUBMIT: "📝", ON_TIME: "⏰", TEST_SCORE: "🎯", BREAKTHROUGH: "🚀", FINAL_TEST: "🏁", HOMEWORK_SUBMIT: "📒", HOMEWORK_PASS: "✅",
  STREAK: "🔥", MANUAL: "👨‍🏫", REDEEM: "🎁", REFUND: "↩️", REVOKE: "⛔", GIFTCODE: "🎟️", GACHA: "🎁", ITEM: "🎨",
};
const RULE_ICONS = ["📝", "⏰", "🎯", "🚀", "🏁", "📒", "🔥", "👨‍🏫", "🎟️"];
const fmtDate = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Lịch sử xu + cách kiếm xu + thang danh hiệu */
export function HistoryModal({ open, onOpenChange, ledger, levelIndex }: { open: boolean; onOpenChange: (o: boolean) => void; ledger: StudentPointsPageData["ledger"]; levelIndex: number }) {
  const [tab, setTab] = useState<"history" | "rules" | "levels">("history");
  return (
    <ShopModal open={open} onOpenChange={onOpenChange} title="📒 Lịch Sử & Cách Kiếm Xu" testId="history-modal" className="sm:max-w-2xl">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {([["history", "Lịch sử xu"], ["rules", "Cách kiếm xu"], ["levels", "Danh hiệu"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={cn("btn-pill px-3 py-1 text-xs", tab === k && "btn-pill-yellow")}>{l}</button>
        ))}
      </div>
      {tab === "history" && (
        ledger.length === 0 ? (
          <p className="rounded-2xl bg-[#fff1c2] p-5 text-center text-sm font-semibold text-[#7a5a35]">Chưa có xu nào. Nộp bài đầu tiên để nhận 300 xu nhé!</p>
        ) : (
          <ol className="divide-y divide-[#efe6d6] rounded-2xl border-2 border-[#5b3d1e]/40 bg-white">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1c2] text-lg">{SOURCE_ICON[l.source] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-bold text-[#3b2a14]">{l.reason || SOURCE_LABEL[l.source] || l.source}</p>
                  <p className="text-[11px] text-[#9a7a4a]">{SOURCE_LABEL[l.source] ?? l.source} · {fmtDate(l.createdAt)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-sm font-black tabular-nums", l.amount > 0 ? "bg-[#d6f3cf] text-[#1f6b22]" : "bg-rose-100 text-rose-700")}>
                  {l.amount > 0 ? `+${l.amount.toLocaleString("vi-VN")}` : l.amount.toLocaleString("vi-VN")}
                </span>
              </li>
            ))}
          </ol>
        )
      )}
      {tab === "rules" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {earningRules().map((r, i) => (
            <div key={r.label} className="flex items-start gap-2 rounded-2xl border-2 border-[#5b3d1e]/40 bg-white p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1c2] text-lg">{RULE_ICONS[i] ?? "⭐"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#3b2a14]">{r.label}</p>
                {r.note && <p className="text-[11px] text-[#7a5a35]">{r.note}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-[#ffe9a8] px-2 py-0.5 text-xs font-black text-[#7c4a03]">{r.points}</span>
            </div>
          ))}
          <p className="text-[11px] text-[#7a5a35] sm:col-span-2">Mỗi bài chỉ được tính xu một lần. Đổi quà xong, thầy sẽ trao ở buổi học tới; quá 30 ngày chưa nhận thì xu tự hoàn lại.</p>
        </div>
      )}
      {tab === "levels" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LEVELS.map((lv, i) => (
            <div key={lv.name} className={cn("flex items-center gap-2 rounded-2xl border-2 px-3 py-2", i === levelIndex ? "border-[#f5b61e] bg-[#fff8e6]" : "border-[#5b3d1e]/30 bg-white")}>
              <span className="text-xl">{lv.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#3b2a14]">{lv.name}</span>
                <span className="block text-[11px] font-semibold text-[#7a5a35]">từ {lv.min.toLocaleString("vi-VN")} xu</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </ShopModal>
  );
}
