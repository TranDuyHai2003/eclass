import type { PDFDocumentProxy } from "pdfjs-dist";
import { analyzePdf, type PdfAnalysis } from "@/lib/pdf-question-anchors";

// Chỉ dùng ở client (cần Web Worker + localStorage).

const CACHE_PREFIX = "pdf-analysis:v6:";

/**
 * Như analyzePdf nhưng:
 * - dùng lại kết quả đã lưu trong trình duyệt (theo fingerprint của file PDF);
 * - phân tích trên một worker riêng để không phải xếp hàng sau việc render các trang.
 */
export async function analyzePdfCached(pdf: PDFDocumentProxy): Promise<PdfAnalysis> {
  const fingerprint = pdf.fingerprints?.[0];
  const cacheKey = CACHE_PREFIX + (fingerprint ?? "");
  if (fingerprint) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as PdfAnalysis;
    } catch {
      // localStorage có thể bị chặn — bỏ qua
    }
  }

  let analysis: PdfAnalysis;
  try {
    const { pdfjs } = await import("react-pdf");
    // react-pdf tự đặt workerSrc tương đối khi nạp; dùng đúng file worker như components/ui/pdf-viewer.tsx
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.wrapper.js";
    const data = await pdf.getData();
    const worker = new pdfjs.PDFWorker();
    const separateDoc = await pdfjs.getDocument({ data, worker }).promise;
    try {
      analysis = await analyzePdf(separateDoc);
    } finally {
      await separateDoc.destroy();
      worker.destroy();
    }
  } catch {
    // Không tạo được worker riêng → phân tích trên tài liệu đang hiển thị
    analysis = await analyzePdf(pdf);
  }

  if (fingerprint) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(analysis));
    } catch {
      // bỏ qua nếu đầy bộ nhớ hoặc bị chặn
    }
  }
  return analysis;
}
