"use client";

import { useState, useMemo } from "react";
import { RankingUser } from "@/actions/ranking";
import { Grid, ShieldAlert, CheckCircle2, XCircle, Filter, Swords, Flame, Sparkles } from "lucide-react";
import Image from "next/image";

interface MatrixStudentItem extends RankingUser {
  recent8Matrix?: {
    testId: string;
    testTitle: string;
    isCompleted: boolean;
    score: number | null;
  }[];
  completedCountInLast8?: number;
  totalTestsTracked?: number;
}

interface Last8TestsMatrixBoardProps {
  leaderboard: MatrixStudentItem[];
  totalStudentsInClass?: number;
}

export function Last8TestsMatrixBoard({
  leaderboard = [],
  totalStudentsInClass = 140,
}: Last8TestsMatrixBoardProps) {
  const [filterMode, setFilterMode] = useState<"ALL" | "UNFINISHED">("ALL");

  const matrixList = useMemo(() => {
    return leaderboard.map((user, idx) => {
      const matrix = user.recent8Matrix || Array.from({ length: 8 }, (_, i) => ({
        testId: `test-${i + 1}`,
        testTitle: `Bài ${String(i + 1).padStart(2, "0")}`,
        isCompleted: user.completedTests > i,
        score: user.completedTests > i ? user.avgScore : null,
      }));

      const completedCount = user.completedCountInLast8 ?? matrix.filter((m) => m.isCompleted).length;

      return {
        ...user,
        matrix,
        completedCountInLast8: completedCount,
        totalTracked: matrix.length,
        rankPos: user.rank || idx + 1,
      };
    });
  }, [leaderboard]);

  const filteredList = useMemo(() => {
    if (filterMode === "UNFINISHED") {
      const unfinished = matrixList.filter((s) => s.completedCountInLast8 < s.totalTracked);

      // Sort: Most missed tests FIRST (completedCountInLast8 ASC)
      unfinished.sort((a, b) => {
        if (a.completedCountInLast8 !== b.completedCountInLast8) {
          return a.completedCountInLast8 - b.completedCountInLast8; // 0/8 before 1/8 before 2/8...
        }
        if (a.avgScore !== b.avgScore) {
          return a.avgScore - b.avgScore; // Lower avg score first
        }
        return a.id.localeCompare(b.id);
      });

      return unfinished.map((s, idx) => ({
        ...s,
        warningRankPos: idx + 1,
        missedCount: s.totalTracked - s.completedCountInLast8,
      }));
    }

    return matrixList.map((s) => ({
      ...s,
      warningRankPos: null,
      missedCount: s.totalTracked - s.completedCountInLast8,
    }));
  }, [matrixList, filterMode]);

  const totalTrackedCount = matrixList[0]?.totalTracked || 8;
  const completedFullCount = matrixList.filter((s) => s.completedCountInLast8 === totalTrackedCount).length;
  const unfinishedCount = matrixList.filter((s) => s.completedCountInLast8 < totalTrackedCount).length;

  const testHeaders = matrixList[0]?.matrix || Array.from({ length: 8 }, (_, i) => ({
    testId: `test-${i + 1}`,
    testTitle: `Bài ${String(i + 1).padStart(2, "0")}`,
  }));

  const getAvatarUrl = (u: any) => {
    if (!u) return "";
    const userName = u.name || "Thợ săn";
    return u.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`;
  };

  return (
    <section className="rounded-none sm:rounded-3xl border-y sm:border border-slate-800/80 bg-[#0D121D]/95 backdrop-blur-xl shadow-2xl text-slate-100 overflow-hidden space-y-4 sm:space-y-6 p-3.5 sm:p-6 lg:p-8 relative group w-full min-w-0 max-w-full">
      {/* Header Row: MA TRẬN 8 BÀI THI GẦN NHẤT */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800/80 pb-4 gap-3 relative z-10 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
            <Grid className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-sm sm:text-xl lg:text-2xl tracking-widest text-slate-100 uppercase flex items-center gap-2">
              MA TRẬN NỘP BÀI · 8 BÀI THI GẦN NHẤT
            </h3>
            <p className="text-xs sm:text-base text-slate-400 font-mono">
              Theo dõi chi tiết học sinh nào đã làm bài và học sinh nào chưa nộp bài
            </p>
          </div>
        </div>

        {/* Filter Switch Buttons */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950/90 border border-slate-800/80 shrink-0 self-start lg:self-auto">
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${
              filterMode === "ALL"
                ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>TẤT CẢ ({matrixList.length})</span>
          </button>
          <button
            onClick={() => setFilterMode("UNFINISHED")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-base font-black transition-all flex items-center gap-1.5 ${
              filterMode === "UNFINISHED"
                ? "bg-gradient-to-r from-red-600/30 to-rose-600/30 text-red-300 border border-red-400/60 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>🚨 CHƯA NỘP ĐỦ BÀI ({unfinishedCount})</span>
          </button>
        </div>
      </div>

      {/* Summary Diagnostic Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 font-mono">
        <div className="bg-[#080B12]/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 uppercase font-bold block">TỔNG SỐ BÀI THEO DÕI</span>
          <div className="text-base sm:text-xl lg:text-2xl font-black text-cyan-300">
            {totalTrackedCount} Bài Thi Gần Nhất
          </div>
        </div>

        <div className="bg-[#080B12]/90 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
          <span className="text-xs text-emerald-400 uppercase font-bold block">HOÀN THÀNH 100% (8/8 BÀI)</span>
          <div className="text-base sm:text-xl lg:text-2xl font-black text-emerald-300">
            {completedFullCount} / {matrixList.length} Học Sinh
          </div>
        </div>

        <div className="bg-[#080B12]/90 border border-red-500/40 p-3.5 rounded-xl space-y-1">
          <span className="text-xs text-red-400 uppercase font-bold block">🚨 CHƯA NỘP BÀI NÀO / THIẾU BÀI</span>
          <div className="text-base sm:text-xl lg:text-2xl font-black text-red-400">
            {unfinishedCount} Học Sinh (Báo Động)
          </div>
        </div>
      </div>

      {/* MATRIX TABLE (Responsive Scrollable Grid with Minimum text-base on PC) */}
      <div className="overflow-x-auto w-full rounded-2xl border border-slate-800/80 bg-[#080B12]/50 backdrop-blur-md relative z-10 shadow-xl min-w-0">
        <table className="w-full text-left text-base text-slate-300 font-medium border-collapse">
          <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider font-black text-xs sm:text-base border-b border-slate-800/90 font-mono">
            <tr>
              <th className="py-4 px-4 text-center min-w-[120px] sticky left-0 bg-[#0B0F17] z-20 shadow-md">
                {filterMode === "UNFINISHED" ? "🚨 HẠNG CHƯA LÀM" : "HẠNG"}
              </th>
              <th className="py-4 px-5 min-w-[200px] sticky left-[120px] bg-[#0B0F17] z-20 shadow-md">THỢ SẮN</th>
              {testHeaders.map((t, idx) => (
                <th key={t.testId || idx} className="py-4 px-3 text-center min-w-[110px]">
                  {t.testTitle}
                </th>
              ))}
              <th className="py-4 px-4 text-center min-w-[110px] sticky right-0 bg-[#0B0F17] z-20 shadow-md">
                TỔNG NỘP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredList.map((user) => {
              const isUnfinished = user.completedCountInLast8 < totalTrackedCount;
              const isZero = user.completedCountInLast8 === 0;
              const displayPos = filterMode === "UNFINISHED" ? user.warningRankPos : user.rankPos;

              return (
                <tr
                  key={user.id}
                  className={`transition-colors duration-150 group/row ${
                    isZero
                      ? "bg-red-950/30 border-l-4 border-l-red-500 hover:bg-red-950/50"
                      : isUnfinished
                      ? "hover:bg-amber-950/20"
                      : "hover:bg-cyan-950/20"
                  }`}
                >
                  {/* Position */}
                  <td className="py-3.5 px-4 text-center font-black sticky left-0 bg-[#080B12] group-hover/row:bg-slate-900 z-10">
                    <span className={`text-sm sm:text-base font-black ${filterMode === "UNFINISHED" && displayPos === 1 ? "text-red-400 animate-pulse bg-red-950/80 px-2 py-1 rounded-md border border-red-500/60" : "text-slate-300"}`}>
                      #{String(displayPos).padStart(2, "0")} {filterMode === "UNFINISHED" && displayPos === 1 ? "🚨 TOP 1" : ""}
                    </span>
                  </td>

                  {/* Name & Avatar */}
                  <td className="py-3.5 px-5 sticky left-[120px] bg-[#080B12] group-hover/row:bg-slate-900 z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                        <Image
                          src={getAvatarUrl(user)}
                          alt={user.name || "Thợ săn"}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-black text-white text-sm sm:text-base lg:text-lg truncate max-w-[180px]">
                          {user.name}
                        </h5>
                        <span className="text-xs text-slate-400 font-normal block">
                          ĐTB: {user.avgScore.toFixed(1)}đ
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 8 Test Columns */}
                  {user.matrix.map((cell, idx) => (
                    <td key={idx} className="py-3.5 px-3 text-center">
                      {cell.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs sm:text-base font-black px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{cell.score !== null ? `${cell.score}đ` : "Đã làm"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs sm:text-base font-black px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-500/80 text-red-300 shadow-sm animate-pulse">
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Chưa làm</span>
                        </span>
                      )}
                    </td>
                  ))}

                  {/* Total Completed Badge */}
                  <td className="py-3.5 px-4 text-center sticky right-0 bg-[#080B12] group-hover/row:bg-slate-900 z-10">
                    <span
                      className={`inline-block text-xs sm:text-base font-mono font-black px-3 py-1 rounded-full border ${
                        user.completedCountInLast8 === totalTrackedCount
                          ? "bg-emerald-950/90 border-emerald-500/70 text-emerald-300"
                          : user.completedCountInLast8 === 0
                          ? "bg-red-950/90 border-red-500/90 text-red-300 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                          : "bg-amber-950/90 border-amber-500/70 text-amber-300"
                      }`}
                    >
                      {user.completedCountInLast8} / {totalTrackedCount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
