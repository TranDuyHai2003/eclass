/**
 * Bộ ghép nhãn câu ↔ câu hỏi (lib/pdf-question-anchors.ts) — dữ liệu nhãn giả lập, không cần DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTextLines,
  isHeadingLine,
  lisCoverageOk,
  longestIncreasingByNumber,
  mapMarkersToQuestions,
  type PdfMarker,
} from "@/lib/pdf-question-anchors";

/** Nhãn theo thứ tự đọc: mỗi nhãn cách nhau 10% trang, 9 nhãn/trang */
function mk(ns: number[], opts: { bare?: boolean; startIndex?: number } = {}): PdfMarker[] {
  return ns.map((n, i) => {
    const k = (opts.startIndex ?? 0) + i;
    return { n, page: Math.floor(k / 9) + 1, y: (k % 9) * 10 + 5, label: `Câu ${n}`, ...(opts.bare ? { bare: true } : {}) };
  });
}
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
/** Câu → số trên nhãn được gán (qua vị trí) */
function labelOf(result: ReturnType<typeof mapMarkersToQuestions>, markers: PdfMarker[], id: string) {
  const it = result[id];
  if (!it) return null;
  const m = markers.find((x) => x.page === it.page && x.y === it.y);
  return m ? m.n : "?";
}

describe("Dãy số tăng dài nhất", () => {
  test("bỏ nhãn lạc, giữ thứ tự đọc", () => {
    const lis = longestIncreasingByNumber(mk([1, 2, 3, 12, 4, 5, 6]));
    assert.deepEqual(lis.map((m) => m.n), [1, 2, 3, 4, 5, 6]);
  });
  test("rỗng", () => assert.deepEqual(longestIncreasingByNumber([]), []));
});

describe("Ngưỡng an toàn", () => {
  test("phần ≤ 5 câu chỉ được thiếu 1", () => {
    assert.equal(lisCoverageOk(3, 4, false), true);
    assert.equal(lisCoverageOk(2, 4, false), false);
    assert.equal(lisCoverageOk(1, 2, false), false, "phần 2 câu cần đủ cả 2 (tối thiểu 2 nhãn)");
  });
  test("phần lớn: ≥ 70% (số trần ≥ 85%)", () => {
    assert.equal(lisCoverageOk(14, 20, false), true);
    assert.equal(lisCoverageOk(13, 20, false), false);
    assert.equal(lisCoverageOk(17, 20, true), true);
    assert.equal(lisCoverageOk(16, 20, true), false);
  });
});

describe("Ghép nhãn với câu", () => {
  test("nhãn khuyết (câu dạng ảnh) + nhãn lạc chỗ: câu có nhãn được ghép đúng số, câu khuyết để trống", () => {
    // Đề thật "Bài 6": thiếu 6,7,8; "12" xuất hiện trước "11"
    const markers = mk([1, 2, 3, 4, 5, 9, 10, 12, 11, 12, 13, 14, 15, 16]);
    const q = ids("q", 16);
    const r = mapMarkersToQuestions(markers, [q]);
    for (const n of [1, 2, 3, 4, 5, 9, 10, 13, 14, 15, 16]) assert.equal(labelOf(r, markers, `q${n}`), n, `câu ${n}`);
    for (const n of [6, 7, 8]) assert.equal(r[`q${n}`], undefined, `câu ${n} không có nhãn → không ghép`);
    // Không được dùng "1 nhãn = 4 câu"
    const starts = new Set(Object.values(r).map((it) => `${it.page}:${it.y}`));
    assert.equal(starts.size, Object.keys(r).length, "mỗi câu một mốc riêng");
  });

  test("đánh số trần khuyết vài số: ghép theo số khi phủ ≥ 85%", () => {
    const ns = Array.from({ length: 48 }, (_, i) => i + 1).filter((n) => ![7, 19, 30, 41].includes(n));
    const markers = mk(ns, { bare: true });
    const r = mapMarkersToQuestions(markers, [ids("q", 48)]);
    assert.equal(Object.keys(r).length, 44);
    assert.equal(labelOf(r, markers, "q20"), 20);
    assert.equal(r.q19, undefined);
  });

  test("đánh số trần khuyết quá nhiều → không ghép (dễ nhầm với mục lục)", () => {
    const markers = mk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { bare: true });
    const r = mapMarkersToQuestions(markers, [ids("q", 20)]);
    assert.equal(Object.keys(r).length, 0);
  });

  test("KHÔNG ghép xuyên phần (kịch bản Gemini): phần 1 chỉ có nhãn 1–5, phần 2 có 1–12", () => {
    const markers = [...mk([1, 2, 3, 4, 5]), ...mk(Array.from({ length: 12 }, (_, i) => i + 1), { startIndex: 9 })];
    const p1 = ids("a", 12);
    const p2 = ids("b", 12);
    const r = mapMarkersToQuestions(markers, [p1, p2]);
    // Phần 2 lấy đúng các nhãn của phần 2 (vị trí từ trang 2 trở đi)
    for (let i = 1; i <= 12; i++) assert.ok(r[`b${i}`] && r[`b${i}`].page >= 2, `b${i} thuộc phần 2`);
    // Phần 1: câu 6–12 không được lấy nhãn của phần 2
    for (let i = 6; i <= 12; i++) {
      const it = r[`a${i}`];
      assert.ok(!it || it.page === 1, `a${i} không được ghép sang nhãn của phần 2`);
    }
  });

  test("KHÔNG ghép xuyên phần khi cả hai phần đều thiếu nhãn (Gemini review diff #1): phần 1 có 1–5, phần 2 có 1–11", () => {
    const markers = [...mk([1, 2, 3, 4, 5]), ...mk(Array.from({ length: 11 }, (_, i) => i + 1), { startIndex: 9 })];
    const r = mapMarkersToQuestions(markers, [ids("a", 12), ids("b", 12)]);
    // Phần 2 lấy nhãn 1–11 của chính nó (từ trang 2)
    for (let i = 1; i <= 11; i++) assert.ok(r[`b${i}`] && r[`b${i}`].page >= 2, `b${i} phải thuộc phần 2`);
    assert.equal(r.b12, undefined);
    // Phần 1 không được lấy nhãn của phần 2; nếu ghép thì chỉ bằng nhãn 1–5 của nó, đúng số
    for (let i = 1; i <= 12; i++) {
      const it = r[`a${i}`];
      assert.ok(!it || (it.page === 1 && labelOf(r, markers, `a${i}`) === i), `a${i} ghép sai`);
    }
  });

  test("khối nhiễu ngắn trước khối thật vẫn bị bỏ qua (một phần)", () => {
    const markers = [...mk([7, 8]), ...mk(Array.from({ length: 14 }, (_, i) => i + 1), { startIndex: 9 })];
    const r = mapMarkersToQuestions(markers, [ids("q", 16)]);
    assert.equal(labelOf(r, markers, "q1"), 1);
    assert.equal(labelOf(r, markers, "q14"), 14);
    assert.ok(r.q1.page >= 2, "câu 1 phải lấy nhãn ở khối thật");
  });

  test("phần Đúng/Sai nhập 4 câu cho mỗi nhãn: 4 nhãn ↔ 16 câu", () => {
    const markers = mk([1, 2, 3, 4]);
    const q = ids("q", 16);
    const r = mapMarkersToQuestions(markers, [q]);
    assert.equal(Object.keys(r).length, 16);
    assert.deepEqual([1, 2, 3, 4].map((i) => labelOf(r, markers, `q${i}`)), [1, 1, 1, 1]);
    assert.equal(labelOf(r, markers, "q5"), 2);
  });

  test("phần nhỏ thiếu 2/4 nhãn → không ghép bằng LIS", () => {
    const markers = [...mk(Array.from({ length: 10 }, (_, i) => i + 1)), ...mk([1, 3], { startIndex: 12 })];
    const r = mapMarkersToQuestions(markers, [ids("a", 10), ids("b", 4)]);
    assert.equal(Object.keys(r).filter((k) => k.startsWith("a")).length, 10);
    // Phần b: 2/4 nhãn không đạt ngưỡng LIS (có thể được bước cũ ghép theo số, nhưng không được gán sai số)
    for (const [id, n] of [["b1", 1], ["b3", 3]] as const) {
      const got = labelOf(r, markers, id);
      assert.ok(got === null || got === n, `${id} nếu ghép thì phải đúng số`);
    }
    assert.equal(r.b2, undefined);
  });

  test("đề chuẩn: số nhãn = số câu → ghép tuần tự như cũ", () => {
    const markers = [...mk([1, 2, 3, 4, 5, 6]), ...mk([1, 2, 3], { startIndex: 6 })];
    const r = mapMarkersToQuestions(markers, [ids("a", 6), ids("b", 3)]);
    assert.equal(Object.keys(r).length, 9);
    assert.equal(r.b1.page, 1);
    assert.equal(r.b1.y, 65);
  });
});

describe("Ranh giới (tiêu đề phần, kết thúc)", () => {
  test("nhận tiêu đề phần có số La Mã và dòng kết thúc", () => {
    for (const t of ["Phần II: Trắc nghiệm đúng sai", "PHẦN III. Trả lời ngắn", "II. TRẮC NGHIỆM ĐÚNG SAI", "Dạng 3: Phủ định", "--- HẾT ---", "HẾT", "BẢNG ĐÁP ÁN", "ĐÁP ÁN", "--- ĐÁP ÁN ---"])
      assert.equal(isHeadingLine(t), true, t);
  });
  test("không nhầm dòng lời giải / đáp án thường", () => {
    for (const t of ["I. Cho hàm số y = f(x) có đồ thị", "Đáp án đúng là A", "Phần lớn học sinh", "Hết thời gian thì nộp bài", "Chọn B", "Đáp án:", "Đáp án", "ĐÁP ÁN:"])
      assert.equal(isHeadingLine(t), false, t);
  });
});

describe("Mốc tách lời giải", () => {
  const line = (top: number, text: string) => ({ top, bottom: top + 2, x0: 10, x1: 90, text });
  test("dòng chỉ có chữ 'Giải' (đề tổng ôn, OCR) là tiêu đề lời giải", () => {
    const a = analyzeTextLines([[line(10, "Câu 1: Cho hàm số y = x ln x"), line(16, "A. 0. B. 1. C. e. D. e+1."), line(22, "Giải"), line(28, "Ta có y' = ln x + 1"), line(50, "Câu 2: Tính đạo hàm")]]);
    assert.deepEqual((a.solutionMarks ?? []).map((m) => m.y), [21.4]);
  });
  test("bản OCR rớt dấu: 'Giai' / 'Giải:' cũng nhận", () => {
    const a = analyzeTextLines([[line(10, "Cau 1: abc"), line(20, "Giai:"), line(50, "Cau 2: xyz"), line(60, "Giải.")]], { fold: true });
    assert.equal((a.solutionMarks ?? []).length, 2);
  });
  test("dòng 'Đáp án:' riêng trong lời giải từng câu không phải ranh giới kết thúc (Gemini review diff #3)", () => {
    const a = analyzeTextLines([[line(10, "Câu 1: abc"), line(20, "Đáp án:"), line(24, "Chọn A. Vì ..."), line(50, "Câu 2: xyz"), line(90, "ĐÁP ÁN")]]);
    const ys = (a.headings ?? []).map((h) => h.y);
    assert.equal(ys.length, 1, `chỉ 'ĐÁP ÁN' cuối đề là ranh giới: ${ys}`);
    assert.ok(ys[0] > 80);
  });
  test("không nhầm câu hỏi bắt đầu bằng 'Giải ...'", () => {
    const a = analyzeTextLines([[line(10, "Câu 1: abc"), line(20, "Giải phương trình x^2 = 1"), line(30, "Giải bất phương trình sau")]]);
    assert.equal((a.solutionMarks ?? []).length, 0);
  });
});
