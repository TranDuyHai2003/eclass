// Nén texture trong GLB / VRM sang KTX2 (Basis Universal) — nhỏ hơn khi tải, nhỏ hơn 4–8 lần trong bộ nhớ GPU.
//
//   node scripts/ktx2-convert.mjs public/world/avatars           → ghi public/world/avatars/ktx2/<tên>.vrm (giữ nguyên bản gốc)
//   node scripts/ktx2-convert.mjs a.vrm b.glb --quality=200        → chất lượng ETC1S 1–255 (mặc định 200)
//   node scripts/ktx2-convert.mjs … --uastc-all                     → mọi texture dùng UASTC (đẹp hơn, nặng hơn)
//   node scripts/ktx2-convert.mjs … --max=1024                      → thu nhỏ cạnh dài > 1024 (mặc định giữ nguyên)
//   node scripts/ktx2-convert.mjs --transcoder                      → chép bộ giải mã Basis của three vào public/world/basis/
//
// Phụ thuộc (dev): `ktx2-encoder` (npm, bộ mã hoá Basis Universal v2 dạng wasm — không cần toktx / basisu cài máy),
// `sharp` (đã có qua next) để giải PNG / JPEG → RGBA. Không gọi mạng, không tải lên đâu cả.
//
// Cách làm (giữ NGUYÊN chỉ số mọi node / mesh / material / texture / image → phần mở rộng VRM / VRMC_* / MToon không đổi):
//   - Ảnh nhúng (bufferView) được mã hoá lại thành KTX2 tại CHỖ: images[i].mimeType = image/ktx2, bufferView cũ thay bằng dữ liệu mới
//     (nếu bufferView dùng chung với thứ khác thì thêm bufferView mới ở cuối), BIN xếp lại theo đúng thứ tự, căn 4 byte.
//   - Texture trỏ tới ảnh đó: thêm extensions.KHR_texture_basisu.source = i, bỏ texture.source; thêm KHR_texture_basisu vào
//     extensionsUsed + extensionsRequired (máy không có KTX2Loader thì không đọc được → game tải bản gốc, xem lib/world/ktx2.ts).
//   - Loại texture theo nơi dùng: màu (baseColor, emissive, MToon _MainTex / _ShadeTexture / _RimTexture / _SphereAdd / _EmissionMap
//     và VRMC_materials_mtoon tương ứng) → ETC1S sRGB; normal map → UASTC chế độ normal (tuyến tính); dữ liệu tuyến tính
//     (occlusion, metallicRoughness, _OutlineWidthTexture, _ShadingGradeTexture, _ReceiveShadowTexture, _UvAnimMaskTexture,
//     shadingShift / outlineWidthMultiply / uvAnimationMask) → UASTC tuyến tính.
//   - Bỏ qua (giữ PNG / JPEG): ảnh thumbnail của VRM (meta), ảnh không texture nào dùng, cạnh không chia hết cho 4
//     (định dạng nén khối 4×4), ảnh nhỏ hơn --min (mặc định 16 px), ảnh mà KTX2 to hơn bản gốc ≥ 4 lần VÀ bản gốc < 8 KB
//     (ảnh gần như trống — PNG nén tốt hơn, GPU chỉ tốn vài KB).
//   - Luôn sinh mipmap (GLTFLoader đặt lọc mipmap cho mọi texture).
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLB_MAGIC = 0x46546c67;
const EXT = "KHR_texture_basisu";

/** GLB → { json, bin } */
export function parseGlb(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error("không phải GLB");
  if (dv.getUint32(4, true) !== 2) throw new Error("chỉ hỗ trợ glTF 2");
  const total = dv.getUint32(8, true);
  let off = 12;
  let json = null;
  let bin = new Uint8Array(0);
  while (off + 8 <= total) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const body = u8.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error("GLB thiếu khối JSON");
  return { json, bin };
}

/** { json, bin } → GLB (JSON đệm dấu cách, BIN đệm 0, đều căn 4 byte) */
export function writeGlb(json, bin) {
  const js = new TextEncoder().encode(JSON.stringify(json));
  const jl = (js.length + 3) & ~3;
  const bl = bin.length ? (bin.length + 3) & ~3 : 0;
  const total = 12 + 8 + jl + (bl ? 8 + bl : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jl, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20);
  out.fill(0x20, 20 + js.length, 20 + jl);
  if (bl) {
    dv.setUint32(20 + jl, bl, true);
    dv.setUint32(24 + jl, 0x004e4942, true);
    out.set(bin, 28 + jl);
  }
  return out;
}

const V0_COLOR = new Set(["_MainTex", "_ShadeTexture", "_RimTexture", "_SphereAdd", "_EmissionMap"]);
const V0_NORMAL = new Set(["_BumpMap"]);
const MTOON1_COLOR = ["shadeMultiplyTexture", "matcapTexture", "rimMultiplyTexture"];
const MTOON1_LINEAR = ["shadingShiftTexture", "outlineWidthMultiplyTexture", "uvAnimationMaskTexture"];

/**
 * Ảnh nào dùng làm gì: Map<chỉ số ảnh, "color" | "linear" | "normal" | "skip">.
 * Ưu tiên khi một ảnh có nhiều vai: skip > normal > linear > color.
 */
export function classifyImages(json) {
  const role = new Map();
  const rank = { color: 1, linear: 2, normal: 3, skip: 4 };
  const texImg = (ti) => {
    const t = json.textures?.[ti];
    if (!t) return undefined;
    return t.source ?? t.extensions?.[EXT]?.source;
  };
  const mark = (img, r) => {
    if (img === undefined || img === null || img < 0) return;
    const cur = role.get(img);
    if (!cur || rank[r] > rank[cur]) role.set(img, r);
  };
  const markTex = (info, r) => {
    if (info && typeof info.index === "number") mark(texImg(info.index), r);
  };
  for (const m of json.materials ?? []) {
    const pbr = m.pbrMetallicRoughness ?? {};
    markTex(pbr.baseColorTexture, "color");
    markTex(m.emissiveTexture, "color");
    markTex(pbr.metallicRoughnessTexture, "linear");
    markTex(m.occlusionTexture, "linear");
    markTex(m.normalTexture, "normal");
    const mt = m.extensions?.VRMC_materials_mtoon;
    if (mt) {
      for (const k of MTOON1_COLOR) markTex(mt[k], "color");
      for (const k of MTOON1_LINEAR) markTex(mt[k], "linear");
    }
  }
  // VRM 0.x: materialProperties[].textureProperties = { _MainTex: chỉ số texture, … }
  for (const mp of json.extensions?.VRM?.materialProperties ?? []) {
    for (const [k, ti] of Object.entries(mp.textureProperties ?? {})) {
      if (typeof ti !== "number") continue;
      mark(texImg(ti), V0_COLOR.has(k) ? "color" : V0_NORMAL.has(k) ? "normal" : "linear");
    }
  }
  // Thumbnail: VRM0 meta.texture (chỉ số texture), VRM1 VRMC_vrm.meta.thumbnailImage (chỉ số ẢNH) — giữ PNG
  const t0 = json.extensions?.VRM?.meta?.texture;
  if (typeof t0 === "number" && t0 >= 0) mark(texImg(t0), "skip");
  const t1 = json.extensions?.VRMC_vrm?.meta?.thumbnailImage;
  if (typeof t1 === "number") mark(t1, "skip");
  // Texture không vật liệu nào biết vai trò (vd. tiện ích lạ) → coi là màu
  for (const t of json.textures ?? []) {
    const img = t.source ?? t.extensions?.[EXT]?.source;
    if (img !== undefined && !role.has(img)) role.set(img, "color");
  }
  // Ảnh không nằm trong BIN (uri ngoài / data URI) → không đụng
  (json.images ?? []).forEach((im, i) => {
    if (im.bufferView === undefined) role.set(i, "skip");
  });
  return role;
}

/**
 * Thay ảnh đã mã hoá vào GLB. replaced: Map<chỉ số ảnh, Uint8Array KTX2>. Trả { json, bin } mới (json là bản sao).
 * Giữ nguyên chỉ số mọi mảng; dữ liệu các bufferView khác chép nguyên byte.
 */
export function rewriteGlb(json0, bin, replaced) {
  const json = structuredClone(json0);
  const views = json.bufferViews ?? [];
  // bufferView dùng bởi những ai (để biết có thay tại chỗ được không)
  const users = new Map();
  const use = (bv, who) => {
    if (typeof bv !== "number") return;
    if (!users.has(bv)) users.set(bv, []);
    users.get(bv).push(who);
  };
  (json.accessors ?? []).forEach((a, i) => {
    use(a.bufferView, `a${i}`);
    use(a.sparse?.indices?.bufferView, `as${i}`);
    use(a.sparse?.values?.bufferView, `as${i}`);
  });
  (json.images ?? []).forEach((im, i) => use(im.bufferView, `i${i}`));
  const newData = new Map(); // chỉ số bufferView → dữ liệu mới
  for (const [img, data] of replaced) {
    const im = json.images[img];
    const bv = im.bufferView;
    if ((users.get(bv) ?? []).length === 1) newData.set(bv, data);
    else {
      views.push({ buffer: 0, byteLength: data.length });
      im.bufferView = views.length - 1;
      newData.set(views.length - 1, data);
    }
    im.mimeType = "image/ktx2";
    for (const t of json.textures ?? []) {
      if (t.source === img) {
        t.extensions = { ...(t.extensions ?? {}), [EXT]: { source: img } };
        delete t.source;
      }
    }
  }
  // Xếp lại BIN theo thứ tự bufferView, mỗi view căn 4 byte
  const parts = [];
  let off = 0;
  views.forEach((v, i) => {
    if ((v.buffer ?? 0) !== 0) return;
    const pad = (4 - (off % 4)) % 4;
    if (pad) parts.push(new Uint8Array(pad));
    off += pad;
    const data = newData.get(i) ?? bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    parts.push(data);
    v.byteOffset = off;
    v.byteLength = data.length;
    off += data.length;
  });
  const out = new Uint8Array(off);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  if (json.buffers?.[0]) json.buffers[0].byteLength = off;
  if (replaced.size) {
    json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), EXT])];
    json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), EXT])];
  }
  return { json, bin: out };
}

/** Kích thước PNG / JPEG từ phần đầu tệp (null nếu không đọc được) */
export function imageSize(d) {
  if (d[0] === 0x89 && d[1] === 0x50) return [(d[16] << 24) | (d[17] << 16) | (d[18] << 8) | d[19], (d[20] << 24) | (d[21] << 16) | (d[22] << 8) | d[23]];
  if (d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    while (i + 9 < d.length) {
      if (d[i] !== 0xff) return null;
      const m = d[i + 1];
      const len = (d[i + 2] << 8) | d[i + 3];
      if (m >= 0xc0 && m <= 0xc3) return [(d[i + 7] << 8) | d[i + 8], (d[i + 5] << 8) | d[i + 6]];
      i += 2 + len;
    }
  }
  return null;
}

/** Ước lượng bộ nhớ GPU (byte, gồm mipmap ≈ ×4/3): RGBA8 = 4 B/px; ETC1S → BC1/ETC1 (0,5 B/px) hoặc BC3/ETC2 có alpha (1 B/px); UASTC → BC7/ASTC (1 B/px) */
export function gpuBytes(w, h, bpp) {
  return Math.round(w * h * bpp * (4 / 3));
}

export async function makeEncoder() {
  const [{ encodeToKTX2 }, sharpMod] = await Promise.all([import("ktx2-encoder"), import("sharp")]);
  const sharp = sharpMod.default;
  return async (png, kind, opt) => {
    let img = sharp(Buffer.from(png)).ensureAlpha();
    const meta = await sharp(Buffer.from(png)).metadata();
    let w = meta.width;
    let h = meta.height;
    if (opt.max && Math.max(w, h) > opt.max) {
      const k = opt.max / Math.max(w, h);
      w = Math.max(4, Math.round((w * k) / 4) * 4);
      h = Math.max(4, Math.round((h * k) / 4) * 4);
      img = img.resize(w, h, { fit: "fill", kernel: "lanczos3" });
    }
    let raw = await img.raw().toBuffer({ resolveWithObject: true });
    // Ảnh một màu (VRoid hay có normal map phẳng 2048², mặt nạ trắng…): lấy mẫu ở mọi độ phân giải đều như nhau → 4×4
    const al = raw.data.byteOffset % 4 ? new Uint8Array(raw.data) : raw.data;
    const d0 = new Uint32Array(al.buffer, al.byteOffset, al.length >> 2);
    if (d0.length > 16 && d0.every((v) => v === d0[0])) {
      raw = { data: Buffer.from(raw.data.subarray(0, 64)), info: { width: 4, height: 4 } };
      w = h = 4;
    }
    const hasAlpha = (() => {
      const d = raw.data;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
      return false;
    })();
    const srgb = kind === "color";
    const uastc = kind !== "color" || opt.uastcAll;
    const log = console.log; // bộ mã hoá wasm in thông tin từng lát ra stdout dù đã tắt debug
    console.log = () => {};
    const data = await encodeToKTX2(new Uint8Array(raw.data.buffer, raw.data.byteOffset, raw.data.length), {
      imageDecoder: async () => ({ width: raw.info.width, height: raw.info.height, data: new Uint8Array(raw.data.buffer, raw.data.byteOffset, raw.data.length) }),
      isUASTC: uastc,
      isKTX2File: true,
      generateMipmap: true,
      isPerceptual: srgb,
      isSetKTX2SRGBTransferFunc: srgb,
      isNormalMap: kind === "normal",
      // đo trên ảnh 2048² (máy dev): ETC1S mức nén 1 ≈ 15 s (mức 2: 39 s, cùng cỡ tệp); UASTC mức 0 + RDO + zstd ≈ 56 s (mức 2: 160 s)
      ...(uastc ? { needSupercompression: true, enableRDO: true, rdoQualityLevel: 1, uastcLDRQualityLevel: 0 } : { qualityLevel: opt.quality, compressionLevel: 1 }),
    }).finally(() => (console.log = log));
    return { data, w, h, uastc, hasAlpha };
  };
}

async function convertFile(file, outFile, enc, opt) {
  const src = readFileSync(file);
  const { json, bin } = parseGlb(src);
  const roles = classifyImages(json);
  const replaced = new Map();
  const st = { file: basename(file), before: src.length, after: 0, imgBefore: 0, imgAfter: 0, gpuBefore: 0, gpuAfter: 0, n: 0, kept: 0 };
  for (const [i, im] of (json.images ?? []).entries()) {
    const r = roles.get(i);
    if (im.bufferView === undefined) continue;
    const v = json.bufferViews[im.bufferView];
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const wh = imageSize(bytes);
    st.imgBefore += bytes.length;
    if (wh) st.gpuBefore += gpuBytes(wh[0], wh[1], 4);
    const keep = () => {
      st.imgAfter += bytes.length;
      if (wh) st.gpuAfter += gpuBytes(wh[0], wh[1], 4);
      st.kept++;
    };
    if (!r || r === "skip" || !wh || wh[0] % 4 || wh[1] % 4 || Math.min(wh[0], wh[1]) < opt.min || im.mimeType === "image/ktx2") {
      keep();
      continue;
    }
    const e = await enc(bytes, r, opt);
    if (e.data.length > bytes.length * 4 && bytes.length < 8192) {
      keep();
      continue;
    }
    replaced.set(i, e.data);
    st.n++;
    st.imgAfter += e.data.length;
    st.gpuAfter += gpuBytes(e.w, e.h, e.uastc || e.hasAlpha ? 1 : 0.5);
  }
  const out = rewriteGlb(json, bin, replaced);
  const glb = writeGlb(out.json, out.bin);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, glb);
  st.after = glb.length;
  return st;
}

const MB = (b) => (b / 1048576).toFixed(1);
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (k, d) => {
    const a = args.find((x) => x.startsWith(`--${k}=`));
    return a ? Number(a.split("=")[1]) : d;
  };
  if (args.includes("--transcoder")) {
    const from = join(ROOT, "node_modules", "three", "examples", "jsm", "libs", "basis");
    const to = join(ROOT, "public", "world", "basis");
    mkdirSync(to, { recursive: true });
    for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) copyFileSync(join(from, f), join(to, f));
    console.log(`đã chép bộ giải mã Basis → ${to}`);
  }
  const opt = { quality: flag("quality", 200), max: flag("max", 0), min: flag("min", 16), uastcAll: args.includes("--uastc-all") };
  const inputs = args.filter((a) => !a.startsWith("--"));
  const files = [];
  for (const p of inputs) {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p)) if (/\.(glb|vrm)$/i.test(f)) files.push(join(p, f));
    if (statSync(p).isFile()) files.push(p);
  }
  if (files.length) {
    const enc = await makeEncoder();
    const tot = { before: 0, after: 0, imgBefore: 0, imgAfter: 0, gpuBefore: 0, gpuAfter: 0 };
    for (const f of files) {
      const out = join(dirname(f), "ktx2", basename(f));
      if (existsSync(out) && args.includes("--skip-existing")) continue;
      const t0 = Date.now();
      const st = await convertFile(f, out, enc, opt);
      for (const k of Object.keys(tot)) tot[k] += st[k];
      console.log(
        `${st.file}: tệp ${MB(st.before)} → ${MB(st.after)} MB · ảnh ${MB(st.imgBefore)} → ${MB(st.imgAfter)} MB · GPU ${MB(st.gpuBefore)} → ${MB(st.gpuAfter)} MB · ${st.n} ảnh KTX2, ${st.kept} giữ nguyên · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
      );
    }
    console.log(`TỔNG: tệp ${MB(tot.before)} → ${MB(tot.after)} MB · ảnh ${MB(tot.imgBefore)} → ${MB(tot.imgAfter)} MB · GPU ${MB(tot.gpuBefore)} → ${MB(tot.gpuAfter)} MB`);
  }
}
