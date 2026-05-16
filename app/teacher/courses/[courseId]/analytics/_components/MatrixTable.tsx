import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, Info, Search } from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { filterStudents, PerformanceFilter } from "@/lib/analytics-utils";

interface MatrixTableProps {
  tests: { id: string; title: string }[];
  matrix: any[];
}

export const MatrixTable = ({ tests, matrix }: MatrixTableProps) => {
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
                <TableHead className="min-w-[160px] md:min-w-[200px] font-black uppercase text-[10px] tracking-widest text-slate-500 sticky left-0 bg-slate-50 z-20 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Học sinh</TableHead>
                {tests.map((test) => (
                  <TableHead key={test.id} className="min-w-[100px] md:min-w-[120px] font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="max-w-[80px] md:max-w-[100px] truncate">
                          {test.title}
                        </TooltipTrigger>
                        <TooltipContent>
                          {test.title}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
                <TableHead className="min-w-[100px] md:min-w-[120px] font-black uppercase text-[10px] tracking-widest text-slate-500 text-center sticky right-0 bg-slate-50 z-20 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Bài bỏ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatrix.map((student) => (
                <TableRow key={student.studentId} className="hover:bg-slate-50/50 transition-colors group">
                  <TableCell className="font-bold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{student.studentName}</TableCell>
                  {student.testStatuses.map((status: any, index: number) => (
                    <TableCell key={index} className="text-center p-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl mx-auto flex flex-col items-center justify-center transition-all",
                        status.status === "COMPLETED" 
                          ? "bg-emerald-50 border border-emerald-100 shadow-sm shadow-emerald-100/50" 
                          : "bg-slate-50 border border-slate-100 opacity-40"
                      )}>
                        {status.status === "COMPLETED" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 mb-0.5 stroke-[3]" />
                            <span className="text-[9px] font-black text-emerald-700 leading-none">{status.score?.toFixed(2)}đ</span>
                          </>
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className={cn(
                    "text-center font-black sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.02)]",
                    student.missedCount > 2 ? "text-red-600 bg-red-50/30" : "text-slate-600"
                  )}>
                    {student.missedCount}
                  </TableCell>
                </TableRow>
              ))}
              {filteredMatrix.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tests.length + 2} className="h-24 text-center font-bold text-slate-400">
                    {searchQuery ? "Không tìm thấy học sinh phù hợp." : "Không có dữ liệu ma trận."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="p-4 bg-slate-50/50 border-t flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <Info className="w-3 h-3" />
        Hệ thống lấy điểm cao nhất của các lần làm bài (Option B).
      </div>
    </div>
  );
};
