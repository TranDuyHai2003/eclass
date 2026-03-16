"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { s3Client } from "@/lib/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// =============================================
// COURSE ACTIONS
// =============================================

export async function getCourses() {
  const courses = await prisma.course.findMany({
    include: {
      chapters: {
        include: {
          lessons: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return courses;
}

export async function getCourseById(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        include: {
          lessons: {
            include: { attachments: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      attachments: true,
      category: true,
    },
  });
  return course;
}

export async function createCourse(data: {
  title: string;
  description?: string;
  thumbnail?: string;
  isStructured?: boolean;
}) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const { title, description, thumbnail, isStructured = true } = data;

  const course = await prisma.course.create({
    data: {
      userId: session.user.id!,
      title,
      description,
      thumbnail,
      isStructured,
    },
  });

  // If flat structure, create a hidden General chapter
  if (!isStructured) {
    await prisma.chapter.create({
      data: {
        title: "General",
        courseId: course.id,
        isHidden: true,
        position: 0,
      },
    });
  }

  revalidatePath("/teacher/courses");
  return { success: true, courseId: course.id };
}

export async function getDefaultChapter(courseId: string) {
  const session = await auth();
  if (!session) return null;
  return prisma.chapter.findFirst({
    where: { courseId, isHidden: true },
  });
}

export async function getOrCreateFlatChapter(courseId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  let chapter = await prisma.chapter.findFirst({
    where: { courseId, isHidden: true },
  });

  if (!chapter) {
    chapter = await prisma.chapter.create({
      data: {
        title: "General",
        courseId,
        isHidden: true,
        position: 0,
      },
    });
  }
  return chapter;
}

export async function updateCourse(
  courseId: string,
  data: {
    title?: string;
    description?: string;
    thumbnail?: string;
    price?: number;
    categoryId?: string;
    isPublished?: boolean;
    isStructured?: boolean;
  },
) {
  const session = await auth();
  if (!session || !session.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  // Validation for publishing
  if (data.isPublished) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { chapters: { include: { lessons: true } } },
    });
    if (!course?.title || !course?.description || !course?.thumbnail) {
      return {
        success: false,
        error: "Vui lòng điền đầy đủ thông tin khóa học trước khi publish.",
      };
    }
    const hasPublishedChapter = course.chapters.some((ch) => ch.isPublished);
    if (!hasPublishedChapter) {
      return {
        success: false,
        error: "Vui lòng publish ít nhất 1 chương trước khi publish khóa học.",
      };
    }
  }

  // Logic for Flat Structure Switch
  // Logic for Flat Structure Switch
  if (data.isStructured === false) {
    // 1. Hierarchical -> Flat
    // Find or create hidden "General" chapter
    let generalChapter = await prisma.chapter.findFirst({
      where: { courseId, isHidden: true },
    });

    if (!generalChapter) {
      generalChapter = await prisma.chapter.create({
        data: { title: "General", courseId, isHidden: true, position: 0 },
      });
    }

    // Get all other chapters
    const otherChapters = await prisma.chapter.findMany({
      where: {
        courseId,
        id: { not: generalChapter.id },
      },
      include: { lessons: true },
    });

    // Move all lessons to General chapter
    let currentPosition = 0;

    // First, get max position in General chapter if it has lessons
    const generalLessonsCount = await prisma.lesson.count({
      where: { chapterId: generalChapter.id },
    });
    currentPosition = generalLessonsCount;

    for (const chapter of otherChapters) {
      for (const lesson of chapter.lessons) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            chapterId: generalChapter.id,
            position: currentPosition++,
          },
        });
      }
      // Delete the empty chapter
      await prisma.chapter.delete({
        where: { id: chapter.id },
      });
    }
  } else if (data.isStructured === true) {
    // 2. Flat -> Hierarchical
    // Find the hidden "General" chapter
    const generalChapter = await prisma.chapter.findFirst({
      where: { courseId, isHidden: true },
    });

    if (generalChapter) {
      // Unhide and rename to "Chương 1"
      await prisma.chapter.update({
        where: { id: generalChapter.id },
        data: {
          isHidden: false,
          title: "Chương 1",
          isPublished: true, // Optional: make it published so it's visible if it has content
        },
      });
    }
  }

  await prisma.course.update({
    where: { id: courseId },
    data,
  });
  revalidatePath(`/teacher/courses/${courseId}`);
  return { success: true };
}

export async function deleteCourse(courseId: string) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
      throw new Error("Unauthorized");

    // Find all lessons to delete their files from R2
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: { include: { lessons: { include: { attachments: true } } } },
        attachments: true,
      },
    });

    if (course) {
      // Delete all files from R2
      for (const chapter of course.chapters) {
        for (const lesson of chapter.lessons) {
          if (lesson.videoUrl) await deleteFileFromR2(lesson.videoUrl);
          for (const att of lesson.attachments) {
            await deleteFileFromR2(att.url);
          }
        }
      }
      for (const att of course.attachments) {
        await deleteFileFromR2(att.url);
      }
      if (course.thumbnail) await deleteFileFromR2(course.thumbnail);
    }

    await prisma.course.delete({ where: { id: courseId } });
    revalidatePath("/teacher/courses");
    return { success: true };
  } catch (error) {
    console.error("Delete Course Error:", error);
    return { success: false, error: "Không thể xóa khóa học này" };
  }
}

// =============================================
// CHAPTER ACTIONS
// =============================================

export async function createChapter(courseId: string, title: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const lastChapter = await prisma.chapter.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
  });
  const newPosition = lastChapter ? lastChapter.position + 1 : 0;

  const chapter = await prisma.chapter.create({
    data: { title, courseId, position: newPosition, isHidden: false },
  });
  revalidatePath(`/teacher/courses/${courseId}`);
  return { success: true, chapter };
}

export async function updateChapter(
  chapterId: string,
  data: {
    title?: string;
    description?: string;
    isPublished?: boolean;
  },
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  // Validation for publishing
  if (data.isPublished) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { lessons: true },
    });
    const hasPublishedLesson = chapter?.lessons.some((l) => l.isPublished);
    if (!hasPublishedLesson) {
      return {
        success: false,
        error: "Chương cần có ít nhất 1 bài giảng được publish.",
      };
    }
  }

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data,
  });
  revalidatePath(`/teacher/courses/${chapter.courseId}`);
  return { success: true };
}

export async function deleteChapter(chapterId: string) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
      throw new Error("Unauthorized");

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { lessons: { include: { attachments: true } } },
    });

    if (chapter) {
      for (const lesson of chapter.lessons) {
        if (lesson.videoUrl) await deleteFileFromR2(lesson.videoUrl);
        for (const att of lesson.attachments) {
          await deleteFileFromR2(att.url);
        }
      }
    }

    await prisma.chapter.delete({ where: { id: chapterId } });
    revalidatePath(`/teacher/courses/${chapter?.courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi khi xóa chương" };
  }
}

/**
 * Reorder Chapters: Update positions based on the new order array.
 * @param list Array of { id: string, position: number }
 */
export async function reorderChapters(
  list: { id: string; position: number }[],
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  // Use a transaction to update all positions atomically
  const updates = list.map((item) =>
    prisma.chapter.update({
      where: { id: item.id },
      data: { position: item.position },
    }),
  );
  await prisma.$transaction(updates);
  // Can't easily get courseId here, caller should revalidate
  return { success: true };
}

// =============================================
// LESSON ACTIONS
// =============================================

export async function createLesson(chapterId: string, title: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const lastLesson = await prisma.lesson.findFirst({
    where: { chapterId },
    orderBy: { position: "desc" },
  });
  const newPosition = lastLesson ? lastLesson.position + 1 : 0;

  const lesson = await prisma.lesson.create({
    data: { title, chapterId, position: newPosition },
  });

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  revalidatePath(`/teacher/courses/${chapter?.courseId}`);

  // Return full lesson for UI
  const fullLesson = await prisma.lesson.findUnique({
    where: { id: lesson.id },
    include: { attachments: true },
  });
  return { success: true, lesson: fullLesson };
}

export async function updateLesson(
  lessonId: string,
  data: {
    title?: string;
    description?: string;
    videoUrl?: string;
    isPublished?: boolean;
    isFree?: boolean; // THÊM DÒNG NÀY
  },
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  // 1. Kiểm tra điều kiện khi Publish
  if (data.isPublished) {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });

    // Lưu ý: Phải kiểm tra cả dữ liệu mới đang update (data) và dữ liệu cũ trong DB
    const finalTitle = data.title || lesson?.title;
    const finalVideoUrl = data.videoUrl || lesson?.videoUrl;

    if (!finalTitle || !finalVideoUrl) {
      return {
        success: false,
        error: "Bài giảng cần có tiêu đề và video trước khi duyệt (publish).",
      };
    }
  }

  // 2. Cập nhật Lesson
  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data, // Bây giờ 'data' đã hợp lệ vì có 'isFree' trong type định nghĩa ở trên
  });

  // 3. Revalidate cache
  const chapter = await prisma.chapter.findUnique({
    where: { id: lesson.chapterId },
    select: { courseId: true }, // Chỉ lấy courseId để tối ưu tốc độ
  });

  if (chapter?.courseId) {
    revalidatePath(`/teacher/courses/${chapter.courseId}`);
  }

  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
      throw new Error("Unauthorized");

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { attachments: true, chapter: true },
    });

    if (lesson) {
      // Delete video from R2
      if (lesson.videoUrl) {
        console.log(`[R2 Delete] Deleting video: ${lesson.videoUrl}`);
        await deleteFileFromR2(lesson.videoUrl);
      }
      // Delete all attachments from R2
      for (const att of lesson.attachments) {
        console.log(`[R2 Delete] Deleting attachment: ${att.url}`);
        await deleteFileFromR2(att.url);
      }
    }

    await prisma.lesson.delete({ where: { id: lessonId } });
    revalidatePath(`/teacher/courses/${lesson?.chapter?.courseId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Lỗi khi xóa bài giảng" };
  }
}

/**
 * Reorder Lessons: Update positions based on the new order array.
 * @param list Array of { id: string, position: number }
 */
export async function reorderLessons(list: { id: string; position: number }[]) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const updates = list.map((item) =>
    prisma.lesson.update({
      where: { id: item.id },
      data: { position: item.position },
    }),
  );
  await prisma.$transaction(updates);
  return { success: true };
}

// =============================================
// LESSON PROGRESS ACTIONS
// =============================================

export async function updateLessonProgress({
  lessonId,
  isCompleted,
}: {
  lessonId: string;
  isCompleted: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const progress = await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId: session.user.id,
          lessonId,
        },
      },
      update: {
        isCompleted,
      },
      create: {
        userId: session.user.id,
        lessonId,
        isCompleted,
      },
    });

    revalidatePath(`/watch/${lessonId}`);
    return { success: true, progress };
  } catch (error) {
    console.error("Progress Update Error:", error);
    return { success: false, error: "Không thể cập nhật tiến độ" };
  }
}

// =============================================
// ATTACHMENT ACTIONS
// =============================================

export async function createAttachment(data: {
  name: string;
  url: string;
  type: string;
  courseId?: string;
  lessonId?: string;
}) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const attachment = await prisma.attachment.create({ data });
  // Revalidate based on parent
  if (data.courseId) revalidatePath(`/teacher/courses/${data.courseId}`);
  return { success: true, attachment };
}

export async function deleteAttachment(attachmentId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER"))
    throw new Error("Unauthorized");

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (attachment) {
    await deleteFileFromR2(attachment.url);
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  if (attachment?.courseId)
    revalidatePath(`/teacher/courses/${attachment.courseId}`);
  return { success: true };
}

// =============================================
// HELPER: Delete file from Cloudflare R2
// =============================================

async function deleteFileFromR2(fileUrl: string) {
  try {
    // 1. Parse URL
    const url = new URL(fileUrl);

    // 2. Lấy pathname và decode để xử lý ký tự đặc biệt (ví dụ: %20 -> khoảng trắng)
    const key = decodeURIComponent(url.pathname.substring(1));

    if (!key) {
      console.warn("[R2 Delete] Could not extract key from URL:", fileUrl);
      return;
    }

    console.log(`[R2 Delete] Deleting key: ${key}`);

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
    );

    console.log(`[R2 Delete] Successfully deleted: ${key}`);
  } catch (error) {
    console.error("[R2 Delete] Error deleting file:", error);
    // Vẫn để code chạy tiếp (không throw error) để Prisma có thể xóa record trong DB
  }
}
