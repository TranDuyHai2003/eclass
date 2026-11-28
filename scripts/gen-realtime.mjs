// Sinh mã server realtime từ TypeScript dùng chung (bỏ kiểu TypeScript, gộp thành MỘT file vì Dockerfile realtime chỉ chép *.mjs):
//   realtime/vault.mjs ← lib/world/vault/*.ts   (Hầm Bổ đề)
//   realtime/forge.mjs ← lib/world/matrixForge.ts (Lò rèn Ma trận: kiểm + khai triển thông điệp "forge")
//   realtime/bossrelay.mjs ← lib/world/bossRelay.ts (boss / sự kiện Vùng Kỳ quan nhiều người: kiểm triệu hồi, chọn chủ trận)
//   node scripts/gen-realtime.mjs          → ghi lại các file trên
//   node scripts/gen-realtime.mjs --check  → thoát 1 nếu file đang có đã cũ (tests/world/vaultSync.test.ts dùng)
// Quy ước cho lib/world/vault: chỉ import lẫn nhau bằng "./x" (named import), không import gì ngoài thư mục, không trùng tên
// khai báo cấp cao nhất giữa các file (script kiểm và báo lỗi). lib/world/matrixForge.ts: không import gì.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** thứ tự phụ thuộc */
const TARGETS = [
  { dir: "lib/world/vault", modules: ["geom", "konigsberg", "balance", "fourier", "threshold", "run"], out: "realtime/vault.mjs", from: "lib/world/vault/*.ts" },
  { dir: "lib/world", modules: ["matrixForge"], out: "realtime/forge.mjs", from: "lib/world/matrixForge.ts" },
  { dir: "lib/world", modules: ["bossRelay"], out: "realtime/bossrelay.mjs", from: "lib/world/bossRelay.ts" },
];

export function build(target = TARGETS[0]) {
  const parts = [];
  const seen = new Map();
  for (const m of target.modules) {
    const src = readFileSync(join(ROOT, ...target.dir.split("/"), `${m}.ts`), "utf8");
    let js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false }, fileName: `${m}.ts` }).outputText;
    for (const imp of js.match(/^import[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm) ?? []) {
      const from = /from\s+["']([^"']+)["']/.exec(imp)[1];
      if (!from.startsWith("./") || target.modules.length === 1) throw new Error(`${m}.ts: chỉ được import trong thư mục ${target.dir} (gặp "${from}")`);
      js = js.replace(imp, "");
    }
    js = js.replace(/^export \{\};?\s*$/gm, "");
    for (const [, name] of js.matchAll(/^(?:export )?(?:async )?(?:const|let|var|function\*?|class) ([A-Za-z_$][\w$]*)/gm)) {
      if (seen.has(name)) throw new Error(`trùng tên cấp cao nhất "${name}" ở ${seen.get(name)}.ts và ${m}.ts`);
      seen.set(name, m);
    }
    parts.push(`// ─────────── ${target.dir}/${m}.ts ───────────\n${js.trim()}\n`);
  }
  return `// AUTO-SINH từ ${target.from} bằng scripts/gen-realtime.mjs — ĐỪNG SỬA TAY (sửa file .ts rồi chạy lại script).\n${parts.join("\n")}`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  let stale = false;
  for (const t of TARGETS) {
    const out = build(t);
    const file = join(ROOT, ...t.out.split("/"));
    if (process.argv.includes("--check")) {
      const cur = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
      if (cur !== out) {
        console.error(`${t.out} đã cũ — chạy: node scripts/gen-realtime.mjs`);
        stale = true;
      } else console.log(`${t.out} khớp ${t.from}`);
    } else {
      writeFileSync(file, out);
      console.log(`đã ghi ${file} (${out.length} byte)`);
    }
  }
  if (stale) process.exit(1);
}
