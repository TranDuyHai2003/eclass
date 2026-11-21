import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Gắn lời giải từng câu với vị trí trong PDF lời giải.
 *
 * - Dò tự động các nhãn "TDHT 5." / "Câu 5:" / "Bài 5)" và lề trang (header/footer, lề trái phải).
 * - Mỗi câu lưu ĐIỂM BẮT ĐẦU; điểm kết thúc mặc định là điểm bắt đầu kế tiếp (của câu khác
 *   hoặc một nhãn dò được nhưng chưa ghép), nên sửa một câu thì câu trước tự khớp theo.
 * - Toạ độ y tính theo % chiều cao trang (0 = mép trên), x theo % chiều rộng.
 */

export interface PdfPoint {
  page: number;
  y: number;
}

export interface PdfLayout {
  /** Vùng nội dung (bỏ header/footer, lề) theo % trang */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PdfMarker extends PdfPoint {
  /** Số câu ghi trên nhãn */
  n: number;
  /** Nhãn gốc, vd "TDHT 5" */
  label: string;
  /** Nhãn số trần ("5. ..."), chỉ dùng khi file không có nhãn TDHT/Câu */
  bare?: boolean;
}

export interface PdfAnalysis {
  numPages: number;
  markers: PdfMarker[];
  layout: PdfLayout;
  /** Vị trí các dòng tiêu đề "Lời giải" — để tách phần đề và phần lời giải của mỗi câu */
  solutionMarks?: PdfPoint[];
  /** Tiêu đề mục ("Dạng 3:", "Phần 2:", "Kiểu 1:") — là ranh giới kết thúc của câu đứng trước */
  headings?: PdfPoint[];
  /** Mép trên các dòng chữ của từng trang (% trang) — để công cụ cắt tay "hút" mốc vào đầu dòng */
  lineTops?: number[][];
}

export interface AnchorItem extends PdfPoint {
  /** Điểm kết thúc do giáo viên đặt; không có thì tự tính */
  end?: PdfPoint;
  label?: string;
  source: "auto" | "manual";
}

/** Tăng khi đổi cách phân tích/ghép → bộ nhớ đệm phân tích trong trình duyệt tự làm mới */
export const ANALYSIS_VERSION = 10;

export interface SolutionAnchorsData {
  version: 1;
  /** Phiên bản thuật toán tạo ra mốc tự động (ANALYSIS_VERSION) */
  algoVersion?: number;
  /** Nguồn dò: lớp chữ của PDF hay nhận dạng chữ trong ảnh (OCR) */
  method?: "text" | "ocr";
  /** File lời giải mà các mốc này thuộc về — đổi file thì bỏ qua mốc cũ */
  pdfUrl: string;
  numPages: number;
  layout: PdfLayout;
  /** Mọi nhãn dò được (kể cả chưa ghép với câu nào) — dùng làm ranh giới kết thúc */
  boundaries: PdfPoint[];
  /** Các dòng tiêu đề "Lời giải" (tách đề / lời giải trong vùng của một câu) */
  solutionMarks?: PdfPoint[];
  items: Record<string, AnchorItem>;
}

export interface SolutionRegion {
  start: PdfPoint;
  end: PdfPoint;
  label?: string;
}

export const DEFAULT_LAYOUT: PdfLayout = { top: 0, bottom: 100, left: 0, right: 100 };

// "TDHT 5." | "Câu 5:" | "» Câu 5)" | nhãn nhóm "Câu 1-4." (một đề bài chung cho câu 1→4)
const MARKER_REGEX = /^[\s»•▪►*]*(TDHT|Câu|Cau|Bài|Bai)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[.:)]/i;
/** Nhãn nhóm hợp lệ tối đa bao nhiêu câu */
const MAX_GROUP_SIZE = 10;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function comparePoints(a: PdfPoint, b: PdfPoint) {
  return a.page - b.page || a.y - b.y;
}

// ---------------------------------------------------------------------------
// Phân tích PDF
// ---------------------------------------------------------------------------

interface TextLine {
  top: number;
  bottom: number;
  x0: number;
  x1: number;
  text: string;
  key: string;
}

const lineKey = (s: string) => s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))];
}

export async function analyzePdf(pdf: PDFDocumentProxy): Promise<PdfAnalysis> {
  const pages: TextLine[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Gom các mảnh chữ cùng toạ độ y thành một dòng, theo thứ tự trái → phải
    const rows = new Map<number, { x: number; y: number; w: number; h: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const [, , , , x, y] = item.transform as number[];
      const key = Math.round(y);
      const row = rows.get(key) ?? [];
      row.push({ x, y, w: item.width || 0, h: item.height || 0, str: item.str });
      rows.set(key, row);
    }

    const lines: TextLine[] = [];
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x);
      const text = row.map((r) => r.str).join("");
      if (!text.trim()) continue;
      // Mảnh chỉ có khoảng trắng có thể rất rộng → không dùng để đo chiều ngang
      const inked = row.filter((r) => r.str.trim());
      const first = inked[0];
      const h = Math.max(...inked.map((r) => r.h));
      const [x0, top] = viewport.convertToViewportPoint(first.x, first.y + h);
      const [, bottom] = viewport.convertToViewportPoint(first.x, first.y);
      const x1 = Math.max(...inked.map((r) => viewport.convertToViewportPoint(r.x + r.w, r.y)[0]));
      lines.push({
        top: (Math.min(top, bottom) / viewport.height) * 100,
        bottom: (Math.max(top, bottom) / viewport.height) * 100,
        x0: (Math.min(x0, x1) / viewport.width) * 100,
        x1: (Math.max(x0, x1) / viewport.width) * 100,
        text,
        key: lineKey(text),
      });
    }
    lines.sort((a, b) => a.top - b.top);
    pages.push(lines);
  }

  return {
    numPages: pdf.numPages,
    markers: findMarkers(pages),
    layout: detectLayout(pages),
    solutionMarks: findSolutionMarks(pages),
    headings: findHeadings(pages),
    lineTops: pages.map((lines) => [...new Set(lines.map((l) => round1(l.top)))]),
  };
}

// "Dạng 3: PHỦ ĐỊNH ...", "Phần 2. Đúng sai", "Phần II: Trắc nghiệm đúng sai", "Kiểu 1: ...", "DẠNG 1: ..."
// (kể cả biểu tượng phía trước)
const HEADING_REGEX = /^[^\p{L}\d]{0,4}(dạng|phần|kiểu|chương)\s*(\d{1,2}|[IVX]{1,4})\s*[:.]/iu;
// "II. TRẮC NGHIỆM ĐÚNG SAI" — số La Mã đầu dòng + chữ in hoa (không nhầm với "I." trong lời giải)
const ROMAN_HEADING_REGEX = /^[^\p{L}\d]{0,4}[IVX]{1,4}\s*[.:]\s*\p{Lu}{2,}[\p{Lu}\s,–-]*$/u;
// "--- HẾT ---", "HẾT", "BẢNG ĐÁP ÁN", "ĐÁP ÁN" đứng riêng một dòng → kết thúc câu cuối
const END_MARK_REGEX = /^[\s\-–—_.*=]*(hết|bảng đáp án|đáp án)[\s\-–—_.*=:]*$/iu;

export function isHeadingLine(text: string) {
  const t = text.trim();
  return HEADING_REGEX.test(t) || ROMAN_HEADING_REGEX.test(t) || END_MARK_REGEX.test(t);
}

function findHeadings(pages: TextLine[][]): PdfPoint[] {
  const points: PdfPoint[] = [];
  pages.forEach((lines, i) => {
    for (const line of lines) {
      if (isHeadingLine(line.text)) {
        points.push({ page: i + 1, y: round1(clamp(line.top - 0.6, 0, 100)) });
      }
    }
  });
  return points.sort(comparePoints);
}

/** Dòng chỉ gồm tiêu đề "Lời giải" / "Hướng dẫn giải" / "Bài giải" (có thể kèm biểu tượng phía trước). */
// Ví dụ: "Lời giải", "✎ Lời giải", "Lời giải (C)", "Lời giải: Chọn A", "Hướng dẫn giải"
const SOLUTION_HEADING_REGEX =
  /^[^\p{L}\d]{0,4}(lời giải( chi tiết)?|hướng dẫn giải|bài giải|đáp án chi tiết)\s*(\([^)]{0,15}\))?\s*[:.]?\s*(chọn\s*[a-d]\s*\.?)?\s*$/iu;

// Dòng đáp án ghi thẳng: "Chọn B", "Chọn đáp án: C", "Đáp án D (Lừa sang B)", "Đáp án đúng là A"
// (chữ A–D phải đứng riêng → không khớp "Chọn khẳng định ...", "Đáp án dưới đây ...")
const ANSWER_LINE_REGEX =
  /^[^\p{L}\d]{0,4}(chọn(\s*đáp án)?|đáp án(\s*đúng)?(\s*là)?)\s*[:.]?\s*[A-D](?![\p{L}\d])/iu;

function findSolutionMarks(pages: TextLine[][]): PdfPoint[] {
  const marks: PdfPoint[] = [];
  pages.forEach((lines, i) => {
    for (const line of lines) {
      const text = line.text.trim();
      if (SOLUTION_HEADING_REGEX.test(text) || ANSWER_LINE_REGEX.test(text)) {
        marks.push({ page: i + 1, y: round1(clamp(line.top - 0.6, 0, 100)) });
      }
    }
  });
  return marks.sort(comparePoints);
}

const keywordOf = (raw: string) =>
  raw.toLowerCase().replace(/^cau$/, "câu").replace(/^bai$/, "bài");

function findMarkers(pages: TextLine[][]): PdfMarker[] {
  const markers: (PdfMarker & { kw: string })[] = [];
  pages.forEach((lines, i) => {
    for (const line of lines) {
      const match = line.text.match(MARKER_REGEX);
      if (!match) continue;
      // "BÀI 1: ..." viết hoa toàn bộ là tiêu đề chương, không phải nhãn câu
      if (/^B[ÀA]I$/.test(match[1])) continue;
      const kw = keywordOf(match[1]);
      const from = Number(match[2]);
      const to = match[3] ? Number(match[3]) : from;
      const y = round1(clamp(line.top - 0.6, 0, 100));
      if (to > from && to - from < MAX_GROUP_SIZE) {
        // Nhóm câu dùng chung đề: mỗi câu trong nhóm bắt đầu tại cùng vị trí
        for (let n = from; n <= to; n++) {
          markers.push({ n, page: i + 1, y, label: `${match[1]} ${from}-${to}`, kw });
        }
      } else {
        markers.push({ n: from, page: i + 1, y, label: `${match[1]} ${from}`, kw });
      }
    }
  });

  // File có thể dùng lẫn "TDHT" và "Câu" cho các phần khác nhau → giữ cả hai.
  // "Bài n" thì thường là tiêu đề/tham chiếu: chỉ coi là nhãn câu khi file chủ yếu dùng "Bài".
  const baiCount = markers.filter((m) => m.kw === "bài").length;
  const kept = baiCount < markers.length * 0.5 ? markers.filter((m) => m.kw !== "bài") : markers;

  const result = kept.map(({ kw: _kw, ...m }) => m).sort(comparePoints);
  return result.length > 0 ? result : findBareNumberMarkers(pages);
}

const BARE_REGEX = /^\s*(\d{1,3})\s*[.)]\s*(\S.*)$/;

/**
 * Phương án cuối cho file đánh số trần "1. Cho hàm số ...": bỏ tiêu đề viết hoa ("1. LÝ THUYẾT"),
 * dòng toàn số/công thức, và chỉ giữ các dòng thẳng lề trái với đa số.
 */
function findBareNumberMarkers(pages: TextLine[][]): PdfMarker[] {
  const candidates: (PdfMarker & { x0: number })[] = [];
  pages.forEach((lines, i) => {
    for (const line of lines) {
      const match = line.text.match(BARE_REGEX);
      if (!match) continue;
      const letters = match[2].replace(/[^\p{L}]/gu, "");
      if (letters.length < 4 || letters === letters.toUpperCase()) continue;
      candidates.push({
        n: Number(match[1]),
        page: i + 1,
        y: round1(clamp(line.top - 0.6, 0, 100)),
        label: `Câu ${match[1]}`,
        bare: true,
        x0: line.x0,
      });
    }
  });
  if (candidates.length < 3) return [];
  const sortedX = candidates.map((c) => c.x0).sort((a, b) => a - b);
  const typicalX = sortedX[Math.floor(sortedX.length / 2)];
  return candidates
    .filter((c) => Math.abs(c.x0 - typicalX) <= 3)
    .map(({ x0: _x0, ...m }) => m)
    .sort(comparePoints);
}

/**
 * Header/footer = dòng lặp lại trên ≥40% số trang và nằm ở 15% trên/dưới cùng.
 * Vùng nội dung = khoảng chứa phần còn lại (lấy trung vị qua các trang).
 */
function detectLayout(pages: TextLine[][]): PdfLayout {
  if (pages.length === 0) return DEFAULT_LAYOUT;

  const freq = new Map<string, number>();
  pages.forEach((lines) => new Set(lines.map((l) => l.key)).forEach((k) => freq.set(k, (freq.get(k) || 0) + 1)));
  const minRepeat = Math.max(2, Math.ceil(pages.length * 0.4));
  const inEdgeZone = (l: TextLine) => l.top < 15 || l.bottom > 85;
  const isPageNumber = (l: TextLine) => /^[#\s|/.\-–]*$/.test(l.key) || /^(trang|page)\s*#/.test(l.key);
  const isChrome = (l: TextLine) =>
    inEdgeZone(l) && (isPageNumber(l) || (l.key.length > 3 && (freq.get(l.key) || 0) >= minRepeat));

  const tops: number[] = [];
  const bottoms: number[] = [];
  const xs0: number[] = [];
  const xs1: number[] = [];
  for (const lines of pages) {
    const body = lines.filter((l) => !isChrome(l));
    if (body.length === 0) continue;
    tops.push(Math.min(...body.map((l) => l.top)));
    bottoms.push(Math.max(...body.map((l) => l.bottom)));
    body.forEach((l) => {
      xs0.push(l.x0);
      xs1.push(l.x1);
    });
  }
  if (tops.length === 0) return DEFAULT_LAYOUT;

  xs0.sort((a, b) => a - b);
  xs1.sort((a, b) => a - b);
  const layout: PdfLayout = {
    // Lấy phân vị nghiêng về phía "giữ nhiều" để không cắt mất nội dung ở chỗ nối trang
    top: round1(clamp(percentile([...tops].sort((x, y) => x - y), 0.1) - 1.5, 0, 25)),
    bottom: round1(clamp(percentile([...bottoms].sort((x, y) => x - y), 0.9) + 1.5, 75, 100)),
    left: round1(clamp(percentile(xs0, 0.02) - 2, 0, 30)),
    right: round1(clamp(percentile(xs1, 0.98) + 2, 70, 100)),
  };
  return layout;
}

// ---------------------------------------------------------------------------
// Ghép nhãn với câu hỏi
// ---------------------------------------------------------------------------

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

function assignRun(run: PdfMarker[], questionIds: string[], result: Record<string, AnchorItem>) {
  for (const marker of run) {
    const id = questionIds[marker.n - 1];
    if (id && !result[id]) {
      result[id] = { page: marker.page, y: marker.y, label: marker.label, source: "auto" };
    }
  }
}

/** Đợt đánh số "sạch": bắt đầu từ 1 và tăng đúng 1 đơn vị mỗi nhãn (không khuyết câu nào). */
function isCleanRun(run: PdfMarker[]) {
  return run.length > 0 && run[0].n === 1 && run.every((m, i) => i === 0 || m.n === run[i - 1].n + 1);
}

/**
 * Mỗi câu Đúng/Sai 4 ý đôi khi được nhập thành 4 câu riêng → 1 nhãn trong PDF ứng với 4 câu.
 * Chỉ dùng hệ số 1 (bình thường) và 4 (Đúng/Sai 4 ý).
 */
const EXPANSION_FACTORS = [1, 4];

/** Một phần được gán trọn cho nhóm đợt [start..end] (đều "sạch", tổng nhãn × hệ số = số câu) */
interface ExactPlan {
  start: number;
  end: number;
  factor: number;
}

/** Kết quả căn chỉnh: phần nào khớp chính xác với nhóm đợt nào */
interface SectionPlan {
  exact: Map<number, ExactPlan>;
}

/**
 * Căn chỉnh tối ưu toàn cục (quy hoạch động) giữa các phần và các đợt đánh số, giữ đúng thứ tự:
 * - phần được gán một nhóm đợt liền nhau "sạch" có tổng nhãn × hệ số = số câu (+1000 điểm mỗi câu);
 * - bỏ qua đợt (vd ví dụ minh hoạ) bị trừ điểm theo số nhãn bỏ qua;
 * - phần chưa khớp được "giữ" các đợt nằm ngay trước phần kế tiếp mà không bị trừ điểm → nhãn của phần này
 *   không bao giờ bị gán cho phần khác (vd phần 1 chỉ có nhãn 1–5 thì dãy 1–12 của phần 2 vẫn thuộc phần 2).
 */
function planSections(runs: PdfMarker[][], sections: string[][]): SectionPlan {
  const m = runs.length;
  const k = sections.length;
  const memo = new Map<string, { score: number; choice: ["exact", ExactPlan] | ["window", number] | null }>();
  const skipped = (from: number, to: number) => {
    let n = 0;
    for (let r = from; r <= to; r++) n += runs[r].length;
    return n;
  };

  const best = (si: number, r: number): { score: number; choice: ["exact", ExactPlan] | ["window", number] | null } => {
    if (si === k) return { score: 0, choice: null };
    const key = `${si}:${r}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let res: { score: number; choice: ["exact", ExactPlan] | ["window", number] | null } = { score: -Infinity, choice: null };
    const len = sections[si].length;

    // A. Phần chưa khớp: giữ các đợt r..x làm vùng của mình (không trừ điểm), phần sau bắt đầu từ x+1
    for (let x = r - 1; x < m; x++) {
      const sub = best(si + 1, x + 1).score;
      if (sub > res.score) res = { score: sub, choice: ["window", x] };
    }
    // B. Khớp chính xác với nhóm đợt [start..end]; các đợt r..start-1 bị bỏ qua (trừ điểm)
    for (let start = r; start < m; start++) {
      let total = 0;
      for (let end = start; end < m && isCleanRun(runs[end]); end++) {
        total += runs[end].length;
        const factor = EXPANSION_FACTORS.find((f) => total * f === len);
        if (factor) {
          const score = len * 1000 - skipped(r, start - 1) + best(si + 1, end + 1).score;
          if (score > res.score) res = { score, choice: ["exact", { start, end, factor }] };
        }
        if (total > len) break;
      }
    }
    memo.set(key, res);
    return res;
  };

  const plan: SectionPlan = { exact: new Map() };
  let r = 0;
  for (let si = 0; si < k; si++) {
    const { choice } = best(si, r);
    if (choice && choice[0] === "exact") {
      plan.exact.set(si, choice[1]);
      r = choice[1].end + 1;
    } else {
      r = (choice ? (choice[1] as number) : r - 1) + 1;
    }
  }
  return plan;
}

/**
 * Gom các đợt (trong vùng của một phần) thành "khối": đợt sau chỉ nhập vào khối nếu số đầu của nó chỉ lùi rất ít
 * so với số lớn nhất của khối (nhãn lặp/lạc chỗ, vd "…10, 12, 11, 12, 13…"). Đánh số lại từ đầu là khối mới.
 */
function buildBlocks(runs: PdfMarker[][]): PdfMarker[][] {
  const blocks: PdfMarker[][] = [];
  let current: PdfMarker[] | null = null;
  let currentMax = 0;
  for (const run of runs) {
    const first = run[0].n;
    // Chỉ coi là "nhãn lạc" khi khối đã đủ dài (≥ 3 nhãn): một nhãn lẻ đứng trước không được kéo cả đợt sau vào
    if (current && current.length >= 3 && first >= currentMax - 2 && first > 1) {
      current.push(...run);
    } else {
      current = [...run];
      blocks.push(current);
    }
    currentMax = Math.max(...current.map((mk) => mk.n));
  }
  return blocks;
}

/** Dãy con tăng ngặt dài nhất theo số câu (giữ thứ tự đọc). O(n log n). */
export function longestIncreasingByNumber(markers: PdfMarker[]): PdfMarker[] {
  const tails: number[] = []; // chỉ số marker kết thúc dãy dài k+1
  const prev: number[] = new Array(markers.length).fill(-1);
  markers.forEach((mk, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (markers[tails[mid]].n < mk.n) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  });
  const out: PdfMarker[] = [];
  for (let x = tails.length ? tails[tails.length - 1] : -1; x !== -1; x = prev[x]) out.push(markers[x]);
  return out.reverse();
}

/**
 * Đủ chắc để ghép theo số? Phần nhỏ (≤ 5 câu, vd Đúng/Sai 4 câu) chỉ được thiếu tối đa 1 câu;
 * phần lớn cần phủ ≥ 70% (nhãn số trần dễ nhầm hơn → ≥ 85%).
 */
export function lisCoverageOk(found: number, total: number, bare: boolean) {
  if (total <= 0 || found <= 0) return false;
  if (total <= 5) return total - found <= 1 && found >= Math.min(total, 2);
  return found / total >= (bare ? 0.85 : 0.7);
}

/**
 * Ghép một phần theo số trên nhãn bằng dãy số tăng dài nhất trong các khối của vùng nó.
 * Ưu tiên 1 nhãn = 1 câu; "1 nhãn = 4 câu" (Đúng/Sai nhập 4 câu) chỉ khi không có nhãn nào vượt số nhãn cần có.
 * Trả về true nếu đã ghép.
 */
function assignSectionByLis(
  blocks: PdfMarker[][],
  ids: string[],
  offsets: number[],
  result: Record<string, AnchorItem>,
): boolean {
  for (const block of blocks) {
    const bare = block.some((mk) => mk.bare);
    let best: { lis: PdfMarker[]; offset: number; factor: number } | null = null;
    for (const factor of EXPANSION_FACTORS) {
      if (best) break;
      if (ids.length % factor !== 0) continue;
      const count = ids.length / factor;
      for (const offset of offsets) {
        if (factor > 1 && block.some((mk) => mk.n > offset + count)) continue;
        const lis = longestIncreasingByNumber(block.filter((mk) => mk.n > offset && mk.n <= offset + count));
        if (!lisCoverageOk(lis.length, count, bare)) continue;
        if (!best || lis.length > best.lis.length) best = { lis, offset, factor };
      }
    }
    if (!best) continue;
    for (const mk of best.lis) {
      const base = (mk.n - best.offset - 1) * best.factor;
      for (let f = 0; f < best.factor; f++) {
        const id = ids[base + f];
        if (id && !result[id]) result[id] = { page: mk.page, y: mk.y, label: mk.label, source: "auto" };
      }
    }
    return true;
  }
  return false;
}

/**
 * Ghép nhãn với câu hỏi. Chỉ ghép khi đủ chắc chắn; câu không ghép được sẽ không có mốc.
 * 1. Số nhãn = số câu và dãy số hợp lý → tuần tự toàn bài.
 * 2. Căn chỉnh tối ưu toàn cục các phần với các đợt đánh số "sạch".
 * 3. Phần chưa khớp: đề đánh số liên tục toàn bài → LIS trên cả bài; nếu không, LIS trong vùng riêng của phần
 *    (có ngưỡng độ phủ); cuối cùng (chỉ nhãn có từ khoá) ghép theo số của đợt dài nhất trong vùng.
 * @param sections danh sách id câu hỏi theo từng phần, đúng thứ tự hiển thị
 */
export function mapMarkersToQuestions(markers: PdfMarker[], sections: string[][]): Record<string, AnchorItem> {
  const result: Record<string, AnchorItem> = {};
  if (markers.length === 0 || sections.length === 0) return result;

  // 1. Số nhãn đúng bằng số câu và dãy số hợp lý ở từng phần → ghép tuần tự theo thứ tự đọc
  const flatIds = sections.flat();
  if (markers.length === flatIds.length && isConsistentSequence(markers, sections)) {
    markers.forEach((mk, i) => {
      result[flatIds[i]] = { page: mk.page, y: mk.y, label: mk.label, source: "auto" };
    });
    return result;
  }

  // 2. Căn chỉnh tối ưu các phần với các đợt đánh số sạch
  const runs = splitRuns(markers);
  const plan = planSections(runs, sections);
  for (const [si, { start, end, factor }] of plan.exact) {
    const ids = sections[si];
    runs
      .slice(start, end + 1)
      .flat()
      .forEach((mk, j) => {
        for (let f = 0; f < factor; f++) result[ids[j * factor + f]] = { page: mk.page, y: mk.y, label: mk.label, source: "auto" };
      });
  }
  if (plan.exact.size === sections.length) return result;

  const anyBare = markers.some((mk) => mk.bare);

  // 3a. Chưa phần nào khớp chính xác và đề đánh số liên tục qua các phần (nhãn vượt số câu phần 1)
  if (plan.exact.size === 0 && sections.length > 1 && Math.max(...markers.map((mk) => mk.n)) > sections[0].length) {
    const lis = longestIncreasingByNumber(markers.filter((mk) => mk.n <= flatIds.length));
    if (lisCoverageOk(lis.length, flatIds.length, anyBare)) {
      for (const mk of lis) result[flatIds[mk.n - 1]] = { page: mk.page, y: mk.y, label: mk.label, source: "auto" };
      return result;
    }
  }

  // 3b. Phần chưa khớp: mỗi "khe" là đoạn đợt nằm giữa hai phần đã khớp chính xác; các phần chưa khớp trong khe
  //     lần lượt (đúng thứ tự) nhận khối của khe → nhãn không bao giờ bị lấy sang phần ở ngoài khe
  const offsetsOf: number[] = [];
  sections.reduce((acc, ids, si) => ((offsetsOf[si] = acc), acc + ids.length), 0);
  let si = 0;
  while (si < sections.length) {
    if (plan.exact.has(si)) {
      si++;
      continue;
    }
    // Khe: các phần chưa khớp liên tiếp [si..sj], đợt từ sau phần khớp trước đến trước phần khớp sau
    let sj = si;
    while (sj + 1 < sections.length && !plan.exact.has(sj + 1)) sj++;
    const prevExact = si > 0 ? plan.exact.get(si - 1) : undefined;
    const nextExact = sj + 1 < sections.length ? plan.exact.get(sj + 1) : undefined;
    const from = prevExact ? prevExact.end + 1 : 0;
    const to = nextExact ? nextExact.start - 1 : runs.length - 1;
    const blocks = from <= to ? buildBlocks(runs.slice(from, to + 1)) : [];
    let ptr = 0;
    const takenBlock = new Map<number, number>(); // phần → khối đã ghép bằng LIS
    for (let s2 = si; s2 <= sj; s2++) {
      const ids = sections[s2];
      const offsets = offsetsOf[s2] > 0 ? [0, offsetsOf[s2]] : [0];
      for (let b = ptr; b < blocks.length; b++) {
        if (assignSectionByLis([blocks[b]], ids, offsets, result)) {
          takenBlock.set(s2, b);
          ptr = b + 1;
          break;
        }
      }
    }
    // Dự phòng như trước (chỉ nhãn có từ khoá, không áp dụng số trần): phần còn thiếu ghép theo số ghi trên nhãn,
    // chỉ dùng các khối nằm giữa khối của phần đã ghép ngay trước và ngay sau nó, và chỉ khi việc chia là rõ ràng
    // (một phần ↔ khối dài nhất, hoặc số phần = số khối) — chịu được phần chỉ còn vài nhãn chữ (còn lại là ảnh)
    if (!anyBare) {
      const groups = new Map<string, { lo: number; hi: number; secs: number[] }>();
      for (let s2 = si; s2 <= sj; s2++) {
        if (takenBlock.has(s2)) continue;
        let lo = -1;
        let hi = blocks.length;
        for (const [s3, b] of takenBlock) {
          if (s3 < s2) lo = Math.max(lo, b);
          else hi = Math.min(hi, b);
        }
        const key = `${lo}:${hi}`;
        const g = groups.get(key) ?? { lo, hi, secs: [] };
        g.secs.push(s2);
        groups.set(key, g);
      }
      for (const { lo, hi, secs } of groups.values()) {
        const cand = blocks.slice(lo + 1, hi);
        if (cand.length === 0) continue;
        if (secs.length === 1) assignRun(cand.reduce((a, b) => (b.length > a.length ? b : a)), sections[secs[0]], result);
        else if (cand.length === secs.length) secs.forEach((s2, idx) => assignRun(cand[idx], sections[s2], result));
      }
    }
    si = sj + 1;
  }
  return result;
}

/**
 * Kiểm tra trước khi ghép tuần tự: trong mỗi phần, số nhãn không giảm và phần bắt đầu
 * từ 1 hoặc nối tiếp số cuối của phần trước — tránh trường hợp số lượng trùng nhau ngẫu nhiên.
 */
function isConsistentSequence(markers: PdfMarker[], sections: string[][]) {
  let offset = 0;
  let prevLast = 0;
  for (const section of sections) {
    const slice = markers.slice(offset, offset + section.length);
    offset += section.length;
    if (slice.length === 0) continue;
    const first = slice[0].n;
    if (first !== 1 && first !== prevLast + 1) return false;
    for (let i = 1; i < slice.length; i++) {
      if (slice[i].n < slice[i - 1].n) return false;
    }
    prevLast = slice[slice.length - 1].n;
  }
  return true;
}

/** Tạo bộ mốc tự động từ kết quả phân tích. */
export function buildAutoAnchors(
  analysis: PdfAnalysis,
  sections: string[][],
  pdfUrl: string,
  method: "text" | "ocr" = "text",
): SolutionAnchorsData {
  return {
    version: 1,
    algoVersion: ANALYSIS_VERSION,
    method,
    pdfUrl,
    numPages: analysis.numPages,
    layout: analysis.layout,
    boundaries: [...analysis.markers.map(({ page, y }) => ({ page, y })), ...(analysis.headings ?? [])].sort(
      comparePoints,
    ),
    solutionMarks: analysis.solutionMarks ?? [],
    items: mapMarkersToQuestions(analysis.markers, sections),
  };
}

/**
 * "Hút" vị trí y về mép trên dòng chữ gần nhất (trong khoảng `radius` % trang), lùi 0.6% như nhãn tự dò.
 * Không có dòng nào gần thì giữ nguyên.
 */
export function snapToLine(lineTops: number[][] | undefined, page: number, y: number, radius = 1.5) {
  const tops = lineTops?.[page - 1];
  if (!tops?.length) return y;
  let best = y;
  let dist = radius;
  for (const t of tops) {
    const target = clamp(t - 0.6, 0, 100);
    const d = Math.abs(target - y);
    if (d < dist) {
      dist = d;
      best = target;
    }
  }
  return round1(best);
}

// ---------------------------------------------------------------------------
// Tính vùng lời giải của một câu
// ---------------------------------------------------------------------------

/** Khoảng tối thiểu (theo % trang) để coi là điểm bắt đầu kế tiếp, tránh trùng chính nó. */
const MIN_GAP = 0.8;

export function resolveRegion(data: SolutionAnchorsData, questionId: string): SolutionRegion | null {
  const item = data.items[questionId];
  if (!item) return null;
  const { layout, numPages } = data;
  const start: PdfPoint = { page: item.page, y: item.y };

  let end: PdfPoint;
  if (item.end && comparePoints(item.end, start) > 0) {
    end = item.end;
  } else {
    const candidates = [
      ...Object.entries(data.items)
        .filter(([id]) => id !== questionId)
        .map(([, it]) => ({ page: it.page, y: it.y })),
      ...data.boundaries,
    ].filter((p) => p.page > start.page || (p.page === start.page && p.y > start.y + MIN_GAP));
    candidates.sort(comparePoints);
    const next = candidates[0];

    if (next) {
      end = { page: next.page, y: next.y };
    } else {
      // Câu cuối: tới hết trang; nếu bắt đầu ở nửa dưới trang thì lấy thêm trang sau
      end =
        start.y > 55 && start.page < numPages
          ? { page: start.page + 1, y: layout.bottom }
          : { page: start.page, y: layout.bottom };
    }
  }

  // Điểm kết thúc nằm sát đầu trang sau → kết thúc ở cuối trang trước cho gọn
  if (end.page > start.page && end.y <= layout.top + MIN_GAP) {
    end = { page: end.page - 1, y: layout.bottom };
  }

  return { start, end: { page: end.page, y: Math.min(end.y, layout.bottom) }, label: item.label };
}

/**
 * Tách vùng của một câu thành phần đề và phần lời giải theo dòng "Lời giải" đầu tiên nằm trong vùng.
 * Không tìm thấy → solution = null (cả vùng được coi là đề + lời giải).
 */
export function splitRegion(region: SolutionRegion, solutionMarks: PdfPoint[] | undefined) {
  const mark = (solutionMarks ?? []).find(
    (m) =>
      comparePoints(m, { page: region.start.page, y: region.start.y + MIN_GAP }) > 0 &&
      comparePoints(m, region.end) < 0,
  );
  if (!mark) return { question: region, solution: null as SolutionRegion | null };
  // mark.y lùi 0.6% so với mép trên dòng "Lời giải" → cắt đúng mép trên để không lộ dòng phía trên
  const cut = { page: mark.page, y: Math.min(100, mark.y + 0.6) };
  return {
    question: { ...region, end: cut },
    solution: { ...region, start: cut } as SolutionRegion,
  };
}

/** Các đoạn cần vẽ cho một vùng (mỗi trang một đoạn), đã bỏ header/footer ở chỗ nối trang. */
export function regionSegments(region: SolutionRegion, layout: PdfLayout) {
  const segments: { page: number; top: number; bottom: number }[] = [];
  for (let page = region.start.page; page <= region.end.page; page++) {
    const top = page === region.start.page ? region.start.y : layout.top;
    const bottom = page === region.end.page ? region.end.y : layout.bottom;
    if (bottom - top > 0.5) segments.push({ page, top, bottom });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Kiểm tra dữ liệu lưu trong DB
// ---------------------------------------------------------------------------

function isPoint(p: any): p is PdfPoint {
  return (
    p &&
    Number.isInteger(p.page) &&
    p.page >= 1 &&
    typeof p.y === "number" &&
    Number.isFinite(p.y) &&
    p.y >= 0 &&
    p.y <= 100
  );
}

/** Trả về dữ liệu mốc hợp lệ cho đúng file lời giải hiện tại, ngược lại null. */
export function parseSolutionAnchors(raw: unknown, currentPdfUrl: string | null | undefined): SolutionAnchorsData | null {
  const data = raw as SolutionAnchorsData | null;
  if (!data || data.version !== 1 || !currentPdfUrl || data.pdfUrl !== currentPdfUrl) return null;
  if (!data.items || typeof data.items !== "object" || !Array.isArray(data.boundaries)) return null;
  if (!data.layout || !Number.isFinite(data.numPages)) return null;
  return data;
}

/** Làm sạch dữ liệu giáo viên gửi lên (dùng ở server action). */
export function sanitizeSolutionAnchors(
  raw: any,
  allowedQuestionIds: Set<string>,
): Omit<SolutionAnchorsData, "pdfUrl"> | null {
  if (!raw || typeof raw !== "object") return null;
  const numPages = Number(raw.numPages);
  if (!Number.isInteger(numPages) || numPages < 1 || numPages > 2000) return null;

  const l = raw.layout || {};
  const layout: PdfLayout = {
    top: round1(clamp(Number(l.top) || 0, 0, 40)),
    bottom: round1(clamp(Number(l.bottom) || 100, 60, 100)),
    left: round1(clamp(Number(l.left) || 0, 0, 40)),
    right: round1(clamp(Number(l.right) || 100, 60, 100)),
  };

  const inRange = (p: PdfPoint) => isPoint(p) && p.page <= numPages;
  const boundaries = (Array.isArray(raw.boundaries) ? raw.boundaries : [])
    .filter(inRange)
    .slice(0, 2000)
    .map((p: PdfPoint) => ({ page: p.page, y: round1(p.y) }));

  const solutionMarks = (Array.isArray(raw.solutionMarks) ? raw.solutionMarks : [])
    .filter(inRange)
    .slice(0, 2000)
    .map((p: PdfPoint) => ({ page: p.page, y: round1(p.y) }));

  const items: Record<string, AnchorItem> = {};
  for (const [id, it] of Object.entries<any>(raw.items || {})) {
    if (!allowedQuestionIds.has(id) || !inRange(it)) continue;
    items[id] = {
      page: it.page,
      y: round1(it.y),
      ...(it.end && inRange(it.end) && comparePoints(it.end, it) > 0
        ? { end: { page: it.end.page, y: round1(it.end.y) } }
        : {}),
      ...(typeof it.label === "string" ? { label: it.label.slice(0, 40) } : {}),
      source: it.source === "manual" ? "manual" : "auto",
    };
  }

  const algoVersion = Number.isInteger(raw.algoVersion) && raw.algoVersion > 0 && raw.algoVersion < 1000 ? raw.algoVersion : undefined;
  const method = raw.method === "ocr" || raw.method === "text" ? raw.method : undefined;
  return {
    version: 1,
    ...(algoVersion ? { algoVersion } : {}),
    ...(method ? { method } : {}),
    numPages,
    layout,
    boundaries,
    solutionMarks,
    items,
  };
}
