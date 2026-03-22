"use client";

import { Chapter, Lesson, Attachment } from "@prisma/client";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { GripVertical, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { LessonItem } from "./LessonItem";
import { LibrarySelect } from "./LibrarySelect";
import { Button } from "@/components/ui/button";
import type { CourseWithRelations } from "./types";
import { useState } from "react";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

interface ChapterCardProps {
  chapter: CourseWithRelations["chapters"][number];
  index: number;
  onEditChapter: (chapter: CourseWithRelations["chapters"][number]) => void;
  onDeleteChapter: (id: string) => void; // Mới
  onCreateLesson: (chapterId?: string) => void;
  onEditLesson: (lesson: any) => void;
  onDeleteLesson: (id: string) => void; // Mới
}
export function ChapterCard({
  chapter,
  index,
  onEditChapter,
  onDeleteChapter, // Nhận prop xóa
  onCreateLesson,
  onEditLesson,
  onDeleteLesson, // Nhận prop xóa lesson để truyền tiếp
}: ChapterCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDeleteChapter(chapter.id);
    setIsDeleting(false);
  };
  return (
    <Draggable draggableId={chapter.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "bg-white rounded-lg border border-gray-200 mb-4 shadow-sm",
            snapshot.isDragging &&
              "shadow-xl border-red-200 ring-2 ring-red-100",
          )}
        >
          {/* Chapter Header */}
          <div className="flex items-center gap-x-2 p-3 bg-gray-50/50 border-b border-gray-100 rounded-t-lg group">
            <div
              {...provided.dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
            >
              <GripVertical className="h-5 w-5" />
            </div>
            <span className="font-semibold text-gray-800 text-sm md:text-base">
              {chapter.title}
            </span>

            <div className="ml-auto flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                onClick={() => onEditChapter(chapter)}
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-blue-600"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <ConfirmModal
                onConfirm={handleDelete}
                title="Xóa chương này?"
                description="Tất cả bài học trong chương này cũng sẽ bị xóa."
                disabled={isDeleting}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-gray-500 hover:text-red-600"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmModal>
              {/* Delete Chapter - could also be added */}
            </div>
          </div>

          {/* Lessons List (Droppable) */}
          <Droppable droppableId={chapter.id} type="lesson">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={cn(
                  "p-2 min-h-[10px]",
                  snapshot.isDraggingOver && "bg-red-50/30",
                )}
              >
                {chapter.lessons.map((lesson, lessonIndex) => (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    index={lessonIndex}
                    onEdit={onEditLesson}
                    onDelete={onDeleteLesson}
                  />
                ))}
                {provided.placeholder}

                <Button
                  onClick={() => onCreateLesson(chapter.id)}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs font-medium text-gray-500 hover:text-red-700 hover:bg-red-50 mt-1 h-9"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Thêm bài học
                </Button>
                <LibrarySelect chapterId={chapter.id} />
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}
