import { S3Client } from "@aws-sdk/client-s3";

export const b2Client = new S3Client({
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

export function validateB2Config(): string | null {
  if (!process.env.B2_KEY_ID || process.env.B2_KEY_ID.startsWith("dummy")) {
    return "B2_KEY_ID chưa được cấu hình";
  }
  if (!process.env.B2_APP_KEY || process.env.B2_APP_KEY.startsWith("dummy")) {
    return "B2_APP_KEY chưa được cấu hình";
  }
  if (!process.env.B2_BUCKET_NAME || process.env.B2_BUCKET_NAME.startsWith("dummy")) {
    return "B2_BUCKET_NAME chưa được cấu hình";
  }
  return null;
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}
