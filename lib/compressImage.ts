import imageCompression from "browser-image-compression";

export const compressImage = async (file: File): Promise<File> => {
  if (!file.type || !file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const options = {
    maxSizeMB: 0.5,           // Ép dung lượng tối đa về ~500KB
    maxWidthOrHeight: 1600,   // Giữ độ phân giải đủ lớn để zoom không vỡ chữ
    useWebWorker: true,       // Chạy ngầm để không làm đơ giật giao diện
    initialQuality: 0.8       // Giữ chất lượng ở mức 80%
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn(`[compressImage] Bỏ qua nén ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB):`, error);
    return file;
  }
};
