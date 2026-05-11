"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBar() {
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
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex-1 max-w-xl relative group"
    >
      <div className="absolute inset-0 bg-red-600/5 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
      <input
        type="text"
        placeholder="Tìm kiếm khóa học..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-11 sm:h-12 pl-6 pr-14 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 focus:outline-none transition-all text-sm font-bold text-slate-700 shadow-inner relative z-10"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1.5 w-8 h-8 sm:w-9 sm:h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-lg active:scale-95 z-20"
      >
        <Search className="w-4 h-4" />
      </button>
    </form>
  );
}
