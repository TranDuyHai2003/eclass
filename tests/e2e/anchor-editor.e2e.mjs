/**
 * E2E công cụ cắt lời giải từng câu của giáo viên (/teacher/tests/solutions/[testId]).
 *
 * Cần server đang chạy (BASE_URL, mặc định http://localhost:3000) và DB local có ít nhất một đề kèm PDF lời giải
 * (dùng lại file lời giải đó cho một đề thử tạm). Tự tạo/xoá dữ liệu thử.
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser, sleep } from "./cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
require(path.join(root, "tests/setup/load-env.cjs")).loadEnv(path.join(root, ".env"));
const dbHost = (() => {
  try {
    return new URL(process.env.CUSTOM_DATABASE_URL || "").hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost)) {
  console.error(`Từ chối chạy: DB không phải local (${dbHost || "?"})`);
  process.exit(1);
}
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "anchor-shots-"));
fs.mkdirSync(SHOTS, { recursive: true });
const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();
const TAG = "e2e-anchor-";

let failed = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`✔ ${name}`);
    console.log(`✔ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✖ ${name}\n    ${err.message}`);
  }
}
const expect = (c, m) => {
  if (!c) throw new Error(m);
};

async function cleanup() {
  await prisma.test.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
}

await cleanup();
// Lấy file lời giải thật có lớp chữ (đề "Bài 6" hoặc bất kỳ đề nào có lời giải)
const source = await prisma.test.findFirst({ where: { explanation: { not: null }, NOT: { explanation: "" } }, select: { explanation: true } });
if (!source) {
  console.error("DB local không có đề nào có PDF lời giải — bỏ qua E2E công cụ cắt câu.");
  process.exit(0);
}
const teacher = await prisma.user.create({ data: { email: `${TAG}gv@test.local`, name: `${TAG}Thầy`, role: "TEACHER", isApproved: true } });
const test = await prisma.test.create({
  data: {
    title: `${TAG}Đề thử cắt câu`,
    pdfUrl: source.explanation,
    explanation: source.explanation,
    duration: 10,
    sections: { create: [{ name: "Phần 1", position: 0, questions: { create: Array.from({ length: 6 }, (_, i) => ({ type: "MULTIPLE_CHOICE", points: 1, position: i, correctAnswer: "A" })) } }] },
  },
  include: { sections: { include: { questions: { orderBy: { position: "asc" } } } } },
});
const qids = test.sections[0].questions.map((q) => q.id);
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: teacher.id, role: "TEACHER" }, maxAge: 3600 });

const b = await openBrowser({ baseUrl: BASE_URL, token, width: 1440, height: 900 });
/** Toạ độ trên màn hình của một điểm % trong trang PDF thứ n */
const pagePoint = (page, yPct, xPct = 50) =>
  b.ev(`const el=document.querySelector('[data-testid="anchor-editor"] [data-page="${page}"]'); if(!el) return null; el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); return [r.left + r.width*${xPct}/100, r.top + r.height*${yPct}/100];`);
const selected = () => b.ev(`return document.querySelector('[data-row-id][class*="bg-blue-50"]')?.innerText.split("\\n")[0] || ""`);
const progressText = () => b.ev(`return document.querySelector('[data-testid="anchor-progress"]')?.innerText || ""`);

try {
  await step("Mở công cụ cắt câu toàn màn hình, có thanh tiến độ", async () => {
    await b.goto(`/teacher/tests/solutions/${test.id}`, /Cắt lời giải từng câu/i);
    expect(await b.waitText(/\d+\/6 câu/, 30000), "không thấy tiến độ x/6 câu");
    const fixed = await b.ev(`const e=document.querySelector('[data-testid="anchor-editor"]'); const r=e.getBoundingClientRect(); return getComputedStyle(e).position==="fixed" && r.width>=innerWidth-1`);
    expect(fixed, "công cụ không phủ toàn màn hình");
    // đợi trang PDF hiện
    for (let i = 0; i < 30 && !(await pagePoint(1, 50)); i++) await sleep(500);
    expect(await pagePoint(1, 50), "PDF không hiện");
  });

  await step("Bỏ gắn hết rồi bấm thẳng vào PDF: đặt điểm bắt đầu và tự sang câu sau", async () => {
    // Chọn câu 1, bỏ gắn các câu (để thử từ đầu)
    for (let i = 0; i < 6; i++) {
      await b.click(new RegExp(`^Câu ${i + 1}`), "[data-row-id]");
      await b.click(/^Bỏ gắn câu$/, "button", { optional: true });
    }
    await b.click(/^Câu 1/, "[data-row-id]");
    expect((await progressText()).startsWith("0/6"), `chưa về 0/6: ${await progressText()}`);
    const p1 = await pagePoint(1, 20);
    await b.mouseClick(p1[0], p1[1]);
    expect((await progressText()).startsWith("1/6"), `bấm vào PDF không đặt được mốc: ${await progressText()}`);
    expect((await selected()).startsWith("Câu 2"), `không tự sang câu 2: ${await selected()}`);
    const p2 = await pagePoint(1, 50);
    await b.mouseClick(p2[0], p2[1]);
    expect((await progressText()).startsWith("2/6"), "không đặt được mốc câu 2");
  });

  await step("Hoàn tác / làm lại (Ctrl+Z, Ctrl+Shift+Z)", async () => {
    await b.press("z", { ctrl: true });
    expect((await progressText()).startsWith("1/6"), `Ctrl+Z không hoàn tác: ${await progressText()}`);
    await b.press("z", { ctrl: true, shift: true });
    expect((await progressText()).startsWith("2/6"), `Ctrl+Shift+Z không làm lại: ${await progressText()}`);
  });

  await step("Shift+bấm đặt điểm kết thúc, Alt+bấm đặt mốc Lời giải cho câu 1", async () => {
    await b.click(/^Câu 1/, "[data-row-id]");
    const pEnd = await pagePoint(1, 40);
    await b.mouseClick(pEnd[0], pEnd[1], { shift: true });
    expect(await b.waitText(/Hết C1(?! \(tự động\))/, 3000), "không thấy mốc kết thúc thủ công");
    const pSol = await pagePoint(1, 30);
    await b.mouseClick(pSol[0], pSol[1], { alt: true });
    expect(await b.waitText(/có mốc Lời giải/, 3000), "không đặt được mốc Lời giải");
    expect(await b.waitText(/Sau khi bấm “Xem đáp án chi tiết”/, 8000), "xem trước không tách phần lời giải");
  });

  await step("Kéo nhãn mốc câu 2 để dời vị trí", async () => {
    const before = await b.ev(`return [...document.querySelectorAll('[data-page="1"] span[role="button"]')].find(s=>s.innerText==="C2")?.getBoundingClientRect().top`);
    expect(before, "không thấy nhãn C2");
    const x = await b.ev(`const s=[...document.querySelectorAll('[data-page="1"] span[role="button"]')].find(s=>s.innerText==="C2"); const r=s.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]`);
    await b.mouseDrag(x[0], x[1], x[0], x[1] + 80);
    const after = await b.ev(`return [...document.querySelectorAll('[data-page="1"] span[role="button"]')].find(s=>s.innerText==="C2")?.getBoundingClientRect().top`);
    expect(after > before + 40, `nhãn không dời (${before} → ${after})`);
  });

  await step("Ctrl+S lưu; DB có mốc thủ công, mốc kết thúc và mốc Lời giải", async () => {
    await b.press("s", { ctrl: true });
    expect(await b.waitText(/Đã lưu vị trí lời giải cho 2 câu/, 8000), "không thấy thông báo đã lưu");
    const t = await prisma.test.findUnique({ where: { id: test.id }, select: { solutionAnchors: true } });
    const a = t.solutionAnchors;
    expect(a && a.items[qids[0]]?.source === "manual" && a.items[qids[0]].end, "câu 1 thiếu mốc thủ công / kết thúc");
    expect(a.items[qids[1]]?.source === "manual", "câu 2 thiếu mốc");
    expect((a.solutionMarks || []).some((m) => m.page === 1 && m.y > a.items[qids[0]].y && m.y < a.items[qids[0]].end.y), "thiếu mốc Lời giải trong vùng câu 1");
    expect(a.algoVersion >= 10 && a.method === "text", `thiếu algoVersion/method: ${a.algoVersion}/${a.method}`);
  });

  await step("Lọc 'Chưa gắn' chỉ còn câu chưa gắn; gắn liên tiếp đi theo danh sách đang lọc", async () => {
    await b.click(/^Chưa gắn$/, "button");
    const rows = await b.ev(`return [...document.querySelectorAll('[data-row-id]')].map(r=>r.innerText.split("\\n")[0])`);
    expect(!rows.includes("Câu 1") || (await selected()) === "Câu 1", `lọc sai: ${rows}`);
    await b.click(/^Câu 4/, "[data-row-id]");
    const p = await pagePoint(2, 20);
    if (p) {
      await b.mouseClick(p[0], p[1]);
      expect((await selected()).startsWith("Câu 5"), `gắn liên tiếp không theo danh sách lọc: ${await selected()}`);
    }
    await b.click(/^Tất cả$/, "button");
  });

  await step("Điện thoại: 3 tab Danh sách / PDF / Xem trước, không tràn ngang", async () => {
    await b.setSize(390, 844);
    await b.goto(`/teacher/tests/solutions/${test.id}`, /Cắt lời giải/i);
    await b.click(/^Danh sách$/, "button");
    expect(await b.waitText(/Câu 1/, 5000), "tab danh sách không hiện câu");
    await b.click(/^Xem trước$/, "button");
    expect(await b.waitText(/Học sinh sẽ thấy/i, 5000), "tab xem trước không hiện");
    const probs = await b.layoutProblems();
    expect(probs.length === 0, probs.join("\n    "));
    await b.screenshot(path.join(SHOTS, "anchor-editor-390.png"));
  });

  await step("Không có lỗi JavaScript", async () => {
    expect(b.errors.length === 0, b.errors.join("\n    "));
  });
} finally {
  await b.screenshot(path.join(SHOTS, "anchor-editor-last.png")).catch(() => {});
  await b.close();
  await cleanup();
  await prisma.$disconnect();
}
console.log(`\n${results.length}/${results.length + failed} bước đạt. Ảnh chụp: ${SHOTS}`);
process.exit(failed ? 1 : 0);
