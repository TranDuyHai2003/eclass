"use server";

import { onHomeworkGraded, onHomeworkSubmitted } from "@/lib/points/hooks";
import { demoGuard } from "@/lib/demo";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  APPROVED_PAGE_SIZE,
  courseTitleFilter,
  reviewOrderBy,
  reviewSubmissionSelect,
} from "@/lib/homework-review";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { cleanHomeworkAttachments, homeworkKeyOf } from "@/lib/homework-files";
import { getVisibleCourseIds } from "@/lib/home/student-home";
import { revokeKey, lockWallet } from "@/lib/points/engine";

// ----------------------------------------------------------------------
// 1. CẤU HÌNH S3 CLIENT CHUẨN ĐỂ GỌI TRỰC TIẾP TỪ SERVER ACTION
// ----------------------------------------------------------------------
const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-004"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APP_KEY || "",
  },
  region: process.env.B2_REGION || "us-east-004",
  forcePathStyle: true,
});

const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "";


/**
 * Chỉ được xoá tệp BTVN (khoá images|documents/<id>-homework…) mà KHÔNG nằm trong bài nộp của người khác.
 * Trước 26/11/2026: nhận URL bất kỳ → học sinh xoá được ảnh / tài liệu bài giảng hoặc bài của bạn.
 */
async function deletableHomeworkKey(url: string, userId: string): Promise<string | null> {
  const key = homeworkKeyOf(url);
  if (!key) return null;
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "HomeworkSubmission"
    WHERE "userId" <> ${userId} AND array_to_string("attachments", ' ') LIKE ${"%" + key.replace(/[\\%_]/g, (c) => "\\" + c) + "%"}
  `;
  return Number(rows[0]?.n ?? 0) > 0 ? null : key;
}

// ----------------------------------------------------------------------
// 2. CÁC SERVER ACTIONS
// ----------------------------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Đặt giới hạn cứng là 50MB

export async function deleteDraftFile(url: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const s3Key = await deletableHomeworkKey(url, session.user.id);
  if (!s3Key) return { success: false };

  try {
    await b2Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: s3Key }));
    console.log(`[B2 Cleanup] Đã xóa file nháp: ${s3Key}`);
    return { success: true };
  } catch (err) {
    console.error(`[B2 Cleanup Lỗi] Không thể xóa file nháp: ${s3Key}`, err);
    return { success: false };
  }
}

export async function submitHomework(
  lessonId: string,
  rawAttachments: { name: string; url: string; size?: number }[],
) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  // Rà soát lại toàn bộ file trước khi lưu
  for (const file of Array.isArray(rawAttachments) ? rawAttachments : []) {
    if (file?.size && file.size > MAX_FILE_SIZE) {
      throw new Error("File quá lớn! Vui lòng chụp lại với chất lượng vừa phải hoặc dùng ảnh nén.");
    }
  }

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Chống lấy xu khống (26/11/2026): bài phải có BTVN, thuộc khoá học sinh được học, và có tệp thật đã tải lên
  if (typeof lessonId !== "string" || !lessonId) throw new Error("Bài học không hợp lệ.");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { hasHomework: true, chapter: { select: { courseId: true } } } });
  if (!lesson?.hasHomework) throw new Error("Bài học này không có bài tập về nhà.");
  if (session.user.role === "STUDENT" && !(await getVisibleCourseIds(session.user.id)).includes(lesson.chapter.courseId)) {
    throw new Error("Em chưa được học khoá này.");
  }

  const existing = await prisma.homeworkSubmission.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id,
        lessonId,
      },
    },
  });

  if (existing && existing.status === "SATISFACTORY") {
    throw new Error("Bài làm đã đạt yêu cầu, không thể thay đổi nội dung.");
  }

  const mine = ((existing?.attachments ?? []) as unknown as { url?: string }[]).map((f) => f?.url).filter((u): u is string => typeof u === "string");
  const cleaned = cleanHomeworkAttachments(rawAttachments, mine);
  if ("error" in cleaned) throw new Error(cleaned.error);
  const attachments = cleaned.ok;

  // 🔥 CHẶN RÁC MỒ CÔI KHI NỘP LẠI BÀI: Xóa file cũ trước khi ghi đè
  if (
    existing &&
    Array.isArray(existing.attachments) &&
    existing.attachments.length > 0
  ) {
    const oldAttachments = existing.attachments as any as { url: string }[];
    for (const file of oldAttachments) {
      if (!file.url) continue;
      
      // CHÚ Ý: Không xóa nếu người dùng quyết định giữ lại file này trong bài nộp mới
      const isRetained = attachments.some(newFile => newFile.url === file.url);
      if (isRetained) continue;

      const s3Key = await deletableHomeworkKey(file.url, session.user.id);
      if (!s3Key) continue;

      try {
        await b2Client.send(
          new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: s3Key }),
        );
        console.log(`[B2 Cleanup] Đã xóa rác mồ côi do nộp đè (file bị loại bỏ): ${s3Key}`);
      } catch (err) {
        console.error(`[B2 Cleanup Lỗi] Không thể xóa file cũ: ${s3Key}`, err);
      }
    }
  }

  const submission = await prisma.homeworkSubmission.upsert({
    where: {
      userId_lessonId: {
        userId: session.user.id,
        lessonId,
      },
    },
    update: {
      attachments: { set: attachments as any },
      status: "PENDING", // Reset to pending if re-submitted
      feedback: null, // Clear old feedback on resubmit
    },
    create: {
      userId: session.user.id,
      lessonId,
      attachments: attachments as any,
    },
  });

  await onHomeworkSubmitted({ userId: session.user.id, lessonId, submissionId: submission.id });

  revalidatePath(`/watch/${lessonId}`);
  return { success: true as const, submission };
}

export async function gradeHomework(
  submissionId: string,
  status: "SATISFACTORY" | "UNSATISFACTORY",
  feedback?: string,
) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    throw new Error("Unauthorized");
  }

  const submission = await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      feedback,
    },
    // Trả đủ trường như lúc tải trang (kể cả bài học/khoá học) để thẻ bài nộp không mất thông tin sau khi chấm
    select: reviewSubmissionSelect,
  });

  await onHomeworkGraded({
    userId: submission.userId,
    lessonId: submission.lessonId,
    submissionId: submission.id,
    status,
    teacherId: session.user.id!,
  });

  revalidatePath(`/watch/${submission.lessonId}`);
  return { success: true as const, submission };
}

export async function deleteHomeworkSubmission(submissionId: string) {
  const demoBlocked = await demoGuard();
  if (demoBlocked) return demoBlocked;

  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    throw new Error("Unauthorized");
  }

  // 🔥 CHẶN RÁC MỒ CÔI KHI GIÁO VIÊN XÓA BÀI: Truy vấn lấy danh sách file trước khi xóa DB
  const submissionToDelete = await prisma.homeworkSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submissionToDelete) {
    return { success: true as const };
  }

  if (
    submissionToDelete &&
    Array.isArray(submissionToDelete.attachments) &&
    submissionToDelete.attachments.length > 0
  ) {
    const filesToDelete = submissionToDelete.attachments as any as {
      url: string;
    }[];
    for (const file of filesToDelete) {
      if (!file.url) continue;
      const s3Key = await deletableHomeworkKey(file.url, submissionToDelete.userId);
      if (!s3Key) continue;

      try {
        await b2Client.send(
          new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: s3Key }),
        );
        console.log(
          `[B2 Cleanup] Đã xóa file rác do giáo viên xóa bài: ${s3Key}`,
        );
      } catch (err) {
        console.error(
          `[B2 Cleanup Lỗi] Không thể xóa file đính kèm: ${s3Key}`,
          err,
        );
      }
    }
  }

  // Sau khi dọn vật lý xong mới tiến hành xóa bản ghi trong DB; thu hồi +100 xu nộp bài (bài rác / nộp nhầm) trong cùng giao dịch
  await prisma.$transaction(async (tx) => {
    await tx.homeworkSubmission.delete({ where: { id: submissionId } });
    await lockWallet(tx, submissionToDelete.userId);
    await revokeKey(tx, submissionToDelete.userId, `HW:${submissionToDelete.lessonId}`, "Giáo viên xoá bài nộp bài tập về nhà", session.user.id ?? null);
  });

  revalidatePath("/teacher/homework");
  return { success: true as const };
}

/** Tải thêm bài "Đã đạt" cho màn Duyệt bài (phân trang theo con trỏ, có lọc theo khoá học). */
export async function listApprovedHomework(input: { courseTitles?: string[]; cursor?: string | null }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return { success: false as const, error: "Không có quyền" };
  }
  const courseTitles = Array.isArray(input.courseTitles)
    ? input.courseTitles.filter((t): t is string => typeof t === "string").slice(0, 100)
    : [];
  const where = { status: "SATISFACTORY" as const, ...courseTitleFilter(courseTitles) };
  const [items, total] = await Promise.all([
    prisma.homeworkSubmission.findMany({
      where,
      select: reviewSubmissionSelect,
      orderBy: reviewOrderBy,
      take: APPROVED_PAGE_SIZE,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    }),
    prisma.homeworkSubmission.count({ where }),
  ]);
  return { success: true as const, items, total };
}

export async function getHomeworkSubmission(lessonId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return await prisma.homeworkSubmission.findUnique({
    where: {
      userId_lessonId: {
        userId: session.user.id,
        lessonId,
      },
    },
  });
}
