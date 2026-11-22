/**
 * E2E Trang chủ khách · Khóa học · Đăng nhập (theo artifact thiết kế 22/11/2026).
 *
 * Cần server đang chạy (BASE_URL, mặc định http://localhost:3000) và DB local. Tự tạo/xoá khoá học + học sinh thử.
 * Kiểm /courses: lọc theo khối (?grade=), tìm (?query=), dải "Tiếp tục học" trỏ bài kế tiếp;
 * trang chủ khách: hero, đếm ngược, lộ trình làm mờ theo khối, footer;
 * không tràn/cắt chữ ở 390/768/1366/1920.
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser } from "./cdp.mjs";

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
const SHOTS = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "landing-shots-"));
fs.mkdirSync(SHOTS, { recursive: true });
const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();
const TAG = "e2e-landing-";

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
// Học sinh chưa có lớp → thấy mọi khoá (buildCourseVisibilityWhere)
const student = await prisma.user.create({ data: { email: `${TAG}hs@test.local`, name: `${TAG}Học sinh`, role: "STUDENT", isApproved: true } });
const mkCourse = (title, lessons) =>
  prisma.course.create({
    data: {
      title: `${TAG}${title}`,
      userId: teacher.id,
      isPublished: true,
      chapters: { create: [{ title: "Chương 1", position: 0, isPublished: true, lessons: { create: lessons.map((t, i) => ({ title: t, position: i, isPublished: true, type: "DOCUMENT" })) } }] },
    },
    include: { chapters: { include: { lessons: { orderBy: { position: "asc" } } } } },
  });
const c10 = await mkCourse("Lớp 10 thử", ["Bài A1", "Bài A2"]);
await mkCourse("Luyện thi THPTQG thử", ["Bài B1"]);
await mkCourse("Hình học thử", ["Bài C1"]);
const [a1, a2] = c10.chapters[0].lessons;
await prisma.progress.create({ data: { userId: student.id, lessonId: a1.id, isCompleted: true } });
const token = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: student.id, role: "STUDENT", isApproved: true }, maxAge: 3600 });

const tiles = (b) => b.ev(`return [...document.querySelectorAll('[data-testid="course-tile"]')].map(t=>({g:t.dataset.group, t:t.querySelector('h3')?.innerText||''}))`);

const b = await openBrowser({ baseUrl: BASE_URL, token, width: 1366, height: 900 });
try {
  await step("Khóa học: tiêu đề, số liệu, tab khối và lưới thẻ", async () => {
    await b.goto("/courses", /Khóa học/);
    const all = await tiles(b);
    expect(all.some((x) => x.t.includes("Lớp 10 thử") && x.g === "10"), `thiếu thẻ Lớp 10: ${JSON.stringify(all)}`);
    expect(all.some((x) => x.t.includes("Luyện thi THPTQG thử") && x.g === "thi"), "thẻ luyện thi không vào nhóm thi");
    expect(all.some((x) => x.t.includes("Hình học thử") && x.g === ""), "khoá chưa rõ khối phải có nhóm rỗng");
    const stats = await b.ev(`return document.querySelector('[data-testid="courses-stats"]')?.innerText || ''`);
    expect(new RegExp(`${all.length}\\s*khóa học`).test(stats), `số khoá sai: ${stats}`);
    const tabs = await b.ev(`return [...document.querySelectorAll('nav[aria-label="Lọc theo khối"] a')].map(a=>a.innerText.trim())`);
    expect(tabs[0] === "Tất cả" && tabs.includes("Lớp 10") && tabs.includes("Luyện thi"), `tab sai: ${tabs}`);
  });

  await step("Lọc Lớp 10 chỉ còn khoá lớp 10; Tất cả hiện lại khoá chưa rõ khối", async () => {
    await b.click(/^Lớp 10$/, 'nav[aria-label="Lọc theo khối"] a');
    expect(await b.waitText(/Lớp 10 thử/, 10000), "không thấy khoá lớp 10 sau khi lọc");
    const f = await tiles(b);
    expect(f.length > 0 && f.every((x) => x.g === "10"), `còn khoá khác khối: ${JSON.stringify(f)}`);
    expect(await b.ev(`return location.search.includes("grade=10")`), "URL không có grade=10");
    expect(await b.ev(`return document.querySelector('nav[aria-label="Lọc theo khối"] a[aria-current="page"]')?.innerText.trim()`) === "Lớp 10", "tab đang chọn không đánh dấu aria-current");
    await b.click(/^Tất cả$/, 'nav[aria-label="Lọc theo khối"] a');
    expect(await b.waitText(/Hình học thử/, 10000), "Tất cả không hiện khoá chưa rõ khối");
  });

  await step("Tìm theo tên (giữ khối đang lọc)", async () => {
    await b.goto(`/courses?query=${encodeURIComponent(TAG)}`, /Tìm thấy 3 khóa học/);
    expect((await tiles(b)).length === 3, "tìm theo tên không ra đúng 3 khoá thử");
    await b.goto(`/courses?query=${encodeURIComponent(TAG)}&grade=thi`, /Luyện thi THPTQG thử/);
    const f = await tiles(b);
    expect(f.length === 1 && f[0].g === "thi", `lọc + tìm sai: ${JSON.stringify(f)}`);
    expect(await b.ev(`return document.querySelector('form[role="search"] input[name="grade"]')?.value`) === "thi", "ô tìm không giữ khối đang lọc");
    await b.goto(`/courses?query=khong-co-khoa-nao-${Date.now()}`, /Không tìm thấy khóa học phù hợp/);
  });

  await step("Tiếp tục học: trỏ bài kế sau bài vừa hoàn thành, hiện x/y bài", async () => {
    await b.goto("/courses", /TIẾP TỤC HỌC/);
    const r = await b.ev(`const a=document.querySelector('[data-testid="courses-resume"]'); return a ? [a.getAttribute('href'), a.innerText] : null`);
    expect(r, "không có dải Tiếp tục học");
    expect(r[0] === `/watch/${a2.id}`, `href sai: ${r[0]} (mong ${a2.id})`);
    expect(/Lớp 10 thử/.test(r[1]) && /1\/2 bài/.test(r[1]), `nội dung sai: ${r[1]}`);
    const prog = await b.ev(`const t=[...document.querySelectorAll('[data-testid="course-tile"]')].find(t=>t.innerText.includes('Lớp 10 thử')); return t?.querySelector('[data-testid="course-progress"]')?.innerText || ''`);
    expect(/50%/.test(prog), `thẻ khoá không có tiến độ 50%: ${prog}`);
  });

  for (const [w, h] of [[390, 844], [768, 1024], [1366, 900], [1920, 1080]]) {
    await step(`Khóa học ${w}px: không tràn / cắt chữ`, async () => {
      await b.setSize(w, h);
      await b.goto("/courses", /Khóa học/);
      const probs = await b.layoutProblems();
      expect(probs.length === 0, probs.join("\n    "));
      await b.screenshot(path.join(SHOTS, `courses-${w}.png`), { fullPage: true });
    });
  }

  await step("Khách xem Khóa học: không có dải Tiếp tục học, không lỗi", async () => {
    const g = await openBrowser({ baseUrl: BASE_URL, width: 1366, height: 900 });
    try {
      await g.goto("/courses", /Khóa học/);
      expect(!(await g.ev(`return !!document.querySelector('[data-testid="courses-resume"]')`)), "khách thấy dải Tiếp tục học");
      expect(!(await g.ev(`return !!document.querySelector('[data-testid="course-progress"]')`)), "khách thấy tiến độ");
      expect(g.errors.length === 0, g.errors.join("\n    "));
    } finally {
      await g.close();
    }
  });

  await step("Trang chủ khách: hero (Đăng ký/Đăng nhập), đếm ngược, 3 bước, lộ trình, footer; header có 2 nút khách", async () => {
    const g = await openBrowser({ baseUrl: BASE_URL, width: 1366, height: 900 });
    try {
      await g.goto("/", /Học toán THPT dễ hiểu/);
      const hero = await g.ev(`const h=document.querySelector('[data-testid="guest-hero"]'); return h ? [!!h.querySelector('a[href="/register"]'), !!h.querySelector('a[href="/login"]'), !!h.querySelector('a[href="#lo-trinh"]')] : null`);
      expect(hero && hero.every(Boolean), `hero thiếu nút: ${JSON.stringify(hero)}`);
      const header = await g.ev(`const h=document.querySelector('header'); return [!!h.querySelector('a[href="/login"]'), !!h.querySelector('a[href="/register"]')]`);
      expect(header[0] && header[1], "header khách thiếu Đăng nhập / Đăng ký học");
      const cd = await g.ev(`return document.querySelector('[data-testid="landing-countdown"]')?.innerText || ''`);
      expect(/Kỳ thi THPT 2027/.test(cd) && /ngày/.test(cd) && /khóa học/.test(cd), `dải đếm ngược sai: ${cd}`);
      expect(await g.waitText(/Học mỗi tuần theo \d bước/, 3000), "thiếu mục các bước");
      expect(await g.ev(`return !!document.querySelector('#lo-trinh [data-testid="course-tile"]')`), "Lộ trình không có thẻ khoá");
      expect(await g.ev(`return !!document.querySelector('footer')?.innerText.includes('Thật Dễ Học Toán')`), "thiếu footer");
      expect(!(await g.ev(`return !!document.querySelector('aside')`)), "trang khách không được có sidebar");
      expect(g.errors.length === 0, g.errors.join("\n    "));
    } finally {
      await g.close();
    }
  });

  await step("Trang chủ khách: chọn khối ở Lộ trình làm mờ khoá khác khối, Tất cả bỏ mờ", async () => {
    const g = await openBrowser({ baseUrl: BASE_URL, width: 1366, height: 900 });
    try {
      await g.goto("/", /Lộ trình học tập/);
      await g.click(/^Lớp 10$/, '#lo-trinh [role="tab"]');
      const st = await g.ev(`return [...document.querySelectorAll('#lo-trinh [data-testid="course-tile"]')].map(t=>[t.dataset.group, t.dataset.dimmed==="true"])`);
      expect(st.length > 1 && st.every(([gr, dim]) => (gr === "10") === !dim), `làm mờ sai: ${JSON.stringify(st)}`);
      expect(await g.ev(`return document.querySelector('#lo-trinh [role="tab"][aria-selected="true"]')?.innerText.trim()`) === "Lớp 10", "tab không aria-selected");
      await g.click(/^Tất cả$/, '#lo-trinh [role="tab"]');
      expect(await g.ev(`return !document.querySelector('#lo-trinh [data-dimmed="true"]')`), "Tất cả vẫn còn thẻ mờ");
    } finally {
      await g.close();
    }
  });

  for (const [w, h] of [[390, 844], [768, 1024], [1366, 900], [1920, 1080]]) {
    await step(`Trang chủ khách ${w}px: không tràn / cắt chữ`, async () => {
      const g = await openBrowser({ baseUrl: BASE_URL, width: w, height: h });
      try {
        await g.goto("/", /Học toán THPT dễ hiểu/);
        const probs = await g.layoutProblems();
        expect(probs.length === 0, probs.join("\n    "));
        await g.screenshot(path.join(SHOTS, `landing-${w}.png`), { fullPage: true });
      } finally {
        await g.close();
      }
    });
  }

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
