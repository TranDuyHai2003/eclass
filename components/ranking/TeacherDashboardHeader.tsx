"use client";

import { Users, TrendingUp, AlertTriangle, CheckCircle, BarChart2 } from "lucide-react";

interface TeacherDashboardHeaderProps {
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  completionRate?: number;
  rankIncreasedCount?: number;
  needSupportCount?: number;
}

export function TeacherDashboardHeader({
  studyClassName = "10A1",
  totalStudents = 32,
  classAvgScore = 7.8,
  completionRate = 92,
  rankIncreasedCount = 24,
  needSupportCount = 3,
}: TeacherDashboardHeaderProps) {
  const percentIncreased = Math.round((rankIncreasedCount / (totalStudents || 32)) * 100);

  return (
    <header className="glass-card p-6 rounded-3xl shadow-xl shadow-blue-900/5 space-y-5 bg-white/90 backdrop-blur-xl border border-white/80">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-lg shadow-md shrink-0">
            {studyClassName ? studyClassName.slice(0, 4).toUpperCase() : "10A1"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-extrabold text-[10px] uppercase tracking-wider">
                Giáo viên Quản nhiệm
              </span>
              <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Sĩ số: {totalStudents}/{totalStudents}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Dashboard Quản Lý Lớp {studyClassName || "10A1"}
            </h1>
          </div>
        </div>

        {/* BỘ LỌC NÂNG CAO GIÁO VIÊN */}
        <div className="flex flex-wrap items-center gap-2">
          <select className="bg-slate-100 border-none rounded-xl text-xs font-bold px-3 py-2 text-slate-700 outline-none cursor-pointer">
            <option>Tất cả môn học</option>
            <option defaultChecked>Toán Đại Số</option>
            <option>Vật Lý</option>
          </select>
          <select className="bg-slate-100 border-none rounded-xl text-xs font-bold px-3 py-2 text-slate-700 outline-none cursor-pointer">
            <option>Tháng 8/2026</option>
            <option>Học kỳ 1</option>
          </select>
        </div>
      </div>

      {/* 1. TỔNG QUAN LỚP TRONG 3 GIÂY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100/80">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Điểm TB Lớp
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <strong className="text-xl font-extrabold text-slate-900">
              {classAvgScore.toFixed(2)}
            </strong>
            <span className="text-[10px] font-bold text-emerald-600">
              ▲ +0.35 so tháng trước
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-100/80">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Tỷ lệ nộp bài
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <strong className="text-xl font-extrabold text-emerald-700">
              {completionRate}%
            </strong>
            <span className="text-[10px] font-bold text-slate-500">
              {totalStudents}/{totalStudents} Học sinh
            </span>
          </div>
        </div>

        <div className="bg-purple-50/80 p-3.5 rounded-2xl border border-purple-100/80">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Học sinh tăng hạng
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <strong className="text-xl font-extrabold text-purple-700">
              {rankIncreasedCount} Bạn
            </strong>
            <span className="text-[10px] font-bold text-purple-600">
              {percentIncreased}% Lớp tiến bộ
            </span>
          </div>
        </div>

        <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-100/80">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Cần hỗ trợ gấp
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <strong className="text-xl font-extrabold text-amber-700">
              {needSupportCount} Bạn
            </strong>
            <span className="text-[10px] font-bold text-amber-600">
              Chưa nộp / Giảm điểm
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
