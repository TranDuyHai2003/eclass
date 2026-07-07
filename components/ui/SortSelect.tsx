"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, History, List } from "lucide-react";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams?.get("sort") || "default";

  const onSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("sort", value);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  };

  return (
    <Select value={currentSort} onValueChange={onSortChange}>
      <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-white border-slate-200 font-bold text-slate-700">
        <SelectValue placeholder="Sắp xếp" />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-slate-200">
        <SelectItem value="default" className="font-bold py-2.5">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-slate-500" />
            <span>Mặc định</span>
          </div>
        </SelectItem>
        <SelectItem value="desc" className="font-bold py-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Mới nhất</span>
          </div>
        </SelectItem>
        <SelectItem value="asc" className="font-bold py-2.5">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Cũ nhất</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
