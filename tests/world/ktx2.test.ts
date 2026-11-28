import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KTX2_READY, ktx2Url } from "../../lib/world/ktx2";
import { AVATARS } from "../../lib/world/avatars";

const ROOT = join(__dirname, "..", "..");
type Mod = Record<string, (...a: unknown[]) => unknown>;
const script = () => (new Function("u", "return import(u)") as (u: string) => Promise<Mod>)("file://" + join(ROOT, "scripts", "ktx2-convert.mjs").replace(/\\/g, "/"));

test("ktx2Url: asset có bản KTX2 → thư mục con ktx2/, giữ nguyên gốc + query; asset khác → null", () => {
  assert.equal(ktx2Url("/world/avatars/ki.vrm"), "/world/avatars/ktx2/ki.vrm");
  assert.equal(ktx2Url("https://cdn.example/x/avatars/savi.vrm?v=2"), "https://cdn.example/x/avatars/ktx2/savi.vrm?v=2");
  assert.equal(ktx2Url("avatars/boy02.vrm"), "avatars/ktx2/boy02.vrm");
  assert.equal(ktx2Url("/world/avatars/unknown.vrm"), null);
  assert.equal(ktx2Url("/world/props/hub_plaza.glb"), null);
  assert.equal(ktx2Url("/world/avatars/ktx2/ki.vrm"), null, "không lồng ktx2/ktx2");
});

test("KTX2_READY chỉ gồm file nhân vật có thật trong danh mục", () => {
  const files = new Set(AVATARS.map((a) => a.file));
  for (const f of KTX2_READY) assert.ok(files.has(f), f);
});

test("bộ giải mã Basis ở public/world/basis khớp bản của three (nâng three → chạy lại --transcoder)", () => {
  for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
    const a = readFileSync(join(ROOT, "public", "world", "basis", f));
    const b = readFileSync(join(ROOT, "node_modules", "three", "examples", "jsm", "libs", "basis", f));
    assert.ok(a.equals(b), f);
  }
});

/** GLB giả kiểu VRM 0.x: 2 accessor + 4 ảnh (màu, normal, outline-width, thumbnail) */
function fakeVrm() {
  const acc = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const imgs = [new Uint8Array([0x89, 0x50, 1]), new Uint8Array([0x89, 0x50, 2, 2]), new Uint8Array([0x89, 0x50, 3, 3, 3]), new Uint8Array([0x89, 0x50, 4])];
  const parts = [acc, ...imgs];
  const views: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  let off = 0;
  const chunks: Uint8Array[] = [];
  for (const p of parts) {
    const pad = (4 - (off % 4)) % 4;
    chunks.push(new Uint8Array(pad));
    off += pad;
    views.push({ buffer: 0, byteOffset: off, byteLength: p.length });
    chunks.push(p);
    off += p.length;
  }
  const bin = new Uint8Array(off);
  let q = 0;
  for (const c of chunks) {
    bin.set(c, q);
    q += c.length;
  }
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: off }],
    bufferViews: views,
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: "VEC3" }],
    images: imgs.map((_, i) => ({ bufferView: i + 1, mimeType: "image/png", name: `img${i}` })),
    textures: [{ source: 0, sampler: 0 }, { source: 1 }, { source: 2 }, { source: 3 }, { source: 0 }],
    materials: [{ name: "Body", pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    extensionsUsed: ["VRM"],
    extensions: {
      VRM: {
        meta: { title: "x", texture: 3 },
        materialProperties: [{ name: "Body", shader: "VRM/MToon", textureProperties: { _MainTex: 0, _ShadeTexture: 4, _BumpMap: 1, _OutlineWidthTexture: 2 } }],
      },
    },
  };
  return { json, bin, acc };
}

test("ktx2-convert: phân loại ảnh theo nơi dùng (màu / normal / tuyến tính / thumbnail giữ nguyên)", async () => {
  const m = await script();
  const { json } = fakeVrm();
  const roles = m.classifyImages(json) as Map<number, string>;
  assert.equal(roles.get(0), "color");
  assert.equal(roles.get(1), "normal");
  assert.equal(roles.get(2), "linear");
  assert.equal(roles.get(3), "skip");
});

test("ktx2-convert: thay ảnh tại chỗ — giữ chỉ số, VRM nguyên vẹn, accessor nguyên byte, KHR_texture_basisu bắt buộc", async () => {
  const m = await script();
  const { json, bin, acc } = fakeVrm();
  const k0 = new Uint8Array([0xab, 0x4b, 0x54, 0x58, 1, 2, 3]);
  const k1 = new Uint8Array([0xab, 0x4b, 0x54, 0x58, 9]);
  const out = m.rewriteGlb(json, bin, new Map([[0, k0], [1, k1]])) as { json: typeof json & Record<string, unknown>; bin: Uint8Array };
  const glb = m.writeGlb(out.json, out.bin) as Uint8Array;
  assert.equal(glb.length % 4, 0);
  assert.equal(new DataView(glb.buffer).getUint32(8, true), glb.length);
  const back = m.parseGlb(glb) as { json: typeof out.json; bin: Uint8Array };
  const j = back.json as unknown as Record<string, never> & typeof json;
  assert.deepEqual(j.extensions, json.extensions, "phần mở rộng VRM không đổi");
  assert.deepEqual(j.materials, json.materials);
  assert.equal(j.images.length, 4);
  const view = (i: number) => {
    const v = j.bufferViews[i];
    assert.equal(v.byteOffset % 4, 0);
    return back.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength);
  };
  assert.deepEqual([...view(0)], [...acc], "accessor nguyên byte");
  assert.deepEqual([...view(j.images[0].bufferView)], [...k0]);
  assert.deepEqual([...view(j.images[1].bufferView)], [...k1]);
  assert.equal(j.images[0].mimeType, "image/ktx2");
  assert.equal(j.images[3].mimeType, "image/png");
  const tex = j.textures as unknown as { source?: number; sampler?: number; extensions?: Record<string, { source: number }> }[];
  assert.equal(tex[0].source, undefined);
  assert.equal(tex[0].extensions?.KHR_texture_basisu.source, 0);
  assert.equal(tex[0].sampler, 0, "giữ sampler");
  assert.equal(tex[4].extensions?.KHR_texture_basisu.source, 0, "mọi texture dùng chung ảnh đều đổi");
  assert.equal(tex[3].source, 3, "thumbnail giữ PNG");
  const jj = j as unknown as { extensionsUsed: string[]; extensionsRequired: string[] };
  assert.ok(jj.extensionsUsed.includes("KHR_texture_basisu") && jj.extensionsUsed.includes("VRM"));
  assert.deepEqual(jj.extensionsRequired, ["KHR_texture_basisu"]);
  const bl = (j.buffers[0] as { byteLength: number }).byteLength;
  assert.ok(bl <= back.bin.length && back.bin.length - bl < 4, "byteLength của buffer = BIN (trừ đệm ≤ 3 byte)");
});

test("ktx2-convert: mã hoá thật một ảnh nhỏ ra KTX2 (ETC1S màu, UASTC normal) + ảnh một màu thu về 4×4", async () => {
  const m = await script();
  const sharp = (await (new Function("u", "return import(u)") as (u: string) => Promise<{ default: (o: unknown, opt?: unknown) => { png: () => { toBuffer: () => Promise<Buffer> } } }>)("sharp")).default;
  const px = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < px.length; i += 4) px.set([i % 255, (i * 7) % 255, 90, 255], i);
  const png = await sharp(px, { raw: { width: 16, height: 16, channels: 4 } } as never).png().toBuffer();
  const flat = await sharp(Buffer.alloc(64 * 64 * 4, 128), { raw: { width: 64, height: 64, channels: 4 } } as never).png().toBuffer();
  const enc = (await m.makeEncoder()) as (b: Uint8Array, k: string, o: unknown) => Promise<{ data: Uint8Array; w: number; h: number; uastc: boolean }>;
  const opt = { quality: 128, max: 0, min: 4, uastcAll: false };
  const magic = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb];
  const a = await enc(new Uint8Array(png), "color", opt);
  assert.deepEqual([...a.data.subarray(0, 8)], magic);
  assert.equal(a.uastc, false);
  const b = await enc(new Uint8Array(png), "normal", opt);
  assert.deepEqual([...b.data.subarray(0, 8)], magic);
  assert.equal(b.uastc, true);
  const c = await enc(new Uint8Array(flat), "normal", opt);
  assert.deepEqual([c.w, c.h], [4, 4]);
});
