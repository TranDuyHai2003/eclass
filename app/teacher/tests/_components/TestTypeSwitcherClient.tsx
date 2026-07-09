"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TestTypeSwitcherClientProps {
  testId: string;
  initialType: "HOMEWORK" | "EXAM";
}

export default function TestTypeSwitcherClient({
  testId,
  initialType,
}: TestTypeSwitcherClientProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleTypeChange = async (newType: "HOMEWORK" | "EXAM") => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType }),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi cập nhật");
      }

      toast.success("Đã cập nhật loại bài!");
      router.refresh();
    } catch (error) {
      toast.error("Không thể cập nhật loại bài");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      <Select
        defaultValue={initialType}
        onValueChange={(v: "HOMEWORK" | "EXAM") => handleTypeChange(v)}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 w-[100px] text-[10px] font-black uppercase tracking-wider bg-white rounded-lg border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="HOMEWORK" className="text-xs font-bold">BTVN</SelectItem>
          <SelectItem value="EXAM" className="text-xs font-bold">Kiểm tra</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
