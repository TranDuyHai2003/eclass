import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Dò vị trí từng câu trong PDF lời giải/đề (nhãn dạng "TDHT 5.", "Câu 5:", "Bài 5)")
 * để màn kết quả cuộn thẳng tới lời giải của câu đang xem.
 */

export interface PdfMarker {
  /** Số câu ghi trên nhãn */
  n: number;
  page: number;
  /** Vị trí mép trên của dòng nhãn, tính theo % chiều cao trang */
  yPct: number;
  /** Nhãn gốc, vd "TDHT 5" */
  label: string;
}

export interface QuestionAnchor {
  page: number;
  yPct: number;
  label: string;
}

const MARKER_REGEX = /^\s*(TDHT|Câu|Cau|Bài|Bai)\s*(\d{1,3})\s*[.:)]/i;

export async function extractQuestionMarkers(pdf: PDFDocumentProxy): Promise<PdfMarker[]> {
  const markers: PdfMarker[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Gom các mảnh chữ cùng dòng (cùng toạ độ y) thành một dòng, theo thứ tự trái → phải
    const lines = new Map<number, { x: number; y: number; h: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const [, , , , x, y] = item.transform as number[];
      const key = Math.round(y);
      const row = lines.get(key) ?? [];
      row.push({ x, y, h: item.height || 0, str: item.str });
      lines.set(key, row);
    }

    for (const row of lines.values()) {
      row.sort((a, b) => a.x - b.x);
      const text = row.map((r) => r.str).join("");
      const match = text.match(MARKER_REGEX);
      if (!match) continue;

      const first = row[0];
      const [, top] = viewport.convertToViewportPoint(first.x, first.y + first.h);
      markers.push({
        n: Number(match[2]),
        page: pageNum,
        yPct: Math.max(0, Math.min(100, (top / viewport.height) * 100)),
        label: `${match[1]} ${match[2]}`,
      });
    }
  }

  // Thứ tự đọc: theo trang, rồi từ trên xuống
  return markers.sort((a, b) => a.page - b.page || a.yPct - b.yPct);
}

const CACHE_PREFIX = "pdf-question-markers:v1:";

/**
 * Như extractQuestionMarkers nhưng:
 * - dùng lại kết quả đã lưu trong trình duyệt (theo fingerprint của file PDF);
 * - dò trên một worker riêng để không phải xếp hàng sau việc render các trang.
 */
export async function extractQuestionMarkersCached(pdf: PDFDocumentProxy): Promise<PdfMarker[]> {
  const cacheKey = CACHE_PREFIX + (pdf.fingerprints?.[0] ?? "");
  if (pdf.fingerprints?.[0]) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as PdfMarker[];
    } catch {
      // localStorage có thể bị chặn — bỏ qua
    }
  }

  let markers: PdfMarker[];
  try {
    const { pdfjs } = await import("react-pdf");
    // react-pdf tự đặt workerSrc tương đối khi nạp; dùng đúng file worker như components/ui/pdf-viewer.tsx
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.wrapper.js";
    const data = await pdf.getData();
    const worker = new pdfjs.PDFWorker();
    const separateDoc = await pdfjs.getDocument({ data, worker }).promise;
    try {
      markers = await extractQuestionMarkers(separateDoc);
    } finally {
      await separateDoc.destroy();
      worker.destroy();
    }
  } catch {
    // Không tạo được worker riêng → dò trên tài liệu đang hiển thị
    markers = await extractQuestionMarkers(pdf);
  }

  if (pdf.fingerprints?.[0]) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(markers));
    } catch {
      // bỏ qua nếu đầy bộ nhớ hoặc bị chặn
    }
  }
  return markers;
}

/** Tách thành các "đợt" đánh số: mỗi lần số câu quay lại nhỏ hơn là bắt đầu phần mới. */
function splitRuns(markers: PdfMarker[]): PdfMarker[][] {
  const runs: PdfMarker[][] = [];
  for (const marker of markers) {
    const current = runs[runs.length - 1];
    if (!current || marker.n <= current[current.length - 1].n) runs.push([marker]);
    else current.push(marker);
  }
  return runs;
}

function assignRun(run: PdfMarker[], questionIds: string[], result: Record<string, QuestionAnchor>) {
  for (const marker of run) {
    const id = questionIds[marker.n - 1];
    if (id && !result[id]) {
      result[id] = { page: marker.page, yPct: marker.yPct, label: marker.label };
    }
  }
}

/**
 * Ghép mốc với câu hỏi.
 * @param sections danh sách id câu hỏi theo từng phần, đúng thứ tự hiển thị
 * Chỉ ghép khi đủ chắc chắn; câu không ghép được sẽ không có mốc.
 */
export function mapMarkersToQuestions(
  markers: PdfMarker[],
  sections: string[][],
): Record<string, QuestionAnchor> {
  const result: Record<string, QuestionAnchor> = {};
  const runs = splitRuns(markers);
  if (runs.length === 0 || sections.length === 0) return result;

  const maxN = (run: PdfMarker[]) => Math.max(...run.map((m) => m.n));

  if (sections.length === 1) {
    // Một phần: lấy đợt đánh số dài nhất (bỏ qua các nhãn lẻ như ví dụ minh hoạ)
    const longest = runs.reduce((a, b) => (b.length > a.length ? b : a));
    assignRun(longest, sections[0], result);
    return result;
  }

  if (runs.length === sections.length) {
    runs.forEach((run, i) => assignRun(run, sections[i], result));
    return result;
  }

  if (runs.length === 1) {
    const run = runs[0];
    // Đánh số liên tục qua các phần → ghép theo thứ tự toàn bài
    if (maxN(run) > sections[0].length) assignRun(run, sections.flat(), result);
    else assignRun(run, sections[0], result);
    return result;
  }

  // Số đợt khác số phần: chỉ ghép đợt nào có số câu lớn nhất trùng khớp số câu của một phần (giữ thứ tự)
  let sectionPtr = 0;
  for (const run of runs) {
    const count = maxN(run);
    const idx = sections.findIndex((s, i) => i >= sectionPtr && s.length === count);
    if (idx === -1) continue;
    assignRun(run, sections[idx], result);
    sectionPtr = idx + 1;
  }
  return result;
}
