/**
 * Thu nhỏ ảnh ngay trên trình duyệt trước khi tải lên (chỉ dùng ở client).
 * Ảnh chụp điện thoại thường 2–5MB, 4000px, trong khi ảnh đại diện chỉ hiển thị vài chục px.
 *
 * - Cạnh dài nhất tối đa `maxSize`px, nén JPEG chất lượng `quality`.
 * - Giữ đúng chiều xoay theo EXIF (createImageBitmap + imageOrientation).
 * - Trình duyệt không đọc được định dạng (vd HEIC trên Chrome) hoặc ảnh sau nén không nhỏ hơn
 *   → trả lại file gốc, việc tải lên vẫn diễn ra như trước.
 */
export async function resizeImageFile(file: File, maxSize = 512, quality = 0.85): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // Nền trắng cho ảnh PNG trong suốt (JPEG không có kênh trong suốt)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
