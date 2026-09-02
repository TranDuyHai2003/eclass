"use client";

import { useState, useMemo } from "react";
import { RankingUser } from "@/actions/ranking";
import { getSafeAvatarUrl } from "@/lib/game-rank";
import { Grid, ShieldAlert, CheckCircle2, XCircle, Filter, Swords, Flame, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface MatrixStudentItem extends RankingUser {
  recent8Matrix?: {
    testId: string;
    testTitle: string;
    lessonId?: string;
    courseId?: string;
    isCompleted: boolean;
    score: number | null;
  }[];
  completedCountInLast8?: number;
  totalTestsTracked?: number;
}

interface Last8TestsMatrixBoardProps {
  leaderboard: MatrixStudentItem[];
  totalStudentsInClass?: number;
  isTeacherView?: boolean;
}

export function Last8TestsMatrixBoard({
  leaderboard = [],
  totalStudentsInClass = 140,
  isTeacherView = false,
}: Last8TestsMatrixBoardProps) {
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
    // Sort by WORST performance / most missed tests FIRST (completedCountInLast8 ASC -> completedTests ASC -> avgScore ASC)
    const sortedAll = [...matrixList].sort((a, b) => {
      if (a.completedCountInLast8 !== b.completedCountInLast8) {
        return a.completedCountInLast8 - b.completedCountInLast8; // Most missed tests FIRST (0/8 before 1/8 before 2/8... before 8/8)
      }
      if (a.completedTests !== b.completedTests) {
        return a.completedTests - b.completedTests;
      }
      if (a.avgScore !== b.avgScore) {
        return a.avgScore - b.avgScore;
      }
      return a.id.localeCompare(b.id);
    });

    return sortedAll.map((s, idx) => ({
      ...s,
      matrixRankPos: idx + 1,
      missedCount: s.totalTracked - s.completedCountInLast8,
    }));
  }, [matrixList]);

  const displayedList = useMemo(() => {
    return filteredList;
  }, [filteredList]);

  const totalTrackedCount = matrixList[0]?.totalTracked || 8;
  const completedFullCount = matrixList.filter((s) => s.completedCountInLast8 === totalTrackedCount).length;
  const unfinishedCount = matrixList.filter((s) => s.completedCountInLast8 < totalTrackedCount).length;

  const testHeaders = matrixList[0]?.matrix || Array.from({ length: 8 }, (_, i) => ({
    testId: `test-${i + 1}`,
    testTitle: `Bài ${String(i + 1).padStart(2, "0")}`,
  }));

  const getAvatarUrl = (u: any) => {
    if (!u) return "";
    return getSafeAvatarUrl(u.name, u.image);
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
              MA TRẬN BÁO ĐỘNG
            </h3>
          </div>
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
          <span className="text-xs text-emerald-400 uppercase font-bold block">HOÀN THÀNH 100% ({totalTrackedCount}/{totalTrackedCount} BÀI)</span>
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
      {/* MOBILE MATRIX CARDS VIEW (sm:hidden) - Zero horizontal scroll hassle */}
      <div className="sm:hidden space-y-3 relative z-10 font-mono">
        {displayedList.map((user) => {
          const isUnfinished = user.completedCountInLast8 < totalTrackedCount;
          const isZero = user.completedCountInLast8 === 0;
          const displayPos = user.rankPos;

          return (
            <div
              key={user.id}
              className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                isZero
                  ? "bg-red-950/20 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                  : isUnfinished
                  ? "bg-[#080B12]/80 border-amber-500/40"
                  : "bg-[#080B12]/60 border-slate-800"
              }`}
            >
              {/* Header: Student Info + Rank + Completed Count */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                    <Image
                      src={getAvatarUrl(user)}
                      alt={user.name || "Thợ săn"}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h5 className="font-black text-white text-xs leading-snug truncate" title={user.name || undefined}>
                      {user.name}
                    </h5>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      ĐTB: <strong className="text-amber-300">{user.avgScore.toFixed(1)}đ</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-cyan-300">
                    #{String(displayPos).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      user.completedCountInLast8 === totalTrackedCount
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                        : isZero
                        ? "bg-red-500/20 border-red-500/60 text-red-300 animate-pulse"
                        : "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    }`}
                  >
                    {user.completedCountInLast8}/{totalTrackedCount} Bài
                  </span>
                </div>
              </div>

              {/* Status Alert Tag */}
              {isZero ? (
                <div className="flex items-center gap-1.5 text-[11px] font-black text-red-400 bg-red-950/40 border border-red-500/40 px-2.5 py-1 rounded-xl">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>CẢNH BÁO: Chưa nộp bài thi nào trong {totalTrackedCount} bài!</span>
                </div>
              ) : isUnfinished ? (
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 bg-amber-950/30 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                  <span>⚠️ Còn thiếu {user.missedCount} bài thi chưa làm</span>
                  <span className="text-amber-400 font-black">CẦN BỔ SUNG</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Đã hoàn thành xuất sắc 100% bài thi theo dõi</span>
                </div>
              )}

              {/* 8-Test Matrix Grid (4x2 layout for mobile) */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5 font-mono">
                {user.matrix.map((cell: any, idx) => {
                  const header = testHeaders[idx] as any;
                  const lessonId = cell.lessonId || header?.lessonId;
                  const testId = cell.testId || header?.testId || header?.id;
                  const targetUrl = lessonId ? `/watch/${lessonId}/quiz` : (testId ? `/tests/${testId}` : null);
                  const displayTitle = `Bài ${String(idx + 1).padStart(2, "0")}`;

                  const pill = (
                    <div
                      className={`p-1.5 rounded-xl border text-center transition-all ${
                        cell.isCompleted
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-red-500/15 border-red-500/40 text-red-300"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 block font-bold whitespace-nowrap">
                        {displayTitle}
                      </span>
                      <span className="text-[11px] font-black block mt-0.5">
                        {cell.isCompleted ? (cell.score !== null ? `${cell.score}đ` : "✓") : "✕"}
                      </span>
                    </div>
                  );

                  if (targetUrl) {
                    return (
                      <Link key={idx} href={targetUrl} title={`Vào làm bài: ${header?.testTitle || cell.testTitle || displayTitle}`} className="block">
                        {pill}
                      </Link>
                    );
                  }

                  return <div key={idx}>{pill}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP MATRIX TABLE (hidden sm:block) - Compact & 100% Full-Width Fit on PC */}
      <div className="hidden sm:block overflow-x-auto custom-scrollbar w-full rounded-2xl border border-slate-800/80 bg-[#080B12]/50 backdrop-blur-md relative z-10 shadow-xl min-w-0">
        <table className="w-full text-left text-xs sm:text-sm text-slate-300 font-medium border-collapse">
          <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider font-black text-xs border-b border-slate-800/90 font-mono">
            <tr>
              <th className="py-3 px-1.5 text-center w-[55px] sm:w-[65px] shrink-0 sticky left-0 bg-[#0B0F17] z-20 shadow-md">
                HẠNG
              </th>
              <th className="py-3 px-2 min-w-[130px] lg:min-w-[160px] sticky left-[55px] sm:left-[65px] bg-[#0B0F17] z-20 shadow-md">THỢ SĂN</th>
              {testHeaders.map((t: any, idx) => {
                const targetUrl = t.lessonId ? `/watch/${t.lessonId}/quiz` : (t.testId || t.id ? `/tests/${t.testId || t.id}` : null);
                const displayTitle = `Bài ${String(idx + 1).padStart(2, "0")}`;
                const hoverTitle = t.testTitle && !t.testTitle.startsWith("Bài ") ? `${t.testTitle} (${displayTitle})` : displayTitle;

                return (
                  <th key={t.testId || t.id || idx} className="py-3 px-1 text-center min-w-[65px]">
                    {targetUrl ? (
                      <Link
                        href={targetUrl}
                        title={`Vào làm bài: ${hoverTitle}`}
                        className="hover:text-cyan-300 hover:underline transition-colors block cursor-pointer whitespace-nowrap"
                      >
                        {displayTitle}
                      </Link>
                    ) : (
                      <span className="whitespace-nowrap" title={hoverTitle}>{displayTitle}</span>
                    )}
                  </th>
                );
              })}
              <th className="py-3 px-1.5 text-center min-w-[80px] sm:min-w-[90px] sticky right-0 bg-[#0B0F17] z-20 shadow-md">
                TỔNG NỘP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {displayedList.map((user) => {
              const isUnfinished = user.completedCountInLast8 < totalTrackedCount;
              const isZero = user.completedCountInLast8 === 0;
              const displayPos = user.rankPos;

              return (
                <tr
                  key={user.id}
                  className={`transition-colors duration-150 group/row ${isZero
                    ? "bg-red-950/30 border-l-4 border-l-red-500 hover:bg-red-950/50"
                    : isUnfinished
                      ? "hover:bg-amber-950/20"
                      : "hover:bg-cyan-950/20"
                    }`}
                >
                  {/* Position */}
                  <td className="py-2.5 px-1.5 text-center font-black sticky left-0 bg-[#080B12] group-hover/row:bg-slate-900 z-10 w-[55px] sm:w-[65px] shrink-0">
                    <span className={`text-xs sm:text-sm font-mono font-black ${isUnfinished ? "text-amber-400" : "text-slate-300"}`}>
                      #{String(displayPos).padStart(2, "0")}
                    </span>
                  </td>

                  {/* Name & Avatar */}
                  <td className="py-2.5 px-2 sticky left-[55px] sm:left-[65px] bg-[#080B12] group-hover/row:bg-slate-900 z-10 min-w-[130px] lg:min-w-[160px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                        <Image
                          src={getAvatarUrl(user)}
                          alt={user.name || "Thợ săn"}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-black text-white text-xs sm:text-sm truncate group-hover/row:text-cyan-300 transition-colors" title={user.name || undefined}>
                          {user.name}
                        </h5>
                        <span className="text-[11px] text-slate-400 font-normal block">
                          ĐTB: {user.avgScore.toFixed(1)}đ
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 8 Test Columns */}
                  {user.matrix.map((cell: any, idx) => {
                    const header = testHeaders[idx] as any;
                    const lessonId = cell.lessonId || header?.lessonId;
                    const testId = cell.testId || header?.testId || header?.id;
                    const targetUrl = lessonId ? `/watch/${lessonId}/quiz` : (testId ? `/tests/${testId}` : null);

                    const cellBadge = cell.isCompleted ? (
                      <span className="whitespace-nowrap inline-flex items-center justify-center gap-1 text-[11px] font-mono font-black px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm group-hover/cell:scale-105 group-hover/cell:border-emerald-400 transition-all">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{cell.score !== null ? `${cell.score}đ` : "Đã làm"}</span>
                      </span>
                    ) : (
                      <span className="whitespace-nowrap inline-flex items-center justify-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 shadow-sm group-hover/cell:scale-105 group-hover/cell:border-red-400 transition-all">
                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span>Chưa làm</span>
                      </span>
                    );

                    return (
                      <td key={idx} className="py-2.5 px-1 text-center min-w-[68px] sm:min-w-[75px]">
                        {targetUrl ? (
                          <Link
                            href={targetUrl}
                            title={`Vào làm bài: ${header?.testTitle || cell.testTitle || "Bài thi"}`}
                            className="block group/cell cursor-pointer"
                          >
                            {cellBadge}
                          </Link>
                        ) : (
                          cellBadge
                        )}
                      </td>
                    );
                  })}

                  {/* Total Completed Badge */}
                  <td className="py-2.5 px-1.5 text-center sticky right-0 bg-[#080B12] group-hover/row:bg-slate-900 z-10 min-w-[80px] sm:min-w-[90px] shrink-0">
                    <span
                      className={`whitespace-nowrap inline-flex items-center justify-center text-xs font-mono font-black px-2 py-0.5 rounded-full border ${user.completedCountInLast8 === totalTrackedCount
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                        : user.completedCountInLast8 === 0
                          ? "bg-red-500/15 border-red-500/60 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse"
                          : "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
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
