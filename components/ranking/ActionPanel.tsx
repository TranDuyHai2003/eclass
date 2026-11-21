"use client";

import { useState } from "react";
import { ShieldAlert, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionPanelProps {
  studentsNeedingSupport?: any[];
  topProgressingStudents?: any[];
}

const PAGE_SIZE = 10;

const num = (...vals: unknown[]) => {
  for (const v of vals) if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
};

/**
 * Bảng hành động cho giáo viên (tông tối cùng trang xếp hạng).
 * Chỉ hiển thị số liệu thật — trước đây có nút "Gửi Nhắc Nhở" không làm gì và số giả (8.0đ, +1 bậc…).
 */
export function ActionPanel({ studentsNeedingSupport = [], topProgressingStudents = [] }: ActionPanelProps) {
  const [activeTab, setActiveTab] = useState<"needSupport" | "topProgress">("needSupport");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const list = activeTab === "needSupport" ? studentsNeedingSupport : topProgressingStudents;
  const shown = list.slice(0, visible);

  const switchTab = (t: typeof activeTab) => {
    setActiveTab(t);
    setVisible(PAGE_SIZE);
  };

  return (
    <section className="rounded-none sm:rounded-3xl border-y sm:border border-slate-200 bg-white shadow-[0_4px_0_0_#e3ecff] p-4 sm:p-6 space-y-4 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-2xl border border-slate-200">
          <button
            onClick={() => switchTab("needSupport")}
            className={cn(
              "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition",
              activeTab === "needSupport" ? "bg-rose-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900",
            )}
          >
            <ShieldAlert className="w-4 h-4" />
            Cần cứu trợ ({studentsNeedingSupport.length})
          </button>
          <button
            onClick={() => switchTab("topProgress")}
            className={cn(
              "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition",
              activeTab === "topProgress" ? "bg-amber-400 text-white shadow-md" : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Sparkles className="w-4 h-4" />
            Bứt phá ({topProgressingStudents.length})
          </button>
        </div>
        <span className="text-xs font-bold text-slate-500">Bảng hành động cho giáo viên</span>
      </div>

      {shown.length === 0 ? (
        <div className="p-6 text-center text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl">
          {activeTab === "needSupport"
            ? "🎉 Không có học sinh nào thuộc diện báo động."
            : "🚀 Chưa có dữ liệu tăng hạng (cần dữ liệu xếp hạng tuần trước để so sánh)."}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {shown.map((item: any, idx: number) => {
            const score = num(item.avgScore, item.currentScore, item.score);
            if (activeTab === "needSupport") {
              return (
                <div key={item.id || idx} className="bg-rose-500/[0.07] border border-rose-200 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                      <span className="truncate">{item.name || "Học sinh"}</span>
                      {score !== null && (
                        <span className="text-xs tabular-nums font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">{score.toFixed(1)}đ</span>
                      )}
                    </div>
                    <p className="text-xs text-rose-600 font-medium mt-0.5">{item.reason || "Cần theo dõi và hỗ trợ làm bài"}</p>
                  </div>
                </div>
              );
            }
            const boost = num(item.scoreBoost, item.scoreGrowth);
            const rankUp = num(item.rankIncreased, item.rankChange);
            return (
              <div key={item.id || idx} className="bg-amber-500/[0.07] border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm flex flex-wrap items-center gap-2">
                    <span className="truncate">{item.name || "Học sinh"}</span>
                    {score !== null && (
                      <span className="text-xs tabular-nums font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">{score.toFixed(1)}đ</span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    {rankUp !== null && <>Thăng <strong className="text-emerald-700">+{rankUp} bậc</strong></>}
                    {rankUp !== null && boost !== null && " · "}
                    {boost !== null && <>Tăng <strong className="text-emerald-700">+{boost.toFixed(1)}đ</strong></>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {list.length > visible && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisible((n) => n + PAGE_SIZE)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-xs font-black text-slate-800 hover:border-slate-300"
          >
            Xem thêm {Math.min(PAGE_SIZE, list.length - visible)} (còn {list.length - visible})
          </button>
        </div>
      )}
    </section>
  );
}
