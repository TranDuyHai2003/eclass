/**
 * Infinite procedural terrain for the Wonder Expanse — deterministic from a seed (same world for everyone),
 * chunked for streaming. Pure functions (usable in workers / server later).
 */
import { WONDER_IDS, type WonderId } from "./wonders";

export const CHUNK = 32;
const SEED = 1729; // số Hardy–Ramanujan

function hash2(x: number, z: number, s = SEED): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, s: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s);
  const b = hash2(ix + 1, iz, s);
  const c = hash2(ix, iz + 1, s);
  const d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, octaves = 4, s = SEED): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, z * f, s + i * 101);
    f *= 2;
    amp *= 0.5;
  }
  return sum / (1 - 0.5 ** octaves);
}

/** Độ cao địa hình (m). Bằng phẳng quanh điểm xuất phát để có chỗ đứng. */
// ───────────── Biome toán học (≈ 20–25% đất liền) ─────────────
export type MathBiome = "function" | "sierpinski" | "fractal" | "saddle";
const MATH_KINDS: MathBiome[] = ["function", "sierpinski", "fractal", "saddle"];
const CELL = 150;
/** Vùng toán học: trục "kỳ quan" nhiễu tần số thấp; loại biome theo ô 150 m (tất định theo hạt) */
export function mathBiome(x: number, z: number): { kind: MathBiome; w: number; cx: number; cz: number } | null {
  const r = Math.hypot(x, z);
  if (r < 60) return null; // quanh điểm xuất phát giữ địa hình thường
  const wv = fbm(x * 0.0035 + 900, z * 0.0035 - 400, 2, 31);
  const w = Math.min(1, Math.max(0, (wv - 0.56) / 0.08));
  if (w <= 0) return null;
  const ci = Math.floor(x / CELL);
  const cj = Math.floor(z / CELL);
  const hsh = Math.abs(Math.imul(ci * 73856093, 1) ^ Math.imul(cj * 19349663, 1)) >>> 0;
  return { kind: MATH_KINDS[hsh % MATH_KINDS.length], w: w * w * (3 - 2 * w), cx: (ci + 0.5) * CELL, cz: (cj + 0.5) * CELL };
}

function mathHeight(kind: MathBiome, x: number, z: number, cx: number, cz: number): number {
  const u = x - cx;
  const v = z - cz;
  switch (kind) {
    case "function":
      // Đồng bằng Hàm số: mặt đất CHÍNH LÀ đồ thị f(x, z) = 6·sin(x/12)·cos(z/15) — đi bộ lên được nơi |f′| ≤ 1
      return 6 * Math.sin(x / 12) * Math.cos(z / 15) + 2;
    case "sierpinski": {
      // Cao nguyên Sierpiński: bậc thang nâng lên ở ô có (i & j) = 0 (theo khối 4×4) — tam giác Sierpiński nhìn từ trên
      const i = Math.floor(x / 4) & 63;
      const j = Math.floor(z / 4) & 63;
      return (i & j) === 0 ? 7 : 1;
    }
    case "fractal": {
      // Cao nguyên Fractal: số vòng lặp thoát của z ↦ z² + c (Mandelbrot), chỉ dùng + − ×
      const ca = u / 45 - 0.6;
      const cb = v / 45;
      let a = 0;
      let b = 0;
      let n = 0;
      for (; n < 24 && a * a + b * b < 4; n++) {
        const t = a * a - b * b + ca;
        b = 2 * a * b + cb;
        a = t;
      }
      return n >= 24 ? 14 : n * 0.5;
    }
    case "saddle":
      // Hồ yên ngựa: z = (x² − y²)/k — điểm yên ngựa ở tâm ô
      return (u * u - v * v) / 260;
  }
}

export function height(x: number, z: number): number {
  const mb = mathBiome(x, z);
  const base = naturalHeight(x, z);
  if (!mb) return base;
  return base + (mathHeight(mb.kind, x, z, mb.cx, mb.cz) - base) * mb.w;
}

function naturalHeight(x: number, z: number): number {
  const hills = fbm(x * 0.018, z * 0.018) * 2 - 1; // -1..1
  const ridges = 1 - Math.abs(fbm(x * 0.009 + 40, z * 0.009 - 17) * 2 - 1);
  let h = hills * 7 + ridges * ridges * 14 - 2;
  const r = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (r - 10) / 22));
  h *= flat * flat * (3 - 2 * flat);
  return h;
}

export type Biome = "meadow" | "crystal" | "dusk" | MathBiome;
export function biome(x: number, z: number): Biome {
  const mb = mathBiome(x, z);
  if (mb && mb.w > 0.5) return mb.kind;
  const b = fbm(x * 0.004 + 300, z * 0.004 - 120, 2, 77);
  return b < 0.42 ? "meadow" : b < 0.6 ? "crystal" : "dusk";
}

export const WATER_LEVEL = -2.2;

/** Màu đỉnh theo độ cao + biome (RGB 0..1) */
export function groundColor(x: number, z: number, h: number): [number, number, number] {
  const bi = biome(x, z);
  if (h < WATER_LEVEL + 0.4) return [0.86, 0.8, 0.6]; // bãi cát
  // Đồng bằng Hàm số: nền giấy kẻ ô — vạch mỗi 8 khối (trục toạ độ đậm hơn)
  if (bi === "function") {
    const gx = ((x % 8) + 8) % 8 === 0;
    const gz = ((z % 8) + 8) % 8 === 0;
    return gx || gz ? [0.42, 0.52, 0.9] : [0.88, 0.9, 0.98];
  }
  if (bi === "sierpinski") return h > 4 ? [0.95, 0.66, 0.6] : [0.98, 0.86, 0.72];
  if (bi === "fractal") {
    const k = Math.min(1, h / 14);
    return [0.35 + 0.25 * k, 0.25 + 0.55 * k, 0.6 + 0.3 * k];
  }
  if (bi === "saddle") return [0.55, 0.85, 0.72];
  const t = Math.min(1, Math.max(0, (h - 0) / 16));
  const palettes: Record<"meadow" | "crystal" | "dusk", [number[], number[], number[]]> = {
    meadow: [[0.3, 0.62, 0.3], [0.47, 0.7, 0.36], [0.92, 0.95, 1]],
    crystal: [[0.32, 0.55, 0.62], [0.55, 0.72, 0.85], [0.95, 0.97, 1]],
    dusk: [[0.55, 0.42, 0.62], [0.78, 0.55, 0.62], [1, 0.92, 0.95]],
  };
  const [lo, mid, top] = palettes[bi as "meadow" | "crystal" | "dusk"];
  const n = valueNoise(x * 0.3, z * 0.3, 9) * 0.08 - 0.04;
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);
  const c = t < 0.6 ? mix(lo, mid, t / 0.6) : mix(mid, top, (t - 0.6) / 0.4);
  return [c[0] + n, c[1] + n, c[2] + n];
}

/** Kỳ quan cố định gần điểm xuất phát (đảm bảo tìm thấy) + ngẫu nhiên ở xa */
const FIXED: Record<string, WonderId> = {
  "2,0": "tesseract",
  "0,-2": "poincare",
  "-2,1": "klein",
  "1,2": "lorenz",
  "-1,-3": "blackhole",
};
export function chunkWonder(cx: number, cz: number): { id: WonderId; x: number; z: number } | null {
  const key = `${cx},${cz}`;
  const fixed = FIXED[key];
  const r = hash2(cx, cz, 4242);
  if (!fixed && (Math.abs(cx) + Math.abs(cz) <= 3 || r > 0.12)) return null;
  const id = fixed ?? WONDER_IDS[Math.floor(hash2(cx, cz, 99) * WONDER_IDS.length)];
  return { id, x: cx * CHUNK + CHUNK / 2, z: cz * CHUNK + CHUNK / 2 };
}

/** Cây trong một chunk (xác định theo seed) */
export function chunkTrees(cx: number, cz: number, max = 14): { x: number; z: number; s: number }[] {
  const out: { x: number; z: number; s: number }[] = [];
  const n = Math.floor(hash2(cx, cz, 7) * max);
  for (let i = 0; i < n; i++) {
    const x = cx * CHUNK + hash2(cx * 31 + i, cz, 11) * CHUNK;
    const z = cz * CHUNK + hash2(cx, cz * 31 + i, 13) * CHUNK;
    const h = height(x, z);
    if (h < WATER_LEVEL + 0.6 || h > 11 || Math.hypot(x, z) < 12) continue;
    out.push({ x, z, s: 0.8 + hash2(i, cx + cz, 17) * 0.9 });
  }
  return out;
}

// ───────────── Voxel (khối 1 m, kiểu Minecraft) ─────────────

/** Cache độ cao theo cột: dựng mesh / va chạm gọi rất nhiều lần cho cùng một ô */
const TOP_CACHE = new Map<number, number>();
const TOP_CACHE_MAX = 400_000;

/** Độ cao mặt trên của cột khối tại ô (x, z) — số nguyên */
export function blockTop(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const k = ix * 200003 + iz; // |x|, |z| < 10^5 → không trùng khoá
  let v = TOP_CACHE.get(k);
  if (v === undefined) {
    if (TOP_CACHE.size > TOP_CACHE_MAX) TOP_CACHE.clear();
    v = Math.floor(height(ix + 0.5, iz + 0.5));
    TOP_CACHE.set(k, v);
  }
  return v;
}

export type BlockKind = "grass" | "sand" | "snow" | "dirt" | "stone";
export function topKind(x: number, z: number, top: number): BlockKind {
  if (top <= WATER_LEVEL + 0.5) return "sand";
  if (top >= 19) return "snow";
  if (top >= 15) return "stone";
  return "grass";
}
