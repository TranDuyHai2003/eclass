"use client";

import { useState } from "react";
import { RankingUser, PersonalRankingContext } from "@/actions/ranking";
import { CheckCircle2, Flame, Star, Info, ChevronDown, ChevronUp, Trophy } from "lucide-react";

interface PersonalCardProps {
  currentUser: RankingUser | null;
  whyRanked?: PersonalRankingContext["whyRanked"];
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  gaps?: {
    aheadGapScore: number;
    aheadStudentName: string;
    behindGapScore: number;
    behindStudentName: string;
  };
}

export function PersonalCard({
  currentUser,
  whyRanked,
  studyClassName = "10A1",
  totalStudents = 32,
  classAvgScore = 7.8,
  gaps,
}: PersonalCardProps) {
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const user = currentUser || {
    id: "current",
    name: "Trần Duy Hải",
    image: null,
    rank: 12,
    score: 8.10,
    avgScore: 8.10,
    rankingScore: 81.0,
    completedTests: 12,
    isEligible: true,
    rankChange: 5,
    lastSubmitAt: null,
    isCurrentUser: true,
  };

  const rank = user.rank || 12;
  const rankChange = user.rankChange ?? 5;
  const total = totalStudents || 32;
  const topPercent = Math.max(5, Math.ceil((rank / total) * 100));

  const aheadGap = gaps?.aheadGapScore ?? 0.15;
  const aheadTargetRank = Math.max(1, rank - 1);
  const behindGap = gaps?.behindGapScore ?? 0.1;
  const behindRank = rank + 1;

  const userAvg = user.avgScore || user.score || 8.10;
  const scoreDiff = parseFloat((userAvg - classAvgScore).toFixed(2));
  const completed = user.completedTests || 12;

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
            <span className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md border border-white shadow-sm">
              #{rank}
            </span>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">
                {user.name} (Bạn)
              </h2>
              {/* RANK CHANGE REASON BADGE */}
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold inline-flex items-center gap-1 leading-tight">
                {rankChange && rankChange > 0 ? (
                  <>↑ Tăng {rankChange} bậc (+{completed} bài nộp, ĐTB {userAvg.toFixed(2)})</>
                ) : rankChange && rankChange < 0 ? (
                  <>↓ Giảm {Math.abs(rankChange)} bậc</>
                ) : (
                  <>⚡ Phong độ ổn định (+{completed} bài nộp)</>
                )}
              </span>
            </div>

            {/* CLASS COMPARISON DATA */}
            <p className="text-xs sm:text-sm text-slate-700 font-semibold leading-normal">
              Đang xếp hạng{" "}
              <strong className="text-blue-600 font-black">
                {rank} / {total}
              </strong>{" "}
              trong lớp •{" "}
              <span className="text-emerald-700 font-extrabold">
                Thuộc Top {topPercent}% lớp
              </span>
            </p>
          </div>
        </div>

        {/* Score Display */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-7 py-4 rounded-2xl shadow-lg shadow-blue-500/20 text-center flex flex-col items-center justify-center w-full md:w-auto shrink-0 min-w-[190px]">
          <span className="text-xs font-extrabold text-blue-100 uppercase tracking-wider block mb-0.5">
            Điểm Trung Bình
          </span>
          <strong className="text-3xl sm:text-4xl font-black tracking-tight block leading-none py-1">
            {userAvg.toFixed(2)}
          </strong>
          <span className="text-xs font-extrabold text-emerald-300">
            {scoreDiff >= 0 ? `▲ Cao hơn ĐTB Lớp (+${scoreDiff.toFixed(2)})` : `▼ Thấp hơn ĐTB Lớp (${scoreDiff.toFixed(2)})`}
          </span>
        </div>
      </div>

      {/* KHOẢNG CÁCH HAI ĐẦU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-blue-50/80 border border-blue-200/80 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm gap-2">
          <div className="space-y-1 min-w-0">
            <span className="text-slate-500 font-bold block text-xs uppercase truncate">
              Khoảng cách tới vị trí #{aheadTargetRank}
            </span>
            <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
              Còn{" "}
              <strong className="text-blue-600 font-black">
                +{aheadGap.toFixed(2)} điểm
              </strong>{" "}
              để vượt
            </span>
          </div>
          <span className="text-blue-700 font-black text-sm shrink-0 bg-blue-100 px-2.5 py-1 rounded-lg">
            82%
          </span>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm gap-2">
          <div className="space-y-1 min-w-0">
            <span className="text-slate-500 font-bold block text-xs uppercase truncate">
              Khoảng cách an toàn phía sau
            </span>
            <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
              Dẫn trước vị trí #{behindRank}{" "}
              <strong className="text-emerald-700 font-black">
                +{behindGap.toFixed(2)} điểm
              </strong>
            </span>
          </div>
          <span className="text-emerald-700 font-black text-xs bg-emerald-100 px-2.5 py-1 rounded-lg shrink-0">
            An toàn
          </span>
        </div>
      </div>

      {/* MỤC TIÊU CÁ NHÂN TRONG LỚP */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-center sm:text-left min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center shrink-0 font-black text-lg shadow-xs border border-indigo-100">
            🎯
          </div>
          <div className="min-w-0">
            <span className="text-xs font-extrabold text-slate-500 block uppercase tracking-wide">
              Mục tiêu cá nhân tháng 8
            </span>
            <h4 className="text-sm font-black text-slate-900 truncate mt-0.5">
              Gia nhập Top 10 của Lớp
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">
            Còn <strong className="text-indigo-600 font-black">0.35 điểm</strong>
          </span>
          <div className="w-24 h-2.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
            <div className="bg-indigo-600 h-full w-[73%]"></div>
          </div>
          <span className="text-xs font-black text-indigo-600 whitespace-nowrap">73%</span>
        </div>
      </div>

      {/* HUY HIỆU DỰA TRÊN HỌC TẬP THỰC TẾ & NÚT HƯỚNG DẪN CÁCH TÍNH */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Hoàn thành {completed} bài tập
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            Chuỗi học tập 8 bài
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
            <Star className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0" />
            ĐTB trên {userAvg >= 8.0 ? "8.0" : userAvg.toFixed(1)}
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
              <span className="text-xs font-bold text-slate-500 block uppercase">75% Trọng số</span>
              <strong className="text-blue-700 font-extrabold text-sm block mt-0.5">Kết quả học tập</strong>
              <span className="text-xs text-slate-500 font-medium">(Academic Score)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold text-slate-500 block uppercase">15% Trọng số</span>
              <strong className="text-indigo-700 font-extrabold text-sm block mt-0.5">Hoàn thành bài</strong>
              <span className="text-xs text-slate-500 font-medium">(Completion Score)</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold text-slate-500 block uppercase">10% Trọng số</span>
              <strong className="text-emerald-700 font-extrabold text-sm block mt-0.5">Tham gia gần đây</strong>
              <span className="text-xs text-slate-500 font-medium">(30 ngày qua)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5 text-slate-700 font-semibold">
            <p>• <strong>Điều kiện ghi danh:</strong> Hoàn thành tối thiểu 5 bài kiểm tra.</p>
            <p>• <strong>Quy tắc hòa điểm (Tie-breaker):</strong> 1. ĐTB cao hơn $\rightarrow$ 2. Tỷ lệ hoàn thành cao hơn $\rightarrow$ 3. Tổng số bài nộp $\rightarrow$ 4. Nộp bài gần đây nhất.</p>
          </div>
        </div>
      )}
    </section>
  );
}
