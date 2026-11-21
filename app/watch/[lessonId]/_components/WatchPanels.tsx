"use client";

import { useState, type ReactNode } from "react";
import { ListVideo, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hai khối "Nội dung khoá học" và "Thảo luận" của trang học bài.
 * - Màn rộng (xl): cả hai cùng hiện — danh sách bài ở cột phải (dính theo màn hình), thảo luận dưới bài học.
 * - Màn nhỏ: một thanh chuyển 2 tab để khỏi phải cuộn qua cả danh sách chương mới tới thảo luận.
 * Trả về fragment để các khối là con trực tiếp của lưới ở trang (đặt vị trí bằng class của lưới).
 */
export function WatchPanels({
  curriculum,
  discussion,
  progress,
  commentCount,
}: {
  curriculum: ReactNode;
  discussion: ReactNode;
  progress: number;
  commentCount: number;
}) {
  const [tab, setTab] = useState<"content" | "discussion">("content");
  const tabs = [
    { key: "content" as const, label: "Nội dung", longLabel: "Nội dung khoá học", icon: ListVideo, badge: `${progress}%` },
    { key: "discussion" as const, label: "Thảo luận", longLabel: "Thảo luận", icon: MessageSquare, badge: String(commentCount) },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label="Nội dung bài học"
        className="xl:hidden grid grid-cols-2 gap-1 rounded-2xl border-2 border-blue-100 bg-white p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-extrabold transition-colors",
              tab === t.key ? "bg-blue-600 text-white shadow-[0_3px_0_0_#1e3a8a]" : "text-slate-500 hover:bg-blue-50",
            )}
          >
            <t.icon className="h-4 w-4 shrink-0" />
            <span className="truncate sm:hidden">{t.label}</span>
            <span className="truncate hidden sm:inline">{t.longLabel}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none",
                tab === t.key ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600",
              )}
            >
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      <div
        data-panel="curriculum"
        className={cn(
          "min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-4 xl:self-start xl:sticky xl:top-[60px]",
          tab !== "content" && "hidden xl:block",
        )}
      >
        {curriculum}
      </div>

      <div data-panel="discussion" className={cn("min-w-0", tab !== "discussion" && "hidden xl:block")}>
        {discussion}
      </div>
    </>
  );
}
