/**
 * Chạy OCR + lưu mốc cắt câu cho các đề có PDF lời giải dạng ảnh, qua chính công cụ cắt câu (Chrome headless).
 *
 *   BASE_URL=http://localhost:3000 node tests/tools/ocr-anchors.mjs [--limit 50] [--test <id>] [--force]
 *
 * - Chỉ xử lý đề CHƯA có mốc lưu (trừ khi --force); không bao giờ ghi đè đề đã có câu chỉnh tay.
 * - Chỉ chạy với DB local (script tự chặn). Muốn chạy cho production: cần thầy đồng ý và làm riêng.
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser, sleep } from "../e2e/cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
require(path.join(root, "tests/setup/load-env.cjs")).loadEnv(path.join(root, ".env"));
const host = (() => {
  try {
    return new URL(process.env.CUSTOM_DATABASE_URL || "").hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Từ chối chạy: DB không phải local (${host || "?"})`);
  process.exit(1);
}
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const LIMIT = Number(opt("--limit") ?? 100);
const ONLY = opt("--test");
const FORCE = args.includes("--force");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();
const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "TEACHER"] }, isDemo: false } });
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: admin.id, role: admin.role }, maxAge: 6 * 3600 });

const tests = await prisma.test.findMany({
  where: { explanation: { not: null }, NOT: { explanation: "" }, ...(ONLY ? { id: ONLY } : {}) },
  select: { id: true, title: true, solutionAnchors: true },
  take: 500,
});
const b = await openBrowser({ baseUrl: BASE_URL, token, width: 1440, height: 900 });
let done = 0;
const report = [];
for (const t of tests) {
  if (done >= LIMIT) break;
  const items = Object.values(t.solutionAnchors?.items ?? {});
  if (items.some((i) => i.source === "manual")) continue; // thầy đã chỉnh tay → không đụng
  if (t.solutionAnchors && !FORCE) continue;
  await b.goto(`/teacher/tests/solutions/${t.id}`, /Cắt lời giải từng câu/i);
  // Chờ phân tích xong rồi xem có phải file ảnh không
  let banner = false;
  for (let i = 0; i < 40; i++) {
    banner = await b.ev(`return !!document.querySelector('[data-testid="ocr-banner"]')`);
    const analyzed = await b.ev(`return /\\d+\\/\\d+ câu/.test(document.querySelector('[data-testid="anchor-progress"]')?.innerText || "") && !document.body.innerText.includes("Đang phân tích")`);
    if (banner || (analyzed && i > 6)) break;
    await sleep(500);
  }
  if (!banner) continue; // file có chữ → không cần OCR
  const before = await b.ev(`return document.querySelector('[data-testid="anchor-progress"]')?.innerText`);
  const t0 = Date.now();
  await b.ev(`document.querySelector('[data-testid="ocr-run"]').click()`);
  for (let i = 0; i < 900; i++) {
    await sleep(1000);
    if (i > 2 && !(await b.ev(`return !!document.querySelector('[data-testid="ocr-progress"]')`))) break;
  }
  const after = await b.ev(`return document.querySelector('[data-testid="anchor-progress"]')?.innerText`);
  await b.press("s", { ctrl: true });
  const saved = await b.waitText(/Đã lưu vị trí lời giải/, 10000);
  done++;
  const line = `${before} → ${after} (${Math.round((Date.now() - t0) / 1000)}s) ${saved ? "đã lưu" : "LƯU LỖI"} · ${t.title?.slice(0, 50)} · ${t.id}`;
  report.push(line);
  console.log(line);
}
await b.close();
await prisma.$disconnect();
console.log(`\nĐã OCR ${done} đề.`);
process.exit(0);
