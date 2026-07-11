"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Calendar } from "lucide-react";

interface DueDateUpdaterClientProps {
  testId: string;
  initialDueDate: string | null;
}

export default function DueDateUpdaterClient({
  testId,
  initialDueDate,
}: DueDateUpdaterClientProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDateStr = e.target.value;
    // Allow clearing the date as well
    const payload = newDateStr ? new Date(newDateStr).toISOString() : null;

    setIsPending(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: payload }),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi cập nhật");
      }

      toast.success("Đã cập nhật hạn nộp!");
      router.refresh();
    } catch (error) {
      toast.error("Không thể cập nhật hạn nộp");
    } finally {
      setIsPending(false);
    }
  };

  const formattedInitial = initialDueDate
    ? new Date(initialDueDate).toISOString().slice(0, 16)
    : "";

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      <div className="relative">
        <Calendar className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
        <Input
          type="datetime-local"
          defaultValue={formattedInitial}
          onBlur={handleDateChange}
          className="h-7 w-[160px] pl-7 text-[10px] font-bold text-slate-600 bg-white rounded-lg border-slate-200"
        />
      </div>
    </div>
  );
}
