"use client";

import { Award, CheckCircle2, ShieldAlert, Users, GraduationCap, Castle, Swords, Skull, Scroll } from "lucide-react";

interface TeacherQuickStatsProps {
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  completionRate?: number;
  rankSCount?: number;
  needSupportCount?: number;
}

export function TeacherQuickStats({
  studyClassName,
  totalStudents = 30,
  classAvgScore = 7.8,
  completionRate = 92,
  rankSCount = 8,
  needSupportCount = 3,
}: TeacherQuickStatsProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Castle className="w-5 h-5 animate-pulse text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>TỔNG QUAN HỌC LỰC CẢ LỚP {studyClassName ? `• LỚP ${studyClassName}` : ""}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Chỉ số quản trị phân hạng thợ săn và đo lường hiệu suất học tập
            </p>
          </div>
        </div>

        <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>Sĩ số: {totalStudents} Học sinh</span>
        </span>
      </div>

      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Điểm TB Lớp */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xl shadow-slate-950/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Điểm TB Lớp
            </span>
            <div className="text-2xl font-black font-mono text-blue-600">
              {classAvgScore.toFixed(1)} / 10
            </div>
            <span className="text-[11px] text-emerald-600 font-bold">
              ↑ +0.3đ so với tuần trước
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Swords className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Tỷ Lệ Hoàn Thành */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xl shadow-slate-950/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Tỷ Lệ Hoàn Thành
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600">
              {completionRate}%
            </div>
            <span className="text-[11px] text-emerald-600 font-bold">
              ✓ Tiến độ rất tốt
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Thợ Săn Rank S/SSS */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xl shadow-slate-950/5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Rank S / SSS
            </span>
            <div className="text-2xl font-black font-mono text-amber-500">
              {rankSCount} HS
            </div>
            <span className="text-[11px] text-amber-600 font-bold">
              👑 Đạt chuẩn xuất sắc
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Cần Cứu Trợ */}
        <div className="bg-white border border-rose-200 rounded-3xl p-5 shadow-xl shadow-rose-950/5 flex items-center justify-between bg-rose-50/20">
          <div className="space-y-1">
            <span className="text-xs text-rose-600 font-bold uppercase tracking-wider">
              Cần Cứu Trợ
            </span>
            <div className="text-2xl font-black font-mono text-rose-600">
              {needSupportCount} HS
            </div>
            <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
              <Skull className="w-3 h-3 text-rose-500" />
              <span>Báo động rớt hạng</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
