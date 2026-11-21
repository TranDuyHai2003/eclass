/**
 * Đo tổng JS tải lần đầu (các <script src> trong HTML, đã nén gzip) của từng trang trên một server build sẵn.
 *   BASE_URL=http://localhost:3057 node tests/tools/measure-js.mjs
 * Tự tạo một học sinh thử (xoá sau khi đo) để xem các trang cần đăng nhập. Chỉ chạy với DB local.
 */
import { createRequire } from "module";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
require(path.join(root, "tests/setup/load-env.cjs")).loadEnv(path.join(root, ".env"));
const { PrismaClient } = require("@prisma/client");
const { encode } = await import(require.resolve("@auth/core/jwt"));
const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "http://localhost:3057";
const tag = `measure-${Date.now()}`;
const student = await prisma.user.create({ data: { email: `${tag}@test.local`, name: `${tag} HS`, role: "STUDENT", isApproved: true } });
const tok = await encode({ salt: "authjs.session-token", secret: process.env.AUTH_SECRET, token: { sub: student.id, email: student.email, name: student.name, role: "STUDENT", isApproved: true, studentType: "OFFLINE" }, maxAge: 3600 });
const headers = { cookie: `authjs.session-token=${tok}` };
const cache = new Map();
async function sizeOf(url) {
  if (cache.has(url)) return cache.get(url);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const r = { raw: buf.length, gz: zlib.gzipSync(buf).length };
  cache.set(url, r);
  return r;
}
const pages = ["/courses", "/", "/rewards", "/rewards/gacha", "/profile/avatar", `/profile/${student.id}`, "/leaderboard", "/profile"];
try {
  console.log("Trang".padEnd(36), "scripts", "raw KB".padStart(8), "gzip KB".padStart(8));
  for (const p of pages) {
    const html = await (await fetch(BASE_URL + p, { headers })).text();
    const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
    let raw = 0, gz = 0;
    for (const s of srcs) {
      const u = s.startsWith("http") ? s : BASE_URL + s;
      const r = await sizeOf(u);
      raw += r.raw; gz += r.gz;
    }
    console.log(p.padEnd(36), String(srcs.length).padStart(7), (raw / 1024).toFixed(0).padStart(8), (gz / 1024).toFixed(0).padStart(8));
  }
} finally {
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
}
