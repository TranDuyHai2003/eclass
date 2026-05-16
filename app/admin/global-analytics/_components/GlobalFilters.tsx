"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Calendar, Filter, X, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface GlobalFiltersProps {
  courses: { id: string; title: string }[];
}

export function GlobalFilters({ courses }: GlobalFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    searchParams.get("courseIds")?.split(",").filter(Boolean) || []
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (startDate) params.set("startDate", startDate);
    else params.delete("startDate");

    if (endDate) params.set("endDate", endDate);
    else params.delete("endDate");

    if (selectedCourseIds.length > 0) params.set("courseIds", selectedCourseIds.join(","));
    else params.delete("courseIds");

    router.push(`?${params.toString()}`);
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedCourseIds([]);
    router.push("?");
  };

  return (
    <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent border-none text-sm focus:ring-0 text-slate-600"
          />
          <span className="text-slate-300">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent border-none text-sm focus:ring-0 text-slate-600 mr-2"
          />
        </div>

        {/* Course Multi-select Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-2xl border-slate-200 h-11 px-4 gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium">Khóa học</span>
              {selectedCourseIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-indigo-50 text-indigo-600 border-indigo-100 rounded-lg">
                  {selectedCourseIds.length}
                </Badge>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-2xl" align="start">
            <div className="p-3 space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
              <div 
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setSelectedCourseIds([])}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  selectedCourseIds.length === 0 ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                )}>
                  {selectedCourseIds.length === 0 && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm font-medium">Tất cả khóa học</span>
              </div>
              <Separator className="my-2" />
              {courses.map((course) => (
                <div 
                  key={course.id}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => toggleCourse(course.id)}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    selectedCourseIds.includes(course.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                  )}>
                    {selectedCourseIds.includes(course.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-slate-600 truncate">{course.title}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {(startDate || endDate || selectedCourseIds.length > 0) && (
            <Button variant="ghost" onClick={clearFilters} className="rounded-2xl text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4 mr-2" />
              Xóa lọc
            </Button>
          )}
          <Button onClick={applyFilters} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-6">
            Áp dụng
          </Button>
        </div>
      </div>

      {/* Selected Tags */}
      {selectedCourseIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedCourseIds.map(id => {
            const course = courses.find(c => c.id === id);
            return (
              <Badge key={id} variant="outline" className="rounded-xl px-3 py-1 bg-white border-slate-200 text-slate-600 flex items-center gap-1">
                {course?.title}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-500" 
                  onClick={() => toggleCourse(id)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
