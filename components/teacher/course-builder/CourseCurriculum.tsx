"use client";

import { CourseWithRelations } from "./types";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { ChapterCard } from "./ChapterCard";
import { LessonItem } from "./LessonItem";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface CurriculumBuilderProps {
  course: CourseWithRelations;
  onCreateChapter: () => void;
  onEditChapter: (chapter: any) => void;
  onDeleteChapter: (id: string) => void; // Mới

  onCreateLesson: (chapterId?: string) => void;
  onEditLesson: (lesson: any) => void;
  onDeleteLesson: (id: string) => void; // Mới

  onReorderChapters: (list: any[]) => void;
  onReorderLessons: (list: any[]) => void;
}

export function CourseCurriculum({
  course,
  onCreateChapter,
  onEditChapter,
  onDeleteChapter,
  onCreateLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderChapters,
  onReorderLessons,
}: CurriculumBuilderProps) {
  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    // 1. Reorder Chapters
    if (type === "chapter") {
      const items = Array.from(course.chapters);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      // Optimistic update handled by parent passing new course?
      // Here we just trigger server action
      const updates = items.map((chapter, index) => ({
        id: chapter.id,
        position: index,
      }));
      onReorderChapters(updates);
      return;
    }

    // 2. Reorder Lessons
    if (type === "lesson") {
      // Find source and destination chapters
      const sourceChapter = course.chapters.find(
        (c) => c.id === source.droppableId,
      );
      const destChapter = course.chapters.find(
        (c) => c.id === destination.droppableId,
      );

      if (!sourceChapter || !destChapter) return;

      // Same chapter reorder
      if (source.droppableId === destination.droppableId) {
        const newLessons = Array.from(sourceChapter.lessons);
        const [movedLesson] = newLessons.splice(source.index, 1);
        newLessons.splice(destination.index, 0, movedLesson);

        const updates = newLessons.map((lesson, index) => ({
          id: lesson.id,
          position: index,
        }));
        onReorderLessons(updates);
      } else {
        // Moving between chapters (if supported in future, backend updateLesson(chapterId))
        // Currently reorderLessons only updates positions, doesn't change chapterId?
        // Our reorderLessons in actions only updates position.
        // To move chapters, we need to update chapterId too.
        // For simplicity, if structure is Hierarchical, moving between chapters is complex if action doesn't support it.
        // Action updateLesson supports data update.
        // We'll skip cross-chapter drag implementation for this step unless 'isStructured' logic allows it.
        // For 'Flat' structure, there is only one chapter, so it works fine.
        console.warn(
          "Cross-chapter drag not fully implemented in this iteration",
        );
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          Chương trình giảng dạy
        </h2>
        {course.isStructured && (
          <Button onClick={onCreateChapter} variant="outline" size="sm">
            <PlusCircle className="h-4 w-4 mr-2" />
            Thêm chương
          </Button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {course.isStructured ? (
          <Droppable droppableId="chapters" type="chapter">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {course.chapters.map((chapter, index) => (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    index={index}
                    onEditChapter={onEditChapter}
                    onDeleteChapter={onDeleteChapter} // Truyền xuống
                    onEditLesson={onEditLesson}
                    onDeleteLesson={onDeleteLesson} // Truyền xuống
                    onCreateLesson={onCreateLesson}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ) : (
          // FLAT VIEW
          <Droppable
            droppableId={
              course.chapters.find((c) => c.isHidden)?.id || "flat-list"
            }
            type="lesson"
          >
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2 min-h-[200px] border border-dashed rounded-xl p-4 bg-gray-50/50"
              >
                {(course.chapters.find((c) => c.isHidden)?.lessons || []).map(
                  (lesson, index) => (
                    <LessonItem
                      key={lesson.id}
                      lesson={lesson}
                      index={index}
                      onEdit={onEditLesson}
                      onDelete={onDeleteLesson} // Truyền xuống
                      isFlat
                    />
                  ),
                )}
                {provided.placeholder}

                <Button
                  onClick={() => onCreateLesson()}
                  className="w-full py-6 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border-2 border-dashed border-gray-200 mt-4 h-auto"
                  variant="ghost"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Thêm bài học mới
                </Button>
              </div>
            )}
          </Droppable>
        )}
      </DragDropContext>
    </div>
  );
}
