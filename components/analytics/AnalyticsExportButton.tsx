"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AnalyticsExportButtonProps {
  /**
   * API endpoint to fetch the export from
   */
  apiUrl?: string;
  /**
   * Optional direct data to export to CSV (client-side)
   */
  data?: any;
  /**
   * Filename for the downloaded file
   */
  filename?: string;
  /**
   * Visual variant: 'premium' (dark) or 'outline'
   */
  variant?: "premium" | "outline" | "ghost";
  /**
   * Additional className
   */
  className?: string;
  /**
   * Mode for CSV export
   */
  mode?: "overview" | "matrix";
}

export function AnalyticsExportButton({
  apiUrl,
  data,
  filename = "bao_cao_thong_ke",
  variant = "premium",
  className,
  mode
}: AnalyticsExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      setIsLoading(true);

      if (apiUrl) {
        // Server-side Excel Export
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        toast.success("Đã xuất file Excel thành công!");
      } else if (data && mode) {
        // Client-side CSV Export (as seen in previous logic)
        let csvContent = "";
        if (mode === "overview") {
            csvContent = "Hoc sinh,Email,Khoa hoc,So bai hoan thanh,Tong so bai,Ti le (%),Diem TB\n";
            const students = data as any[];
            students.forEach(student => {
              const courseTitles = student.courses.map((c: any) => c.title).join("; ");
              const row = [
                `"${student.name}"`,
                `"${student.email}"`,
                `"${courseTitles}"`,
                student.stats.completedCount,
                student.stats.totalAssigned,
                student.stats.completionRate,
                student.stats.averageScore
              ].join(",");
              csvContent += row + "\n";
            });
        } else if (mode === "matrix") {
            const { tests, matrix } = data;
            const testTitles = tests.map((t: any) => `"${t.title}"`).join(",");
            csvContent = `Hoc sinh,Diem TB,${testTitles},Bo bai\n`;
            matrix.forEach((student: any) => {
              const scores = student.testStatuses.map((s: any) => 
                s.status === "COMPLETED" ? s.score : "X"
              ).join(",");
              const row = [
                `"${student.studentName}"`,
                student.averageScore,
                scores,
                student.missedCount
              ].join(",");
              csvContent += row + "\n";
            });
        }

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Đã xuất file CSV thành công!");
      } else {
        toast.error("Thiếu cấu hình xuất file.");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Có lỗi xảy ra khi xuất file.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isLoading}
      variant={variant === "premium" ? "default" : variant as any}
      className={cn(
        "rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-sm",
        variant === "premium" && "bg-slate-900 hover:bg-black text-white px-6 h-11 shadow-slate-200",
        variant === "outline" && "border-slate-200 hover:bg-slate-50 text-slate-600 h-10",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      {isLoading ? "Đang xử lý..." : "Xuất báo cáo"}
    </Button>
  );
}
