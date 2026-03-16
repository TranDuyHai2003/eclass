"use client";

import { useState, useTransition, useEffect } from "react";
import { Chapter, Lesson, Attachment, Course } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CourseHeader } from "./CourseHeader";
import { CourseCurriculum } from "./CourseCurriculum";
import { LessonEditModal } from "./LessonEditModal";
import { ChapterEditModal } from "./ChapterEditModal";
import { CourseWithRelations } from "./types";

import {
  updateCourse,
  createChapter,
  createLesson,
  deleteChapter,
  deleteLesson,
  deleteCourse,
  reorderChapters,
  reorderLessons,
  getDefaultChapter,
} from "@/actions/course";

interface CourseBuilderProps {
  course: CourseWithRelations;
}

export function CourseBuilder({ course: initialCourse }: CourseBuilderProps) {
  // State quản lý dữ liệu khóa học (Local state để update UI tức thì)
  const [course, setCourse] = useState(initialCourse);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();

  // State cho Modals
  const [editingLesson, setEditingLesson] = useState<
    (Lesson & { attachments: Attachment[] }) | null
  >(null);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

  // --- EFFECT: Đồng bộ dữ liệu từ Server ---
  useEffect(() => {
    setCourse(initialCourse);
  }, [initialCourse]);

  const refreshData = () => {
    router.refresh();
  };

  // ==============================
  // COURSE HANDLERS
  // ==============================
  const handleUpdateCourse = async (data: Partial<Course>) => {
    // 1. Optimistic Update: Cập nhật giao diện ngay lập tức
    // Sử dụng 'as any' để tránh lỗi type deep merge tạm thời
    setCourse((prev) => ({ ...prev, ...data }) as any);

    // 2. Chuẩn bị payload: Chuyển đổi 'null' từ DB thành 'undefined' để khớp với Server Action
    const payload = {
      title: data.title,
      description: data.description === null ? undefined : data.description,
      thumbnail: data.thumbnail === null ? undefined : data.thumbnail,
      price: data.price === null ? undefined : data.price,
      categoryId: data.categoryId === null ? undefined : data.categoryId,
      isPublished: data.isPublished,
      isStructured: data.isStructured,
    };

    startTransition(async () => {
      // 3. Gọi Server Action với payload đã làm sạch
      const res = await updateCourse(course.id, payload);

      if (!res.success) {
        toast.error(res.error || "Lỗi cập nhật");
        refreshData(); // Revert dữ liệu về server state nếu lỗi
      } else {
        toast.success("Đã lưu thay đổi");
        refreshData(); // Sync lại để đảm bảo đồng bộ
      }
    });
  };

  const handleDeleteCourse = async () => {
    try {
      const res = await deleteCourse(course.id);
      if (res.success) {
        toast.success("Đã xóa khóa học");
        router.push("/teacher/courses");
      } else {
        toast.error("Lỗi: " + res.error);
      }
    } catch {
      toast.error("Đã có lỗi xảy ra");
    }
  };

  // ==============================
  // CHAPTER HANDLERS
  // ==============================
  const handleCreateChapter = async () => {
    startTransition(async () => {
      await createChapter(course.id, "Chương mới");
      refreshData();
    });
  };

  const handleDeleteChapter = async (chapterId: string) => {
    // 1. Optimistic: Backup
    const previousCourse = { ...course };

    // 2. Optimistic: Xóa ngay trên UI
    const newChapters = course.chapters.filter((ch) => ch.id !== chapterId);
    setCourse({ ...course, chapters: newChapters });

    try {
      // 3. Gọi API
      const res = await deleteChapter(chapterId);
      if (!res.success) throw new Error(res.error);

      toast.success("Đã xóa chương");
      router.refresh();
    } catch (error) {
      // 4. Rollback
      setCourse(previousCourse);
      toast.error("Không thể xóa chương này");
    }
  };

  // ==============================
  // LESSON HANDLERS
  // ==============================
  const handleCreateLesson = async (chapterId?: string) => {
    let targetId = chapterId;

    // Logic tìm chapter ẩn cho chế độ Flat
    if (!course.isStructured && !targetId) {
      const hidden =
        course.chapters.find((c) => c.isHidden) ||
        (await getDefaultChapter(course.id));
      targetId = hidden?.id;
    }

    if (!targetId) return;

    startTransition(async () => {
      const res = await createLesson(targetId!, "Bài học mới");
      if (res.success && res.lesson) {
        setEditingLesson(res.lesson);
        setIsModalOpen(true);
        refreshData();
      }
    });
  };

  const handleDeleteLesson = async (lessonId: string) => {
    // 1. Optimistic: Backup
    const previousCourse = { ...course };

    // 2. Optimistic: Xóa ngay trên UI
    const newChapters = course.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.filter((l) => l.id !== lessonId),
    }));

    setCourse({ ...course, chapters: newChapters });

    try {
      // 3. Gọi API
      const res = await deleteLesson(lessonId);
      if (!res.success) throw new Error(res.error);

      toast.success("Đã xóa bài giảng");
      router.refresh();
    } catch (error) {
      // 4. Rollback
      setCourse(previousCourse);
      toast.error("Không thể xóa bài giảng này");
    }
  };

  // ==============================
  // REORDER HANDLERS
  // ==============================
  const handleReorderChapters = async (
    list: { id: string; position: number }[],
  ) => {
    // Có thể thêm Optimistic update cho reorder ở đây nếu muốn mượt hơn nữa,
    // nhưng DragDropContext thường đã xử lý visual rồi.
    await reorderChapters(list);
    refreshData();
  };

  const handleReorderLessons = async (
    list: { id: string; position: number }[],
  ) => {
    await reorderLessons(list);
    refreshData();
  };

  return (
    <div className="space-y-8 pb-20">
      <CourseHeader
        course={course}
        onUpdate={handleUpdateCourse}
        onDelete={handleDeleteCourse}
        isLoading={isLoading}
      />

      <CourseCurriculum
        course={course}
        // Chapter Actions
        onCreateChapter={handleCreateChapter}
        onEditChapter={(ch) => {
          setEditingChapter(ch);
          setIsChapterModalOpen(true);
        }}
        onDeleteChapter={handleDeleteChapter}
        // Lesson Actions
        onCreateLesson={handleCreateLesson}
        onEditLesson={(l) => {
          setEditingLesson(l);
          setIsModalOpen(true);
        }}
        onDeleteLesson={handleDeleteLesson}
        // Reorder Actions
        onReorderChapters={handleReorderChapters}
        onReorderLessons={handleReorderLessons}
      />

      {/* --- MODALS --- */}
      {editingLesson && (
        <LessonEditModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          lesson={editingLesson}
          onSuccess={refreshData}
        />
      )}
      {editingChapter && (
        <ChapterEditModal
          open={isChapterModalOpen}
          onOpenChange={setIsChapterModalOpen}
          chapter={editingChapter}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}
