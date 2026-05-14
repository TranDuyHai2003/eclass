"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DeleteTestButtonProps {
  testId: string;
}

export function DeleteTestButton({ testId }: DeleteTestButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Bạn chắc chắn muốn xóa bài kiểm tra này?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, { method: "DELETE" });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Xóa bài kiểm tra thất bại");
      }
      toast.success("Đã xóa bài kiểm tra");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Không thể xóa bài kiểm tra");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
