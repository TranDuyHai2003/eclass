/**
 * Đo chất lượng bộ cắt câu tự động (lib/pdf-question-anchors.ts) trên các đề thật trong DB local.
 *
 *   node --no-experimental-strip-types -r ./tests/setup/register.cjs tests/tools/eval-anchors.ts [--limit 100] [--test <id>] [--json out.json]
 *
 * Với mỗi đề có PDF lời giải: tải file (lưu tạm ở ~/.cache/eclass-anchor-eval), chạy đúng analyzePdf + buildAutoAnchors
 * mà màn kết quả dùng, rồi báo: số câu ghép được, vùng bất thường (quá dài / quá ngắn / chồng lên câu khác), nhãn dò được.
 * Không ghi gì vào DB.
 */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  analyzePdf,
  buildAutoAnchors,
  comparePoints,
  parseSolutionAnchors,
  resolveRegion,
  regionSegments,
  type PdfAnalysis,
} from "@/lib/pdf-question-anchors";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(opt("--limit") ?? 200);
const ONLY = opt("--test");
const JSON_OUT = opt("--json");
/** Dùng mốc đã lưu trong DB (thầy lưu / OCR hàng loạt) khi có, thay vì chỉ đo cắt tự động */
const USE_SAVED = args.includes("--saved");
const CACHE = path.join(os.homedir(), ".cache", "eclass-anchor-eval");
fs.mkdirSync(CACHE, { recursive: true });

async function loadPdfBytes(url: string): Promise<Uint8Array> {
  const file = path.join(CACHE, crypto.createHash("sha1").update(url).digest("hex") + ".pdf");
  if (fs.existsSync(file)) return new Uint8Array(fs.readFileSync(file));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

export interface EvalRow {
  id: string;
  title: string;
  questions: number;
  sections: number[];
  matched: number;
  markers: number;
  runs: string;
  pages: number;
  tooLong: number;
  tooShort: number;
  overlap: number;
  outOfOrder: number;
  error?: string;
}

/** Chuỗi tóm tắt các đợt đánh số, vd "1-12 | 1-4 | 1-6" */
function runsSummary(analysis: PdfAnalysis) {
  const runs: number[][] = [];
  for (const m of analysis.markers) {
    const cur = runs[runs.length - 1];
    if (!cur || m.n <= cur[cur.length - 1]) runs.push([m.n]);
    else cur.push(m.n);
  }
  return runs.map((r) => (r.length > 1 ? `${r[0]}-${r[r.length - 1]}(${r.length})` : `${r[0]}`)).join(" | ");
}

async function main() {
  // import() thật (ts-node/commonjs sẽ đổi import() thành require, không nạp được ESM)
  const esmImport = new Function("s", "return import(s)") as (s: string) => Promise<any>;
  const { getDocument } = await esmImport("pdfjs-dist/legacy/build/pdf.mjs");
  const tests = await prisma.test.findMany({
    where: { explanation: { not: null }, NOT: { explanation: "" }, ...(ONLY ? { id: ONLY } : {}) },
    select: {
      id: true,
      title: true,
      explanation: true,
      solutionAnchors: true,
      sections: { orderBy: { position: "asc" }, select: { questions: { orderBy: { position: "asc" }, select: { id: true } } } },
    },
    take: LIMIT,
  });

  const rows: EvalRow[] = [];
  for (const t of tests) {
    const sections = t.sections.map((s) => s.questions.map((q) => q.id)).filter((s) => s.length > 0);
    const total = sections.flat().length;
    const row: EvalRow = {
      id: t.id,
      title: (t.title || "").slice(0, 50),
      questions: total,
      sections: sections.map((s) => s.length),
      matched: 0,
      markers: 0,
      runs: "",
      pages: 0,
      tooLong: 0,
      tooShort: 0,
      overlap: 0,
      outOfOrder: 0,
    };
    try {
      const data = await loadPdfBytes(t.explanation!);
      const pdf = await getDocument({ data, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
      const analysis = await analyzePdf(pdf);
      await pdf.destroy();
      const saved = USE_SAVED ? parseSolutionAnchors(t.solutionAnchors, t.explanation) : null;
      const anchors = saved ?? buildAutoAnchors(analysis, sections, t.explanation!);
      row.pages = analysis.numPages;
      row.markers = analysis.markers.length;
      row.runs = runsSummary(analysis);
      const ids = sections.flat();
      const regions = ids.map((id) => ({ id, r: resolveRegion(anchors, id) }));
      row.matched = regions.filter((x) => x.r).length;
      let prevStart: { page: number; y: number } | null = null;
      for (const { r } of regions) {
        if (!r) continue;
        const segs = regionSegments(r, anchors.layout);
        const height = segs.reduce((s, g) => s + (g.bottom - g.top), 0);
        if (r.end.page - r.start.page >= 3 || height > 250) row.tooLong++;
        if (height < 2) row.tooShort++;
        // Câu sau bắt đầu trước câu trước (thứ tự trong PDF khác thứ tự câu trong đề)
        if (prevStart && comparePoints(r.start, prevStart) < 0) row.outOfOrder++;
        if (prevStart && comparePoints(r.start, prevStart) === 0) row.overlap++;
        prevStart = r.start;
      }
    } catch (err) {
      row.error = (err as Error).message.slice(0, 80);
    }
    rows.push(row);
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const ok = rows.filter((r) => !r.error && r.questions > 0);
  const totalQ = ok.reduce((s, r) => s + r.questions, 0);
  const totalM = ok.reduce((s, r) => s + r.matched, 0);
  const full = ok.filter((r) => r.matched === r.questions).length;
  const zero = ok.filter((r) => r.matched === 0).length;
  console.log(`\nĐề: ${rows.length} (lỗi tải/đọc: ${rows.length - ok.length - rows.filter((r) => !r.error && r.questions === 0).length}, không có câu: ${rows.filter((r) => !r.error && r.questions === 0).length})`);
  console.log(`Câu ghép được: ${totalM}/${totalQ} (${((totalM / Math.max(1, totalQ)) * 100).toFixed(1)}%)`);
  console.log(`Đề ghép đủ 100%: ${full}/${ok.length} · đề không ghép được câu nào: ${zero}`);
  console.log(
    `Vùng bất thường — quá dài: ${ok.reduce((s, r) => s + r.tooLong, 0)} · quá ngắn: ${ok.reduce((s, r) => s + r.tooShort, 0)} · trùng điểm đầu: ${ok.reduce((s, r) => s + r.overlap, 0)} · sai thứ tự: ${ok.reduce((s, r) => s + r.outOfOrder, 0)}`,
  );
  const worst = [...rows]
    .filter((r) => r.questions > 0)
    .sort((a, b) => a.matched / a.questions - b.matched / b.questions || b.tooLong - a.tooLong)
    .slice(0, 25);
  console.log("\nTệ nhất:");
  for (const r of worst) {
    console.log(
      `${r.matched}/${r.questions}`.padEnd(8),
      `sec=[${r.sections.join(",")}]`.padEnd(16),
      `mk=${r.markers}`.padEnd(7),
      `p=${r.pages}`.padEnd(6),
      `long=${r.tooLong} short=${r.tooShort} ovl=${r.overlap} ord=${r.outOfOrder}`.padEnd(34),
      r.error ? `ERR ${r.error}` : `runs: ${r.runs.slice(0, 90)}`,
      `· ${r.id}`,
    );
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
