"use client";

import { Castle, CheckCircle2, Lock, TrendingUp, TrendingDown, Sparkles, Info } from "lucide-react";
import Link from "next/link";
import { SessionProgressItem } from "@/lib/ranking/session-progress-engine";
import { WeeklyProgressSummary } from "@/lib/ranking/weekly-progress-engine";

interface WeeklyProgressTrackerProps {
  weeklyProgress?: WeeklyProgressSummary;
  sessionProgress?: {
    sessions: SessionProgressItem[];
    completedSessionsCount: number;
  };
}

export function WeeklyProgressTracker({
  weeklyProgress,
  sessionProgress,
}: WeeklyProgressTrackerProps) {
  const sessions = sessionProgress?.sessions || [];
  const status = weeklyProgress?.status || "NO_DATA";
  const completedCount = weeklyProgress?.sessionsCompleted || 0;
  const totalSessions = weeklyProgress?.totalSessions || 4;
  const weeklyGrowth = weeklyProgress?.weeklyGrowthPercent ?? null;

  if (status === "NO_DATA" || sessions.length === 0) {
    return (
      <div className="rounded-none sm:rounded-2xl bg-white border-y sm:border border-slate-200 p-6 text-center text-slate-500 space-y-2">
        <Castle className="w-8 h-8 text-blue-700 mx-auto opacity-60" />
        <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-widest">
          4 BÀI GẦN NHẤT CỦA BẠN
        </h3>
        <p className="text-xs font-semibold text-slate-500">
          Chưa có dữ liệu tiến bộ tuần này. Hãy hoàn thành bài kiểm tra đầu tiên để bắt đầu!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-none sm:rounded-2xl bg-white border-y sm:border border-slate-200 p-3.5 sm:p-6 shadow-[0_4px_0_0_#e3ecff] text-slate-900 space-y-4 relative overflow-hidden group w-full min-w-0 max-w-full">

      {/* Header with Weekly Progress Badge */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-sm sm:text-lg lg:text-xl tracking-widest text-slate-800 uppercase flex items-center gap-2">
            <Castle className="w-5 h-5 text-blue-700 shrink-0" />
            <span>4 BÀI GẦN NHẤT CỦA BẠN</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 tabular-nums mt-0.5">
            Quỹ đạo thay đổi vị trí tương đối và điểm số của bạn qua 4 bài thi gần nhất
          </p>
        </div>

        {/* Weekly Growth Badge */}
        {weeklyGrowth !== null ? (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-black text-emerald-700 tabular-nums shadow-lg shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-700 animate-pulse" />
            <span>
              {weeklyGrowth >= 0 ? `↑ +${weeklyGrowth}% TIẾN BỘ GẦN ĐÂY` : `↓ ${weeklyGrowth}% SO VỚI BÀI ĐẦU`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-blue-50 border border-blue-200 text-xs sm:text-sm font-black text-blue-700 tabular-nums shadow-lg shrink-0">
            <Sparkles className="w-4 h-4 text-blue-700 animate-pulse" />
            <span>ĐANG TÍCH LŨY ({completedCount}/{totalSessions} BUỔI)</span>
          </div>
        )}
      </div>

      {/* Weekly Trajectory Summary Statistics Bar (Temporarily Hidden) */}

      {/* Grid Layout: Exactly 4 columns on desktop (lg:grid-cols-4), 2 on tablet (sm:grid-cols-2), 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10 w-full min-w-0">
        {sessions.map((sess, idx) => {
          const isCompleted = sess.status === "COMPLETED";
          const isCurrent = sess.isCurrent;
          const targetUrl = sess.lessonId ? `/watch/${sess.lessonId}/quiz` : (sess.testId ? `/tests/${sess.testId}` : null);

          const cardContent = (
            <div
              className={`rounded-xl p-4 sm:p-4.5 transition-all duration-300 border flex flex-col justify-between space-y-3 min-w-0 h-full ${
                targetUrl ? "cursor-pointer hover:border-blue-300 hover:scale-[1.02] " : ""
              } ${isCurrent
                ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                : isCompleted
                  ? "bg-slate-50 border-emerald-200 text-slate-800"
                  : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
            >
              {/* Header: Session Title & Stage Icon */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-black uppercase leading-snug text-slate-800 line-clamp-2 break-words group-hover:text-blue-700 transition-colors" title={sess.sessionName}>
                  {sess.sessionName}
                </span>

                {isCompleted ? (
                  <span
                    className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
                      sess.scoreDelta !== null && sess.scoreDelta < 0
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}
                    title={sess.scoreDelta !== null && sess.scoreDelta < 0 ? "Điểm giảm" : "Điểm tăng"}
                  >
                    {sess.scoreDelta !== null && sess.scoreDelta < 0 ? (
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-emerald-700" />
                    )}
                  </span>
                ) : isCurrent ? (
                  <span className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-blue-700 animate-pulse" />
                  </span>
                ) : (
                  <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </span>
                )}
              </div>

              {/* Supremacy % Text & HigherThan Info */}
              <div className="space-y-1 min-w-0">
                <div className="text-xs sm:text-lg tabular-nums text-blue-700 font-black truncate">
                  {sess.positionPercentile !== null
                    ? `Top ${sess.positionPercentile}% toàn khóa`
                    : "Chưa nộp bài"}
                </div>
                {sess.higherThanPercent !== null && (
                  <p className="text-[11px] sm:text-base text-slate-600 font-bold truncate">
                    Cao hơn {sess.higherThanPercent}% bạn học
                  </p>
                )}
              </div>

              {/* Footer: Rank & Score + Growth Indicator */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs sm:text-base tabular-nums font-bold text-slate-500 min-w-0">
                <span className={isCurrent ? "text-amber-700 font-black" : "text-slate-600"}>
                  {sess.rankText}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-blue-700 font-black">
                    {sess.score !== null ? `${sess.score}đ` : "—"}
                  </span>
                  {sess.scoreDelta !== null && (
                    <span
                      className={`text-[10px] sm:text-sm font-black ${sess.scoreDelta >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                    >
                      ({sess.scoreDelta >= 0 ? `+${sess.scoreDelta}` : sess.scoreDelta}đ)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          if (targetUrl) {
            return (
              <Link key={sess.id} href={targetUrl} title={`Vào làm bài: ${sess.sessionName}`} className="block group">
                {cardContent}
              </Link>
            );
          }

          return <div key={sess.id}>{cardContent}</div>;
        })}
      </div>
    </div>
  );
}
