"use client";

import React, { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  GraduationCap, 
  BookOpen, 
  Clock,
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { filterStudents, PerformanceFilter } from "@/lib/analytics-utils";

interface GlobalOverviewTableProps {
  data: any[];
}

export function GlobalOverviewTable({ data }: GlobalOverviewTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PerformanceFilter>("all");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

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

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="min-w-[200px] font-black uppercase text-[10px] tracking-widest text-slate-500">
                  Học sinh
                </TableHead>
                <TableHead className="min-w-[150px] font-black uppercase text-[10px] tracking-widest text-slate-500">
                  Khóa học
                </TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest text-slate-500">
                  Bài tập
                </TableHead>
                <TableHead className="min-w-[150px] font-black uppercase text-[10px] tracking-widest text-slate-500">
                  Tiến độ
                </TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] tracking-widest text-indigo-600">
                  Điểm TB
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((student) => (
                <React.Fragment key={student.id}>
                  <TableRow 
                    className={cn(
                      "group cursor-pointer transition-colors",
                      expandedRows.includes(student.id) ? "bg-slate-50/80" : "hover:bg-slate-50/40"
                    )}
                    onClick={() => toggleRow(student.id)}
                  >
                    <TableCell>
                      {expandedRows.includes(student.id) ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{student.name}</span>
                        <span className="text-xs text-slate-400">{student.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.courses.map((course: any) => (
                          <Badge 
                            key={course.id || course.title} 
                            variant="secondary" 
                            className="text-[10px] bg-slate-100 text-slate-600 border-none font-medium px-2 py-0"
                          >
                            {course.title}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-slate-700">
                          {student.stats.completedCount}/{student.stats.totalAssigned}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase">Hoàn thành</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[120px]">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                          <span>{student.stats.completionRate}%</span>
                          <span>Đạt mục tiêu</span>
                        </div>
                        <Progress 
                          value={student.stats.completionRate} 
                          className="h-1.5 bg-slate-100" 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 font-black text-indigo-600">
                        {student.stats.averageScore?.toFixed(2)}
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Row */}
                  {expandedRows.includes(student.id) && (
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableCell colSpan={6} className="p-6">
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
                            Chi tiết bài kiểm tra đã làm
                          </h4>
                          {student.details && student.details.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {student.details.map((attempt: any, idx: number) => (
                                <div key={attempt.id || idx} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/30">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                    attempt.score >= 8 ? "bg-emerald-100 text-emerald-600" :
                                    attempt.score >= 5 ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                                  )}>
                                    <span className="font-black text-sm">{attempt.score?.toFixed(2)}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 truncate">{attempt.testTitle}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        {format(new Date(attempt.completedAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                              <BookOpen className="w-8 h-8 opacity-20" />
                              <p className="text-sm font-medium">Chưa có bài kiểm tra nào được hoàn thành.</p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}

              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <GraduationCap className="w-12 h-12 opacity-20" />
                      <p className="font-bold">Không tìm thấy học sinh nào.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
