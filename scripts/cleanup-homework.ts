import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

// Load biến môi trường từ file .env
dotenv.config();

const prisma = new PrismaClient();

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
 * Hàm hỗ trợ bóc tách S3 Key chuẩn xác kể cả với link CDN mới hoặc link B2 thô cũ
 */
function extractS3Key(fileUrl: string): string | null {
  try {
    const parsedUrl = new URL(fileUrl);
    let pathname = parsedUrl.pathname; // Ví dụ: "/images/abc.jpg" hoặc "/file/bucket-name/images/abc.jpg"

    // Loại bỏ dấu gạch chéo ở đầu nếu có
    if (pathname.startsWith("/")) {
      pathname = pathname.substring(1);
    }

    // Nếu là link thô cũ của B2, loại bỏ cụm "file/ten-bucket/" ở đầu đường dẫn
    const prefixToRemove = `file/${B2_BUCKET_NAME}/`;
    if (pathname.startsWith(prefixToRemove)) {
      pathname = pathname.replace(prefixToRemove, "");
    }

    return pathname;
  } catch (error) {
    console.error(`❌ Định dạng URL không hợp lệ: ${fileUrl}`);
    return null;
  }
}

async function autoCleanupOldHomework() {
  console.log(
    "🚀 Bắt đầu tiến trình dọn dẹp bài tập cũ để giải phóng dung lượng...",
  );

  // ⏱️ Thiết lập hạn xử lý cuốn chiếu: 7 ngày kể từ lúc chấm xong
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
    // 1. Tìm các bài nộp đã quá 7 ngày VÀ đã được chấm xong (Tránh đụng vào bài PENDING)
    const oldSubmissions = await prisma.homeworkSubmission.findMany({
      where: {
        updatedAt: { lt: oneWeekAgo },
        status: { in: ["SATISFACTORY", "UNSATISFACTORY"] },
      },
    });

    // Lọc các bản ghi thực sự có dữ liệu đính kèm bên trong mảng JSON attachments
    const submissionsToClean = oldSubmissions.filter(
      (sub) => Array.isArray(sub.attachments) && sub.attachments.length > 0,
    );

    console.log(
      `📌 Tìm thấy ${submissionsToClean.length} bài nộp cũ đủ điều kiện thanh lọc.`,
    );

    for (const submission of submissionsToClean) {
      const attachments = submission.attachments as any as {
        name: string;
        url: string;
      }[];
      console.log(
        `⏳ Đang xử lý bài nộp ID: ${submission.id} (Có ${attachments.length} file)`,
      );

      for (const file of attachments) {
        if (!file.url) continue;

        const s3Key = extractS3Key(file.url);
        if (!s3Key) continue;

        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: s3Key,
          });
          await b2Client.send(deleteCommand);
          console.log(`  🗑️ Đã xóa tệp trên B2: ${s3Key}`);
        } catch (fileErr: any) {
          // Kể cả file không tồn tại trên B2 (404), ta vẫn log lại và tiếp tục luồng chạy
          console.warn(
            `  ⚠️ Không thể xóa tệp vật lý (Có thể đã bị xóa trước đó): ${s3Key}`,
          );
        }
      }

      // 2. CẬP NHẬT DATABASE (Luôn luôn chạy để giải phóng bản ghi, tránh lặp lại vào đêm sau)
      await prisma.homeworkSubmission.update({
        where: { id: submission.id },
        data: {
          attachments: [], // Xóa sạch mảng lưu trữ link file đính kèm
          feedback: submission.feedback
            ? `${submission.feedback}\n\n(Hệ thống đã tự động dọn dẹp tệp đính kèm cũ để tối ưu dung lượng hệ thống)`
            : "(Hệ thống đã tự động dọn dẹp tệp đính kèm cũ để tối ưu dung lượng hệ thống theo chu kỳ định kỳ)",
        },
      });
      console.log(
        `  ✅ Đã dọn dẹp sạch dữ liệu DB của bài nộp ID: ${submission.id}`,
      );
    }

    console.log("✅ Hoàn thành chu kỳ dọn dẹp dữ liệu lưu trữ vinh quang!");
  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng trong tiến trình dọn dẹp tổng:", error);
  } finally {
    await prisma.$disconnect();
  }
}

autoCleanupOldHomework()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
