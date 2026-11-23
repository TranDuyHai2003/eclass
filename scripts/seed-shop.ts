/**
 * Thêm bộ quà của tiệm (17 món theo canvas) + 3 mã thẻ cào mẫu (DIEM10, CHAMCHI, PHUONG). Chạy lại không tạo trùng.
 * Thầy đồng ý chạy trên production ngày 24/11/2026. Chạy:
 *   CUSTOM_DATABASE_URL=... node --no-experimental-strip-types -r ./tests/setup/register.cjs scripts/seed-shop.ts [--apply]
 * Không có --apply → chỉ in việc sẽ làm.
 */
import { prisma } from "@/lib/prisma";
import { missingShopTemplates } from "@/lib/points/templates";
import { addShopTemplatesInTx } from "@/lib/points/shop-templates";

/** Mã mẫu trong canvas: số xu, mỗi học sinh 1 lần, dùng chung (tối đa 1000 lượt) */
const CODES = [
  { code: "DIEM10", amount: 300, note: "Mã mẫu Thẻ cào Điểm 10" },
  { code: "CHAMCHI", amount: 150, note: "Mã mẫu Chăm chỉ" },
  { code: "PHUONG", amount: 500, note: "Mã mẫu PHUONG" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const staff = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!staff) throw new Error("Không tìm thấy tài khoản ADMIN");

  const existing = await prisma.reward.findMany({ where: { deletedAt: null }, select: { title: true } });
  const todo = missingShopTemplates(existing.map((r) => r.title));
  const haveCodes = new Set((await prisma.giftCode.findMany({ where: { code: { in: CODES.map((c) => c.code) } }, select: { code: true } })).map((c) => c.code));
  const newCodes = CODES.filter((c) => !haveCodes.has(c.code));
  console.log(`Quà sẽ thêm: ${todo.length} (${todo.map((t) => t.title).join(", ") || "—"})`);
  console.log(`Mã sẽ thêm: ${newCodes.map((c) => `${c.code} +${c.amount} xu`).join(", ") || "—"}`);
  if (!apply) return console.log("Chưa ghi (thêm --apply để ghi).");

  await prisma.$transaction(async (tx) => {
    const n = await addShopTemplatesInTx(tx, staff.id);
    for (const c of newCodes) {
      await tx.giftCode.create({ data: { code: c.code, currency: "XU", amount: c.amount, maxUses: 1000, note: c.note, createdById: staff.id } });
    }
    console.log(`Đã thêm ${n} quà, ${newCodes.length} mã.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
