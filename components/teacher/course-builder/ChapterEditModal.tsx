"use client";

import { useState } from "react";
import { Chapter } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateChapter, deleteChapter } from "@/actions/course";
import { toast } from "sonner";

interface ChapterEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: Chapter;
  onSuccess: () => void;
}

export function ChapterEditModal({
  open,
  onOpenChange,
  chapter,
  onSuccess,
}: ChapterEditModalProps) {
  const [title, setTitle] = useState(chapter.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateChapter(chapter.id, { title });
      if (res.success) {
        toast.success("Cập nhật chương thành công");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Lỗi cập nhật");
      }
    } catch {
      toast.error("Lỗi cập nhật");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Bạn có chắc chắn muốn xóa chương này và toàn bộ bài học bên trong?",
      )
    )
      return;
    setIsDeleting(true);
    try {
      const res = await deleteChapter(chapter.id);
      if (res.success) {
        toast.success("Đã xóa chương");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error("Lỗi xóa chương");
      }
    } catch {
      toast.error("Lỗi xóa chương");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa chương</DialogTitle>
          <DialogDescription>
            Thay đổi tên chương hoặc xóa chương này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tên chương</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên chương..."
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            type="button"
          >
            {isDeleting ? "Đang xóa..." : "Xóa chương"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? "Lưu thay đổi" : "Lưu"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
