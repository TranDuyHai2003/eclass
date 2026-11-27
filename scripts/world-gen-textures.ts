/**
 * Nướng texture thủ tục của Math World ra PNG (chạy 1 lần khi đổi bộ sinh):
 *   npx tsx scripts/world-gen-textures.ts
 * → public/world/fx/tex/{water_normal,caustic,streak,noise}.png (RGBA8, lặp liền ô). Bộ sinh: lib/world/texgen.ts.
 * Mã hoá PNG tối giản bằng zlib có sẵn của Node (không thêm phụ thuộc).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genCaustic, genNoise, genStreak, genWaterNormal, type TexData } from "../lib/world/texgen";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(Buffer.from(type, "ascii"), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function png(t: TexData): Buffer {
  const { size, data } = t;
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bit, RGBA
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    raw.set(data.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]);
}

const dir = join(process.cwd(), "public", "world", "fx", "tex");
mkdirSync(dir, { recursive: true });
for (const gen of [genWaterNormal, genCaustic, genStreak, genNoise]) {
  const t0 = performance.now();
  const t = gen();
  const buf = png(t);
  writeFileSync(join(dir, `${t.name}.png`), buf);
  console.log(`${t.name}.png ${t.size}² ${(buf.length / 1024).toFixed(0)} KB (${(performance.now() - t0).toFixed(0)} ms)`);
}
