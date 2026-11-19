/**
 * Nạp trước mỗi file test (node --test -r ./tests/setup/register.cjs):
 * - Đọc .env nếu chưa có biến môi trường DB
 * - CHẶN chạy test nếu DB không phải máy local (test ghi/xoá dữ liệu)
 * - Dùng ts-node để chạy TypeScript, hỗ trợ alias "@/..."
 * - "@/lib/prisma" → PrismaClient thường (bản ở app kéo theo next-auth, không chạy được ngoài Next)
 */
const path = require("path");
const Module = require("module");

const root = path.resolve(__dirname, "../..");

require("./load-env.cjs").loadEnv(path.join(root, ".env"));

const dbUrl = process.env.CUSTOM_DATABASE_URL || "";
let host = "";
try {
  host = new URL(dbUrl).hostname;
} catch {}
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) && process.env.ALLOW_NON_LOCAL_TEST_DB !== "1") {
  console.error(`\n[tests] Từ chối chạy: CUSTOM_DATABASE_URL không trỏ tới DB local (host "${host || "?"}").\n`);
  process.exit(1);
}

process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "commonjs", moduleResolution: "node", jsx: "react-jsx" });
require("ts-node/register");

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "@/lib/prisma") return path.join(__dirname, "prisma.cjs");
  if (request.startsWith("@/")) return resolve.call(this, path.join(root, request.slice(2)), parent, ...rest);
  return resolve.call(this, request, parent, ...rest);
};
