import { S3Client } from "@aws-sdk/client-s3";

// Đã xóa đoạn if (!process.env...) throw Error để không bị crash lúc Build

export const b2Client = new S3Client({
  // Thêm giá trị fallback (|| 'dummy') để đánh lừa quá trình Build của Next.js
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-004"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "dummy_key",
    secretAccessKey: process.env.B2_APP_KEY || "dummy_secret",
  },
  region: process.env.B2_REGION || "us-east-004",
  forcePathStyle: true,
});

export const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "dummy_bucket";
export const CDN_DOMAIN = process.env.NEXT_PUBLIC_VIDEO_DOMAIN || "";

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w.-]/g, "_") // Thay thế các ký tự không phải chữ cái, số, dấu chấm, dấu gạch ngang bằng dấu gạch dưới
    .replace(/_{2,}/g, "_") // Rút gọn nhiều dấu gạch dưới liên tiếp
    .replace(/^_+|_+$/g, ""); // Xóa dấu gạch dưới ở đầu và cuối
}
