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
  return { cls, student, teacher, attempt, test };
}

async function cleanup() {
  await prisma.reward.deleteMany({ where: { title: { startsWith: tag } } });
  // Quà tạo từ mẫu trên giao diện mang tên mẫu → xoá theo người tạo
  const teacher = await prisma.user.findUnique({ where: { email: `${tag}-gv@test.local` } });
  if (teacher) {
    await prisma.reward.deleteMany({ where: { createdById: teacher.id } });
    await prisma.giftCode.deleteMany({ where: { createdById: teacher.id } });
  }
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
    await t.goto("/teacher/rewards", /Quà & Xu/i);
  });

  await step("Thầy: thêm quà từ mẫu 'Kẹo / bánh nhỏ'", async () => {
    await t.click(/^Quản lý quà$/);
    await t.click(/Kẹo \/ bánh nhỏ/);
    await t.click(/^Lưu$/, "[role=dialog] button");
    expect(await t.waitText(/Đã thêm quà/), "không thấy thông báo Đã thêm quà");
    const r = await prisma.reward.findFirst({ where: { createdById: data.teacher.id, title: "Kẹo / bánh nhỏ" } });
    expect(r && r.price === 6000 && r.offlineOnly, "quà mẫu lưu sai");
  });

  await step("Thầy: form thêm quà — chưa nhập tên thì không lưu được; nhập đủ thì lưu", async () => {
    await t.click(/^Thêm quà$/);
    expect(await t.isDisabled(/^Lưu$/, "[role=dialog] button"), "nút Lưu phải bị khoá khi chưa có tên");
    const titleInput = await t.ev(`const l=[...document.querySelectorAll("[role=dialog] label")].find(x=>/Tên quà/i.test(x.innerText)); const i=l?.querySelector("input"); if(!i) return false; i.id="e2e-title"; return true;`);
    expect(titleInput, "không thấy ô Tên quà");
    await t.fill("#e2e-title", `${tag} Quà đắt`);
    const priceInput = await t.ev(`const l=[...document.querySelectorAll("[role=dialog] label")].find(x=>/Giá \\(xu\\)/i.test(x.innerText)); const i=l?.querySelector("input"); if(!i) return false; i.id="e2e-price"; return true;`);
    expect(priceInput, "không thấy ô Giá");
    await t.fill("#e2e-price", "50000");
    await t.click(/^Mọi học sinh/, "[role=dialog] button");
    await t.click(/^Lưu$/, "[role=dialog] button");
    expect(await t.waitText(/Quà đắt/), "quà mới không hiện trong danh sách");
    const r = await prisma.reward.findFirst({ where: { title: `${tag} Quà đắt` } });
    expect(r && r.price === 50000 && r.kind === "VIRTUAL" && !r.offlineOnly, "quà nhập tay lưu sai");
  });

  await step("Thầy: thưởng +150 xu cho học sinh (tìm theo tên)", async () => {
    await t.click(/^Thưởng xu$/);
    await t.fill("select", data.cls.id);
    await t.fill('input[placeholder="Tìm học sinh…"]', "Học sinh");
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    expect(await t.isDisabled(/^Thưởng [\d.]+ xu$/), "chưa nhập lý do mà nút thưởng không bị khoá");
    await t.click(/^\+150$/);
    await t.click(/^Phát biểu xây dựng bài$/);
    await t.click(/^Thưởng 150 xu$/);
    expect(await t.waitText(/Đã thưởng xu cho 1 học sinh/), "không thấy thông báo thưởng xu");
    expect((await balanceOf(data.student.id)) === 15750, "số dư sau thưởng phải 15750");
  });

  await step("Thầy: thưởng quá giới hạn ngày (1 500 xu) → cộng phần còn lại rồi báo lỗi", async () => {
    for (let i = 0; i < 2; i++) {
      await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
      await t.click(/^\+750$/);
      await t.click(/^Thưởng 750 xu$/);
      await sleep(1500);
    }
    expect((await balanceOf(data.student.id)) === 17100, `sau 150+750+600 (trần ngày) phải 17100 (thực tế ${await balanceOf(data.student.id)})`);
    await t.click(new RegExp(studentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "label");
    await t.click(/^\+150$/);
    await t.click(/^Thưởng 150 xu$/);
    expect(await t.waitText(/Không áp dụng được/), "không báo lỗi khi vượt giới hạn");
    expect((await balanceOf(data.student.id)) === 17100, `số dư phải dừng ở 17100 (thực tế ${await balanceOf(data.student.id)})`);
  });

  let giftCodes = [];
  await step("Thầy: tạo lô 10 thẻ cào × 3 ngọc, in được", async () => {
    await t.click(/^Mã quà tặng$/);
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
    expect(chip && chip.includes("17.100"), `chip header sai: ${chip}`);
    const hero = await s.ev(`return document.querySelector('[data-testid="student-hero"]')?.innerText || ""`);
    expect(/Chào /.test(hero), "thiếu lời chào ở thẻ chào trang chủ");
    expect(/Chó rách|Nghèo rớt|Người nghèo|Tiểu thương|Phú nông|Phú ông|Đại gia|Tỷ phú/.test(hero), "thẻ chào thiếu danh hiệu");
    expect(/Bắt đầu học|Bài gần nhất/i.test(hero), "thẻ chào thiếu khối học tiếp");
    expect(/17\.100/.test(hero), "thẻ chào thiếu số xu");
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
    expect(w && w.gems === 3 && w.balance === 17100, `ví sai sau nhập mã: ${JSON.stringify(w)}`);
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
    expect(txt.includes("17.100"), "không thấy số dư 17.100");
    expect(txt.includes("Kẹo / bánh nhỏ") && txt.includes("Quà đắt"), "thiếu quà");
    const note = await s.ev(`[...document.querySelectorAll('[data-testid="reward-card"]')].find(c => c.dataset.title.endsWith("Quà đắt"))?.click(); await new Promise(r=>setTimeout(r,200)); return document.querySelector('[data-testid="shop-detail"] [data-testid="detail-note"]')?.innerText || ""`);
    expect(/còn thiếu 32\.900 xu/i.test(note), `quà đắt phải báo còn thiếu 32.900 xu: ${note}`);
    const rarity = await s.ev(`return [...document.querySelectorAll('[data-testid="reward-card"]')].map(c => c.dataset.title.replace(/^.*Quà đắt$/, "Quà đắt") + ":" + c.dataset.rarity).join(",")`);
    expect(rarity.includes("Kẹo / bánh nhỏ:common") && rarity.includes("Quà đắt:legendary"), `độ hiếm sai: ${rarity}`);
    expect(/Chó rách|Nghèo rớt|Người nghèo|Tiểu thương|Phú nông|Phú ông|Đại gia|Tỷ phú/.test(txt), "thanh trạng thái thiếu danh hiệu");
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
    expect(/Số dư sau khi đổi: 11\.100 xu/.test(note), `hộp chi tiết thiếu số dư sau khi đổi: ${note}`);
    const opened = await s.ev(`const b=document.querySelector('[data-testid="shop-detail"] [data-testid="redeem"]'); if(!b || b.disabled) return false; b.click(); return true;`);
    expect(opened, "không thấy nút đổi kẹo");
    expect(await s.waitText(/Đã đổi "Kẹo \/ bánh nhỏ"/), "không thấy thông báo đổi quà");
    expect((await balanceOf(data.student.id)) === 11100, "số dư sau đổi phải 11100");
    expect((await s.ev(`return document.querySelector("[data-celebrated]")?.dataset.celebrated`)) === "1", "không bắn pháo giấy khi đổi quà thành công");
    await s.ev(`document.querySelector('[data-testid="bag-open"]').click()`);
    expect(await s.waitText(/Chờ nhận quà/), "không thấy trạng thái Chờ nhận quà trong túi đồ");
  });

  await step("Học sinh: huỷ yêu cầu → hoàn xu", async () => {
    await s.click(/^Huỷ$/);
    expect(await s.waitText(/Đã huỷ và hoàn xu/), "không thấy thông báo huỷ");
    expect((await balanceOf(data.student.id)) === 17100, "chưa hoàn xu");
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
    await t.goto("/teacher/rewards", /quà đang chờ trao/i);
    // Từ chối: chưa nhập lý do thì nút khoá
    await t.click(/^Từ chối$/);
    expect(await t.isDisabled(/^Từ chối & hoàn xu$/, "[role=dialog] button"), "nút từ chối không bị khoá khi thiếu lý do");
    await t.click(/^Thôi$/, "[role=dialog] button");
    await t.click(/^Chọn tất cả$/, "label");
    await t.click(/^Đã trao \(\d+\)$/);
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
    await t.goto("/teacher/rewards", /Quà & Xu/i);
    await t.click(/^Thống kê$/);
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
    expect(await s.waitText(/Bảng Vàng server khối/), "mục Bảng Vàng không mở");
    expect(await s.ev(`return !!document.querySelector('[data-testid="board-g7"]')`), "thiếu tab khối 7");
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

  await step("Học sinh: hồ sơ cá nhân hiện nhân vật, danh hiệu, xu tích luỹ; bạn khác xem không thấy kết quả gần đây; hồ sơ thầy → 404", async () => {
    await s.goto(`/profile/${data.student.id}`, /Thang danh hiệu/i);
    const txt = await s.text();
    expect(/Tuỳ chỉnh nhân vật/.test(txt) && /Kết quả gần đây/.test(txt), "chính chủ thiếu nút tuỳ chỉnh / kết quả gần đây");
    expect(/Tiểu thương|Phú nông|Người nghèo/.test(txt), "thiếu danh hiệu");
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

  await step("Học sinh: Bảng Vàng khối 7 — bục top 3 có mình, tab tháng này, tab lớp; trang chủ có NPC + top 3", async () => {
    await s.goto("/leaderboard?tab=g7&period=all", /Bảng Vàng/i);
    expect(await s.ev(`return !!document.querySelector('[data-testid="podium"]')`), "không thấy bục top 3");
    const podium = await s.ev(`return document.querySelector('[data-testid="podium"]')?.innerText || ""`);
    expect(podium.includes("Học sinh") && /17\.100|16\.|15\./.test(podium), `bục không có mình: ${podium.slice(0, 80)}`);
    expect(await s.ev(`return document.querySelectorAll('[data-testid="podium"] svg[role="img"]').length >= 1`), "bục thiếu nhân vật");
    await s.goto("/leaderboard?tab=g7&period=month", /Bảng Vàng/i);
    expect(/Tháng này/.test(await s.text()), "thiếu tab Tháng này");
    await s.goto("/leaderboard?tab=class&period=all", /Bảng Vàng/i);
    expect((await s.text()).includes(`${tag} lớp`), "tab lớp tôi không hiện tên lớp");
    await s.goto("/", /Tiệm quà/i);
    expect(await s.ev(`return !!document.querySelector('[data-testid="npc"]') && !!document.querySelector('[data-testid="home-top3"]')`), "trang chủ thiếu NPC hoặc top 3");
    const npc = await s.ev(`return document.querySelector('[data-testid="npc"]')?.innerText || ""`);
    expect(/lucky boy/i.test(npc) && !/rương/i.test(npc), `NPC sai: ${npc.slice(0, 80)}`);
  });

  // -------------------------------------------------- Tiệm Quà GĐ6 (mockup Canvas 2)
  await step("Học sinh: Menu Tiệm Quà — chọn Tuyết thì có lớp tuyết rơi, tải lại vẫn nhớ; lối tắt Danh hiệu mở hệ thống danh hiệu", async () => {
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await s.ev(`document.querySelector('[data-testid="menu-open"]').click()`);
    expect(await s.waitText(/Menu Tiệm Quà/), "menu không mở");
    expect(await s.ev(`return document.querySelectorAll('[data-testid^="menu-"]').length >= 9`), "menu thiếu lối tắt");
    await s.ev(`document.querySelector('[data-testid="weather-snow"]').click()`);
    await sleep(300);
    expect(await s.ev(`return document.querySelector('[data-weather]')?.dataset.weather === "snow" && document.querySelectorAll('.weather-layer[data-weather="snow"] .weather-flake').length > 10`), "chọn Tuyết không có tuyết rơi");
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    await sleep(300);
    expect(await s.ev(`return document.querySelector('[data-weather]')?.dataset.weather === "snow"`), "tải lại không nhớ thời tiết");
    await s.ev(`document.querySelector('[data-testid="menu-open"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="weather-sun"]').click()`);
    await s.ev(`document.querySelector('[data-testid="menu-titles"]').click()`);
    expect(await s.waitText(/Hệ Thống Danh Hiệu/), "lối tắt Danh hiệu không mở hộp danh hiệu");
    const rows = await s.ev(`return [...document.querySelectorAll('[data-testid="title-row"]')].map(r => r.dataset.unlocked).join("")`);
    expect(rows.length === 8 && rows.startsWith("1"), `danh hiệu sai: ${rows}`);
    await s.ev(`document.querySelector('[data-testid="shop-modal-close"]').click()`);
    await sleep(400);
    await s.ev(`document.querySelector('[data-testid="titles-open"]').click()`);
    expect(await s.waitText(/Tổng xu tích luỹ/), "bấm huy hiệu cấp không mở hộp danh hiệu");
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
    // Viền avatar dùng tranh v2 của canvas
    await s.ev(`document.querySelector('[data-testid="cat-frame"]').click()`);
    await sleep(300);
    expect(await s.ev(`const a=document.querySelector('[data-testid="item-card"][data-item="frame-catear"] [role="presentation"]'); return !!a && /studio\\/shop-v2\\.webp/.test(getComputedStyle(a).backgroundImage)`), "khung Tai Mèo chưa dùng tranh v2");
    await s.ev(`document.querySelector('[data-testid="cat-deco"]').click()`);
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="deco-hair"]').click()`);
    await sleep(300);
    const chibi = await s.ev(`const svg=document.querySelector('[data-testid="item-card"] svg[role="img"]'); return svg ? [!!svg.querySelector('linearGradient[id$="-iris"]'), svg.querySelectorAll('ellipse').length] : null`);
    expect(chibi && chibi[0] && chibi[1] >= 10, `nhân vật chưa phải bản anime: ${JSON.stringify(chibi)}`);
    await s.ev(`document.querySelector('[data-testid="deco-all"]').click(); document.querySelector('[data-testid="cat-all"]').click()`);
    await sleep(200);
    await s.ev(`document.querySelector('[data-testid="menu-open"]').click()`);
    expect(await s.waitText(/Menu Tiệm Quà/), "menu không mở");
    expect(await s.ev(`return document.querySelector('[data-testid="menu-home"]')?.getAttribute('href') === "/"`), "menu thiếu lối tắt Trang Chủ");
    await s.ev(`document.querySelector('[role=dialog] [data-testid="shop-modal-close"]').click()`);
    await sleep(400);
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
    const petId = await s.ev(`for (const c of document.querySelectorAll('[data-testid="item-card"]')) { c.click(); await new Promise(r=>setTimeout(r,150)); const b=document.querySelector('[data-testid="shop-detail"] [data-testid^="shop-buy-pet-"]'); if (b && !b.disabled && / xu$/.test(b.innerText.trim())) { b.click(); return b.dataset.testid.replace("shop-buy-", ""); } } return null;`);
    expect(petId, "không còn mèo nào mua được bằng xu");
    expect(await s.waitText(/Đã mua/), "không thấy thông báo đã mua");
    await sleep(1500);
    const row = await prisma.userAvatar.findUnique({ where: { userId: data.student.id } });
    expect(row?.config?.pet === petId, `chưa lưu mèo mới ${petId}: ${JSON.stringify(row?.config)}`);
    const petName = { "pet-moka": "Moka", "pet-peanut": "Peanut" }[petId] ?? petId;
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(new RegExp(petName).test(await s.ev(`return document.querySelector('[data-testid="mascot"]')?.innerText || ""`)), `tải lại không còn mèo ${petName}`);
  });

  await step("[review GĐ6] 320px: tablist chỉ chứa tab; hộp chi tiết vừa màn hình; menu có nút loa", async () => {
    await s.setSize(320, 640);
    await s.goto("/rewards", /Chăm làm bài · Đổi quà xinh/i);
    expect(await s.ev(`const t=document.querySelector('[role="tablist"][aria-label="Danh mục quà"]'); return !!t && [...t.children].every(c => c.getAttribute("role") === "tab")`), "tablist chứa phần tử không phải tab");
    await s.ev(`document.querySelector('[data-testid="reward-card"],[data-testid="item-card"]').click()`);
    await sleep(500);
    const geo = await s.ev(`const d=document.querySelector('[data-testid="shop-detail"]').getBoundingClientRect(); return { left: d.left, right: d.right, vw: innerWidth }`);
    expect(geo.left >= 0 && geo.right <= geo.vw, `hộp chi tiết tràn màn hình: ${JSON.stringify(geo)}`);
    await s.click(/^Đóng$/, '[data-testid="shop-detail"] button');
    await sleep(300);
    await s.ev(`document.querySelector('[data-testid="cat-box"]').click()`);
    await sleep(300);
    for (const x of await s.layoutProblems()) throw new Error(`320px Hộp bí ẩn: ${x}`);
    await s.ev(`document.querySelector('[data-testid="menu-open"]').click()`);
    await sleep(500);
    expect(await s.ev(`return !!document.querySelector('[data-testid="shop-menu"] button[aria-label*="âm thanh" i], [data-testid="shop-menu"] button[title*="âm thanh" i]')`), "menu thiếu nút bật/tắt âm thanh");
    await s.ev(`document.querySelector('[role=dialog] [data-testid="shop-modal-close"]').click()`);
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
        ["/leaderboard?tab=g7&period=all", /Bảng Vàng/i, "leaderboard"],
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
      await t.goto("/teacher/rewards", /Quà & Xu/i);
      for (const tab of ["Yêu cầu đổi quà", "Quản lý quà", "Thưởng xu", "Mã quà tặng", "Thống kê"]) {
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
