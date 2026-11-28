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
  await prisma.course.deleteMany({ where: { title: { startsWith: "e2e-points-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-points-" } } });
  await prisma.studyClass.deleteMany({ where: { name: { startsWith: "e2e-points-" } } });
}

async function setup() {
  await cleanupStale();
  // Khối 7: không trùng khối thật (10–12) của DB local → Bảng Vàng khối 7 chỉ có dữ liệu thử
  const cls = await prisma.studyClass.create({ data: { name: `${tag} lớp`, grade: 7 } });
  const student = await prisma.user.create({
    data: { email: `${tag}-hs@test.local`, name: `${tag} Học sinh`, role: "STUDENT", isApproved: true, studentType: "OFFLINE", classId: cls.id },
  });
  const teacher = await prisma.user.create({ data: { email: `${tag}-gv@test.local`, name: `${tag} Thầy`, role: "TEACHER", isApproved: true } });
  // Học sinh đã có 1 lượt làm bài được +600 xu (để thử mưa xu ở màn kết quả)
  const test = await prisma.test.create({
    data: { title: `${tag} Bài kiểm tra`, pdfUrl: "x.pdf", duration: 10, sections: { create: [{ name: "Phần 1", questions: { create: [{ type: "MULTIPLE_CHOICE", points: 1, position: 0, correctAnswer: "A" }] } }] } },
  });
  const attempt = await prisma.studentAttempt.create({ data: { testId: test.id, userId: student.id, score: 9, startedAt: new Date(Date.now() - 600000), completedAt: new Date() } });
  await prisma.pointLedger.createMany({
    data: [
      { userId: student.id, amount: 300, source: "TEST_SUBMIT", key: `TEST:${test.id}`, refId: attempt.id, reason: "Nộp bài" },
      { userId: student.id, amount: 300, source: "TEST_SCORE", key: `TESTSCORE:${test.id}`, refId: attempt.id, reason: "Đạt 9 điểm" },
      // Ghi lùi 2 ngày để không chiếm giới hạn thưởng tay của hôm nay
      { userId: student.id, amount: 15000, source: "MANUAL", reason: "E2E: giả lập tích xu", createdAt: new Date(Date.now() - 2 * 86400000) },
    ],
  });
  await prisma.pointWallet.create({ data: { userId: student.id, balance: 15600, lifetimeEarned: 15600 } });
  // Quà túi giấy ăn (mở nhiệm vụ ẩn "Người Mở Đường Khăn Giấy") — có tranh riêng, không lấy nhầm tranh túi đeo chéo
  await prisma.reward.create({ data: { title: `${tag} Túi Giấy Ăn Nhỏ Hoạt Hình`, price: 10000, kind: "PHYSICAL", stock: 5 } });
  // Bài có bài tập về nhà trong khoá học của lớp (trang Duyệt chữa bài)
  const course = await prisma.course.create({ data: { title: `${tag} Khoá`, userId: teacher.id, isPublished: true, classes: { connect: [{ id: cls.id }] } } });
  const chapter = await prisma.chapter.create({ data: { title: `${tag} Chương`, courseId: course.id, isPublished: true } });
  const hwLesson = await prisma.lesson.create({ data: { title: `${tag} BTVN`, chapterId: chapter.id, hasHomework: true, isPublished: true } });
  return { cls, student, teacher, attempt, test, hwLesson };
}

async function cleanup() {
  // Cấu hình giá / mức xu thử trên giao diện (bước admin) — xoá nếu bước bị dừng giữa chừng
  await prisma.gameConfig.deleteMany({ where: { key: { in: ["itemPrices", "earning", "chests"] } } }).catch(() => {});
  await prisma.reward.deleteMany({ where: { title: { startsWith: tag } } });
  // Quà tạo từ mẫu trên giao diện mang tên mẫu → xoá theo người tạo
  const teacher = await prisma.user.findUnique({ where: { email: `${tag}-gv@test.local` } });
  if (teacher) {
    await prisma.reward.deleteMany({ where: { createdById: teacher.id } });
    await prisma.giftCode.deleteMany({ where: { createdById: teacher.id } });
  }
  await prisma.test.deleteMany({ where: { title: { startsWith: tag } } });
  await prisma.course.deleteMany({ where: { title: { startsWith: tag } } });
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

  await step("Thầy: link cũ /teacher/rewards chuyển vào khu Quản lý tiệm trong Tiệm quà (giáo viên cũng quản lý được)", async () => {
    await t.goto("/teacher/rewards", /Quản lý tiệm/i);
    expect(await t.ev(`return location.pathname === "/rewards" && new URLSearchParams(location.search).has("manage") && !!document.querySelector('[data-testid="reward-manager"]')`), "không chuyển vào khu quản lý trong tiệm");
    expect(await t.ev(`return !document.querySelector('[data-testid="mgr-tab-prices"]') && !document.querySelector('[data-testid="mgr-tab-earning"]')`), "giáo viên không được thấy mục giá đồ / mức xu (chỉ admin)");
    expect(await t.ev(`return document.querySelector('[data-testid="mgr-review-link"]')?.getAttribute("href") === "/teacher/homework/check"`), "thiếu nút sang trang Duyệt chữa bài");
    await t.ev(`document.querySelector('[data-testid="mgr-tab-rewards"]').click()`);
    await sleep(300);
    expect(new URL(await t.ev(`return location.href`)).searchParams.get("manage") === "rewards", "địa chỉ trang không giữ mục đang mở");
  });

  await step("Thầy: thêm quà từ mẫu 'Kẹo / bánh nhỏ'", async () => {
    await t.ev(`document.querySelector('[data-testid="mgr-templates"]').open = true`);
    await sleep(200);
    await t.click(/Kẹo \/ bánh nhỏ/, '[data-testid="mgr-template"]');
    await t.ev(`document.querySelector('[data-testid="ed-save"]').click()`);
    expect(await t.waitText(/Đã thêm quà/), "không thấy thông báo Đã thêm quà");
    const r = await prisma.reward.findFirst({ where: { createdById: data.teacher.id, title: "Kẹo / bánh nhỏ" } });
    // 26/11: giá mẫu = tiền thật ÷ 3,6 (kẹo 3.000đ → 900 xu)
    expect(r && r.price === 900 && r.offlineOnly, `quà mẫu lưu sai: ${r?.price}`);
  });

  await step("Thầy: form thêm quà — chưa nhập tên thì không lưu được; nhập đủ thì lưu", async () => {
    await sleep(800);
    await t.ev(`document.querySelector('[data-testid="mgr-new"]').click()`);
    await sleep(300);
    expect(await t.ev(`return document.querySelector('[data-testid="ed-save"]').disabled`), "nút Lưu phải bị khoá khi chưa có tên");
    await t.fill('[data-testid="ed-title"]', `${tag} Quà đắt`);
    await t.ev(`document.querySelector('[data-testid="ed-kind-VIRTUAL"]').click()`);
    await sleep(200);
    await t.fill('[data-testid="ed-price"]', "50000");
    await t.ev(`const c=document.querySelector('[data-testid="ed-offline"]'); if(c?.checked) c.click(); return true`);
    await sleep(300);
    const ed = await t.ev(`return { price: document.querySelector('[data-testid="ed-price"]').value, offline: document.querySelector('[data-testid="ed-offline"]')?.checked }`);
    expect(ed.price === "50000" && ed.offline === false, `form chưa đúng trước khi lưu: ${JSON.stringify(ed)}`);
    await t.ev(`document.querySelector('[data-testid="ed-save"]').click()`);
    // Ô xem trước trong form đã có tên quà → chờ form đóng và thẻ quà mới hiện trong khu quản lý
    let shown = false;
    for (let i = 0; i < 40 && !shown; i++) {
      shown = await t.ev(`return !document.querySelector('[data-testid="reward-editor"]') && !!document.querySelector('[data-testid="mgr-card"][data-title="${tag} Quà đắt"]')`);
      if (!shown) await sleep(250);
    }
    expect(shown, "quà mới không hiện trong danh sách");
    const r = await prisma.reward.findFirst({ where: { title: `${tag} Quà đắt` } });
    expect(r && r.price === 50000 && r.kind === "VIRTUAL" && !r.offlineOnly, `quà nhập tay lưu sai: ${JSON.stringify(r && { price: r.price, kind: r.kind, offlineOnly: r.offlineOnly })}`);
  });

  await step("Thầy: thưởng +100 xu cho học sinh (tìm theo tên, gõ không dấu)", async () => {
    await t.ev(`document.querySelector('[data-testid="mgr-tab-grant"]').click()`);
    await sleep(300);
    await t.fill('[data-testid="grant-class"]', data.cls.id);
    await t.fill('[data-testid="grant-search"]', "hoc sinh");
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    expect(await t.ev(`return document.querySelector('[data-testid="grant-submit"]').disabled`), "chưa nhập lý do mà nút thưởng không bị khoá");
    await t.click(/^\+100$/);
    await t.click(/^Phát biểu xây dựng bài$/);
    await t.click(/Thưởng 100 xu$/);
    expect(await t.waitText(/Đã thưởng xu cho 1 học sinh/), "không thấy thông báo thưởng xu");
    expect((await balanceOf(data.student.id)) === 15700, "số dư sau thưởng phải 15700");
  });

  await step("Thầy: thưởng quá giới hạn ngày (500 xu) → cộng phần còn lại rồi báo lỗi", async () => {
    for (let i = 0; i < 2; i++) {
      await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
      await t.click(/^\+300$/);
      await t.click(/Thưởng 300 xu$/);
      await sleep(1500);
    }
    expect((await balanceOf(data.student.id)) === 16100, `sau 100+300+100 (trần ngày 500) phải 16100 (thực tế ${await balanceOf(data.student.id)})`);
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    await t.click(/^\+100$/);
    await t.click(/Thưởng 100 xu$/);
    expect(await t.waitText(/Không áp dụng được/), "không báo lỗi khi vượt giới hạn");
    expect((await balanceOf(data.student.id)) === 16100, `số dư phải dừng ở 16100 (thực tế ${await balanceOf(data.student.id)})`);
  });

  let giftCodes = [];
  await step("Thầy: tạo lô 10 thẻ cào × 3 ngọc, in được", async () => {
    await t.ev(`document.querySelector('[data-testid="mgr-tab-codes"]').click()`);
    await sleep(300);
    // 26/11: mặc định tặng xu → chọn Ngọc cho lô thẻ cào điểm 10
    await t.ev(`document.querySelector('[data-testid="giftcode-cur-GEM"]').click()`);
    await sleep(300);
    await t.click(/^Tạo 10 mã/);
    expect(await t.waitText(/Vừa tạo 10 mã/), "không thấy lô mã vừa tạo");
    const rows = await prisma.giftCode.findMany({ where: { createdById: data.teacher.id }, select: { code: true, amount: true, currency: true } });
    expect(rows.length === 10 && rows.every((r) => r.amount === 3 && r.currency === "GEM"), "lô mã lưu sai");
    giftCodes = rows.map((r) => r.code);
    expect(await t.waitText(/10 mã còn dùng được/), "danh sách lô không cập nhật");
  });
  await t.screenshot(path.join(SHOTS, "teacher-grant.png"));

  // -------------------------------------------------- Học sinh
  const s = await openBrowser({ baseUrl: BASE_URL, token: sTok });

  await step("Học sinh: màn kết quả hiện mưa xu '+600 xu' lần đầu, lần sau không hiện lại", async () => {
    await s.goto(`/watch/x/results/${data.attempt.id}`, /Chữa từng câu|Kết quả/i);
    expect(await s.waitText(/\+600 xu/, 6000), "không thấy thông báo +600 xu");
    expect((await s.ev(`return document.querySelector('[data-testid="coin-burst"]')?.dataset.active`)) !== undefined, "thiếu khung mưa xu");
    await s.screenshot(path.join(SHOTS, "result-toast.png"));
    await s.goto(`/watch/x/results/${data.attempt.id}`, /Chữa từng câu|Kết quả/i);
    await sleep(1500);
    expect(!/\+600 xu/.test(await s.text()), "thông báo hiện lại lần 2");
  });

  await step("Học sinh: chip xu trên header + thẻ chào ở trang chủ", async () => {
    await s.goto("/", /Tiệm quà/i);
    const chip = await s.ev(`return document.querySelector('header [data-wallet-chip]')?.innerText`);
    expect(chip && chip.includes("16.100"), `chip header sai: ${chip}`);
    const hero = await s.ev(`return document.querySelector('[data-testid="student-hero"]')?.innerText || ""`);
    expect(/Chào /.test(hero), "thiếu lời chào ở thẻ chào trang chủ");
    expect(/Chó rách|Trứng bắc thảo|đẳng cấp|thần hào|999 Tỷ Xu/.test(hero), "thẻ chào thiếu danh hiệu");
    expect(/Bắt đầu học|Bài gần nhất/i.test(hero), "thẻ chào thiếu khối học tiếp");
    expect(/16\.100/.test(hero), "thẻ chào thiếu số xu");
  });

  await step("Học sinh: nhập thẻ cào → +3 ngọc; nhập lại → báo đã dùng; chip header hiện ngọc", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="code-open"]').click()`);
    expect(await s.waitText(/Thẻ cào Điểm 10 & Code/i), "mục thẻ cào không mở");
    expect(await s.ev(`return !!document.querySelector('[data-testid="scratch-canvas"]')`), "thiếu lớp nhũ bạc để cào");
    await s.ev(`document.querySelector('[data-testid="scratch-skip"]').click()`);
    await s.fill('[data-testid="giftcode-input"]', giftCodes[0].toLowerCase());
    await s.click(/^Nhận quà$/, '[data-testid="scratch-open"] button');
    expect(await s.waitText(/\+3 ngọc/), "không thấy +3 ngọc");
    const w = await prisma.pointWallet.findUnique({ where: { userId: data.student.id } });
    expect(w && w.gems === 3 && w.balance === 16100, `ví sai sau nhập mã: ${JSON.stringify(w)}`);
    await s.click(/^Nhập mã khác$/, '[data-testid="scratch-open"] button');
    await s.fill('[data-testid="giftcode-input"]', giftCodes[0]);
    await s.click(/^Nhận quà$/, '[data-testid="scratch-open"] button');
    expect(await s.waitText(/đã dùng mã này/i), "nhập lại không báo đã dùng");
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    const gems = await s.ev(`return document.querySelector('[data-testid="hud-gems"]')?.innerText || ""`);
    expect(/3/.test(gems), `chip ngọc trên header sai: ${gems}`);
  });

  await step("Học sinh: trang Tiệm quà — số dư, chỉ thấy quà dành cho mình", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    const txt = await s.text();
    expect(txt.includes("16.100"), "không thấy số dư 16.100");
    expect(txt.includes("Kẹo / bánh nhỏ") && txt.includes("Quà đắt"), "thiếu quà");
    const note = await s.ev(`[...document.querySelectorAll('[data-testid="reward-card"]')].find(c => c.dataset.title.endsWith("Quà đắt"))?.click(); await new Promise(r=>setTimeout(r,200)); return document.querySelector('[data-testid="shop-detail"] [data-testid="detail-note"]')?.innerText || ""`);
    expect(/còn thiếu 33\.900 xu/i.test(note), `quà đắt phải báo còn thiếu 33.900 xu: ${note}`);
    const rarity = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title.replace(/^.*Quà đắt$/, "Quà đắt") + ":" + c.dataset.rarity).join(",")`);
    expect(rarity.includes("Kẹo / bánh nhỏ:common") && rarity.includes("Quà đắt:legendary"), `độ hiếm sai: ${rarity}`);
    expect(/Chó rách|Trứng bắc thảo|đẳng cấp|thần hào|999 Tỷ Xu/.test(txt), "thanh trạng thái thiếu danh hiệu");
  });

  await step("Học sinh: danh mục bên trái lọc đúng (Thẻ đặc quyền / Quà hiện vật / Mèo Cún / Hộp bí ẩn)", async () => {
    await s.ev(`document.querySelector('[data-testid="cat-voucher"]').click()`);
    await sleep(300);
    let titles = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title).join("|")`);
    expect(titles.includes("Quà đắt") && !titles.includes("Kẹo"), `lọc Thẻ đặc quyền sai: ${titles}`);
    await s.ev(`document.querySelector('[data-testid="cat-physical"]').click()`);
    await sleep(300);
    titles = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title).join("|")`);
    expect(titles.includes("Kẹo") && !titles.includes("Quà đắt"), `lọc Quà hiện vật sai: ${titles}`);
    await s.ev(`document.querySelector('[data-testid="cat-pet"]').click()`);
    await sleep(300);
    const pets = await s.ev(`return [...document.querySelectorAll('[data-testid="item-card"]')].map(c => c.dataset.item).join("|")`);
    expect(pets.includes("pet-snow") && pets.includes("pet-bi") && !pets.includes("hair-spiky"), `danh mục Mèo Cún sai: ${pets}`);
    expect(pets.includes("pet-redpanda"), `thiếu Gấu Trúc Đỏ của canvas: ${pets}`);
    await s.ev(`document.querySelector('[data-testid="cat-box"]').click()`);
    await sleep(300);
    expect(await s.ev(`return document.querySelectorAll('[data-testid="chest-card"]').length === 2`), "Hộp bí ẩn phải có 2 hộp");
    await s.ev(`document.querySelector('[data-testid="cat-all"]').click()`);
    await sleep(300);
  });

  await step("Học sinh: ghim quà mục tiêu; vuốt ve mèo đổi câu thoại", async () => {
    const ok = await s.ev(`const c=[...document.querySelectorAll('[data-testid="reward-card"]')].find(c => c.dataset.title.endsWith("Quà đắt")); if(!c) return false; c.click(); await new Promise(r=>setTimeout(r,200)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid="pin"]'); if(!b) return false; b.click(); return true;`);
    expect(ok, "không thấy nút ghim");
    await sleep(1500);
    const w = await prisma.pointWallet.findUnique({ where: { userId: data.student.id } });
    const expensive = await prisma.reward.findFirst({ where: { title: `${tag} Quà đắt` } });
    expect(w && expensive && w.goalRewardId === expensive.id, "chưa ghim mục tiêu vào ví");
    const before = await s.ev(`return document.querySelector('[data-testid="pet-line"]')?.innerText`);
    await s.ev(`document.querySelector('[data-testid="pet-card"]').click()`);
    await sleep(300);
    const after = await s.ev(`return document.querySelector('[data-testid="pet-line"]')?.innerText`);
    expect(before && after && before !== after, "vuốt ve mèo không đổi câu thoại");
  });

  await step("Học sinh: đổi kẹo (hộp chi tiết báo số dư sau khi đổi) → trừ xu, hiện ở Túi đồ", async () => {
    const note = await s.ev(`document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"]')?.click(); await new Promise(r=>setTimeout(r,200)); return document.querySelector('[data-testid="shop-detail"] [data-testid="detail-note"]')?.innerText || ""`);
    expect(/Số dư sau khi đổi: 15\.200 xu/.test(note), `hộp chi tiết thiếu số dư sau khi đổi: ${note}`);
    const opened = await s.ev(`const b=document.querySelector('[data-testid="shop-detail"] [data-testid="redeem"]'); if(!b || b.disabled) return false; b.click(); return true;`);
    expect(opened, "không thấy nút đổi kẹo");
    expect(await s.waitText(/Đã đổi "Kẹo \/ bánh nhỏ"/), "không thấy thông báo đổi quà");
    expect((await balanceOf(data.student.id)) === 15200, "số dư sau đổi phải 15200");
    expect((await s.ev(`return document.querySelector("[data-celebrated]")?.dataset.celebrated`)) === "1", "không bắn pháo giấy khi đổi quà thành công");
    await s.ev(`document.querySelector('[data-testid="bag-open"]').click()`);
    expect(await s.waitText(/Chờ nhận quà/), "không thấy trạng thái Chờ nhận quà trong túi đồ");
  });

  await step("Học sinh: huỷ yêu cầu → hoàn xu", async () => {
    await s.click(/^Huỷ$/);
    expect(await s.waitText(/Đã huỷ và hoàn xu/), "không thấy thông báo huỷ");
    expect((await balanceOf(data.student.id)) === 16100, "chưa hoàn xu");
  });

  await step("Học sinh: đổi lại kẹo (để thầy trao)", async () => {
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]')?.click()`);
    await sleep(400);
    const clicked = await s.ev(`document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"]').click(); for (let i = 0; i < 50; i++) { await new Promise(r=>setTimeout(r,100)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid="redeem"]'); if (b && !b.disabled) { b.click(); return true; } } return false;`);
    expect(clicked, "nút đổi kẹo không bấm được");
    expect(await s.waitText(/Đã đổi "Kẹo/), "đổi lại thất bại");
    let pendingN = 0;
    for (let i = 0; i < 20 && pendingN === 0; i++) {
      pendingN = await prisma.redemption.count({ where: { userId: data.student.id, status: "PENDING" } });
      if (!pendingN) await sleep(250);
    }
    expect(pendingN === 1, `phải có đúng 1 yêu cầu chờ trao (thực tế ${pendingN})`);
  });

  // -------------------------------------------------- Thầy trao / từ chối
  await step("Thầy: từ chối bắt buộc lý do; trao quà hàng loạt", async () => {
    await t.goto("/rewards?manage=requests", /quà đang chờ trao/i);
    // Từ chối: chưa nhập lý do thì nút khoá
    await t.ev(`document.querySelector('[data-testid="req-reject"]').click()`);
    await sleep(300);
    expect(await t.ev(`return document.querySelector('[data-testid="reject-confirm"]').disabled`), "nút từ chối không bị khoá khi thiếu lý do");
    await t.click(/^Thôi$/, "[role=dialog] button");
    await t.click(/^Chọn tất cả$/, "label");
    await t.click(/Đã trao \(\d+\)$/);
    expect(await t.waitText(/Đã đánh dấu \d+ quà đã trao/), "không thấy thông báo đã trao");
    const red = await prisma.redemption.findFirst({ where: { userId: data.student.id, status: "DELIVERED" } });
    expect(red, "yêu cầu chưa chuyển sang Đã trao");
  });

  await step("Học sinh: thấy 'Đã nhận' và thông báo", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="bag-open"]').click()`);
    expect(await s.waitText(/Đã nhận/), "không thấy trạng thái Đã nhận");
    const n = await prisma.notification.count({ where: { userId: data.student.id, title: { contains: "Đã nhận quà" } } });
    expect(n === 1, "thiếu thông báo đã nhận quà");
  });

  await step("Thầy: thống kê tháng có số liệu", async () => {
    await t.goto("/rewards?manage=stats", /Quản lý tiệm/i);
    expect(await t.waitText(/Chăm chỉ nhất tháng này/i), "không thấy bảng thống kê");
  });

  await step("Học sinh: đổi thêm một món (để đo bố cục khi có đơn đang chờ)", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    const clicked = await s.ev(`document.querySelector('[data-testid="reward-card"][data-title="Kẹo / bánh nhỏ"]').click(); for (let i = 0; i < 50; i++) { await new Promise(r=>setTimeout(r,100)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid="redeem"]'); if (b && !b.disabled) { b.click(); return true; } } return false;`);
    expect(clicked, "nút đổi kẹo không bấm được");
    expect(await s.waitText(/Đã đổi "Kẹo/), "đổi thêm thất bại");
  });

  await step("Học sinh: hộp Nộp bài liệt kê bài chưa nộp; hộp Bảng Vàng Khối có tab khối 7", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="tasks-open"]').click()`);
    expect(await s.waitText(/Nộp bài tập nhận xu/), "mục Nộp bài không mở");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="board-open"]').click()`);
    expect(await s.waitText(/Bảng Vàng Server Khối/), "mục Bảng Vàng không mở");
    expect(await s.ev(`return !!document.querySelector('[data-testid="board-g7"]')`), "thiếu tab khối 7");
    expect(await s.ev(`return document.querySelector('[data-testid="leaderboard-modal"]')?.getAttribute("role") === "dialog"`), "Bảng Vàng phải là hộp nổi như mẫu Gemini");
    await sleep(700);
    await s.screenshot(path.join(SHOTS, "gold-modal.png"));
    expect(/Học sinh/.test(await s.ev(`return document.querySelector('[data-testid="leaderboard-modal"]')?.innerText || ""`)), "bảng khối 7 không có mình");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="history-open"]').click()`);
    expect(await s.waitText(/Lịch Sử & Cách Kiếm Xu/), "hộp Lịch sử không mở");
    expect(await s.waitText(/Nộp bài/), "lịch sử trống");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
  });

  // -------------------------------------------------- Nhân vật & hồ sơ
  await step("Học sinh: tiệm → lọc 'Trang trí hồ sơ' → mua tóc dựng (900 xu)", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="cat-deco"]').click()`);
    expect(await s.waitText(/Chỉ từ Hộp bí ẩn/i), "không thấy lưới đồ trang trí");
    const before = await balanceOf(data.student.id);
    const ok = await s.ev(`document.querySelector('[data-testid="item-card"][data-item="hair-spiky"]')?.click(); await new Promise(r=>setTimeout(r,200)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid="shop-buy-hair-spiky"]'); if(!b||b.disabled) return false; b.click(); return true;`);
    expect(ok, "không bấm được nút mua tóc dựng");
    expect(await s.waitText(/Đã mua "Tóc dựng"/), "không thấy thông báo đã mua");
    expect((await balanceOf(data.student.id)) === before - 900, "chưa trừ 900 xu");
    const own = await prisma.userItem.findFirst({ where: { userId: data.student.id, itemId: "hair-spiky" } });
    expect(own, "chưa có món trong túi");
    expect(await s.waitText(/Đã có/), "thẻ món không chuyển sang Đã có");
  });

  await step("Học sinh: Hồ sơ & Trang trí — mặc tóc dựng, thử kính → mua tại chỗ (450 xu), lưu; vương miện thiếu ngọc thì khoá; /profile/avatar chuyển về /profile", async () => {
    await s.goto("/profile", /Tủ đồ & Cửa hàng/i);
    const click = (id) => s.ev(`const b=document.querySelector('[data-testid="${id}"]'); if(!b||b.disabled) return false; b.click(); return true;`);
    expect(await click("char-custom"), "không có nút Tuỳ chỉnh tóc & mắt");
    await sleep(200);
    expect(await click("item-hair-spiky"), "không có ô tóc dựng");
    expect(await click("item-acc-glasses"), "không có ô kính");
    expect(await s.waitText(/1 vật phẩm chưa sở hữu · 450 xu/), "thanh hành động không báo món đang thử");
    // đeo kính vẫn giữ đầu tóc dựng vẽ tay, kính vẽ chồng lên (lỗi cũ: đeo phụ kiện → đổi sang nhân vật SVG, mất kiểu tóc)
    expect(await s.ev(`return !!document.querySelector('[data-testid="profile-banner"] [data-head="13"] [data-acc="acc-glasses"]')`), "đeo kính phải giữ tóc dựng vẽ tay");
    expect(await s.ev(`return document.querySelector('[data-testid="profile-banner"] svg[role="img"]') !== null`), "banner thiếu nhân vật xem trước");
    const before = await balanceOf(data.student.id);
    expect(await click("decor-buy"), "không bấm được Mua & lưu");
    expect(await s.waitText(/Đã mua cả bộ \(1 món\)/), "không thấy thông báo mua");
    expect(await s.waitText(/Đã lưu trang trí/), "Mua & lưu chưa lưu trang trí");
    expect((await balanceOf(data.student.id)) === before - 450, "chưa trừ 450 xu");
    const av = await prisma.userAvatar.findUnique({ where: { userId: data.student.id } });
    expect(av && av.config.hair === "hair-spiky" && av.config.accessory === "acc-glasses", `cấu hình lưu sai: ${JSON.stringify(av?.config)}`);
    // Thử vương miện 10 ngọc (học sinh có 3 ngọc) → nút mua khoá; hoàn tác về bản đã lưu
    expect(await click("item-acc-crown"), "không có ô vương miện");
    await sleep(200);
    expect(await s.ev(`return !!document.querySelector('[data-testid="decor-buy"]')?.disabled`), "vương miện 10 ngọc phải bị khoá (chỉ có 3 ngọc)");
    expect(await click("decor-reset"), "không hoàn tác được");
    expect(await s.waitText(/Đã lưu trang trí|Không có thay đổi/), "hoàn tác chưa về bản đã lưu");
    expect(await s.ev(`return !document.querySelector('[data-testid="decor-reset"]')`), "hoàn tác xong vẫn còn thay đổi");
    // Tab Cài đặt tài khoản vẫn có form cũ; đường dẫn cũ chuyển hướng
    expect(await click("tab-settings"), "thiếu tab Cài đặt tài khoản");
    expect(await s.waitText(/Thông tin cá nhân/), "tab cài đặt thiếu form thông tin");
    const res = await fetch(BASE_URL + "/profile/avatar", { headers: { cookie: `authjs.session-token=${sTok}` }, redirect: "manual" });
    expect([307, 308].includes(res.status) && /\/profile$/.test(res.headers.get("location") ?? ""), `/profile/avatar phải chuyển về /profile (${res.status} ${res.headers.get("location")})`);
  });

  await step("Học sinh: đổi màu tóc / thay áo / đổi kiểu tóc vẫn giữ nhân vật vẽ tay; khuôn mặt riêng (mắt, miệng, sticker) → lưu được", async () => {
    await s.goto("/profile", /Tủ đồ & Cửa hàng/i);
    const click = (id) => s.ev(`const b=document.querySelector('[data-testid="${id}"]'); if(!b||b.disabled) return false; b.click(); return true;`);
    const hero = (sel) => s.ev(`return !!document.querySelector('[data-testid="profile-banner"] ${sel}')`);
    expect(await click("char-preset"), "thiếu nút Mẫu có sẵn");
    await sleep(200);
    expect(await click("preset-preset-student"), "thiếu mẫu Học sinh nam");
    await sleep(200);
    expect(await hero(`[data-painted="preset-student"]:not([data-hair])`), "mẫu Học sinh nam chưa vẽ bằng tranh");
    expect(await click("char-custom"), "thiếu nút Tuỳ chỉnh");
    await sleep(200);
    expect(await click("item-hc-black"), "thiếu màu tóc Đen");
    await sleep(200);
    expect(await hero(`[data-painted="preset-student"][data-hair="hc-black"]`), "đổi màu tóc phải giữ tranh Học sinh nam và tô lại tóc");
    expect(await click("item-outfit-tee"), "thiếu Áo phông");
    await sleep(200);
    expect(await hero(`[data-painted="preset-student"] [data-body="outfit-tee"]`), "thay áo phông phải giữ đầu Học sinh nam, chỉ đổi thân");
    // Tùy chỉnh không còn hàng "mặt của mẫu" (muốn mặt mẫu thì chọn nguyên mẫu)
    expect(!(await s.ev(`return !!document.querySelector('[data-testid="face-preset-kimono"]')`)), "Tùy chỉnh không được còn nút chọn mặt của mẫu");
    // Giới tính: Nam chỉ thấy 10 kiểu tóc nam; kiểu mới (Rẽ ngôi lệch) vẽ tay trên đầu nam
    const hairIds = () => s.ev(`return [...document.querySelectorAll('[data-testid^="item-hair-"]')].map((b) => b.dataset.testid.slice(5))`);
    let hs = await hairIds();
    expect(hs.length === 10 && hs.includes("hair-sidepart") && !hs.includes("hair-bob"), `Nam phải có đúng 10 kiểu tóc nam: ${hs}`);
    // thẻ kiểu tóc có ảnh (đầu nhân vật đội thử kiểu tóc, vẽ tay) + nhãn Mới cho kiểu mới
    expect(await s.ev(`const c=document.querySelector('[data-testid="item-hair-sidepart"]'); return !!c && c.dataset.badge === "Mới" && !!c.querySelector('[data-head="16"]')`), "thẻ Rẽ ngôi lệch thiếu ảnh vẽ tay / nhãn Mới");
    expect(await click("item-hair-sidepart"), "thiếu Rẽ ngôi lệch");
    await sleep(200);
    expect(await hero(`[data-head="16"][data-painted="preset-student"]`), "Rẽ ngôi lệch phải vẽ tay trên đầu nam");
    expect(await click("gender-female"), "thiếu nút Nữ");
    await sleep(250);
    hs = await hairIds();
    expect(hs.length === 10 && hs.includes("hair-pixie") && !hs.includes("hair-short"), `Nữ phải có đúng 10 kiểu tóc nữ: ${hs}`);
    expect(await hero(`[data-head="8"]`), "chọn Nữ → kiểu tóc chuyển về tóc bob");
    await s.screenshot(path.join(SHOTS, "profile-female.png"));
    expect(await click("item-hair-ponytail"), "thiếu Tóc đuôi ngựa");
    await sleep(200);
    await s.screenshot(path.join(SHOTS, "profile-ponytail.png"));
    expect(await hero(`[data-head="9"] [data-hairback="9"]`), "đuôi ngựa phải vẽ bằng đầu vẽ tay + tóc sau lưng (không ra nhân vật SVG)");
    expect(await hero(`[data-head="9"][data-painted="preset-kimono"]`), "tóc nữ dùng đầu + mặt nữ");
    expect(await click("item-hair-bob"), "thiếu Tóc bob");
    await sleep(200);
    expect(await hero(`[data-head="8"]`), "tóc bob phải vẽ bằng đầu tóc bob vẽ tay");
    // Khuôn mặt riêng: mắt to long lanh + miệng mèo + sticker sao → vẫn đầu vẽ tay
    expect(await click("eyeShape-big") && (await click("mouth-cat")) && (await click("faceDeco-star")), "thiếu nút Mắt / Miệng / Trang điểm");
    await sleep(250);
    expect(await hero(`[data-head="8"] [data-eyeshape="big"][data-mouth="cat"][data-deco="star"]`), "phối mắt/miệng/sticker phải vẽ trên đầu tóc bob");
    expect(await click("skinTone-tan") && (await click("brows-thick")), "thiếu nút Màu da / Lông mày");
    await sleep(250);
    expect(await hero(`[data-head="8"] [data-brows="thick"]`) && (await hero(`[data-head="8"] mask image[href*="char-skin"]`)), "màu da + lông mày phải vẽ trên tranh");
    await s.screenshot(path.join(SHOTS, "profile-face-parts.png"));
    expect(await click("decor-save"), "không bấm được Lưu trang trí");
    expect(await s.waitText(/Đã lưu trang trí/), "chưa lưu");
    const av = await prisma.userAvatar.findUnique({ where: { userId: data.student.id } });
    const cf = av?.config ?? {};
    expect(cf.gender === "female" && cf.hairColor === "hc-black" && cf.hair === "hair-bob" && cf.eyeShape === "big" && cf.mouth === "cat" && cf.faceDeco === "star" && cf.skinTone === "tan" && cf.brows === "thick", `cấu hình lưu sai: ${JSON.stringify(cf)}`);
  });

  await step("Học sinh: hồ sơ cá nhân hiện nhân vật, danh hiệu, xu tích luỹ; bạn khác xem không thấy kết quả gần đây; hồ sơ thầy → 404", async () => {
    await s.goto(`/profile/${data.student.id}`, /Thang danh hiệu/i);
    const txt = await s.text();
    expect(/Tuỳ chỉnh nhân vật/.test(txt) && /Kết quả gần đây/.test(txt), "chính chủ thiếu nút tuỳ chỉnh / kết quả gần đây");
    expect(/Trứng bắc thảo|đẳng cấp|thần hào|999 Tỷ Xu/.test(txt), "thiếu danh hiệu");
    expect(await s.ev(`return !!document.querySelector('[data-testid="public-profile"] svg[role="img"]')`), "thiếu nhân vật SVG");
    expect(await s.ev(`return !!document.querySelector('[data-testid="public-profile"] [data-testid="profile-banner"] [data-scene]')`), "hồ sơ công khai thiếu cảnh banner");
    expect(!/@test\.local/.test(txt), "hồ sơ công khai không được lộ email");
    const res = await fetch(BASE_URL + `/profile/${data.teacher.id}`, { headers: { cookie: `authjs.session-token=${sTok}` }, redirect: "manual" });
    expect(res.status === 404, `hồ sơ thầy phải 404 (thực tế ${res.status})`);
    const other = await prisma.user.create({ data: { email: `${tag}-hs2@test.local`, name: `${tag} Bạn khác`, role: "STUDENT", isApproved: true, classId: data.cls.id } });
    const oTok = await token(other);
    const html = await (await fetch(BASE_URL + `/profile/${data.student.id}`, { headers: { cookie: `authjs.session-token=${oTok}` } })).text();
    expect(!html.includes("Kết quả gần đây") && html.includes("Hoạt động"), "bạn khác không được thấy kết quả gần đây");
  });

  await step("Học sinh: rương bí ẩn — xem tỉ lệ, mở Rương Xu (600 xu) → có kết quả, sổ khớp ví, bảo hiểm cập nhật", async () => {
    await s.goto("/rewards/gacha", /Rương kho báu bí ẩn/i);
    await s.click(/^Tỉ lệ rơi quà$/, "button");
    expect(await s.waitText(/60%/), "bảng tỉ lệ không hiện 60% Phổ thông");
    expect(await s.ev(`return document.querySelectorAll('[data-testid="rates-table"] > div').length >= 4`), "bảng tỉ lệ thiếu bậc");
    await s.ev(`document.querySelector('[role="dialog"] button[aria-label], [role="dialog"] [data-slot="dialog-close"]')?.click()`);
    await sleep(400);
    const before = await balanceOf(data.student.id);
    const ok = await s.ev(`const b=document.querySelector('[data-testid="open-xu"]'); if(!b||b.disabled) return false; b.click(); return true;`);
    expect(ok, "không bấm được Mở Rương Xu");
    expect(await s.ev(`return document.querySelector('[data-testid="gacha-scene"]')?.dataset.phase`) === "shaking", "rương không lắc");
    expect(await s.waitText(/Mở tiếp/, 10000), "không thấy thẻ kết quả");
    const rarity = await s.ev(`return document.querySelector('[data-testid="gacha-result"]')?.dataset.rarity`);
    expect(["common", "rare", "epic", "legendary"].includes(rarity), `bậc lạ: ${rarity}`);
    const pull = await prisma.gachaPull.findFirst({ where: { userId: data.student.id } });
    expect(pull && pull.cost === 600, "chưa ghi GachaPull");
    const w = await prisma.pointWallet.findUnique({ where: { userId: data.student.id } });
    const sum = (await prisma.pointLedger.aggregate({ where: { userId: data.student.id, currency: "XU" }, _sum: { amount: true } }))._sum.amount;
    expect(w.balance === sum, `ví ${w.balance} ≠ sổ ${sum}`);
    expect(w.balance <= before - 600 + 600, "trừ xu sai");
    expect(/còn 2\/3 hôm nay/.test(await s.text()), "bộ đếm lượt/ngày không giảm");
    await s.screenshot(path.join(SHOTS, "gacha-result.png"));
  });

  await step("Bảng Vàng: học sinh vào tiệm → /leaderboard mở hộp Bảng Vàng trong tiệm (không còn mục ở thanh bên); thầy cũng xem trong tiệm; trang chủ có NPC + top 3", async () => {
    await s.goto("/leaderboard?tab=g7&period=all", /Bảng Vàng Server Khối/i);
    expect(await s.ev(`return location.pathname === "/rewards" && !!document.querySelector('[data-testid="leaderboard-modal"]')`), "học sinh vào /leaderboard không được đưa vào hộp Bảng Vàng của tiệm");
    expect(/Học sinh/.test(await s.ev(`return document.querySelector('[data-testid="leaderboard-modal"]')?.innerText || ""`)), "hộp Bảng Vàng không có mình");
    // 28/11: mỗi bạn trên Bảng Vàng khoe đủ đồ (sân khấu nền + nhân vật + thú cưng, khung, bảng tên); khối hồ sơ trong tiệm cũng vậy
    expect(await s.ev(`return document.querySelectorAll('[data-testid="leaderboard-modal"] [data-testid="board-row"] [data-testid="showcase-stage"]').length >= 1`), "thẻ Bảng Vàng thiếu sân khấu khoe đồ");
    expect(await s.ev(`return !!document.querySelector('[data-testid="hud-stage"] [data-testid="showcase-stage"]')`), "khối hồ sơ trong tiệm thiếu sân khấu khoe đồ");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    // 28/11: thầy cũng xem Bảng Vàng trong Tiệm quà (bỏ trang riêng / mục thanh bên)
    await t.goto("/leaderboard?tab=g7&period=all", /Bảng Vàng Server Khối/i);
    expect(await t.ev(`return location.pathname === "/rewards" && !!document.querySelector('[data-testid="leaderboard-modal"]')`), "thầy vào /leaderboard không được đưa vào hộp Bảng Vàng của tiệm");
    await t.ev(`document.querySelector('[data-testid="board-g7"]')?.click()`);
    await sleep(400);
    expect(/Học sinh/.test(await t.ev(`return document.querySelector('[data-testid="leaderboard-modal"]')?.innerText || ""`)), "hộp Bảng Vàng của thầy (khối 7) không có học sinh thử");
    expect(await t.ev(`return !document.querySelector('[data-testid="leaderboard-modal"] a[href="/leaderboard"]')`), "hộp Bảng Vàng còn nút xem trang riêng");
    await s.goto("/", /Tiệm quà/i);
    expect(await s.ev(`return !!document.querySelector('[data-testid="npc"]') && !!document.querySelector('[data-testid="home-top3"]')`), "trang chủ thiếu NPC hoặc top 3");
    expect(await s.ev(`return !document.querySelector('aside a[href="/leaderboard"]')`), "thanh bên vẫn còn mục Bảng Vàng riêng");
    expect(await s.ev(`return !!document.querySelector('aside a[href="/world"]')`), "thanh bên thiếu lối vào game 3D (thầy bật lại 28/11)");
    const npc = await s.ev(`return document.querySelector('[data-testid="npc"]')?.innerText || ""`);
    expect(/lucky boy/i.test(npc) && !/rương/i.test(npc), `NPC sai: ${npc.slice(0, 80)}`);
  });

  // -------------------------------------------------- Tiệm Quà GĐ6 (mockup Canvas 2)
  await step("Học sinh: tiệm không còn nút Menu (thầy bỏ 24/11); huy hiệu cấp mở Hệ Thống Danh Hiệu", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`return !document.querySelector('[data-testid="menu-open"]') && !document.querySelector('[aria-label="Menu Tiệm Quà"]')`), "vẫn còn nút Menu Tiệm Quà");
    await s.ev(`document.querySelector('[data-testid="titles-open"]').click()`);
    expect(await s.waitText(/Tổng xu tích luỹ/), "bấm huy hiệu cấp không mở hộp danh hiệu");
    const rows = await s.ev(`return [...document.querySelectorAll('[data-testid="title-row"]')].map(r => r.dataset.unlocked).join("")`);
    expect(rows.length === 8 && rows.startsWith("1"), `danh hiệu sai: ${rows}`);
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
  });

  await step("Học sinh: Tiệm quà v2 (Adorable Home) — thanh gỗ không sidebar, lọc độ hiếm + chỉ món mua được, hộp chi tiết có ảnh thật + Thử trên hồ sơ; nhân vật anime", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`return !!document.querySelector('.ah-wood') && !document.querySelector('aside a[href="/rewards"]') && !document.querySelector('header [data-wallet-chip]')`), "thiếu thanh gỗ / còn sidebar hoặc header chung");
    // Lọc Huyền thoại → mọi thẻ đều Huyền thoại
    await s.ev(`document.querySelector('[data-testid="rar-legendary"]').click()`);
    await sleep(200);
    expect(await s.ev(`const c=[...document.querySelectorAll('[data-testid="item-card"],[data-testid="reward-card"]')]; return c.length > 0 && c.every(x => /Huyền thoại/.test(x.getAttribute('aria-label')))`), "lọc Huyền thoại sai");
    await s.ev(`document.querySelector('[data-testid="rar-all"]').click()`);
    // Chỉ món mua được: không còn thẻ nào báo thiếu (title "Còn thiếu")
    await s.ev(`document.querySelector('[data-testid="afford-only"]').click()`);
    await sleep(200);
    expect(await s.ev(`return [...document.querySelectorAll('[data-testid="item-card"],[data-testid="reward-card"]')].every(x => !/Còn thiếu/.test(x.getAttribute('title') || ''))`), "Chỉ món mua được vẫn hiện món thiếu");
    await s.ev(`document.querySelector('[data-testid="afford-only"]').click()`);
    // Bấm thẻ đồ trang trí → hộp chi tiết dùng ảnh thật của canvas + liên kết Thử trên hồ sơ
    await s.ev(`document.querySelector('[data-testid="cat-deco"]').click()`);
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="item-card"][data-item="acc-crown"]').click()`);
    await sleep(200);
    expect(await s.ev(`const a=document.querySelector('[data-testid="detail-art"] [role="presentation"]'); return document.querySelector('[data-testid="detail-name"]')?.innerText === "Vương miện" && !!a && /studio\\/shop\\.webp/.test(getComputedStyle(a).backgroundImage)`), "chi tiết vương miện không dùng ảnh thật của canvas");
    expect(await s.ev(`return document.querySelector('[data-testid="try-acc-crown"]')?.getAttribute('href') === "/profile?try=acc-crown"`), "thiếu Thử trên hồ sơ");
    await s.click(/^Đóng$/, '[data-testid="shop-detail"] button');
    await sleep(200);
    await s.ev(`document.querySelector('[data-testid="cat-physical"]').click()`);
    await sleep(300);
    expect(await s.ev(`const c=[...document.querySelectorAll('[data-testid="reward-card"]')].find(c=>/Túi Giấy Ăn/.test(c.dataset.title||"")); return !!c && !!c.querySelector('[data-art-tissue]')`), "quà túi giấy ăn chưa có tranh gói khăn giấy");
    // Viền avatar (24/11): Tai Mèo dùng tranh vẽ tay (sprite đồ vật), Thiên Thần là SVG nhiều lớp; mọi thẻ viền lồng sẵn mặt học sinh
    await s.ev(`document.querySelector('[data-testid="cat-frame"]').click()`);
    await sleep(300);
    // 26/11: tranh vẽ tay đã tách nền (ảnh riêng, nền trong suốt) — trước cắt ô sprite bằng khung tròn nên tai mèo bị cụt
    expect(await s.ev(`const i=document.querySelector('[data-testid="item-card"][data-item="frame-catear"] img[data-frame-cut="frame-catear"]'); return !!i && /studio\\/cut\\/frame-catear\\.webp/.test(i.src)`), "khung Tai Mèo chưa dùng tranh vẽ tay tách nền");
    expect(await s.ev(`return !!document.querySelector('[data-testid="item-card"][data-item="frame-blue"] svg[data-frame="frame-blue"]')`), "khung Thiên Thần chưa vẽ SVG");
    expect(await s.ev(`const cs=[...document.querySelectorAll('[data-testid="item-card"][data-item^="frame-"]')]; return cs.length>0 && cs.every(c=>!/studio\\/shop-v2\\.webp/.test(c.innerHTML))`), "còn thẻ viền dùng vòng mảnh v2");
    const frames = await s.ev(`return [...document.querySelectorAll('[data-testid="item-card"]')].map(c => c.dataset.item).join("|")`);
    expect(["frame-blue", "frame-butterfly", "frame-rose"].every((id) => frames.includes(id)), `thiếu viền của canvas: ${frames}`);
    await s.ev(`document.querySelector('[data-testid="cat-deco"]').click()`);
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="deco-hair"]').click()`);
    await sleep(300);
    await s.screenshot(path.join(SHOTS, "shop-hair.png"));
    // Thẻ kiểu tóc: mọi kiểu tóc đều vẽ bằng đầu vẽ tay (char-heads.webp), không còn nhân vật SVG / mặt SVG cũ
    const chibi = await s.ev(`const cards=[...document.querySelectorAll('[data-testid="item-card"] svg[role="img"]')]; return cards.map((svg)=>!!svg.querySelector('[data-head] image[href*="char-heads"]') && !svg.querySelector('ellipse[rx="7.2"]'))`);
    expect(chibi.length >= 3 && chibi.every(Boolean), `thẻ kiểu tóc chưa vẽ tay hết: ${JSON.stringify(chibi)}`);
    await s.ev(`document.querySelector('[data-testid="deco-all"]').click(); document.querySelector('[data-testid="cat-all"]').click()`);
    await sleep(200);
    expect(await s.ev(`return !!document.querySelector('.ah-wood a[href="/"]')`), "thanh gỗ thiếu nút về Trang chủ");
  });

  await step("Học sinh: [GĐ10] Tiệm quà v2 — khối hồ sơ + ví, các mục (Kiếm xu, Hộp bí ẩn, Bảng Vàng, Túi đồ), lên cấp, âm thanh, mèo linh vật", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`return !!document.querySelector('[data-testid="hud-balance"]') && !!document.querySelector('[data-testid="hud-gems"]') && !!document.querySelector('[data-testid="hud-nameplate"] [data-testid="avatar-ring"]')`), "thanh gỗ / khối hồ sơ thiếu ví hoặc ảnh đại diện");
    // Hộp bí ẩn: 2 rương có thanh tỉ lệ + sao bảo hiểm
    await s.ev(`document.querySelector('[data-testid="sec-gacha"]').click()`);
    await sleep(200);
    expect(await s.ev(`return document.querySelectorAll('[data-testid="chest-card"]').length === 2 && !!document.querySelector('[data-testid="pity"]')`), "mục Hộp bí ẩn thiếu rương / bảo hiểm");
    // Kiếm xu: nộp bài + thẻ cào + thang cấp
    await s.ev(`document.querySelector('[data-testid="tasks-open"]').click()`);
    expect(await s.waitText(/Cấp độ & danh hiệu/), "mục Kiếm xu thiếu thang cấp");
    // Âm thanh bật/tắt
    const before = await s.ev(`return document.querySelector('[role="switch"][aria-label="Âm thanh hiệu ứng"]').getAttribute('aria-checked')`);
    await s.ev(`document.querySelector('[role="switch"][aria-label="Âm thanh hiệu ứng"]').click()`);
    await sleep(150);
    const after = await s.ev(`return document.querySelector('[role="switch"][aria-label="Âm thanh hiệu ứng"]').getAttribute('aria-checked')`);
    expect(before !== after, "nút âm thanh không đổi trạng thái");
    await s.ev(`document.querySelector('[role="switch"][aria-label="Âm thanh hiệu ứng"]').click()`);
    // Mèo linh vật: vuốt ve → tim bay
    await s.ev(`document.querySelector('[data-testid="pet-card"]').click()`);
    expect(await s.ev(`await new Promise(r=>setTimeout(r,100)); return !!document.querySelector('[data-testid="mascot"] .v2-heart')`), "vuốt ve không có tim");
    // Lên cấp: cấp đã thấy trước đó thấp hơn → hộp thoại LÊN CẤP
    const lv = await s.ev(`return +(document.querySelector('[data-testid="titles-open"] b')?.innerText.replace('Lv.','') || 0)`);
    if (lv > 1) {
      await s.ev(`localStorage.setItem('last-level:${data.student.id}', '1')`);
      await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
      expect(await s.waitText(/LÊN CẤP/), "không hiện hộp thoại lên cấp");
      await s.click(/^Để sau$/);
      await sleep(200);
      expect(await s.ev(`return !document.querySelector('[data-testid="level-up"]')`), "hộp thoại lên cấp không đóng");
    }
  });

  await step("Học sinh: Bảng Vàng có banner thử thách tuần thật; Nộp bài có mục đã nộp; Trang trí lọc theo ô", async () => {
    await s.ev(`document.querySelector('[data-testid="board-open"]').click()`);
    expect(await s.waitText(/Thử thách tuần/), "thiếu banner thử thách tuần");
    expect(/Còn \d ngày/.test(await s.ev(`return document.querySelector('[data-testid="leaderboard-modal"]')?.innerText || ""`)), "banner thiếu số ngày còn lại");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="tasks-open"]').click()`);
    expect(await s.waitText(/Nộp bài tập nhận xu/), "mục Nộp bài không mở");
    // Mục "Đã nộp" chỉ có khi học sinh có lượt nộp bài gắn với bài học (dữ liệu thử ở đây: đề không gắn bài học → không hiện)
    const lessonAttempts = await prisma.studentAttempt.count({ where: { userId: data.student.id, completedAt: { not: null }, test: { lesson: { isNot: null } } } });
    const doneShown = await s.ev(`return /Đã nộp/.test(document.querySelector('[data-testid="tasks-done"]')?.innerText || "")`);
    expect(doneShown === lessonAttempts > 0, `mục đã nộp sai: hiện=${doneShown}, lượt có bài học=${lessonAttempts}`);
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="cat-deco"]').click()`);
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="deco-hair"]').click()`);
    await sleep(300);
    const items = await s.ev(`return [...document.querySelectorAll('[data-testid="item-card"]')].map(c => c.dataset.item).join("|")`);
    expect(items.length > 0 && items.split("|").every((id) => id.startsWith("hair-")), `lọc Kiểu tóc sai: ${items}`);
    await s.ev(`document.querySelector('[data-testid="cat-all"]').click()`);
    await sleep(300);
    const all = await s.ev(`return [...document.querySelectorAll('[data-testid="item-card"]')].map(c => c.dataset.item).join("|")`);
    expect(!all.includes("hair-bun") && !all.includes("hair-spiky"), `"Tất cả" không được trưng đồ tóc / đồ chỉ từ rương: ${all}`);
  });

  await step("Học sinh: cầu nguyện ngay trong tiệm — Hộp bí ẩn → sao băng → Chúc mừng; lượt/ngày, sổ khớp ví", async () => {
    await s.ev(`document.querySelector('[data-testid="cat-box"]').click()`);
    await sleep(300);
    expect(await s.ev(`return document.querySelectorAll('[data-testid="chest-card"]').length === 2`), "Hộp bí ẩn thiếu thẻ rương");
    expect(await s.waitText(/Còn 2\/3 lượt hôm nay/), "lượt/ngày sai (đã mở 1 lượt ở trang rương)");
    expect(await s.waitText(/60%/), "thiếu thanh tỉ lệ rơi");
    const ok = await s.ev(`const b=document.querySelector('[data-testid="chest-open-xu"]'); if(!b||b.disabled) return false; b.click(); return true;`);
    expect(ok, "không bấm được Cầu nguyện Hộp Sao Mèo");
    // Cảnh sao băng (canvas v2) hiện ra, "Bỏ qua" lật thẻ ngay
    expect(await s.ev(`await new Promise(r=>setTimeout(r,300)); return !!document.querySelector('[data-testid="gacha-cinematic"]')`), "không có cảnh sao băng khi mở rương");
    await s.ev(`document.querySelector('[data-testid="gacha-skip"]')?.click()`);
    expect(await s.waitText(/Chúc mừng! Bạn nhận được/, 10000), "không thấy thẻ Chúc mừng");
    const rarity = await s.ev(`return document.querySelector('[data-testid="gacha-result"]')?.dataset.rarity`);
    expect(["common", "rare", "epic", "legendary"].includes(rarity), `bậc lạ: ${rarity}`);
    expect(/Còn 1\/3 lượt hôm nay/.test(await s.text()), "lượt/ngày không giảm sau khi cầu nguyện");
    expect((await prisma.gachaPull.count({ where: { userId: data.student.id } })) === 2, "chưa ghi GachaPull thứ 2");
    const w = await prisma.pointWallet.findUnique({ where: { userId: data.student.id } });
    const sum = (await prisma.pointLedger.aggregate({ where: { userId: data.student.id, currency: "XU" }, _sum: { amount: true } }))._sum.amount;
    expect(w.balance === sum, `ví ${w.balance} ≠ sổ ${sum}`);
    const shown = await s.ev(`return document.querySelector('[data-testid="gacha-wallet"]')?.innerText || ""`);
    expect(shown.includes(w.balance.toLocaleString("vi-VN")), `số dư ở mục Hộp bí ẩn (${shown}) khác ví ${w.balance}`);
    await s.screenshot(path.join(SHOTS, "shop-gacha-result.png"));
    await s.click(/^Đóng$/, '[data-testid="gacha-result"] button');
    await sleep(400);
    expect(!(await s.ev(`return !!document.querySelector('[data-testid="gacha-result"]')`)), "Đóng không tắt thẻ kết quả");
  });

  await step("[review GĐ6] bấm đúp Cầu nguyện chỉ mở 1 lượt; hết 3 lượt/ngày thì nút Hộp Sao Mèo khoá", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="cat-box"]').click()`);
    await sleep(300);
    expect(await s.waitText(/Còn 1\/3 lượt hôm nay/), "mục Hộp bí ẩn phải còn 1/3 lượt");
    const before = await prisma.gachaPull.count({ where: { userId: data.student.id } });
    await s.ev(`const b=document.querySelector('[data-testid="chest-open-xu"]'); b.click(); b.click(); b.click();`);
    await s.ev(`await new Promise(r=>setTimeout(r,400)); document.querySelector('[data-testid="gacha-skip"]')?.click()`);
    expect(await s.waitText(/Chúc mừng! Bạn nhận được/, 10000), "không thấy kết quả");
    await sleep(800);
    expect((await prisma.gachaPull.count({ where: { userId: data.student.id } })) === before + 1, "bấm đúp mở nhiều hơn 1 lượt");
    await s.click(/^Đóng$/, '[data-testid="gacha-result"] button');
    await sleep(300);
    expect(await s.ev(`return document.querySelector('[data-testid="chest-open-xu"]')?.disabled === true`), "hết lượt ngày mà nút Hộp Sao Mèo vẫn bấm được");
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(300);
  });

  await step("[review GĐ6] mua mèo trong tiệm → dùng luôn và được LƯU (tải lại vẫn là mèo mới)", async () => {
    await s.ev(`document.querySelector('[data-testid="cat-pet"]').click()`);
    await sleep(300);
    // Mèo đầu tiên còn mua được bằng xu (rương có thể đã cho sẵn Moka)
    const bought = await s.ev(`for (const c of document.querySelectorAll('[data-testid="item-card"]')) { c.click(); await new Promise(r=>setTimeout(r,150)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid^="shop-buy-pet-"]'); if (b && !b.disabled && / xu$/.test(b.innerText.trim())) { const name = document.querySelector('[data-testid="shop-detail"] [data-testid="detail-name"]')?.innerText || ""; b.click(); return b.dataset.testid.replace("shop-buy-", "") + "|" + name; } } return null;`);
    expect(bought, "không còn mèo nào mua được bằng xu");
    const [petId, petName] = bought.split("|");
    expect(await s.waitText(/Đã mua/), "không thấy thông báo đã mua");
    await sleep(1500);
    const row = await prisma.userAvatar.findUnique({ where: { userId: data.student.id } });
    expect(row?.config?.pet === petId, `chưa lưu mèo mới ${petId}: ${JSON.stringify(row?.config)}`);
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    // Tên lấy từ hộp chi tiết (mèo mua được đầu tiên tuỳ rương đã cho món nào — trước đây chỉ biết Moka / Peanut nên chập chờn)
    expect((await s.ev(`return document.querySelector('[data-testid="mascot"]')?.innerText || ""`)).includes(petName), `tải lại không còn mèo ${petName}`);
  });

  await step("Nhiệm vụ ẩn: bảng 10 ô (??? chưa mở); được cấp biệt danh → hộp chúc mừng, chip biệt danh, ô đã mở", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="quest-unlocked-ok"]')?.click()`);
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="quest-open"]').click()`);
    await sleep(400);
    const cards = await s.ev(`return [...document.querySelectorAll('[data-testid="quest-card"]')].map(c => c.dataset.quest + ":" + c.dataset.open).join(",")`);
    expect(cards.split(",").length === 10 && cards.includes(":false"), `bảng nhiệm vụ sai: ${cards}`);
    expect(!/Cú Đêm Tu Tiên/.test(await s.ev(`return document.querySelector('[data-testid="quest-board"]').innerText`)) || cards.includes("owl:true"), "ô chưa mở lộ tên biệt danh");
    await s.ev(`document.querySelector('[data-testid="quest-close"]').click()`);
    // Cấp biệt danh như hệ thống (thêm món QUEST + tự đeo)
    await prisma.userItem.upsert({ where: { userId_itemId: { userId: data.student.id, itemId: "q-owl" } }, create: { userId: data.student.id, itemId: "q-owl", source: "QUEST" }, update: {} });
    const av = await prisma.userAvatar.findUnique({ where: { userId: data.student.id } });
    await prisma.userAvatar.upsert({ where: { userId: data.student.id }, create: { userId: data.student.id, config: { title: "q-owl" } }, update: { config: { ...(av?.config ?? {}), title: "q-owl" } } });
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.waitText(/Hoàn thành nhiệm vụ ẩn!/), "không hiện hộp chúc mừng nhiệm vụ ẩn");
    await s.ev(`document.querySelector('[data-testid="quest-unlocked-ok"]').click()`);
    await sleep(300);
    expect(/Cú Đêm Tu Tiên/.test(await s.ev(`return document.querySelector('[data-testid="hud-nickname"]')?.innerText || ""`)), "thiếu chip biệt danh dưới tên");
    await s.ev(`document.querySelector('[data-testid="quest-open"]').click()`);
    await sleep(400);
    expect(await s.ev(`return document.querySelector('[data-testid="quest-card"][data-quest="owl"]')?.dataset.open === "true"`), "ô Cú Đêm chưa mở");
    await s.ev(`document.querySelector('[data-testid="quest-close"]').click()`);
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`return !document.querySelector('[data-testid="quest-unlocked"]')`), "hộp chúc mừng hiện lại lần 2");
  });

  await step("[review GĐ6] 320px: tablist chỉ chứa tab; hộp chi tiết vừa màn hình; thanh gỗ có nút loa", async () => {
    await s.setSize(320, 640);
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`const t=document.querySelector('[role="tablist"][aria-label="Danh mục quà"]'); return !!t && [...t.children].every(c => c.getAttribute("role") === "tab")`), "tablist chứa phần tử không phải tab");
    expect(await s.ev(`return !document.querySelector('[data-testid="manage-toggle"]') && !document.querySelector('[data-testid="reward-manager"]')`), "học sinh không được thấy quản lý quà");
    // Hồi quy 24/11: danh mục bị giãn theo cả hàng nút → thân tiệm tràn khỏi màn hình, không kéo tới mục cuối
    const fit = await s.ev(`const a=document.querySelector('aside[aria-label="Danh mục tiệm quà"]').getBoundingClientRect(); const c=document.querySelector('[data-testid="reward-card"],[data-testid="item-card"]').getBoundingClientRect(); const t=document.querySelector('[role="tablist"][aria-label="Danh mục quà"]'); return { aside: Math.round(a.right), card: Math.round(c.right), vw: innerWidth, scroll: t.scrollWidth > t.clientWidth && t.clientWidth <= innerWidth }`);
    expect(fit.aside <= fit.vw && fit.card <= fit.vw && fit.scroll, `danh mục / thẻ tràn màn hình 320px: ${JSON.stringify(fit)}`);
    // Hồi quy 24/11 + 26/11: khung vẽ tay (Băng Tinh…) trên thẻ điện thoại là ảnh tách nền phủ đúng ô (không lệch sang ô bên cạnh, không bị cắt tròn)
    await s.ev(`document.querySelector('[data-testid="cat-frame"]').click()`);
    await sleep(300);
    const ice = await s.ev(`const i=document.querySelector('[data-testid="item-card"][data-item="frame-ice"] img[data-frame-cut="frame-ice"]'); if(!i) return "none"; const r=i.getBoundingClientRect(), p=i.parentElement.getBoundingClientRect(); return { w: Math.round(r.width), pw: Math.round(p.width), cx: Math.round(r.left + r.width/2 - p.left - p.width/2), loaded: i.complete && i.naturalWidth > 0 }`);
    expect(ice !== "none" && ice.loaded && ice.w >= ice.pw && ice.w <= ice.pw * 1.1 && Math.abs(ice.cx) <= 1, `khung Băng Tinh vẽ sai: ${JSON.stringify(ice)}`);
    await s.ev(`document.querySelector('[data-testid="cat-all"]').click()`);
    await sleep(200);
    // Hồi quy 24/11: trên điện thoại bấm "Nộp bài" / "Thẻ cào & Code" mở hộp nổi ngay tại chỗ — thấy ngay, trang KHÔNG nhảy xuống nội dung
    for (const [btn, title] of [["code-open", /Thẻ cào/], ["tasks-open", /Nộp bài/]]) {
      await s.ev(`window.scrollTo(0, 0); document.querySelector('[data-testid="${btn}"]').click()`);
      await sleep(700);
      const pos = await s.ev(`const h=document.querySelector('[data-testid="sec-modal"] [data-testid="sec-title"]'); const r=h?.getBoundingClientRect(); return { text: h?.innerText || "", top: r ? Math.round(r.top) : -1, vh: innerHeight, y: Math.round(scrollY), ph: document.querySelector('[data-testid="sec-modal"] input')?.placeholder ?? null }`);
      expect(title.test(pos.text) && pos.top >= 0 && pos.top < pos.vh && pos.y === 0, `bấm ${btn} không mở hộp tại chỗ: ${JSON.stringify(pos)}`);
      if (btn === "code-open") expect(pos.ph !== null && !/DIEM|CHAMCHI|PHUONG/i.test(pos.ph), `ô nhập mã còn lộ mã mẫu: ${pos.ph}`);
      await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
      await sleep(300);
    }
    await s.ev(`document.querySelector('[data-testid="reward-card"],[data-testid="item-card"]').click()`);
    await sleep(500);
    const geo = await s.ev(`const d=document.querySelector('[data-testid="shop-detail"]').getBoundingClientRect(); return { left: d.left, right: d.right, vw: innerWidth }`);
    expect(geo.left >= 0 && geo.right <= geo.vw, `hộp chi tiết tràn màn hình: ${JSON.stringify(geo)}`);
    await s.click(/^Đóng$/, '[data-testid="shop-detail"] button');
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="cat-box"]').click()`);
    await sleep(300);
    for (const x of await s.layoutProblems()) throw new Error(`320px Hộp bí ẩn: ${x}`);
    expect(await s.ev(`return !!document.querySelector('.ah-wood button[aria-label="Âm thanh hiệu ứng"]')`), "thanh gỗ thiếu nút bật/tắt âm thanh");
    await s.setSize(1366, 900);
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
    await step(`Bố cục ${w}px: không tràn ngang (học sinh: /rewards, trang chủ; thầy: 5 tab)`, async () => {
      const problems = [];
      await s.setSize(w, h);
      for (const [p, ready, shot] of [
        ["/rewards", /Chăm làm bài · Đổi quà xinh/i, "rewards"],
        ["/", /Tiệm quà/i, "home"],
        ["/profile", /Tủ đồ & Cửa hàng/i, "profile-decor"],
        [`/profile/${data.student.id}`, /Thang danh hiệu/i, "profile"],
        ["/rewards/gacha", /Rương kho báu bí ẩn/i, "gacha"],
      ]) {
        await s.goto(p, ready);
        for (const tab of p === "/rewards" ? ["cat-physical", "cat-voucher", "cat-deco", "cat-pet", "cat-box"] : [null]) {
          if (tab) await s.ev(`document.querySelector('[data-testid="${tab}"]').click()`);
          for (const x of await s.layoutProblems()) problems.push(`HS ${p} ${tab ?? ""}: ${x}`);
        }
        await s.screenshot(path.join(SHOTS, `student-${shot}-${w}.png`));
      }
      // Chip điểm không đè lên logo
      const overlap = await s.ev(`const a=document.querySelector('header [data-wallet-chip]')?.getBoundingClientRect(); const b=document.querySelector('header a[href="/"]')?.getBoundingClientRect(); if(!a||!b) return "thiếu chip/logo"; return (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) ? "chip đè logo" : "";`);
      if (overlap) problems.push(`HS header: ${overlap}`);
      await t.setSize(w, h);
      await t.goto("/rewards?manage=requests", /Quản lý tiệm/i);
      for (const tab of ["requests", "rewards", "grant", "codes", "stats"]) {
        await t.ev(`document.querySelector('[data-testid="mgr-tab-${tab}"]').click()`);
        await sleep(400);
        for (const x of await t.layoutProblems()) problems.push(`GV ${tab}: ${x}`);
      }
      await t.screenshot(path.join(SHOTS, `teacher-${w}.png`));
      expect(problems.length === 0, problems.join("\n    "));
    });
  }

  await step("Không có lỗi JavaScript trên trình duyệt", async () => {
    const all = [...t.errors, ...s.errors];
    const hyd = [...t.consoleErrors, ...s.consoleErrors].filter((e) => /hydrat/i.test(e));
    expect(all.length === 0, [...all, ...hyd].join("\n    "));
  });

  await step("Admin + giáo viên: xem Tiệm quà như học sinh (chỉ xem, thấy mọi quà), có nút Xem Tiệm quà ở trang quản lý", async () => {
    const admin = await prisma.user.create({ data: { email: `${tag}-ad@test.local`, name: `${tag} Admin`, role: "ADMIN", isApproved: true } });
    const a = await openBrowser({ baseUrl: BASE_URL, token: await token(admin) });
    try {
      await a.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
      expect(await a.ev(`return !!document.querySelector('[data-testid="shop-frame"]') && !!document.querySelector('[data-testid="admin-view"]')`), "admin không thấy giao diện tiệm / thiếu dòng báo chế độ xem");
      await a.ev(`document.querySelector('[data-testid="cat-physical"]').click()`);
      await sleep(300);
      expect(await a.ev(`return document.querySelectorAll('[data-testid="reward-card"]').length >= 1`), "admin không thấy quà hiện vật");
      // Quản lý quà ngay trong tiệm: thêm → thấy trong khu quản lý + DB → ẩn → xoá (bấm 2 lần)
      await a.ev(`document.querySelector('[data-testid="manage-toggle"]').click()`);
      let opened = false;
      for (let i = 0; i < 20 && !opened; i++) {
        opened = await a.ev(`return !!document.querySelector('[data-testid="reward-manager"]')`);
        if (!opened) await sleep(200);
      }
      expect(opened, "admin không mở được khu quản lý quà");
      expect(await a.ev(`return !!document.querySelector('[data-testid="mgr-tab-prices"]') && !!document.querySelector('[data-testid="mgr-tab-earning"]')`), "admin thiếu mục giá đồ / mức xu");
      await a.ev(`document.querySelector('[data-testid="mgr-tab-rewards"]').click()`);
      await sleep(300);
      await a.ev(`document.querySelector('[data-testid="mgr-new"]').click()`);
      await sleep(300);
      const setVal = (sel, v) => a.ev(`const i=document.querySelector('${sel}'); const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i),"value").set; d.call(i, ${JSON.stringify(String(v))}); i.dispatchEvent(new Event("input",{bubbles:true}));`);
      await setVal('[data-testid="ed-title"]', `${tag} Gấu bông thử`);
      await setVal('[data-testid="ed-price"]', 9000);
      await setVal('[data-testid="ed-stock"]', 2);
      await sleep(200);
      expect(await a.ev(`return !!document.querySelector('[data-testid="reward-editor"] [data-art="gift"]')`), "xem trước quà hiện vật không có khung hộp quà");
      // Đăng ảnh quà: chọn file → hộp Sửa ảnh (xoay) → Dùng ảnh này → tải lên (giả lập, không đẩy lên CDN thật) → xem trước có ảnh
      await a.ev(`window.__up=[]; const rf=window.fetch.bind(window); window.fetch=(u,o)=>{ if(String(u).includes("/api/upload/image")){ const f=o.body.get("file"); window.__up.push(f.type+":"+f.size); return Promise.resolve(new Response(JSON.stringify({url:"/logo-96.png"}),{headers:{"content-type":"application/json"}})); } return rf(u,o); }; return true`);
      const setFile = async (sel, file) => {
        const { result: { root } } = await a.send("DOM.getDocument", { depth: 0 });
        const { result: { nodeId } } = await a.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
        await a.send("DOM.setFileInputFiles", { nodeId, files: [file] });
      };
      await setFile('[data-testid="ed-image-input"]', path.join(root, "public/logo.png"));
      await sleep(800);
      expect(await a.ev(`return !!document.querySelector('[data-testid="image-cropper"]')`), "chọn ảnh xong không mở hộp Sửa ảnh");
      await a.ev(`document.querySelector('[data-testid="crop-rotate"]').click()`);
      await sleep(200);
      await a.ev(`document.querySelector('[data-testid="crop-ok"]').click()`);
      await sleep(1200);
      const up1 = await a.ev(`return window.__up`);
      expect(up1.length === 1 && /^image\/(webp|png):\d+$/.test(up1[0]), `ảnh không được cắt / tải lên: ${JSON.stringify(up1)}`);
      expect(await a.ev(`return !document.querySelector('[data-testid="image-cropper"]') && document.querySelector('[data-testid="ed-image-thumb"]')?.getAttribute('src')==="/logo-96.png" && !!document.querySelector('[data-testid="reward-editor"] [data-reward-img]')`), "xem trước quà chưa dùng ảnh vừa đăng");
      await a.ev(`document.querySelector('[data-testid="ed-save"]').click()`);
      expect(await a.waitText(/Đã thêm quà/), "không thêm được quà từ tiệm");
      const created = await prisma.reward.findFirst({ where: { title: `${tag} Gấu bông thử` } });
      expect(created && created.price === 9000 && created.stock === 2 && created.kind === "PHYSICAL" && created.isActive, `DB quà mới sai: ${JSON.stringify(created)}`);
      expect(created.imageUrl === "/logo-96.png", `ảnh quà không lưu: ${created.imageUrl}`);
      await sleep(800);
      const cardSel = `[data-testid="mgr-card"][data-title="${tag} Gấu bông thử"]`;
      expect(await a.ev(`return !!document.querySelector('${cardSel}')`), "quà mới không hiện trong khu quản lý");
      expect(await a.ev(`return document.querySelector('${cardSel} [data-reward-img]')?.getAttribute('src')==="/logo-96.png"`), "thẻ quà trong khu quản lý không hiện ảnh");
      // Sửa ảnh đang có (mở lại ảnh trên web) rồi bỏ ảnh → lưu → quay về tranh tự chọn
      await a.ev(`document.querySelector('${cardSel} [data-testid="mgr-edit"]').click()`);
      await sleep(300);
      await a.ev(`document.querySelector('[data-testid="ed-image-edit"]').click()`);
      await sleep(1000);
      await a.ev(`document.querySelector('[data-testid="crop-ok"]').click()`);
      await sleep(1200);
      expect((await a.ev(`return window.__up.length`)) === 2, "Sửa ảnh đang có không tải lại ảnh đã cắt");
      await a.ev(`document.querySelector('[data-testid="ed-image-remove"]').click()`);
      await sleep(200);
      await a.ev(`document.querySelector('[data-testid="ed-save"]').click()`);
      expect(await a.waitText(/Đã lưu quà/), "không lưu được quà sau khi bỏ ảnh");
      expect((await prisma.reward.findUnique({ where: { id: created.id } })).imageUrl === null, "bỏ ảnh không lưu");
      await sleep(800);
      await a.ev(`document.querySelector('${cardSel} [data-testid="mgr-toggle"]').click()`);
      await sleep(1500);
      expect((await prisma.reward.findUnique({ where: { id: created.id } })).isActive === false, "ẩn quà không lưu");
      await a.ev(`document.querySelector('${cardSel} [data-testid="mgr-delete"]').click()`);
      await sleep(200);
      await a.ev(`document.querySelector('${cardSel} [data-testid="mgr-delete"]').click()`);
      await sleep(1500);
      expect(!!(await prisma.reward.findUnique({ where: { id: created.id } })).deletedAt, "xoá quà không lưu");
      // Giá thú cưng theo tiền thật: 20.000đ → 5.600 xu (÷3,6 làm tròn lên trăm) → lưu → thẻ tiệm đổi giá
      await a.ev(`document.querySelector('[data-testid="mgr-tab-prices"]').click()`);
      await sleep(400);
      await a.ev(`document.querySelector('[data-testid="price-slot-pet"]').click()`);
      await sleep(200);
      const rowSel = `[data-testid="price-row"][data-item="pet-moka"]`;
      await setVal(`${rowSel} [data-testid="price-vnd"]`, "20000");
      await sleep(200);
      expect(/5\.600 xu/.test(await a.ev(`return document.querySelector('${rowSel} [data-testid="price-preview"]')?.innerText || ""`)), "nhập 20000đ không ra 5.600 xu");
      await a.ev(`document.querySelector('[data-testid="price-save"]').click()`);
      expect(await a.waitText(/Đã lưu giá đồ trang trí/), "không lưu được giá đồ");
      const cfg = await prisma.gameConfig.findUnique({ where: { key: "itemPrices" } });
      expect(cfg?.value?.["pet-moka"]?.xu === 5600 && cfg.value["pet-moka"].vnd === 20000, `DB giá sai: ${JSON.stringify(cfg?.value)}`);
      await sleep(1200);
      await a.ev(`document.querySelector('[data-testid="banner-manage"]').click()`); // về xem tiệm như học sinh
      await sleep(400);
      expect(await a.ev(`return !document.querySelector('[data-testid="reward-manager"]') && !new URLSearchParams(location.search).has("manage")`), "tắt quản lý không về tiệm");
      await a.ev(`document.querySelector('[data-testid="cat-pet"]').click()`);
      await sleep(500);
      expect(/5\.600 Xu/.test(await a.ev(`return document.querySelector('[data-testid="item-card"][data-item="pet-moka"]')?.innerText || ""`)), "thẻ Moka trong tiệm chưa đổi giá");
      // Mức xu các hoạt động: nộp bài 500 → lưu → DB; rồi Về mặc định
      await a.ev(`document.querySelector('[data-testid="manage-toggle"]').click()`);
      await sleep(400);
      await a.ev(`document.querySelector('[data-testid="mgr-tab-earning"]').click()`);
      await sleep(400);
      await setVal('[data-testid="earn-testSubmit"]', "500");
      await a.ev(`document.querySelector('[data-testid="earn-save"]').click()`);
      expect(await a.waitText(/Đã lưu mức xu các hoạt động/), "không lưu được mức xu");
      expect((await prisma.gameConfig.findUnique({ where: { key: "earning" } }))?.value?.testSubmit === 500, "DB mức xu sai");
      await sleep(1200);
      await a.ev(`document.querySelector('[data-testid="earn-reset-all"]').click()`);
      await sleep(1500);
      expect(JSON.stringify((await prisma.gameConfig.findUnique({ where: { key: "earning" } }))?.value) === "{}", "Về mặc định mức xu không lưu");
      await a.ev(`document.querySelector('[data-testid="mgr-tab-prices"]').click()`);
      await sleep(300);
      await a.ev(`document.querySelector('[data-testid="price-slot-pet"]').click()`);
      await sleep(200);
      await a.ev(`document.querySelector('${rowSel} [data-testid="price-reset"]').click()`);
      await a.ev(`document.querySelector('[data-testid="price-save"]').click()`);
      await sleep(1500);
      expect(JSON.stringify((await prisma.gameConfig.findUnique({ where: { key: "itemPrices" } }))?.value) === "{}", "Về giá gốc không lưu");
      // 28/11: sửa được mọi loại đồ (có tab Kiểu tóc) + giá rương
      expect(await a.ev(`return !!document.querySelector('[data-testid="price-slot-hair"]')`), "thiếu tab giá Kiểu tóc");
      await a.ev(`document.querySelector('[data-testid="price-slot-chest"]').click()`);
      await sleep(300);
      await setVal('[data-testid="chest-xu-cost"]', "400");
      await sleep(200);
      expect(await a.ev(`return document.querySelector('[data-testid="chest-save"]').disabled`), "giá rương dưới 500 xu phải bị chặn");
      await setVal('[data-testid="chest-xu-cost"]', "900");
      await setVal('[data-testid="chest-xu-daily"]', "5");
      await a.ev(`document.querySelector('[data-testid="chest-save"]').click()`);
      expect(await a.waitText(/Đã lưu giá rương/), "không lưu được giá rương");
      const ch = (await prisma.gameConfig.findUnique({ where: { key: "chests" } }))?.value;
      expect(ch?.xu?.cost === 900 && ch?.xu?.dailyLimit === 5, `DB giá rương sai: ${JSON.stringify(ch)}`);
      await sleep(1200);
      await a.ev(`document.querySelector('[data-testid="chest-reset"]').click()`);
      await sleep(1500);
      expect(JSON.stringify((await prisma.gameConfig.findUnique({ where: { key: "chests" } }))?.value) === "{}", "Về giá gốc rương không lưu");
      await a.goto("/rewards?manage=prices", /Quản lý tiệm/i);
      expect(await a.ev(`return document.querySelector('[data-testid="mgr-tab-prices"]')?.getAttribute("aria-selected") === "true"`), "link ?manage=prices không mở đúng mục cho admin");
      expect(a.errors.length === 0, a.errors.join("\n    "));
    } finally {
      await a.close();
    }
    await t.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await t.ev(`return location.pathname === "/rewards" && !!document.querySelector('[data-testid="admin-view"]')`), "giáo viên chưa xem được tiệm");
    expect(await t.ev(`return !!document.querySelector('[data-testid="manage-toggle"]') && !document.querySelector('[data-testid="reward-manager"]')`), "giáo viên phải thấy nút Quản lý tiệm (khu quản lý đóng khi vào /rewards thường)");
    await t.goto("/rewards?manage=prices", /Quản lý tiệm/i);
    expect(await t.ev(`return !document.querySelector('[data-testid="mgr-tab-prices"]') && document.querySelector('[role=tab][aria-selected=true]')?.dataset.testid !== "mgr-tab-prices"`), "giáo viên không được mở mục giá đồ qua link");
  });

  await step("Thầy: Duyệt chữa bài — đặt hạn nộp lớp, tìm tên, bấm Có chữa (+280) rồi Chữa đủ (+400); mã quà tự đặt dùng 1 lần", async () => {
    const before = await balanceOf(data.student.id);
    await t.goto(`/teacher/homework/check?class=${data.cls.id}&lesson=${data.hwLesson.id}`, /Duyệt chữa bài tập/i);
    expect(await t.ev(`return !!document.querySelector('[data-testid="homework-check"]') && document.querySelectorAll('[data-testid="hc-row"]').length >= 1`), "trang duyệt không có danh sách lớp");
    // 28/11: chỉ mục "Duyệt chữa bài" sáng, "Duyệt Bài tự luận" (/teacher/homework) không sáng theo
    const act = await t.ev(`return [...document.querySelectorAll('a[aria-current="page"]')].map(a=>a.getAttribute('href'))`);
    expect(act.includes("/teacher/homework/check") && !act.includes("/teacher/homework"), `thanh bên sáng sai: ${JSON.stringify(act)}`);
    await t.fill('[data-testid="hc-due"]', "2099-12-31T21:00");
    await t.ev(`document.querySelector('[data-testid="hc-due-save"]').click()`);
    expect(await t.waitText(/Đã lưu hạn nộp/), "không lưu được hạn nộp");
    const dl = await prisma.homeworkDeadline.findUnique({ where: { lessonId_classId: { lessonId: data.hwLesson.id, classId: data.cls.id } } });
    expect(dl && dl.dueDate.toISOString() === "2099-12-31T14:00:00.000Z", `hạn nộp lưu sai (giờ VN): ${dl?.dueDate?.toISOString()}`);
    await t.fill('[data-testid="hc-search"]', "hoc sinh");
    await sleep(200);
    const row = `[data-testid="hc-row"][data-user="${data.student.id}"]`;
    expect(await t.ev(`return !!document.querySelector('${row}')`), "tìm tên (không dấu) không ra học sinh");
    await t.ev(`document.querySelector('${row} [data-testid="hc-PARTIAL"]').click()`);
    for (let i = 0; i < 20 && (await balanceOf(data.student.id)) !== before + 280; i++) await sleep(250);
    expect((await balanceOf(data.student.id)) === before + 280, "Có chữa không cộng 280 xu");
    await t.ev(`document.querySelector('${row} [data-testid="hc-FULL"]').click()`);
    for (let i = 0; i < 20 && (await balanceOf(data.student.id)) !== before + 400; i++) await sleep(250);
    expect((await balanceOf(data.student.id)) === before + 400, "Chữa đủ không điều chỉnh lên 400 xu");
    expect((await t.ev(`return document.querySelector('${row}').dataset.level`)) === "FULL", "nút Chữa đủ chưa sáng");
    // Mã quà tự đặt
    await t.goto("/rewards?manage=codes", /Tạo mã quà tặng/i);
    const custom = `E2E${Date.now().toString(36).toUpperCase().slice(-5)}`;
    await t.fill('[data-testid="giftcode-custom"]', custom.toLowerCase());
    await t.click(/^Tạo 1 mã/);
    expect(await t.waitText(new RegExp(custom)), "không thấy mã tự đặt vừa tạo");
    const gc = await prisma.giftCode.findUnique({ where: { code: custom } });
    expect(gc && gc.maxUses === 1 && gc.currency === "XU" && gc.amount === 300, `mã tự đặt lưu sai: ${JSON.stringify(gc)}`);
    // Danh sách tải lại sau khi trang làm mới (router.refresh) — chờ tối đa 6 giây
    let listed = false;
    for (let i = 0; i < 24 && !listed; i++) {
      listed = (await t.ev(`return document.querySelector('[data-testid="giftcode-unused"]')?.innerText || ""`)).includes(custom);
      if (!listed) await sleep(250);
    }
    expect(listed, "mã chưa dùng không có trong danh sách lưu");
  });

  await t.close();
  await s.close();
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log(`\n${results.length - failed}/${results.length} bước đạt. Ảnh chụp: ${SHOTS}`);
process.exit(failed ? 1 : 0);
