// Sinh lib/world/assetVersions.json: dấu phiên bản (8 ký tự md5) của mọi file trong public/world, kể cả VRM / KTX2 không
// nằm trong git. worldAsset() gắn "?v=<dấu>" khi tải từ kho CDN → Cloudflare / trình duyệt (cache 7 ngày) tự lấy bản mới khi
// file đổi nội dung mà giữ tên. Chạy lại mỗi lần đổi asset, TRƯỚC khi tải lên kho và push:  node scripts/world-asset-versions.mjs
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "public", "world");
const out = {};
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!name.endsWith(".md")) out[relative(ROOT, p).split(sep).join("/")] = createHash("md5").update(readFileSync(p)).digest("hex").slice(0, 8);
  }
})(ROOT);
writeFileSync(join(process.cwd(), "lib", "world", "assetVersions.json"), JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + "\n");
console.log(Object.keys(out).length, "files");
