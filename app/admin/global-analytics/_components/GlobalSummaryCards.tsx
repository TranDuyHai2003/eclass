"use client";

import { 
  Users, 
  GraduationCap, 
  Award, 
  CheckCircle2, 
  Zap,
  Globe,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalSummaryCardsProps {
  summary: {
    totalStudents: number;
    onlineStudents: number;
    offlineStudents: number;
    averageScore: number;
    averageCompletion: number;
    maxScore: number;
    minScore: number;
  };
}

export function GlobalSummaryCards({ summary }: GlobalSummaryCardsProps) {
  const cards = [
    {
      title: "Tổng học sinh",
      value: summary.totalStudents,
      icon: Users,
      color: "blue",
      details: [
        { label: "Online", value: summary.onlineStudents, icon: Globe },
        { label: "Offline", value: summary.offlineStudents, icon: Home },
      ]
    },
    {
      title: "Điểm trung bình",
      value: summary.averageScore.toFixed(2),
      icon: Award,
      color: "indigo",
      suffix: "/ 10",
      details: [
        { label: "Cao nhất", value: summary.maxScore.toFixed(1), icon: Award },
        { label: "Thấp nhất", value: summary.minScore.toFixed(1), icon: Award },
      ]
    },
    {
      title: "Tỷ lệ hoàn thành",
      value: Math.round(summary.averageCompletion),
      icon: CheckCircle2,
      color: "emerald",
      suffix: "%",
      description: "Tiến độ học tập trung bình"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card, idx) => (
        <div 
          key={idx}
          className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          {/* Background Decoration */}
          <div className={cn(
            "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform duration-500",
            card.color === "blue" ? "bg-blue-600" : 
            card.color === "indigo" ? "bg-indigo-600" : "bg-emerald-600"
          )} />

          <div className="flex items-start justify-between mb-4">
            <div className={cn(
              "p-3 rounded-2xl",
              card.color === "blue" ? "bg-blue-50 text-blue-600" : 
              card.color === "indigo" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
            )}>
              <card.icon className="w-6 h-6" />
            </div>
            {card.details && (
                <div className="flex gap-2">
                    {card.details.map((detail, dIdx) => (
                        <div key={dIdx} className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                <detail.icon className="w-2.5 h-2.5" /> {detail.label}
                            </span>
                            <span className="text-sm font-black text-slate-700">{detail.value}</span>
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">
              {card.title}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {card.value}
              </span>
              {card.suffix && (
                <span className="text-lg font-bold text-slate-400">
                  {card.suffix}
                </span>
              )}
            </div>
            {card.description && (
                <p className="text-xs text-slate-400 mt-2 font-medium">
                    {card.description}
                </p>
            )}
          </div>
          
          {/* Progress bar for completion */}
          {card.title === "Tỷ lệ hoàn thành" && (
            <div className="mt-4 w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: `${card.value}%` }}
                />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
