"use client";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  X,
  Info,
  TrendingUp,
  AlertTriangle,
  Search,
} from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { filterStudents, PerformanceFilter } from "@/lib/analytics-utils";

interface SmartMatrixProps {
  courseId: string;
  tests: { id: string; title: string }[];
  matrix: any[];
}

export const SmartMatrix = ({ courseId, tests, matrix }: SmartMatrixProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PerformanceFilter>("all");

  const filteredMatrix = filterStudents(matrix, { 
    searchQuery, 
    performanceFilter: statusFilter 
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Tất cả" },
            { id: "excellent", label: "Giỏi (>=8)" },
            { id: "passed", label: "Đạt (>=5)" },
            { id: "failed", label: "Cần cố gắng (<5)" },
            { id: "completed-all", label: "Hoàn thành hết" },
            { id: "missing-tests", label: "Còn thiếu bài" },
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as PerformanceFilter)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                statusFilter === status.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                  : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
            >
              {status.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Tìm học sinh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 text-xs font-bold"
          />
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                {/* Rank & Student Info */}
                <TableHead className="w-[60px] font-black uppercase text-[10px] tracking-widest text-slate-500 text-center sticky left-0 bg-slate-50 z-30">
                  #
                </TableHead>
                <TableHead className="min-w-[180px] font-black uppercase text-[10px] tracking-widest text-slate-500 sticky left-[60px] bg-slate-50 z-30 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  Học sinh
                </TableHead>

                {/* Performance Indicator */}
                <TableHead className="w-[100px] font-black uppercase text-[10px] tracking-widest text-indigo-600 text-center border-r">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3" /> ĐTB
                  </div>
                </TableHead>

                {/* Dynamic Test Columns */}
                {tests.map((test) => (
                  <TableHead
                    key={test.id}
                    className="min-w-[100px] font-black uppercase text-[10px] tracking-widest text-slate-500 text-center hover:bg-slate-100 transition-colors cursor-pointer group"
                  >
                    <Link
                      href={`/teacher/tests/${test.id}/analytics`}
                      className="block py-2 px-1"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="max-w-[80px] truncate group-hover:text-blue-600">
                            {test.title}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Xem phân tích chi tiết: {test.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Link>
                  </TableHead>
                ))}

                {/* Missed Counter */}
                <TableHead className="min-w-[100px] font-black uppercase text-[10px] tracking-widest text-red-500 text-center sticky right-0 bg-slate-50 z-30 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Bỏ bài
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatrix.map((student, index) => (
                <TableRow
                  key={student.studentId}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  {/* Rank */}
                  <TableCell className="text-center font-black text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-20">
                    {index + 1}
                  </TableCell>

                  {/* Name - Clickable to Cấp độ 2 */}
                  <TableCell className="font-bold text-slate-900 sticky left-[60px] bg-white group-hover:bg-slate-50 z-20 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <Link
                      href={`/teacher/courses/${courseId}/analytics/students/${student.studentId}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {student.studentName}
                    </Link>
                  </TableCell>

                  {/* Average Score */}
                  <TableCell className="text-center border-r font-black text-indigo-600 text-base">
                    {student.averageScore?.toFixed(2)}
                  </TableCell>

                  {/* Individual Test Scores */}
                  {student.testStatuses.map((status: any, idx: number) => (
                    <TableCell key={idx} className="text-center p-2">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl mx-auto flex flex-col items-center justify-center transition-all border",
                          status.status === "COMPLETED"
                            ? status.score >= 8
                              ? "bg-emerald-50 border-emerald-100"
                              : status.score >= 5
                                ? "bg-blue-50 border-blue-100"
                                : "bg-orange-50 border-orange-100"
                            : "bg-red-50 border-red-100 opacity-60",
                        )}
                      >
                        {status.status === "COMPLETED" ? (
                          <span
                            className={cn(
                              "text-xs font-black",
                              status.score >= 8
                                ? "text-emerald-700"
                                : status.score >= 5
                                  ? "text-blue-700"
                                  : "text-orange-700",
                            )}
                          >
                            {status.score?.toFixed(2)}
                          </span>
                        ) : (
                          <X className="w-4 h-4 text-red-400 stroke-[3]" />
                        )}
                      </div>
                    </TableCell>
                  ))}

                  {/* Missed Count */}
                  <TableCell
                    className={cn(
                      "text-center font-black sticky right-0 bg-white group-hover:bg-slate-50 z-20 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.02)]",
                      student.missedCount > 2
                        ? "text-red-600 bg-red-50/30"
                        : "text-slate-600",
                    )}
                  >
                    {student.missedCount}
                  </TableCell>
                </TableRow>
              ))}
              {filteredMatrix.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={tests.length + 4}
                    className="h-32 text-center font-bold text-slate-400"
                  >
                    {searchQuery
                      ? "Không tìm thấy học sinh phù hợp."
                      : "Chưa có dữ liệu thống kê."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <Info className="w-3 h-3" />
          Bảng gộp Xếp hạng & Tiến độ. Click vào tên học sinh hoặc tên bài để
          xem chi tiết.
        </div>
      </div>
    </div>
  );
};
