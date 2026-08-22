"use client";

import { useState } from "react";
import { RankingUser, PersonalRankingContext } from "@/actions/ranking";
import { RankStatus } from "@/lib/ranking-config";
import { CheckCircle2, Flame, Star, Info, ChevronDown, ChevronUp, Trophy, Award } from "lucide-react";

interface PersonalCardProps {
  currentUser: RankingUser | null;
  whyRanked?: PersonalRankingContext["whyRanked"];
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  gaps?: {
    aheadGapScore: number | null;
    aheadStudentName: string | null;
    behindGapScore: number | null;
    behindStudentName: string | null;
  };
}

export function PersonalCard({
  currentUser,
  whyRanked,
  studyClassName,
  totalStudents,
  classAvgScore,
  gaps,
}: PersonalCardProps) {
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  if (!currentUser) {
    return (
      <section className="glass-card rounded-3xl p-6 border border-slate-200 bg-white/95 text-center text-slate-500">
        <Trophy className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">Chưa có thông tin xếp hạng cá nhân</p>
      </section>
    );
  }

  const user = currentUser;
  const rank = user.rank;
  const rankChange = user.rankChange;
  const total = totalStudents || 0;
  const topPercent = (rank && total > 0) ? Math.max(1, Math.ceil((rank / total) * 100)) : null;

  const aheadGap = gaps?.aheadGapScore != null ? gaps.aheadGapScore : null;
  const aheadTargetRank = rank && rank > 1 ? rank - 1 : null;
  const behindGap = gaps?.behindGapScore != null ? gaps.behindGapScore : null;
  const behindRank = rank ? rank + 1 : null;

  const userAvg = user.avgScore || user.score || 0;
  const completed = user.completedTests || 0;

  const academicScore = user.academicScore ?? parseFloat((userAvg * 10).toFixed(1));
  const completionBonus = user.completionBonus ?? 0;
  const activityBonus = user.activityBonus ?? 0;
  const rankingScore = user.rankingScore ?? (academicScore + completionBonus + activityBonus);
  const rankStatus = user.rankStatus || RankStatus.SAME;

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-7 border-2 border-blue-500/40 shadow-xl shadow-blue-500/10 bg-white/95 backdrop-blur-2xl space-y-5">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-5 pb-5 border-b border-slate-100 text-center md:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl border-2 border-blue-500 overflow-hidden shadow-md bg-blue-50 flex items-center justify-center font-extrabold text-blue-600 text-xl">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "Avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user.name?.[0] || "H"}</span>
              )}
            </div>
            {rank !== null && (
              <span className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md border border-white shadow-sm">
                #{rank}
              </span>
            )}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">
                {user.name || "Bạn"} (Bạn)
              </h2>
              {/* RANK STATUS BADGE */}
              {rankStatus === RankStatus.NEW && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black inline-flex items-center gap-1 leading-tight animate-pulse">
                  ✨ Mới ghi danh Top Lớp!
                </span>
              )}
              {rankStatus === RankStatus.UP && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold inline-flex items-center gap-1 leading-tight">
                  ↑ Tăng {rankChange || 1} bậc
                </span>
              )}
              {rankStatus === RankStatus.DOWN && (
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-extrabold inline-flex items-center gap-1 leading-tight">
                  ↓ Giảm {Math.abs(rankChange || 1)} bậc
                </span>
              )}
              {rankStatus === RankStatus.SAME && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold inline-flex items-center gap-1 leading-tight">
                  ⚡ Phong độ ổn định
                </span>
              )}
            </div>

            {/* CLASS COMPARISON DATA */}
            <p className="text-xs sm:text-sm text-slate-700 font-semibold leading-normal">
              {studyClassName ? `${studyClassName} • ` : ""}
              {rank !== null ? (
                <>
                  Đang xếp hạng{" "}
                  <strong className="text-blue-600 font-black">
                    #{rank} {total > 0 ? `/ ${total}` : ""}
                  </strong>
                  {topPercent !== null && (
                    <span className="text-emerald-700 font-extrabold ml-1">
                      (Top {topPercent}%)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-700 font-semibold">Chưa đủ bài thi để vào xếp hạng chính thức</span>
              )}
            </p>
          </div>
        </div>

        {/* Score Display with Breakdown */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-4 sm:p-5 rounded-2xl shadow-xl border border-indigo-800/50 w-full md:w-auto shrink-0 min-w-[240px]">
          <div className="flex items-center justify-between gap-2 border-b border-indigo-800/60 pb-2 mb-2">
            <span className="text-[11px] font-extrabold text-indigo-200 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Điểm Ranking Tổng
            </span>
            <strong className="text-2xl font-black text-amber-400 tracking-tight">
              {rankingScore.toFixed(1)} <span className="text-xs font-normal text-indigo-300">đ</span>
            </strong>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/5">
              <span className="text-[10px] text-indigo-200 font-bold block">Học Thuật</span>
              <strong className="text-sm font-black text-white">{academicScore.toFixed(1)}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/5">
              <span className="text-[10px] text-emerald-300 font-bold block">Thưởng Bài</span>
              <strong className="text-sm font-black text-emerald-300">+{completionBonus.toFixed(1)}</strong>
            </div>
            <div className="bg-white/10 rounded-xl p-1.5 border border-white/5">
              <span className="text-[10px] text-amber-300 font-bold block">Thưởng Chăm</span>
              <strong className="text-sm font-black text-amber-300">+{activityBonus.toFixed(1)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* KHOẢNG CÁCH THỰC TẾ (NẾU CÓ DỮ LIỆU) */}
      {(aheadGap !== null || behindGap !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {typeof aheadGap === "number" && aheadTargetRank && (
            <div className="bg-blue-50/80 border border-blue-200/80 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-slate-500 font-bold block text-xs uppercase truncate">
                  Khoảng cách tới vị trí #{aheadTargetRank} ({gaps?.aheadStudentName || "Đối thủ"})
                </span>
                <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                  Kém{" "}
                  <strong className="text-blue-600 font-black">
                    +{aheadGap.toFixed(2)} điểm
                  </strong>
                </span>
              </div>
            </div>
          )}

          {typeof behindGap === "number" && behindRank && (
            <div className="bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-slate-500 font-bold block text-xs uppercase truncate">
                  Khoảng cách vị trí #{behindRank} ({gaps?.behindStudentName || "Đối thủ"})
                </span>
                <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                  Dẫn trước{" "}
                  <strong className="text-emerald-700 font-black">
                    +{behindGap.toFixed(2)} điểm
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HUY HIỆU THỰC TẾ & CÔNG THỨC */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Hoàn thành {completed} bài kiểm tra
          </span>
          {user.streak ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-extrabold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              Streak {user.streak} ngày liên tiếp
            </span>
          ) : null}
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
            <Star className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0" />
            ĐTB {userAvg.toFixed(1)}
          </span>
        </div>

        <button
          onClick={() => setShowFormulaInfo(!showFormulaInfo)}
          className="text-xs sm:text-sm font-extrabold text-blue-600 hover:text-blue-800 transition flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
        >
          <Info className="w-4 h-4 text-blue-500" />
          <span>🏆 Cách tính xếp hạng</span>
          {showFormulaInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* FORMULA EXPLANATION ACCORDION */}
      {showFormulaInfo && (
        <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3 animate-in fade-in duration-200">
          <div className="font-black text-slate-900 flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Công thức tính điểm Đấu Trường Xếp Hạng eClass:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold text-slate-500 block uppercase">Năng Lực Gốc</span>
              <strong className="text-blue-700 font-extrabold text-sm block mt-0.5">Academic Score</strong>
              <span className="text-xs text-slate-500 font-medium">= ĐTB × 10 (tối đa 100đ)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold text-emerald-600 block uppercase">Điểm Thưởng Bài</span>
              <strong className="text-emerald-700 font-extrabold text-sm block mt-0.5">Completion Bonus</strong>
              <span className="text-xs text-slate-500 font-medium">Tối đa +7đ (+0.7 GPA)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold text-amber-600 block uppercase">Điểm Thưởng Chăm</span>
              <strong className="text-amber-700 font-extrabold text-sm block mt-0.5">Activity Bonus</strong>
              <span className="text-xs text-slate-500 font-medium">Tối đa +3đ (+0.3 GPA)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5 text-slate-700 font-semibold">
            <p>• <strong>Triết lý:</strong> Học thuật chiếm 85–90%. Điểm thưởng giúp bứt phá khi năng lực tương đương.</p>
            <p>• <strong>Điều kiện ghi danh:</strong> Hoàn thành tối thiểu 5 bài kiểm tra khác nhau.</p>
            <p>• <strong>Tie-breaker:</strong> 1. Ranking Score → 2. Điểm TB → 3. Số bài hoàn thành → 4. Chuỗi học tập.</p>
          </div>
        </div>
      )}
    </section>
  );
}
