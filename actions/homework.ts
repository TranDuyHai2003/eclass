"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

function extractS3Key(fileUrl: string): string | null {
  try {
    const parsedUrl = new URL(fileUrl);
    let pathname = parsedUrl.pathname;
    if (pathname.startsWith("/")) pathname = pathname.substring(1);
    const prefixToRemove = `file/${B2_BUCKET_NAME}/`;
    if (pathname.startsWith(prefixToRemove))
      pathname = pathname.replace(prefixToRemove, "");
    return pathname;
  } catch (error) {
    return null;
  }
}

// ----------------------------------------------------------------------
// 2. CÁC SERVER ACTIONS
// ----------------------------------------------------------------------

export async function submitHomework(
  lessonId: string,
  attachments: { name: string; url: string }[],
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

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

  // 🔥 CHẶN RÁC MỒ CÔI KHI NỘP LẠI BÀI: Xóa file cũ trước khi ghi đè
  if (
    existing &&
    Array.isArray(existing.attachments) &&
    existing.attachments.length > 0
  ) {
    const oldAttachments = existing.attachments as any as { url: string }[];
    for (const file of oldAttachments) {
      if (!file.url) continue;
      const s3Key = extractS3Key(file.url);
      if (!s3Key) continue;

      try {
        await b2Client.send(
          new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: s3Key }),
        );
        console.log(`[B2 Cleanup] Đã xóa rác mồ côi do nộp đè: ${s3Key}`);
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
      attachments: attachments as any,
      status: "PENDING", // Reset to pending if re-submitted
      feedback: null, // Clear old feedback on resubmit
    },
    create: {
      userId: session.user.id,
      lessonId,
      attachments: attachments as any,
    },
  });

  revalidatePath(`/watch/${lessonId}`);
  return { success: true, submission };
}

export async function gradeHomework(
  submissionId: string,
  status: "SATISFACTORY" | "UNSATISFACTORY",
  feedback?: string,
) {
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
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          studentType: true,
        },
      },
    },
  });

  revalidatePath(`/watch/${submission.lessonId}`);
  return { success: true, submission };
}

export async function deleteHomeworkSubmission(submissionId: string) {
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
      const s3Key = extractS3Key(file.url);
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

  // Sau khi dọn vật lý xong mới tiến hành xóa bản ghi trong DB
  await prisma.homeworkSubmission.delete({
    where: { id: submissionId },
  });

  revalidatePath("/teacher/homework");
  return { success: true };
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
