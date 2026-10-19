/**
 * Tạo / cập nhật tài khoản DEMO (quyền ADMIN nhưng chỉ xem, không thể thay đổi dữ liệu).
 *
 * Thông tin đăng nhập KHÔNG lưu trong git — truyền qua biến môi trường:
 *   DEMO_EMAIL=demo@teacherduc.me DEMO_PASSWORD='...' node scripts/create-demo-account.js
 *
 * Bỏ trống DEMO_PASSWORD để script tự sinh mật khẩu ngẫu nhiên và in ra màn hình.
 * Chạy lại script với mật khẩu mới để đổi mật khẩu / thu hồi quyền truy cập.
 */
require("dotenv/config");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.DEMO_EMAIL || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Thiếu DEMO_EMAIL");
  }

  const password =
    process.env.DEMO_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const hashed = await hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.isDemo) {
    throw new Error(
      `Email ${email} đã thuộc về một tài khoản thật — hãy chọn email khác cho tài khoản demo.`,
    );
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "ADMIN", isDemo: true, isApproved: true },
    create: {
      email,
      name: "Demo Reviewer",
      password: hashed,
      role: "ADMIN",
      isDemo: true,
      isApproved: true,
    },
  });

  console.log("✅ Tài khoản demo đã sẵn sàng");
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: ${password}`);
}

main()
  .catch((e) => {
    console.error("❌", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
