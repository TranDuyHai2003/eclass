"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface MobileSearchBarProps {
  onSearch?: () => void;
}

export function MobileSearchBar({ onSearch }: MobileSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("query") || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/courses?query=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/courses");
    }
    onSearch?.();
  };

  return (
    <form onSubmit={handleSearch} className="px-6 mb-4 relative group">
      <input
        type="text"
        placeholder="Tìm kiếm khóa học..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-bold text-slate-700 shadow-inner"
      />
      <div className="absolute left-10 top-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors">
        <Search className="w-5 h-5" />
      </div>
      {query && (
         <button 
           type="button" 
           onClick={() => setQuery("")}
           className="absolute right-10 top-3.5 text-slate-300 hover:text-slate-600"
         >
           <X className="w-5 h-5" />
         </button>
      )}
    </form>
  );
}
