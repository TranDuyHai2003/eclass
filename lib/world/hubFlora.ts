/**
 * Quảng trường kiểu Genshin — phần "thực vật" thuần (không three) để kiểm thử:
 *  • khóm hoa theo CỤM một màu (Genshin / Ghost of Tsushima: hoa mọc thành đám cùng loại, không rắc đều): dọc mép lối đá,
 *    vòng quanh gốc cây, quanh bồn đài phun, rìa vườn sinh vật;
 *  • thông số bóng đổ của tán cây (tâm, bán kính, độ cao tán) cho shader bóng giải tích trên sàn + cỏ + hoa.
 */
import { AXES, FOUNTAINS, GARDEN, PATH_HALF, PROPS, isBed, pathDistance } from "./hubLayout";

export interface Clump {
  x: number;
  z: number;
  /** 0 cúc trắng · 1 cosmos hồng · 2 mao lương vàng · 3 chuông tím (ô atlas) */
  kind: number;
  /** cỡ (1 ≈ cao 0,55 m) */
  s: number;
  yaw: number;
}

function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export const TREES = PROPS.filter((p) => p.kind === "tree" || p.kind === "blossom");

/** chỗ được mọc hoa: bồn cỏ (hoặc vườn sinh vật), không sát gốc cây / bồn đài phun */
export function canBloom(x: number, z: number): boolean {
  const inGarden = Math.hypot(x - GARDEN.x, z - GARDEN.z) < GARDEN.r - 0.4;
  if (!inGarden && !isBed(x, z)) return false;
  // khóm thấp không che mép lối: cách mép đá ≥ 0,25 m
  if (!inGarden && pathDistance(x, z) < PATH_HALF + 0.25) return false;
  for (const t of TREES) if (Math.hypot(x - t.x, z - t.z) < 0.75 * t.s + 0.25) return false;
  for (const f of FOUNTAINS) if (Math.hypot(x - f.x, z - f.z) < f.r + 0.35) return false;
  return true;
}

/** khóm hoa tất định; `n` ≈ số khóm mong muốn (mật độ theo mức đồ hoạ) */
export function flowerClumps(n: number, seed = 7): Clump[] {
  const R = rand(seed);
  const out: Clump[] = [];
  const centers: { x: number; z: number; kind: number; spread: number; k: number }[] = [];
  // 1) mép lối: dải hoa hai bên mỗi lối toả tia (r 13–28), mỗi bên vài cụm
  for (const [ax, az] of AXES) {
    for (const sd of [-1, 1])
      for (let r = 14; r < 28; r += 3.4 + R() * 2) {
        const off = PATH_HALF + 0.55 + R() * 0.7;
        centers.push({ x: ax * r - az * sd * off, z: az * r + ax * sd * off, kind: Math.floor(R() * 4), spread: 1.0, k: 13 });
      }
  }
  // 2) vòng quanh gốc cây (hoa dưới tán — đọc được "góc vườn")
  for (const t of TREES) {
    const m = 3;
    for (let i = 0; i < m; i++) {
      const a = R() * Math.PI * 2;
      const d = 1.4 * t.s + R() * 1.2;
      centers.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, kind: Math.floor(R() * 4), spread: 0.85, k: 9 });
    }
  }
  // 3) quanh bồn đài phun + rìa vườn sinh vật
  for (const f of FOUNTAINS)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + R();
      centers.push({ x: f.x + Math.cos(a) * (f.r + 0.9), z: f.z + Math.sin(a) * (f.r + 0.9), kind: Math.floor(R() * 4), spread: 0.65, k: 8 });
    }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    centers.push({ x: GARDEN.x + Math.cos(a) * (GARDEN.r - 1.2), z: GARDEN.z + Math.sin(a) * (GARDEN.r - 1.2), kind: i % 4, spread: 0.8, k: 7 });
  }
  const total = centers.reduce((s, c) => s + c.k, 0);
  const keep = Math.min(1, n / total);
  for (const c of centers) {
    for (let i = 0; i < c.k; i++) {
      const x = c.x + (R() - 0.5) * 2 * c.spread;
      const z = c.z + (R() - 0.5) * 2 * c.spread;
      const s = 0.65 + R() * 0.55;
      const yaw = R() * Math.PI * 2;
      // màu "lạc" lẻ trong cụm (8%) — tự nhiên hơn khối một màu tuyệt đối
      const kind = R() < 0.08 ? Math.floor(R() * 4) : c.kind;
      if (R() > keep || !canBloom(x, z)) continue;
      out.push({ x, z, kind, s, yaw });
    }
  }
  return out;
}

/** bóng đổ tán: [x, z, bán kính tán, độ cao tâm tán] (khớp hx_tree / hx_blossom: tán y 2,4–6,8 m, r ≈ 2,5 m ở s = 1) */
export const TREE_CASTERS: [number, number, number, number][] = TREES.map((t) => [t.x, t.z, 2.35 * t.s, 4.6 * t.s]);

/**
 * Tâm bóng tán trên mặt đất theo hướng TỚI mặt trời L (chuẩn hoá): lệch ngược nắng h·cot(cao độ), cao độ kẹp ≥ minEl
 * (giờ vàng: bóng dài nhưng không chạy ra khỏi đảo). Khớp công thức trong shader (fx/hubShade.ts).
 */
export function shadowCenter(c: [number, number, number, number], L: [number, number, number], minEl = 0.38): [number, number] {
  const el = Math.max(L[1], minEl);
  const hl = Math.hypot(L[0], L[2]) || 1;
  const cot = Math.sqrt(1 - el * el) / el;
  return [c[0] - (L[0] / hl) * c[3] * cot, c[1] - (L[2] / hl) * c[3] * cot];
}
