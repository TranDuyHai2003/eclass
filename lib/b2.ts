import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";
import { B2_BUCKET_NAME, CDN_DOMAIN, normalizeCdnUrl } from "./cdn-url";

export { B2_BUCKET_NAME, CDN_DOMAIN, normalizeCdnUrl };

export const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-005"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "dummy_key",
    secretAccessKey: process.env.B2_APP_KEY || "dummy_secret",
  },
  region: process.env.B2_REGION || "us-east-005",
  forcePathStyle: true,
});

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
  if (!str) return "";
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
  if (!fileName || typeof fileName !== "string") return "file";

  const parts = fileName.split(".");
  let ext = "";
  if (parts.length > 1) {
    ext = (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  const name = parts.join(".");

  let safeName = slugify(name);
  if (!safeName) safeName = "file";

  return ext ? `${safeName}.${ext}` : safeName;
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
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      // url is already a relative path
    }

    // Strip legacy /file/<bucket-name>/ prefix if present
    pathname = pathname.replace(/^\/file\/[^\/]+\//, "/");

    const tempIndex = pathname.indexOf("temp/");
    if (tempIndex === -1) {
      return normalized;
    }

    const sourceKey = pathname.substring(tempIndex);
    const destinationKey = sourceKey.replace("temp/", "");

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

    return normalizeCdnUrl(destinationKey);
  } catch (error) {
    console.error("[B2] Failed to commit temp file:", error);
    return normalized;
  }
}
