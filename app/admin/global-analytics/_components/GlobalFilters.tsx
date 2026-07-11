"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useTransition, useCallback, ReactNode } from "react";
import { Calendar, X, ChevronDown, Check, Users, BookOpen, Search, SortAsc, SortDesc, Globe, User, GraduationCap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GlobalFiltersProps {
  courses: { id: string; title: string }[];
  children?: ReactNode;
}

export function GlobalFilters({ courses, children }: GlobalFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(searchParams?.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams?.get("endDate") || "");
  const [studentType, setStudentType] = useState(searchParams?.get("studentType") || "all");
  const [level, setLevel] = useState(searchParams?.get("level") || "all");
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [sortBy, setSortBy] = useState(searchParams?.get("sortBy") || "default");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    searchParams?.get("courseIds")?.split(",").filter(Boolean) || []
  );

  // Instant apply logic
  const applyFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    if (startDate) params.set("startDate", startDate); else params.delete("startDate");
    if (endDate) params.set("endDate", endDate); else params.delete("endDate");
    if (studentType && studentType !== "all") params.set("studentType", studentType); else params.delete("studentType");
    if (level && level !== "all") params.set("level", level); else params.delete("level");
    if (search) params.set("search", search); else params.delete("search");
    if (sortBy) params.set("sortBy", sortBy); else params.delete("sortBy");
    if (selectedCourseIds.length > 0) params.set("courseIds", selectedCourseIds.join(",")); else params.delete("courseIds");

    const newUrl = `?${params.toString()}`;
    if (newUrl !== `?${searchParams?.toString() || ""}`) {
      startTransition(() => {
        router.push(newUrl, { scroll: false });
      });
    }
  },     [startDate, endDate, studentType, level, search, sortBy, selectedCourseIds, router, searchParams]);

  // Effect to apply filters instantly when basic toggles change
  useEffect(() => {
    applyFilters();
  }, [studentType, level, sortBy, selectedCourseIds, startDate, endDate, applyFilters]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, applyFilters]);

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStudentType("all");
    setLevel("all");
    setSearch("");
    setSortBy("score_desc");
    setSelectedCourseIds([]);
    router.push("?");
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] group">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
            isPending ? "text-blue-500 animate-pulse" : "text-slate-400 group-focus-within:text-blue-500"
          )} />
          <Input
            placeholder="Tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all text-xs font-bold shadow-none"
          />
        </div>

        {/* Student Type Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 h-10 overflow-hidden">
          {[
            { id: "all", label: "Tất cả", icon: Users },
            { id: "ONLINE", label: "Online", icon: Globe },
            { id: "OFFLINE", label: "Offline", icon: User },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setStudentType(type.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap",
                studentType === type.id 
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <type.icon className="w-3 h-3" />
              {type.label}
            </button>
          ))}
        </div>

        {/* Level Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 h-10 overflow-hidden">
          {[
            { id: "all", label: "Tất cả", icon: GraduationCap },
            { id: "BASIC", label: "Cơ bản", icon: GraduationCap },
            { id: "ADVANCED", label: "Nâng cao", icon: GraduationCap },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setLevel(type.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap",
                level === type.id 
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <type.icon className="w-3 h-3" />
              {type.label}
            </button>
          ))}
        </div>

        {/* Sorting Tabs */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 h-10 overflow-hidden">
           {[
             { id: "default", label: "A-Z", icon: Users },
             { id: "score_desc", label: "Cao ↓", icon: SortDesc },
             { id: "score_asc", label: "Thấp ↑", icon: SortAsc },
           ].map((opt) => (
             <button
               key={opt.id}
               onClick={() => setSortBy(opt.id)}
               className={cn(
                 "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap",
                 sortBy === opt.id 
                   ? "bg-indigo-600 text-white shadow-sm" 
                   : "text-slate-400 hover:text-slate-700"
               )}
             >
               <opt.icon className="w-3 h-3" />
               {opt.label}
             </button>
           ))}
        </div>

        {/* Course & Date Popovers */}
        <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl border-slate-200 h-10 px-3 gap-2 bg-white hover:bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  Khóa học
                  {selectedCourseIds.length > 0 && (
                    <div className="bg-blue-600 text-white rounded-md h-4 px-1 min-w-[16px] flex items-center justify-center text-[8px] font-bold">
                      {selectedCourseIds.length}
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 rounded-2xl shadow-2xl border-slate-100" align="end">
                <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                  <div 
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => setSelectedCourseIds([])}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900">Chọn tất cả</span>
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center",
                      selectedCourseIds.length === 0 ? "bg-blue-600 border-blue-600 shadow-sm" : "border-slate-200"
                    )}>
                      {selectedCourseIds.length === 0 && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </div>
                  <Separator className="my-1.5" />
                  {courses.map((course) => (
                    <div 
                      key={course.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                      onClick={() => toggleCourse(course.id)}
                    >
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-900 truncate pr-3">{course.title}</span>
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        selectedCourseIds.includes(course.id) ? "bg-blue-600 border-blue-600 shadow-sm" : "border-slate-200"
                      )}>
                        {selectedCourseIds.includes(course.id) && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-slate-200 h-10 px-3 gap-2 bg-white hover:bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Ngày
                    {(startDate || endDate) && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4 rounded-2xl shadow-2xl border-slate-100" align="end">
                   <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Từ ngày</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Đến ngày</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                            />
                         </div>
                      </div>
                      <Button 
                        variant="secondary" 
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="w-full rounded-lg text-[9px] font-black uppercase tracking-widest h-8"
                      >
                        Xóa ngày
                      </Button>
                   </div>
                </PopoverContent>
            </Popover>

            <Button 
                variant="ghost" 
                onClick={clearFilters} 
                className="w-10 h-10 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all p-0"
                title="Xóa tất cả lọc"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
        </div>

        {/* Divider if there are children */}
        {children && <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block bg-slate-200" />}

        {/* Custom Actions (Hide/Show, Export, etc.) */}
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>

      {/* Selected Course Tags */}
      {selectedCourseIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 animate-in slide-in-from-top-1 duration-300">
          {selectedCourseIds.map(id => {
            const course = courses.find(c => c.id === id);
            return (
              <Badge key={id} variant="secondary" className="rounded-lg px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5 font-bold text-[8px] uppercase tracking-tight shadow-none">
                {course?.title}
                <X 
                  className="w-2.5 h-2.5 cursor-pointer text-blue-300 hover:text-blue-600" 
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
