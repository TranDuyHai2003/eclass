import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";

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
export const CDN_DOMAIN =
  process.env.NEXT_PUBLIC_VIDEO_DOMAIN || "https://cdn.teacherduc.me";

export function validateB2Config(): string | null {
  if (!process.env.B2_KEY_ID || process.env.B2_KEY_ID.startsWith("dummy")) {
    return "B2_KEY_ID chưa được cấu hình";
  }
  if (!process.env.B2_APP_KEY || process.env.B2_APP_KEY.startsWith("dummy")) {
    return "B2_APP_KEY chưa được cấu hình";
  }
  if (
    !process.env.B2_BUCKET_NAME ||
    process.env.B2_BUCKET_NAME.startsWith("dummy")
  ) {
    return "B2_BUCKET_NAME chưa được cấu hình";
  }
  return null;
}

export function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ""); // remove leading/trailing hyphens
}

export function sanitizeFileName(fileName: string): string {
  const parts = fileName.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const name = parts.join(".");

  let safeName = slugify(name);
  if (!safeName) safeName = "file";

  return ext ? `${safeName}.${ext}` : safeName;
}

export async function commitTempFile(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url || typeof url !== "string") return url || null;
  if (!url.includes("/temp/")) return url;

  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;

    const tempIndex = pathname.indexOf("temp/");
    if (tempIndex === -1) return url;

    const sourceKey = pathname.substring(tempIndex);
    const destinationKey = sourceKey.replace("temp/", "");

    // Thực hiện sao chép file từ thư mục tạm sang thư mục chính thức trên B2
    const command = new CopyObjectCommand({
      Bucket: B2_BUCKET_NAME,
      CopySource: encodeURI(`${B2_BUCKET_NAME}/${sourceKey}`),
      Key: destinationKey,
    });

    await b2Client.send(command);

    // Chuẩn hóa CDN Domain (xử lý bỏ dấu gạch chéo thừa ở cuối nếu có)
    const cleanCdnBase = CDN_DOMAIN.endsWith("/")
      ? CDN_DOMAIN.slice(0, -1)
      : CDN_DOMAIN;

    // Trả về định dạng URL Cloudflare CDN siêu ngắn gọn để lưu vào Database
    // Kết quả dạng: https://cdn.teacherduc.me/documents/abc.pdf
    return `${cleanCdnBase}/${destinationKey}`;
  } catch (error) {
    console.error("[B2] Failed to commit temp file:", error);
    return url;
  }
}
