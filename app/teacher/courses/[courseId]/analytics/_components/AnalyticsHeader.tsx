"use client";

import { useRouter } from "next/navigation";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { AnalyticsExportButton } from "@/components/analytics/AnalyticsExportButton";

interface AnalyticsHeaderProps {
  courseTitle: string;
  courseId: string;
  month: number;
  year: number;
}

export const AnalyticsHeader = ({
  courseTitle,
  courseId,
  month,
  year,
}: AnalyticsHeaderProps) => {
  const router = useRouter();

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const onFilterChange = (newMonth: string, newYear: string) => {
    router.push(`/teacher/courses/${courseId}/analytics?month=${newMonth}&year=${newYear}`);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-100/50 transition-colors duration-500" />
      
      <div className="relative space-y-2">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{courseTitle}</h1>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
           <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">
            Thống kê tiến độ học tập
           </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative">
        <div className="flex items-center gap-2">
          <Select 
            value={String(month)} 
            onValueChange={(val) => onFilterChange(val, String(year))}
          >
            <SelectTrigger className="flex-1 sm:w-[120px] rounded-xl border-slate-100 font-bold bg-slate-50/50 hover:bg-white transition-colors">
              <SelectValue placeholder="Tháng" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {months.map((m) => (
                <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={String(year)} 
            onValueChange={(val) => onFilterChange(String(month), val)}
          >
            <SelectTrigger className="flex-1 sm:w-[120px] rounded-xl border-slate-100 font-bold bg-slate-50/50 hover:bg-white transition-colors">
              <SelectValue placeholder="Năm" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnalyticsExportButton
          apiUrl={`/api/courses/${courseId}/analytics/export?month=${month}&year=${year}`}
          filename={`Thống_kê_${courseTitle.replace(/\s+/g, "_")}_Tháng_${month}_${year}`}
        />
      </div>
    </div>
  );
};
