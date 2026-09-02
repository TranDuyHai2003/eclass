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
      <div className="rounded-none sm:rounded-2xl bg-[#0D121D]/90 backdrop-blur-xl border-y sm:border border-slate-800 p-6 text-center text-slate-400 space-y-2">
        <Castle className="w-8 h-8 text-cyan-400 mx-auto opacity-60" />
        <h3 className="text-base font-extrabold text-slate-200 uppercase tracking-widest">
          4 BÀI GẦN NHẤT CỦA BẠN
        </h3>
        <p className="text-xs font-semibold text-slate-400">
          Chưa có dữ liệu tiến bộ tuần này. Hãy hoàn thành bài kiểm tra đầu tiên để bắt đầu!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-none sm:rounded-2xl bg-[#0D121D]/90 backdrop-blur-xl border-y sm:border border-slate-800/80 p-3.5 sm:p-6 shadow-2xl text-slate-100 space-y-4 relative overflow-hidden group w-full min-w-0 max-w-full">
      {/* Background AI Artwork Backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundImage: "url('/dungeon-floors-bg.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0D121D] via-[#0D121D]/70 to-[#0D121D]/50 pointer-events-none" />

      {/* Header with Weekly Progress Badge */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-sm sm:text-lg lg:text-xl tracking-widest text-slate-200 uppercase flex items-center gap-2">
            <Castle className="w-5 h-5 text-cyan-400 shrink-0" />
            <span>4 BÀI GẦN NHẤT CỦA BẠN</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
            Quỹ đạo thay đổi vị trí tương đối và điểm số của bạn qua 4 bài thi gần nhất
          </p>
        </div>

        {/* Weekly Growth Badge */}
        {weeklyGrowth !== null ? (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-xs sm:text-sm font-black text-emerald-300 font-mono shadow-lg shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>
              {weeklyGrowth >= 0 ? `↑ +${weeklyGrowth}% TIẾN BỘ GẦN ĐÂY` : `↓ ${weeklyGrowth}% SO VỚI BÀI ĐẦU`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-cyan-950/90 border border-cyan-500/60 text-xs sm:text-sm font-black text-cyan-300 font-mono shadow-lg shrink-0">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
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
                targetUrl ? "cursor-pointer hover:border-cyan-400/90 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]" : ""
              } ${isCurrent
                ? "bg-[#091522] border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50"
                : isCompleted
                  ? "bg-[#080B12]/90 border-emerald-500/40 text-slate-200"
                  : "bg-[#080B12]/80 border-slate-800/90 text-slate-400"
                }`}
            >
              {/* Header: Session Title & Stage Icon */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-xs sm:text-base font-black tracking-wider uppercase text-slate-200 truncate group-hover:text-cyan-300 transition-colors" title={sess.sessionName}>
                  {sess.sessionName}
                </span>

                {isCompleted ? (
                  <span
                    className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
                      sess.scoreDelta !== null && sess.scoreDelta < 0
                        ? "bg-rose-950/80 border-rose-500/50 text-rose-400"
                        : "bg-emerald-950/80 border-emerald-500/50 text-emerald-400"
                    }`}
                    title={sess.scoreDelta !== null && sess.scoreDelta < 0 ? "Điểm giảm" : "Điểm tăng"}
                  >
                    {sess.scoreDelta !== null && sess.scoreDelta < 0 ? (
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    )}
                  </span>
                ) : isCurrent ? (
                  <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  </span>
                ) : (
                  <span className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </span>
                )}
              </div>

              {/* Supremacy % Text & HigherThan Info */}
              <div className="space-y-1 min-w-0">
                <div className="text-xs sm:text-lg font-mono text-cyan-300 font-black truncate">
                  {sess.positionPercentile !== null
                    ? `Top ${sess.positionPercentile}% toàn khóa`
                    : "Chưa nộp bài"}
                </div>
                {sess.higherThanPercent !== null && (
                  <p className="text-[11px] sm:text-base text-slate-300 font-bold truncate">
                    Cao hơn {sess.higherThanPercent}% bạn học
                  </p>
                )}
              </div>

              {/* Footer: Rank & Score + Growth Indicator */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs sm:text-base font-mono font-bold text-slate-400 min-w-0">
                <span className={isCurrent ? "text-amber-400 font-black" : "text-slate-300"}>
                  {sess.rankText}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-cyan-400 font-black">
                    {sess.score !== null ? `${sess.score}đ` : "—"}
                  </span>
                  {sess.scoreDelta !== null && (
                    <span
                      className={`text-[10px] sm:text-sm font-black ${sess.scoreDelta >= 0 ? "text-emerald-400" : "text-rose-400"
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
