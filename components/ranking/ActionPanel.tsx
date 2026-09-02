"use client";

import { useState } from "react";
import { ShieldAlert, Sparkles, AlertTriangle, TrendingUp, Send } from "lucide-react";

interface ActionPanelProps {
  studentsNeedingSupport?: any[];
  topProgressingStudents?: any[];
}

export function ActionPanel({
  studentsNeedingSupport = [],
  topProgressingStudents = [],
}: ActionPanelProps) {
  const [activeTab, setActiveTab] = useState<"needSupport" | "topProgress">("needSupport");

  const supportList = studentsNeedingSupport;
  const progressList = topProgressingStudents;

  return (
    <div className="glass-card bg-white/95 border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-blue-950/5 space-y-4 text-slate-800">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
          <button
            onClick={() => setActiveTab("needSupport")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === "needSupport"
                ? "bg-rose-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Cần Cứu Trợ ({supportList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("topProgress")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === "topProgress"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Thợ Săn Bứt Phá ({progressList.length})</span>
          </button>
        </div>

        <span className="hidden sm:inline-block text-xs font-bold text-slate-400">
          Bảng Hành Động Cho Giáo Viên
        </span>
      </div>

      {/* Tab 1: Cần Cứu Trợ */}
      {activeTab === "needSupport" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {supportList.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl">
              🎉 Tất cả học sinh trong lớp đều đang làm bài rất ổn định! Không có ai thuộc diện báo động.
            </div>
          ) : (
            supportList.map((item: any, idx: number) => {
              const scoreVal = typeof item.avgScore === "number"
                ? item.avgScore
                : typeof item.currentScore === "number"
                ? item.currentScore
                : typeof item.score === "number"
                ? item.score
                : null;

              return (
                <div
                  key={item.id || idx}
                  className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <span>{item.name || "Học sinh"}</span>
                        {scoreVal !== null && (
                          <span className="text-xs font-mono font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
                            {scoreVal.toFixed(1)}đ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-700 font-medium mt-0.5">
                        ⚠️ {item.reason || "Cần theo dõi và hỗ trợ làm bài"}
                      </p>
                    </div>
                  </div>

                  <button className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow transition shrink-0">
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi Nhắc Nhở</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Thợ Săn Bứt Phá */}
      {activeTab === "topProgress" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {progressList.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200/60 rounded-2xl">
              🚀 Chưa có dữ liệu thợ săn bứt phá tăng hạng trong chu kỳ này.
            </div>
          ) : (
            progressList.map((item: any, idx: number) => {
              const scoreVal = typeof item.avgScore === "number"
                ? item.avgScore
                : typeof item.currentScore === "number"
                ? item.currentScore
                : typeof item.score === "number"
                ? item.score
                : 8.0;

              const boostVal = typeof item.scoreBoost === "number"
                ? item.scoreBoost
                : typeof item.scoreGrowth === "number"
                ? item.scoreGrowth
                : 1.0;

              const rankInc = typeof item.rankIncreased === "number"
                ? item.rankIncreased
                : typeof item.rankChange === "number"
                ? item.rankChange
                : 1;

              return (
                <div
                  key={item.id || idx}
                  className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0 mt-0.5">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <span>{item.name || "Học sinh"}</span>
                        <span className="text-xs font-mono font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">
                          {scoreVal.toFixed(1)}đ
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium mt-0.5">
                        🚀 Thăng <strong className="text-emerald-600 font-extrabold">+{rankInc} bậc</strong> | Tăng <strong className="text-emerald-600 font-extrabold">+{boostVal.toFixed(1)}đ</strong>
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-sm">
                    👑 Tuyên Dương Lớp
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
