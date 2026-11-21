/**
 * Kiểm thử giao diện Điểm thưởng từ đầu đến cuối trên trình duyệt thật (Chrome headless).
 *
 * Cần: server đang chạy (mặc định http://localhost:3000, đổi bằng BASE_URL) và DB local.
 *   npm run build && npm start      # hoặc npm run dev
 *   npm run test:e2e
 * Tự tạo lớp/học sinh/giáo viên/quà thử, đăng nhập bằng token, chạy xong tự dọn.
 * Ảnh chụp lưu ở thư mục E2E_SHOTS (mặc định: thư mục tạm của hệ điều hành).
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser, sleep } from "./cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));

// ---- Môi trường: đọc .env, chặn DB không phải local
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
const SHOTS = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "points-shots-"));
fs.mkdirSync(SHOTS, { recursive: true });

const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();

// ---- Kết quả
let failed = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`✔ ${name}`);
    console.log(`✔ ${name}`);
  } catch (err) {
    failed++;
    results.push(`✖ ${name}: ${err.message}`);
    console.log(`✖ ${name}\n    ${err.message}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// ---- Dữ liệu thử
const tag = `e2e-points-${Date.now()}`;
const token = (u) =>
  encode({
    salt: "authjs.session-token",
    secret: process.env.AUTH_SECRET,
    token: { sub: u.id, email: u.email, name: u.name, role: u.role, isApproved: true, studentType: u.studentType },
    maxAge: 3600,
  });

/** Dọn dữ liệu sót của các lần chạy trước bị dừng giữa chừng (không chạy tới bước dọn cuối) */
async function cleanupStale() {
  const stale = await prisma.user.findMany({ where: { email: { startsWith: "e2e-points-" } }, select: { id: true } });
  if (stale.length) await prisma.reward.deleteMany({ where: { createdById: { in: stale.map((u) => u.id) } } });
  await prisma.reward.deleteMany({ where: { title: { startsWith: "e2e-points-" } } });
  await prisma.test.deleteMany({ where: { title: { startsWith: "e2e-points-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-points-" } } });
  await prisma.studyClass.deleteMany({ where: { name: { startsWith: "e2e-points-" } } });
}

async function setup() {
  await cleanupStale();
  const cls = await prisma.studyClass.create({ data: { name: `${tag} lớp` } });
  const student = await prisma.user.create({
    data: { email: `${tag}-hs@test.local`, name: `${tag} Học sinh`, role: "STUDENT", isApproved: true, studentType: "OFFLINE", classId: cls.id },
  });
  const teacher = await prisma.user.create({ data: { email: `${tag}-gv@test.local`, name: `${tag} Thầy`, role: "TEACHER", isApproved: true } });
  // Học sinh đã có 1 lượt làm bài được +4 điểm (để thử thông báo ở màn kết quả)
  const test = await prisma.test.create({
    data: { title: `${tag} Bài kiểm tra`, pdfUrl: "x.pdf", duration: 10, sections: { create: [{ name: "Phần 1", questions: { create: [{ type: "MULTIPLE_CHOICE", points: 1, position: 0, correctAnswer: "A" }] } }] } },
  });
  const attempt = await prisma.studentAttempt.create({ data: { testId: test.id, userId: student.id, score: 9, startedAt: new Date(Date.now() - 600000), completedAt: new Date() } });
  await prisma.pointLedger.createMany({
    data: [
      { userId: student.id, amount: 2, source: "TEST_SUBMIT", key: `TEST:${test.id}`, refId: attempt.id, reason: "Nộp bài" },
      { userId: student.id, amount: 2, source: "TEST_SCORE", key: `TESTSCORE:${test.id}`, refId: attempt.id, reason: "Đạt 9 điểm" },
      // Ghi lùi 2 ngày để không chiếm giới hạn thưởng tay của hôm nay
      { userId: student.id, amount: 100, source: "MANUAL", reason: "E2E: giả lập tích điểm", createdAt: new Date(Date.now() - 2 * 86400000) },
    ],
  });
  await prisma.pointWallet.create({ data: { userId: student.id, balance: 104, lifetimeEarned: 104 } });
  return { cls, student, teacher, attempt, test };
}

async function cleanup() {
  await prisma.reward.deleteMany({ where: { title: { startsWith: tag } } });
  // Quà tạo từ mẫu trên giao diện mang tên mẫu → xoá theo người tạo
  const teacher = await prisma.user.findUnique({ where: { email: `${tag}-gv@test.local` } });
  if (teacher) await prisma.reward.deleteMany({ where: { createdById: teacher.id } });
  await prisma.test.deleteMany({ where: { title: { startsWith: tag } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.studyClass.deleteMany({ where: { name: { startsWith: tag } } });
}

const balanceOf = async (userId) => (await prisma.pointWallet.findUnique({ where: { userId } }))?.balance ?? 0;

// =====================================================================
const data = await setup();
const tTok = await token(data.teacher);
const sTok = await token(data.student);
const studentName = data.student.name;

// Kiểm tra trước: server có chạy và nhận token không (sai AUTH_SECRET → bị chuyển về trang đăng nhập)
{
  let res;
  try {
    res = await fetch(BASE_URL + "/rewards", { headers: { cookie: `authjs.session-token=${sTok}` }, redirect: "manual" });
  } catch {
    await cleanup();
    console.error(`Không kết nối được ${BASE_URL} — hãy chạy server trước (npm start / npm run dev) hoặc đặt BASE_URL.`);
    process.exit(1);
  }
  if (res.status !== 200) {
    await cleanup();
    console.error(`Đăng nhập thử thất bại (HTTP ${res.status}) — AUTH_SECRET trong .env có khớp với server không?`);
    process.exit(1);
  }
}

try {
  // -------------------------------------------------- Thầy
  const t = await openBrowser({ baseUrl: BASE_URL, token: tTok });

  await step("Thầy: mở trang Quà & Điểm thưởng", async () => {
    await t.goto("/teacher/rewards", /Quà & Điểm thưởng/i);
  });

  await step("Thầy: thêm quà từ mẫu 'Kẹo / bánh nhỏ'", async () => {
    await t.click(/^Quản lý quà$/);
    await t.click(/Kẹo \/ bánh nhỏ/);
    await t.click(/^Lưu$/, "[role=dialog] button");
    expect(await t.waitText(/Đã thêm quà/), "không thấy thông báo Đã thêm quà");
    const r = await prisma.reward.findFirst({ where: { createdById: data.teacher.id, title: "Kẹo / bánh nhỏ" } });
    expect(r && r.price === 40 && r.offlineOnly, "quà mẫu lưu sai");
  });

  await step("Thầy: form thêm quà — chưa nhập tên thì không lưu được; nhập đủ thì lưu", async () => {
    await t.click(/^Thêm quà$/);
    expect(await t.isDisabled(/^Lưu$/, "[role=dialog] button"), "nút Lưu phải bị khoá khi chưa có tên");
    const titleInput = await t.ev(`const l=[...document.querySelectorAll("[role=dialog] label")].find(x=>/Tên quà/i.test(x.innerText)); const i=l?.querySelector("input"); if(!i) return false; i.id="e2e-title"; return true;`);
    expect(titleInput, "không thấy ô Tên quà");
    await t.fill("#e2e-title", `${tag} Quà đắt`);
    const priceInput = await t.ev(`const l=[...document.querySelectorAll("[role=dialog] label")].find(x=>/Giá \\(điểm\\)/i.test(x.innerText)); const i=l?.querySelector("input"); if(!i) return false; i.id="e2e-price"; return true;`);
    expect(priceInput, "không thấy ô Giá");
    await t.fill("#e2e-price", "500");
    await t.click(/^Mọi học sinh/, "[role=dialog] button");
    await t.click(/^Lưu$/, "[role=dialog] button");
    expect(await t.waitText(/Quà đắt/), "quà mới không hiện trong danh sách");
    const r = await prisma.reward.findFirst({ where: { title: `${tag} Quà đắt` } });
    expect(r && r.price === 500 && r.kind === "VIRTUAL" && !r.offlineOnly, "quà nhập tay lưu sai");
  });

  await step("Thầy: thưởng +5 điểm cho học sinh (tìm theo tên)", async () => {
    await t.click(/^Thưởng điểm$/);
    await t.fill("select", data.cls.id);
    await t.fill('input[placeholder="Tìm học sinh…"]', "Học sinh");
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    expect(await t.isDisabled(/^Thưởng \d+ điểm$/), "chưa nhập lý do mà nút thưởng không bị khoá");
    await t.click(/^\+5$/);
    await t.click(/^Phát biểu xây dựng bài$/);
    await t.click(/^Thưởng 5 điểm$/);
    expect(await t.waitText(/Đã thưởng điểm cho 1 học sinh/), "không thấy thông báo thưởng điểm");
    expect((await balanceOf(data.student.id)) === 109, "số dư sau thưởng phải 109");
  });

  await step("Thầy: thưởng quá giới hạn ngày → báo lỗi, không cộng", async () => {
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    await t.click(/^\+5$/);
    await t.click(/^Thưởng 5 điểm$/);
    await sleep(1500);
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    await t.click(/^\+5$/);
    await t.click(/^Thưởng 5 điểm$/);
    expect(await t.waitText(/Không áp dụng được/), "không báo lỗi khi vượt giới hạn");
    expect((await balanceOf(data.student.id)) === 114, `số dư phải dừng ở 114 (thực tế ${await balanceOf(data.student.id)})`);
  });
  await t.screenshot(path.join(SHOTS, "teacher-grant.png"));

  // -------------------------------------------------- Học sinh
  const s = await openBrowser({ baseUrl: BASE_URL, token: sTok });

  await step("Học sinh: màn kết quả hiện '+4 điểm thưởng' lần đầu, lần sau không hiện lại", async () => {
    await s.goto(`/watch/x/results/${data.attempt.id}`, /Chữa từng câu|Kết quả/i);
    expect(await s.waitText(/\+4 điểm thưởng/, 5000), "không thấy thông báo +4 điểm");
    await s.screenshot(path.join(SHOTS, "result-toast.png"));
    await s.goto(`/watch/x/results/${data.attempt.id}`, /Chữa từng câu|Kết quả/i);
    await sleep(1500);
    expect(!/\+4 điểm thưởng/.test(await s.text()), "thông báo hiện lại lần 2");
  });

  await step("Học sinh: chip điểm trên header + dải điểm ở trang chủ", async () => {
    await s.goto("/", /điểm thưởng/i);
    const chip = await s.ev(`return document.querySelector('header a[href="/rewards"]')?.innerText`);
    expect(chip && chip.includes("114"), `chip header sai: ${chip}`);
    const hero = await s.ev(`return document.querySelector('[data-testid="student-hero"]')?.innerText || ""`);
    expect(/Chào /.test(hero), "thiếu lời chào ở thẻ chào trang chủ");
    expect(/Cấp \d+/.test(hero), "thẻ chào thiếu cấp độ");
    expect(/Bắt đầu học|Bài gần nhất/i.test(hero), "thẻ chào thiếu khối học tiếp");
    expect(/114/.test(hero), "thẻ chào thiếu số điểm");
  });

  await step("Học sinh: trang Điểm thưởng — số dư, chỉ thấy quà dành cho mình", async () => {
    await s.goto("/rewards", /Điểm thưởng của bạn/i);
    const txt = await s.text();
    expect(txt.includes("114"), "không thấy số dư 114");
    expect(txt.includes("Kẹo / bánh nhỏ") && txt.includes("Quà đắt"), "thiếu quà");
    expect(/Còn thiếu 386 điểm/.test(txt), "quà đắt phải báo còn thiếu 386 điểm");
    const rarity = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title.replace(/^.*Quà đắt$/, "Quà đắt") + ":" + c.dataset.rarity).join(",")`);
    expect(rarity.includes("Kẹo / bánh nhỏ:common") && rarity.includes("Quà đắt:legendary"), `độ hiếm sai: ${rarity}`);
    expect(/Cấp \d+ · /.test(txt), "thanh trạng thái thiếu cấp độ");
  });

  await step("Học sinh: lọc quà theo loại (chỉ hiện lựa chọn có quà)", async () => {
    await s.click(/^✨ Đặc quyền$/);
    let titles = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title).join("|")`);
    expect(titles.includes("Quà đắt") && !titles.includes("Kẹo"), `lọc Đặc quyền sai: ${titles}`);
    await s.click(/^🏫 Nhận tại lớp$/);
    titles = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title).join("|")`);
    expect(titles.includes("Kẹo") && !titles.includes("Quà đắt"), `lọc Nhận tại lớp sai: ${titles}`);
    await s.click(/^Tất cả$/);
  });

  await step("Học sinh: ghim quà mục tiêu", async () => {
    const ok = await s.ev(`const b=[...document.querySelectorAll('[data-testid="reward-card"]')].find(c => c.dataset.title.endsWith("Quà đắt"))?.querySelector('[data-testid="pin"]'); if(!b) return false; b.click(); return true;`);
    expect(ok, "không thấy nút ghim");
    expect(await s.waitText(/Còn 386 điểm nữa/), "khối Quà mục tiêu không cập nhật");
  });

  await step("Học sinh: đổi kẹo (hộp xác nhận) → trừ điểm, hiện ở 'Quà của tôi'", async () => {
    const opened = await s.ev(`const b=document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"]')?.querySelector('[data-testid="redeem"]'); if(!b || b.disabled) return false; b.click(); return true;`);
    expect(opened, "không thấy nút đổi kẹo");
    expect(await s.waitText(/Dùng 40 điểm để đổi/), "hộp xác nhận không hiện");
    await s.click(/^Đổi quà$/, "[role=dialog] button");
    expect(await s.waitText(/Đã đổi "Kẹo \/ bánh nhỏ"/), "không thấy thông báo đổi quà");
    expect((await balanceOf(data.student.id)) === 74, "số dư sau đổi phải 74");
    expect((await s.ev(`return document.querySelector("[data-celebrated]")?.dataset.celebrated`)) === "1", "không bắn pháo giấy khi đổi quà thành công");
    await s.click(/^Quà của tôi/);
    expect(await s.waitText(/Chờ nhận quà/), "không thấy trạng thái Chờ nhận quà");
  });

  await step("Học sinh: huỷ yêu cầu → hoàn điểm", async () => {
    await s.click(/^Huỷ$/);
    expect(await s.waitText(/Đã huỷ và hoàn điểm/), "không thấy thông báo huỷ");
    expect((await balanceOf(data.student.id)) === 114, "chưa hoàn điểm");
  });

  await step("Học sinh: đổi lại kẹo (để thầy trao)", async () => {
    await s.click(/^Đổi quà$/);
    await s.ev(`document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"]').querySelector('[data-testid="redeem"]').click();`);
    await sleep(800);
    await s.click(/^Đổi quà$/, "[role=dialog] button");
    expect(await s.waitText(/Đã đổi/), "đổi lại thất bại");
  });

  // -------------------------------------------------- Thầy trao / từ chối
  await step("Thầy: từ chối bắt buộc lý do; trao quà hàng loạt", async () => {
    await t.goto("/teacher/rewards", /quà đang chờ trao/i);
    // Từ chối: chưa nhập lý do thì nút khoá
    await t.click(/^Từ chối$/);
    expect(await t.isDisabled(/^Từ chối & hoàn điểm$/, "[role=dialog] button"), "nút từ chối không bị khoá khi thiếu lý do");
    await t.click(/^Thôi$/, "[role=dialog] button");
    await t.click(/^Chọn tất cả$/, "label");
    await t.click(/^Đã trao \(\d+\)$/);
    expect(await t.waitText(/Đã đánh dấu \d+ quà đã trao/), "không thấy thông báo đã trao");
    const red = await prisma.redemption.findFirst({ where: { userId: data.student.id, status: "DELIVERED" } });
    expect(red, "yêu cầu chưa chuyển sang Đã trao");
  });

  await step("Học sinh: thấy 'Đã nhận' và thông báo", async () => {
    await s.goto("/rewards", /Điểm thưởng của bạn/i);
    await s.click(/^Quà của tôi/);
    expect(await s.waitText(/Đã nhận/), "không thấy trạng thái Đã nhận");
    const n = await prisma.notification.count({ where: { userId: data.student.id, title: { contains: "Đã nhận quà" } } });
    expect(n === 1, "thiếu thông báo đã nhận quà");
  });

  await step("Thầy: thống kê tháng có số liệu", async () => {
    await t.goto("/teacher/rewards", /Quà & Điểm thưởng/i);
    await t.click(/^Thống kê$/);
    expect(await t.waitText(/Chăm chỉ nhất tháng này/i), "không thấy bảng thống kê");
  });

  await step("Học sinh: đổi thêm một món (để đo bố cục khi có đơn đang chờ)", async () => {
    await s.goto("/rewards", /Điểm thưởng của bạn/i);
    await s.ev(`document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"] [data-testid="redeem"]').click();`);
    await sleep(800);
    await s.click(/^Đổi quà$/, "[role=dialog] button");
    expect(await s.waitText(/Đã đổi/), "đổi thêm thất bại");
  });

  // -------------------------------------------------- Bố cục nhiều cỡ màn hình
  const sizes = [
    [320, 640],
    [360, 740],
    [390, 844],
    [414, 896],
    [768, 1024],
    [1366, 900],
    [1920, 1080],
  ];
  for (const [w, h] of sizes) {
    await step(`Bố cục ${w}px: không tràn ngang (học sinh: /rewards, trang chủ; thầy: 4 tab)`, async () => {
      const problems = [];
      await s.setSize(w, h);
      for (const [p, ready] of [["/rewards", /Điểm thưởng của bạn/i], ["/", /điểm thưởng/i]]) {
        await s.goto(p, ready);
        for (const tab of p === "/rewards" ? ["Đổi quà", "Quà của tôi", "Lịch sử điểm", "Cách nhận điểm"] : [null]) {
          if (tab) await s.click(new RegExp("^" + tab), "button");
          for (const x of await s.layoutProblems()) problems.push(`HS ${p} ${tab ?? ""}: ${x}`);
        }
        await s.screenshot(path.join(SHOTS, `student-${p === "/" ? "home" : "rewards"}-${w}.png`));
      }
      // Chip điểm không đè lên logo
      const overlap = await s.ev(`const a=document.querySelector('header a[href="/rewards"]')?.getBoundingClientRect(); const b=document.querySelector('header a[href="/"]')?.getBoundingClientRect(); if(!a||!b) return "thiếu chip/logo"; return (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) ? "chip đè logo" : "";`);
      if (overlap) problems.push(`HS header: ${overlap}`);
      await t.setSize(w, h);
      await t.goto("/teacher/rewards", /Quà & Điểm thưởng/i);
      for (const tab of ["Yêu cầu đổi quà", "Quản lý quà", "Thưởng điểm", "Thống kê"]) {
        await t.click(new RegExp("^" + tab), "button");
        for (const x of await t.layoutProblems()) problems.push(`GV ${tab}: ${x}`);
      }
      await t.screenshot(path.join(SHOTS, `teacher-${w}.png`));
      expect(problems.length === 0, problems.join("\n    "));
    });
  }

  await step("Không có lỗi JavaScript trên trình duyệt", async () => {
    const all = [...t.errors, ...s.errors];
    expect(all.length === 0, all.join("\n    "));
  });

  await t.close();
  await s.close();
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log(`\n${results.length - failed}/${results.length} bước đạt. Ảnh chụp: ${SHOTS}`);
process.exit(failed ? 1 : 0);
