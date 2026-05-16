import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filterStudents, PerformanceFilter } from "@/lib/analytics-utils";

interface LeaderboardTableProps {
  data: any[];
}

export const LeaderboardTable = ({ data }: LeaderboardTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PerformanceFilter>("all");

  const filteredData = filterStudents(data, {
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
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[60px] md:w-[100px] font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Hạng</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500">Học sinh</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Tổng điểm</TableHead>
              <TableHead className="hidden md:table-cell font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Điểm TB</TableHead>
              <TableHead className="hidden sm:table-cell font-black uppercase text-[10px] tracking-widest text-slate-500 text-center">Bài đã làm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((student, index) => {
              // We want to keep the original rank if possible, or just show index in filtered list
              // Usually ranking should be based on the original data, but displayed in the filtered list.
              const originalIndex = data.findIndex(s => s.studentId === student.studentId);
              
              return (
                <TableRow key={student.studentId} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-center">
                    <div className={cn(
                      "w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-black mx-auto",
                      originalIndex === 0 ? "bg-yellow-100 text-yellow-700" :
                      originalIndex === 1 ? "bg-slate-100 text-slate-700" :
                      originalIndex === 2 ? "bg-orange-100 text-orange-700" :
                      "text-slate-400"
                    )}>
                      {originalIndex + 1}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 text-xs md:text-sm">{student.studentName}</TableCell>
                  <TableCell className="text-center font-black text-blue-600 text-base md:text-lg">{student.totalScore?.toFixed(2)}</TableCell>
                  <TableCell className="hidden md:table-cell text-center font-bold text-slate-600">{student.averageScore?.toFixed(2)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    <Badge variant="secondary" className="rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">
                      {student.completedCount} bài
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center font-bold text-slate-400">
                  {searchQuery ? "Không tìm thấy học sinh phù hợp." : "Chưa có dữ liệu thống kê trong tháng này."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
