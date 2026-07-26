import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";

export const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-005"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "dummy_key",
    secretAccessKey: process.env.B2_APP_KEY || "dummy_secret",
  },
  region: process.env.B2_REGION || "us-east-005",
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

export function normalizeCdnUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return url || null;

  // Don't treat simple answer strings like "A", "B", "T", "F", etc. as relative URL paths
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    return url;
  }

  const cleanCdnBase = CDN_DOMAIN.endsWith("/")
    ? CDN_DOMAIN.slice(0, -1)
    : CDN_DOMAIN;

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // If not a valid full URL, treat as path
  }

  // Remove legacy /file/<bucket>/ prefix if present
  pathname = pathname.replace(/^\/file\/[^\/]+\//, "/");
  // Remove /temp/ from path if present
  pathname = pathname.replace("/temp/", "/");

  // Ensure path starts with /
  if (!pathname.startsWith("/")) pathname = "/" + pathname;

  return `${cleanCdnBase}${pathname}`;
}

export async function commitTempFile(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url || typeof url !== "string") return url || null;

  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    return url;
  }

  // Clean URL first to strip legacy /file/<bucket>/
  const normalized = normalizeCdnUrl(url) || url;

  if (!url.includes("/temp/")) {
    return normalized;
  }

  try {
    const parsedUrl = new URL(url);
    let pathname = parsedUrl.pathname;

    // Strip legacy /file/<bucket-name>/ prefix if present
    pathname = pathname.replace(/^\/file\/[^\/]+\//, "/");

    const tempIndex = pathname.indexOf("temp/");
    if (tempIndex === -1) {
      return normalized;
    }

    const sourceKey = pathname.substring(tempIndex);
    const destinationKey = sourceKey.replace("temp/", "");

    const cleanCdnBase = CDN_DOMAIN.endsWith("/")
      ? CDN_DOMAIN.slice(0, -1)
      : CDN_DOMAIN;
    const finalUrl = `${cleanCdnBase}/${destinationKey}`;

    const rawSourceKey = decodeURIComponent(sourceKey);
    const rawDestinationKey = decodeURIComponent(destinationKey);

    try {
      // Attempt 1: Copy using raw decoded keys
      await b2Client.send(
        new CopyObjectCommand({
          Bucket: B2_BUCKET_NAME,
          CopySource: encodeURI(`${B2_BUCKET_NAME}/${rawSourceKey}`),
          Key: rawDestinationKey,
        }),
      );
    } catch (err1) {
      try {
        // Attempt 2: Copy using original keys
        await b2Client.send(
          new CopyObjectCommand({
            Bucket: B2_BUCKET_NAME,
            CopySource: encodeURI(`${B2_BUCKET_NAME}/${sourceKey}`),
            Key: destinationKey,
          }),
        );
      } catch (err2) {
        console.warn("[B2] Copy temp file attempt warning:", err1, err2);
      }
    }

    return finalUrl;
  } catch (error) {
    console.error("[B2] Failed to commit temp file:", error);
    return normalized;
  }
}
