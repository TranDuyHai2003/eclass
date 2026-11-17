"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reopenTestAttempt } from "@/actions/test";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Unlock } from "lucide-react";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

export const ReopenAttemptButton = ({ attemptId }: { attemptId: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleReopen = async () => {
    try {
      setIsLoading(true);
      const res = await reopenTestAttempt(attemptId);
      if (res.success) {
        toast.success("Đã mở lại bài thi. Học sinh có thể vào sửa bài.");
        router.refresh();
      } else {
        throw new Error("Failed to reopen");
      }
    } catch (error) {
      toast.error("Không thể mở lại bài thi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfirmModal
      title="Cho phép sửa bài?"
      description="Bài thi này sẽ được chuyển về trạng thái Đang làm. Điểm số sẽ bị xóa tạm thời cho đến khi học sinh nộp lại bài."
      onConfirm={handleReopen}
    >
      <Button 
        variant="outline" 
        size="sm" 
        disabled={isLoading}
        title="Cho phép học sinh sửa bài"
        aria-label="Cho phép sửa bài"
        className="h-9 rounded-xl border-blue-200 bg-blue-50/50 px-2.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 xl:px-3"
      >
        <Unlock className="w-4 h-4 xl:mr-1.5" />
        <span className="hidden xl:inline">{isLoading ? "Đang mở..." : "Cho phép sửa bài"}</span>
      </Button>
    </ConfirmModal>
  );
};
