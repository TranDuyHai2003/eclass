"use client";

import { Award, CheckCircle2, ShieldAlert, Users, Castle, Swords, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherQuickStatsProps {
  studyClassName?: string | null;
  totalStudents?: number;
  classAvgScore?: number;
  completionRate?: number;
  rankSCount?: number;
  needSupportCount?: number;
}

/**
 * Số liệu server trả về là TỶ LỆ THAM GIA (% học sinh đã làm ≥ 1 bài), không phải tỷ lệ hoàn thành
 * mọi bài — trước đây gắn nhãn "Tỷ lệ hoàn thành 100%" nên mâu thuẫn với Ma trận báo động.
 */
function participationNote(rate: number | undefined) {
  if (rate === undefined) return { text: "Chưa có dữ liệu", tone: "text-slate-500" };
  if (rate >= 90) return { text: "Đã làm ít nhất 1 bài", tone: "text-emerald-700" };
  if (rate >= 60) return { text: "Còn bạn chưa làm bài nào", tone: "text-amber-700" };
  return { text: "Nhiều bạn chưa làm bài nào", tone: "text-rose-600" };
}

const fmt = (v: number | undefined, digits = 0) => (v === undefined || Number.isNaN(v) ? "—" : v.toFixed(digits));

export function TeacherQuickStats({
  studyClassName,
  totalStudents,
  classAvgScore,
  completionRate,
  rankSCount,
  needSupportCount,
}: TeacherQuickStatsProps) {
  const note = participationNote(completionRate);

  const cards = [
    {
      label: "Điểm TB lớp",
      value: classAvgScore === undefined ? "—" : `${fmt(classAvgScore, 1)} / 10`,
      sub: "Trung bình các bài đã chấm",
      subTone: "text-slate-500",
      icon: Swords,
      accent: "text-blue-700",
      ring: "border-blue-200",
      iconBg: "bg-blue-50 text-blue-700",
    },
    {
      label: "Tỷ lệ tham gia",
      value: completionRate === undefined ? "—" : `${fmt(completionRate)}%`,
      sub: note.text,
      subTone: note.tone,
      icon: CheckCircle2,
      accent: "text-emerald-700",
      ring: "border-emerald-200",
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Rank S trở lên",
      value: rankSCount === undefined ? "—" : `${rankSCount} HS`,
      sub: "👑 SSS · SS · S",
      subTone: "text-amber-700",
      icon: Award,
      accent: "text-amber-700",
      ring: "border-amber-200",
      iconBg: "bg-amber-50 text-amber-700",
    },
    {
      label: "Cần cứu trợ",
      value: needSupportCount === undefined ? "—" : `${needSupportCount} HS`,
      sub: "TB < 5 hoặc chưa đủ bài",
      subTone: "text-rose-600",
      icon: ShieldAlert,
      accent: "text-rose-600",
      ring: "border-rose-200",
      iconBg: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <div className="space-y-4 px-3 sm:px-0">
      {/* Tiêu đề — chữ sáng trên nền tối của trang xếp hạng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-200 shrink-0">
            <Castle className="w-5 h-5 text-indigo-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Tổng quan học lực{studyClassName ? <span className="text-blue-700"> · {studyClassName}</span> : null}
            </h2>
            <p className="text-xs text-slate-500 font-medium">Chỉ số phân hạng và hiệu suất học tập của lớp</p>
          </div>
        </div>

        <span className="text-xs font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-blue-700" />
          <span>Sĩ số: {totalStudents ?? "—"} học sinh</span>
        </span>
      </div>

      {/* 4 thẻ số liệu nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-2xl sm:rounded-3xl border bg-white p-4 sm:p-5 shadow-xl shadow-black/30 flex items-start justify-between gap-3",
              c.ring,
            )}
          >
            <div className="space-y-1 min-w-0">
              <span className="block text-[11px] sm:text-xs text-slate-600 font-bold uppercase tracking-wider">{c.label}</span>
              <div className={cn("text-xl sm:text-2xl font-black tabular-nums", c.accent)}>{c.value}</div>
              <span className={cn("block text-[11px] font-bold", c.subTone)}>
                {c.label === "Cần cứu trợ" && <Skull className="inline w-3 h-3 mr-1 -mt-0.5" />}
                {c.sub}
              </span>
            </div>
            <div className={cn("hidden sm:flex w-11 h-11 rounded-2xl items-center justify-center shrink-0", c.iconBg)}>
              <c.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
