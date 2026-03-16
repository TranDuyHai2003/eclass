"use client";

import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Pencil, Trash2, Film, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

interface LessonItemProps {
  lesson: any; // Bạn có thể thay bằng Type chính xác nếu có (VD: Lesson & { attachments: Attachment[] })
  index: number;
  onEdit: (lesson: any) => void;
  onDelete: (id: string) => void;
  isFlat?: boolean;
}

export function LessonItem({
  lesson,
  index,
  onEdit,
  onDelete,
  isFlat,
}: LessonItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(lesson.id);
    setIsDeleting(false);
  };

  return (
    <Draggable draggableId={lesson.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "flex items-center gap-x-2 bg-white border border-gray-200 text-gray-700 rounded-md mb-2 text-sm hover:bg-gray-50 transition-colors group",
            snapshot.isDragging && "shadow-lg bg-blue-50 border-blue-200",
            isFlat && "bg-gray-50 border-dashed", // Style tùy chọn nếu là flat view
          )}
        >
          {/* Drag Handle */}
          <div
            {...provided.dragHandleProps}
            className="px-2 py-3 border-r border-gray-100 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-l-md"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>

          {/* Main Content Area - Click vào đây sẽ mở Edit Modal */}
          <div
            className="flex items-center gap-x-2 py-3 px-2 flex-1 min-w-0 cursor-pointer"
            onClick={() => onEdit(lesson)}
          >
            {/* Icon based on content */}
            {lesson.videoUrl ? (
              <Film className="h-4 w-4 text-blue-500" />
            ) : (
              <FileText className="h-4 w-4 text-gray-400" />
            )}

            <span className="font-medium truncate hover:text-blue-600 transition-colors">
              {lesson.title}
            </span>

            <div className="ml-auto flex items-center gap-x-2">
              {lesson.isFree && (
                <Badge variant="secondary" className="text-xs">
                  Học thử
                </Badge>
              )}
              <Badge
                className={cn(
                  "text-[10px]",
                  lesson.isPublished
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                {lesson.isPublished ? "Đã duyệt" : "Nháp"}
              </Badge>

              {/* --- ACTION GROUP (Sửa & Xóa) --- */}
              {/* Chặn sự kiện nổi bọt (Bubbling) ngay tại container này */}
              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Edit Button */}
                <button
                  onClick={() => onEdit(lesson)}
                  className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                {/* Delete Button */}
                <ConfirmModal
                  onConfirm={handleDelete}
                  title="Xóa bài học?"
                  description="Bạn có chắc muốn xóa bài học này không? Hành động này không thể hoàn tác."
                  disabled={isDeleting}
                >
                  <button
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </ConfirmModal>
              </div>
              {/* --- END ACTION GROUP --- */}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
