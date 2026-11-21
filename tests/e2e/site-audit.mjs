/**
 * Rà toàn trang: mở mọi trang chính theo từng vai trò (khách, học sinh, giáo viên, admin) ở 390 / 768 / 1366 / 1920px.
 * Mỗi trang kiểm: mã HTTP (không 5xx, không 404 ngoài ý muốn), lỗi JavaScript, ảnh hỏng, tràn ngang / chữ bị cắt / thừa khoảng trống.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/site-audit.mjs [--only student|teacher|admin|guest] [--widths 390,1366]
 *
 * Chỉ đọc (không mở trang làm bài để khỏi tạo lượt làm). Dùng dữ liệu sẵn có trong DB local; trang nào thiếu dữ liệu thì bỏ qua.
 * Thoát mã 1 nếu có lỗi; ảnh chụp các trang lỗi lưu ở E2E_SHOTS.
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
const SHOTS = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "site-audit-"));
fs.mkdirSync(SHOTS, { recursive: true });
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ONLY = arg("--only");
const WIDTHS = (arg("--widths") || "390,768,1366,1920").split(",").map(Number);
const HEIGHT = { 390: 844, 768: 1024, 1366: 900, 1920: 1080 };

const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();

// ---------- Dữ liệu mẫu có sẵn ----------
const student = await prisma.user.findFirst({ where: { role: "STUDENT", isApproved: true, isDemo: false }, orderBy: { createdAt: "asc" } });
const teacher = await prisma.user.findFirst({ where: { role: "TEACHER", isDemo: false } });
const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isDemo: false } });
const course = await prisma.course.findFirst({ where: { isPublished: true, chapters: { some: { lessons: { some: {} } } } }, orderBy: { createdAt: "asc" } });
// Học sinh chỉ xem được khoá cùng trình độ (level) — chọn khoá đúng level để không báo 404 giả
const studentCourse = student
  ? await prisma.course.findFirst({ where: { isPublished: true, level: student.level ?? undefined, chapters: { some: { lessons: { some: {} } } } }, orderBy: { createdAt: "asc" } })
  : null;
const lesson = course ? await prisma.lesson.findFirst({ where: { chapter: { courseId: course.id } }, orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }] }) : null;
const attempt = await prisma.studentAttempt.findFirst({
  where: { completedAt: { not: null }, test: { lesson: { isNot: null } } },
  orderBy: { completedAt: "desc" },
  select: { id: true, userId: true, testId: true, test: { select: { lesson: { select: { id: true } } } } },
});
const quizLesson = await prisma.lesson.findFirst({ where: { test: { isNot: null } }, select: { id: true, test: { select: { id: true } } } });
const solutionTest = await prisma.test.findFirst({ where: { explanation: { not: null }, NOT: { explanation: "" } }, select: { id: true } });

const R = (p, opts = {}) => (p ? { path: p, ...opts } : null);
const ROUTES = {
  guest: [R("/"), R("/login"), R("/register"), R("/courses")],
  student: [
    R("/"),
    R("/courses"),
    studentCourse && R(`/courses/${studentCourse.id}`),
    lesson && R(`/watch/${lesson.id}`),
    R("/ranking"),
    R("/rewards"),
    R("/rewards/gacha"),
    R("/leaderboard"),
    R("/profile"),
    R("/profile/avatar"),
    R("/library"),
    R("/news"),
    R("/practice"),
    R("/community"),
    R("/live"),
    R("/books"),
  ].filter(Boolean),
  teacher: [
    R("/teacher/courses"),
    course && R(`/teacher/courses/${course.id}`),
    course && R(`/teacher/courses/${course.id}/analytics`),
    R("/teacher/tests"),
    quizLesson && R(`/teacher/tests/${quizLesson.id}`),
    quizLesson && R(`/teacher/tests/${quizLesson.id}/results`),
    quizLesson && R(`/teacher/tests/${quizLesson.id}/analytics`),
    solutionTest && R(`/teacher/tests/solutions/${solutionTest.id}`, { wait: 6000 }),
    R("/teacher/homework"),
    R("/teacher/rewards"),
    R("/teacher/videos"),
  ].filter(Boolean),
  admin: [R("/admin/users"), R("/admin/classes"), R("/admin/analytics"), R("/admin/global-analytics"), R("/admin/finance"), R("/admin/settings"), R("/admin/live")],
};

async function tokenFor(user) {
  if (!user) return null;
  return encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: user.id, role: user.role, isApproved: true }, maxAge: 3600 });
}

async function httpStatus(p, token) {
  try {
    const res = await fetch(BASE_URL + p, { headers: token ? { cookie: `authjs.session-token=${token}` } : {}, redirect: "manual" });
    return res.status;
  } catch (e) {
    return `ERR ${e.message}`;
  }
}

const problems = [];
let checked = 0;
async function audit(role, user, routes) {
  if (ONLY && ONLY !== role) return;
  if (role !== "guest" && !user) {
    console.log(`– bỏ qua vai trò ${role}: DB local không có tài khoản`);
    return;
  }
  const token = await tokenFor(user);
  // Trang kết quả bài làm: phải là học sinh làm bài đó
  if (role === "student" && attempt?.test?.lesson) {
    const owner = await prisma.user.findUnique({ where: { id: attempt.userId } });
    if (owner) {
      const t2 = await tokenFor(owner);
      await auditRoutes(`student(chủ bài làm)`, t2, [{ path: `/watch/${attempt.test.lesson.id}/results/${attempt.id}`, wait: 6000 }]);
    }
  }
  await auditRoutes(role, token, routes);
}

async function auditRoutes(role, token, routes) {
  for (const w of WIDTHS) {
    const b = await openBrowser({ baseUrl: BASE_URL, token, width: w, height: HEIGHT[w] || 900 });
    try {
      for (const r of routes) {
        const status = await httpStatus(r.path, token);
        const errBefore = b.errors.length;
        await b.goto(r.path);
        await sleep(r.wait ?? 2500);
        const finalPath = await b.ev("return location.pathname");
        const broken = await b.ev(`return [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).map(i => i.src.slice(0, 80))`);
        const notFound = await b.ev(`return /This page could not be found|404|Không tìm thấy trang/i.test(document.title + " " + (document.querySelector("h1")?.innerText || ""))`);
        const layout = await b.layoutProblems();
        const jsErrors = b.errors.slice(errBefore);
        const issues = [];
        if (typeof status !== "number" || status >= 500) issues.push(`HTTP ${status}`);
        if (notFound) issues.push("trang 404");
        if (jsErrors.length) issues.push(...jsErrors.map((e) => `JS: ${e}`));
        if (broken.length) issues.push(`ảnh hỏng: ${broken.join(", ")}`);
        issues.push(...layout);
        checked++;
        const tag = `${role} ${w}px ${r.path}${finalPath !== r.path.split("?")[0] ? ` → ${finalPath}` : ""}`;
        if (issues.length) {
          problems.push({ tag, issues });
          console.log(`✖ ${tag}\n    ${issues.join("\n    ")}`);
          const file = path.join(SHOTS, `${role.replace(/\W+/g, "_")}-${w}-${r.path.replace(/\W+/g, "_")}.png`);
          await b.screenshot(file, { fullPage: true }).catch(() => {});
        } else {
          console.log(`✔ ${tag}`);
        }
      }
    } finally {
      await b.close();
    }
  }
}

try {
  await audit("guest", null, ROUTES.guest);
  await audit("student", student, ROUTES.student);
  await audit("teacher", teacher, ROUTES.teacher);
  await audit("admin", admin, ROUTES.admin);
} finally {
  await prisma.$disconnect();
}
console.log(`\nĐã rà ${checked} lượt trang; ${problems.length} lượt có vấn đề. Ảnh chụp lỗi: ${SHOTS}`);
process.exit(problems.length ? 1 : 0);
