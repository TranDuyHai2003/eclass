/**
 * E2E trang học bài của học sinh (/watch/[lessonId]).
 *
 * Cần server đang chạy (BASE_URL, mặc định http://localhost:3000) và DB local. Tự tạo/xoá khoá học + học sinh thử.
 * Kiểm: danh sách bài ở cột phải (màn rộng), nút Bài trước/Bài sau, đánh dấu hoàn thành, chương đang học,
 * thanh 2 tab trên điện thoại, không tràn/cắt chữ ở 390/768/1366/1920.
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
const SHOTS = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "lesson-shots-"));
fs.mkdirSync(SHOTS, { recursive: true });
const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();
const TAG = "e2e-lesson-";

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
  await prisma.course.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
}

await cleanup();
const teacher = await prisma.user.create({ data: { email: `${TAG}gv@test.local`, name: `${TAG}Thầy`, role: "TEACHER", isApproved: true } });
const student = await prisma.user.create({ data: { email: `${TAG}hs@test.local`, name: `${TAG}Học sinh`, role: "STUDENT", isApproved: true } });
const longChapter = "Chương 3: Các số đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm và ứng dụng";
const course = await prisma.course.create({
  data: {
    title: `${TAG}Khoá học thử trang học bài`,
    userId: teacher.id,
    isPublished: true,
    chapters: {
      create: [
        { title: "Chương 1: Hàm số", position: 0, isPublished: true, lessons: { create: [{ title: "Bài 1: Đơn điệu", position: 0, isPublished: true, type: "DOCUMENT" }, { title: "Bài 2: Cực trị", position: 1, isPublished: true, type: "DOCUMENT" }] } },
        { title: longChapter, position: 1, isPublished: true, lessons: { create: [{ title: "Bài 3: Khoảng tứ phân vị của mẫu số liệu ghép nhóm (rất dài để thử xuống dòng)", position: 0, isPublished: true, type: "DOCUMENT" } ] } },
      ],
    },
  },
  include: { chapters: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } },
});
// Khoá riêng có một đề còn hạn (ngày mai) → đứng đầu "Bài cần làm" ở trang chủ
await prisma.course.create({
  data: {
    title: `${TAG}Khoá có đề`,
    userId: teacher.id,
    isPublished: true,
    chapters: { create: [{ title: "Chương kiểm tra", position: 0, isPublished: true, lessons: { create: [{ title: "Bài 4: Kiểm tra 15 phút", position: 0, isPublished: true, type: "QUIZ", test: { create: { title: "Kiểm tra 15 phút chương 3", pdfUrl: "x.pdf", duration: 15, dueDate: new Date(Date.now() + 24 * 3600 * 1000) } } }] } }] },
  },
});
const [l1, l2] = course.chapters[0].lessons;
const [l3] = course.chapters[1].lessons;
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: student.id, role: "STUDENT", isApproved: true }, maxAge: 3600 });

const b = await openBrowser({ baseUrl: BASE_URL, token, width: 1366, height: 900 });
const rect = (sel) => b.ev(`const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height,vis:getComputedStyle(e).display!=="none" && r.width>0}`);

try {
  await step("Màn rộng: danh sách bài ở cột phải, thảo luận dưới bài học", async () => {
    await b.goto(`/watch/${l2.id}`, /Bài 2: Cực trị/);
    const info = await rect('[data-testid="lesson-info"]');
    const cur = await rect('[data-panel="curriculum"]');
    const disc = await rect('[data-panel="discussion"]');
    expect(info && cur && disc, "thiếu khối");
    expect(cur.x > info.x + info.w - 1, `danh sách bài không ở cột phải (${cur.x} vs ${info.x + info.w})`);
    expect(disc.vis && disc.y > info.y, "thảo luận không nằm dưới bài học");
    expect(!(await rect('[role="tablist"][aria-label="Nội dung bài học"]')).vis, "thanh tab điện thoại hiện trên màn rộng");
  });

  await step("Chương đang học được đánh dấu, mỗi chương có x/y bài, tiến độ chỉ hiện một chỗ", async () => {
    const cur = await b.ev(`return [...document.querySelectorAll('[data-current-chapter]')].map(e=>e.innerText)`);
    expect(cur.length === 1 && /Chương 1: Hàm số/.test(cur[0]) && /Đang học/.test(cur[0]) && /0\/2 bài/.test(cur[0]), `chương đang học sai: ${JSON.stringify(cur)}`);
    expect(await b.waitText(/0\/3 bài · 0%/, 3000), "thiếu 'x/y bài · %' ở đầu danh sách");
    const progressBars = await b.ev(`return document.querySelectorAll('[role="progressbar"]').length`);
    expect(progressBars === 1, `có ${progressBars} thanh tiến độ`);
  });

  await step("Bài trước / Bài sau đi theo thứ tự chương → bài (qua cả chương)", async () => {
    await b.click(/^Tiếp$/, 'a[aria-label="Bài sau"]');
    expect(await b.waitText(/Bài 3: Khoảng tứ phân vị/, 15000), "Bài sau không sang bài 3");
    expect(await b.ev(`return !document.querySelector('a[aria-label="Bài sau"]')`), "bài cuối vẫn có link Bài sau");
    await b.click(/Trước/, 'a[aria-label="Bài trước"]');
    expect(await b.waitText(/Bài 2: Cực trị/, 15000), "Bài trước không về bài 2");
  });

  await step("Hoàn thành bài: nút đổi trạng thái, tiến độ và số bài của chương cập nhật", async () => {
    await b.click(/Hoàn thành bài/, '[data-testid="lesson-complete"]');
    for (let i = 0; i < 30 && !(await b.ev(`return document.querySelector('[data-testid="lesson-complete"]')?.getAttribute("aria-pressed")==="true"`)); i++) await sleep(500);
    expect(await b.waitText(/Đã hoàn thành/, 5000), "nút không chuyển sang Đã hoàn thành");
    expect(await b.waitText(/1\/3 bài · 33%/, 8000), "tiến độ khoá không cập nhật");
    const p = await prisma.progress.findUnique({ where: { userId_lessonId: { userId: student.id, lessonId: l2.id } } });
    expect(p?.isCompleted, "DB chưa ghi hoàn thành");
  });

  for (const [w, h] of [[1920, 1080], [1366, 768]]) {
    await step(`Không tràn / cắt chữ ở ${w}px`, async () => {
      await b.setSize(w, h);
      await b.goto(`/watch/${l3.id}`, /Bài 3/);
      const probs = await b.layoutProblems();
      expect(probs.length === 0, probs.join("\n    "));
      await b.screenshot(path.join(SHOTS, `lesson-${w}.png`), { fullPage: true });
    });
  }

  for (const [w, h] of [[390, 844], [768, 1024]]) {
    await step(`Điện thoại/tablet ${w}px: 2 tab Nội dung / Thảo luận, không tràn`, async () => {
      await b.setSize(w, h);
      await b.goto(`/watch/${l1.id}`, /Bài 1: Đơn điệu/);
      expect((await rect('[data-panel="curriculum"]')).vis, "tab Nội dung không hiện mặc định");
      expect(!(await rect('[data-panel="discussion"]')).vis, "thảo luận hiện khi đang ở tab Nội dung");
      await b.click(/Thảo luận/, '[role="tab"]');
      expect((await rect('[data-panel="discussion"]')).vis, "bấm tab Thảo luận không hiện thảo luận");
      expect(!(await rect('[data-panel="curriculum"]')).vis, "danh sách bài vẫn hiện ở tab Thảo luận");
      await b.click(/Nội dung/, '[role="tab"]');
      const probs = await b.layoutProblems();
      expect(probs.length === 0, probs.join("\n    "));
      await b.screenshot(path.join(SHOTS, `lesson-${w}.png`), { fullPage: true });
    });
  }

  await step("Trang chủ học sinh: 'Bài cần làm' liệt kê đề chưa làm, bấm 'Làm bài' mở đúng bài", async () => {
    await b.setSize(1366, 900);
    await b.goto("/", /Bài cần làm/);
    const tasks = await b.ev(`return document.querySelector('[data-testid="student-tasks"]')?.innerText || ""`);
    expect(/Kiểm tra 15 phút chương 3/.test(tasks), `thiếu đề chưa làm: ${tasks.slice(0, 200)}`);
    await b.click(/Kiểm tra 15 phút chương 3/, '[data-testid="student-tasks"] a');
    expect(await b.waitText(/Bài 4: Kiểm tra 15 phút/, 15000), "không mở đúng bài");
  });

  for (const [w, h] of [[390, 844], [1920, 1080]]) {
    await step(`Trang chủ ${w}px: không tràn / cắt chữ`, async () => {
      await b.setSize(w, h);
      await b.goto("/", /Bài cần làm/);
      const probs = await b.layoutProblems();
      expect(probs.length === 0, probs.join("\n    "));
      await b.screenshot(path.join(SHOTS, `home-${w}.png`), { fullPage: true });
    });
  }

  await step("Trang chủ khách (chưa đăng nhập): thẻ giới thiệu có nút Đăng ký / Đăng nhập, không tràn ở 390px", async () => {
    const g = await openBrowser({ baseUrl: BASE_URL, width: 390, height: 844 });
    try {
      await g.goto("/", /Đăng ký học/);
      const hero = await g.ev(`const h=document.querySelector('[data-testid="guest-hero"]'); return h ? [h.innerText, !!h.querySelector('a[href="/register"]'), !!h.querySelector('a[href="/login"]')] : null`);
      expect(hero && hero[1] && hero[2], "thiếu thẻ giới thiệu hoặc nút đăng ký/đăng nhập");
      const probs = await g.layoutProblems();
      expect(probs.length === 0, probs.join("\n    "));
      expect(g.errors.length === 0, g.errors.join("\n    "));
    } finally {
      await g.close();
    }
  });

  await step("Không có lỗi JavaScript", async () => {
    expect(b.errors.length === 0, b.errors.join("\n    "));
  });
} finally {
  await b.close();
  await cleanup();
  await prisma.$disconnect();
}
console.log(`\n${results.length}/${results.length + failed} bước đạt. Ảnh chụp: ${SHOTS}`);
process.exit(failed ? 1 : 0);
