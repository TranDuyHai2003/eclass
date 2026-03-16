// components/modals/ConfirmModal.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface ConfirmModalProps {
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>; // Hỗ trợ cả hàm async
  title?: string;
  description?: string;
  disabled?: boolean;
}

export const ConfirmModal = ({
  children,
  onConfirm,
  title = "Bạn có chắc chắn?",
  description = "Hành động này không thể hoàn tác.",
  disabled,
}: ConfirmModalProps) => {
  const [open, setOpen] = useState(false); // 1. Thêm state quản lý đóng mở

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault(); // Ngăn đóng ngay lập tức
    try {
      await onConfirm(); // 2. Đợi hàm xóa chạy xong
      setOpen(false); // 3. Đóng modal thủ công
    } catch (error) {
      console.error("Lỗi trong ConfirmModal:", error);
      // Có thể giữ modal mở nếu lỗi để người dùng thử lại
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Hủy bỏ</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {disabled ? "Đang xử lý..." : "Xóa vĩnh viễn"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
