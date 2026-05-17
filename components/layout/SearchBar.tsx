"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, BookOpen, X } from "lucide-react";
import { getCourses } from "@/actions/course";
import Link from "next/link";

type CourseResult = {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  category?: { name: string } | null;
  user?: { name: string | null } | null;
};

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [results, setResults] = useState<CourseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setIsLoading(true);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await getCourses({ search: query });
        setResults(data as CourseResult[]);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    if (query.trim()) {
      router.push(`/courses?query=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/courses");
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="flex-1 max-w-xl relative group z-[9999]">
      <div className="absolute inset-0 bg-red-600/5 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
      
      <form onSubmit={handleSearch} className="relative z-10 flex items-center w-full">
        <input
          type="text"
          placeholder="Tìm kiếm khóa học..."
          value={query}
          onFocus={() => query.trim() && setIsOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-11 sm:h-12 pl-6 pr-24 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 focus:outline-none transition-all text-sm font-bold text-slate-700 shadow-inner"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg active:scale-95"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* DROPDOWN SEARCH RESULTS */}
      {isOpen && query.trim() && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-4 z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                <span className="text-xs font-bold uppercase tracking-widest">Đang tìm kiếm...</span>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 flex items-center justify-between">
                  <span>Kết quả tìm kiếm ({results.length})</span>
                  <span className="text-red-600">eClass Course</span>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  {results.slice(0, 5).map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-4 p-2.5 rounded-2xl hover:bg-red-50/50 transition-all group"
                    >
                      <div className="relative w-16 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
                            <BookOpen className="w-4 h-4 text-white/30" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {course.category?.name && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[8px] font-black tracking-widest uppercase">
                              {course.category.name}
                            </span>
                          )}
                          {course.user?.name && (
                            <span className="text-[9px] font-bold text-slate-400 truncate uppercase">
                              Thầy {course.user.name}
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-[13px] text-slate-800 line-clamp-1 uppercase tracking-tight group-hover:text-red-600 transition-colors">
                          {course.title}
                        </h4>
                      </div>
                      
                      <div className="shrink-0 text-right pr-2">
                        <span className="font-black text-xs text-slate-950 group-hover:text-red-600 transition-colors">
                          {course.price ? `${course.price.toLocaleString()}đ` : "Miễn phí"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {results.length > 5 && (
                  <div className="pt-2 border-t border-slate-50 text-center">
                    <button
                      onClick={handleSearch}
                      className="text-[10px] font-black text-red-600 hover:text-slate-900 uppercase tracking-widest transition-colors"
                    >
                      Xem tất cả {results.length} kết quả
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400 text-center px-4">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-2xl">
                  🔭
                </div>
                <div className="space-y-1">
                  <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Không tìm thấy kết quả</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider max-w-xs leading-relaxed">
                    Hãy thử từ khóa khác hoặc kiểm tra lại chính tả nhé!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
