import type { PDFDocumentProxy } from "pdfjs-dist";
import { analyzeTextLines, type PdfAnalysis, type PositionedLine } from "@/lib/pdf-question-anchors";

// Chỉ dùng ở client (cần canvas + Web Worker). Chỉ nạp ở công cụ cắt câu của giáo viên.

// Lưu các dòng chữ đã nhận dạng (không lưu kết quả phân tích) → nâng thuật toán ghép câu không phải OCR lại
const CACHE_PREFIX = "pdf-ocr-lines:v1:";
/** Vẽ trang ở 2× (≈ 144 dpi) — đủ rõ cho tiếng Việt có dấu mà vẫn nhanh */
const RENDER_SCALE = 2;

export interface OcrProgress {
  page: number;
  total: number;
  /** "init" lúc tải bộ nhận dạng (~10 MB, lần đầu), "page" khi đang đọc trang */
  phase: "init" | "page";
}

/** File PDF gần như không có lớp chữ (vd "Microsoft: Print To PDF" từ ảnh) → nên dùng OCR */
export async function looksImageOnly(pdf: PDFDocumentProxy, samplePages = 3) {
  let chars = 0;
  const n = Math.min(samplePages, pdf.numPages);
  for (let p = 1; p <= n; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    for (const it of content.items) if ("str" in it) chars += it.str.trim().length;
  }
  return chars < 40 * n;
}

export function getCachedOcr(pdf: PDFDocumentProxy): PdfAnalysis | null {
  const fp = pdf.fingerprints?.[0];
  if (!fp) return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + fp);
    if (!raw) return null;
    const pages = JSON.parse(raw) as PositionedLine[][];
    return Array.isArray(pages) ? analyzeTextLines(pages, { fold: true }) : null;
  } catch {
    return null;
  }
}

/**
 * Nhận dạng chữ (tesseract.js, tiếng Việt) trên từng trang rồi phân tích như PDF có chữ.
 * So khớp nhãn trên chữ đã bỏ dấu (OCR hay rớt dấu). Có thể huỷ bằng `signal`.
 */
export async function analyzePdfWithOcr(
  pdf: PDFDocumentProxy,
  onProgress?: (p: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<PdfAnalysis> {
  onProgress?.({ page: 0, total: pdf.numPages, phase: "init" });
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("vie", OEM.LSTM_ONLY);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" });
    const pages: PositionedLine[][] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas");

    for (let p = 1; p <= pdf.numPages; p++) {
      if (signal?.aborted) throw new DOMException("Đã huỷ", "AbortError");
      onProgress?.({ page: p, total: pdf.numPages, phase: "page" });
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
      const lines: PositionedLine[] = [];
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            const text = line.text.replace(/\s+/g, " ").trim();
            if (!text || line.confidence < 30) continue;
            lines.push({
              top: (line.bbox.y0 / canvas.height) * 100,
              bottom: (line.bbox.y1 / canvas.height) * 100,
              x0: (line.bbox.x0 / canvas.width) * 100,
              x1: (line.bbox.x1 / canvas.width) * 100,
              text,
            });
          }
        }
      }
      pages.push(lines);
    }

    const analysis = analyzeTextLines(pages, { fold: true });
    const fp = pdf.fingerprints?.[0];
    if (fp) {
      try {
        localStorage.setItem(CACHE_PREFIX + fp, JSON.stringify(pages));
      } catch {
        // đầy bộ nhớ / bị chặn — bỏ qua
      }
    }
    return analysis;
  } finally {
    await worker.terminate();
  }
}
