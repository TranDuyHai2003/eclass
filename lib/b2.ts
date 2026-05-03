import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.B2_KEY_ID || !process.env.B2_APP_KEY || !process.env.B2_REGION || !process.env.B2_BUCKET_NAME) {
  throw new Error("Missing Backblaze B2 configuration in environment variables.");
}

export const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  region: process.env.B2_REGION,
  forcePathStyle: true,
});

export const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
export const CDN_DOMAIN = process.env.NEXT_PUBLIC_VIDEO_DOMAIN;

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w.-]/g, "_") // Thay thế các ký tự không phải chữ cái, số, dấu chấm, dấu gạch ngang bằng dấu gạch dưới
    .replace(/_{2,}/g, "_")    // Rút gọn nhiều dấu gạch dưới liên tiếp
    .replace(/^_+|_+$/g, "");   // Xóa dấu gạch dưới ở đầu và cuối
}
