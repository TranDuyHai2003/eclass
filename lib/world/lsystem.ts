/**
 * W6 — CÂY VOXEL L-SYSTEM (Prusinkiewicz & Lindenmayer, "The Algorithmic Beauty of Plants" — ABOP ch. 1).
 *
 * Chuỗi được viết lại `iters` lần theo luật của loài, rồi "con rùa" 3D đi theo chuỗi với khung H (hướng), L (trái), U (lên):
 *   F  tiến một bước, vẽ GỖ (raster nối theo MẶT — đổi một trục mỗi lần → cành không rời rạc)
 *   L  khối tán lá (ê-líp rx × ry)          C  một khối pha lê
 *   + −  quay quanh U   & ^  ngẩng / cúi quanh L   / \  lăn quanh H     [ ]  lưu / lấy lại trạng thái     !  bước × shrink
 * Ký tự không có luật còn sót sau lần viết lại cuối (chồi ngọn) → chuỗi `tip` của loài.
 * Tất định: góc dùng dsin/dcos (đa thức), toạ độ chỉ + − × và floor. Gỗ ưu tiên hơn lá (lá không đè gỗ).
 */
import { B } from "./blocks";
import { dcos, dsin } from "./terrain";

export type Species = {
  id: string;
  axiom: string;
  rules: Record<string, string>;
  iters: number;
  /** độ: ngẩng (& ^), lăn (/ \), quay (+ −) */
  pitch: number;
  roll: number;
  yaw: number;
  step: number;
  shrink: number;
  tip: string;
  wood: number;
  leaf: number;
  leafR: [number, number];
};

const RAD = 3.141592653589793 / 180;

export const SPECIES = {
  /** Sồi (đồng cỏ): mỗi mắt 3 cành lăn theo GÓC VÀNG 137,5° — cành không bao giờ chồng đúng lên nhau */
  oak: { id: "oak", axiom: "FFF!A", rules: { A: "[&F!A]/[&F!A]/[&F!A]" }, iters: 3, pitch: 36, roll: 137.5, yaw: 0, step: 1.5, shrink: 0.8, tip: "L", wood: B.wood, leaf: B.leaf, leafR: [2.1, 1.7] },
  /** Thông pha lê: thân thẳng, mỗi tầng 4 cành gần ngang, tầng trên ngắn dần (!), ngọn pha lê */
  pine: { id: "pine", axiom: "FFW", rules: { W: "F[&FL]/[&FL]/[&FL]/[&FL]!FW" }, iters: 4, pitch: 72, roll: 90, yaw: 0, step: 1.7, shrink: 0.78, tip: "FLC", wood: B.wood, leaf: B.pine, leafR: [1.5, 0.8] },
  /** Anh đào (hoàng hôn): dù rộng — 5 cành ngả mạnh, tán dẹt hồng */
  blossom: { id: "blossom", axiom: "FFFA", rules: { A: "[&F!A]/[&F!A]/[&F!A]/[&F!A]/[&F!A]" }, iters: 2, pitch: 52, roll: 72, yaw: 0, step: 1.7, shrink: 0.75, tip: "L", wood: B.wood, leaf: B.blossom, leafR: [2.3, 1.2] },
  /** Cây NHỊ PHÂN (Rừng Đồ thị): mỗi nút tách đúng 2 nhánh, lăn 90° giữa các tầng — độ sâu 5 → 2⁵ = 32 lá */
  binary: { id: "binary", axiom: "A", rules: { A: "F/[&!A][^!A]" }, iters: 5, pitch: 30, roll: 90, yaw: 0, step: 2.2, shrink: 0.8, tip: "L", wood: B.wood, leaf: B.leaf, leafR: [1.3, 1.1] },
} satisfies Record<string, Species>;
export type SpeciesId = keyof typeof SPECIES;

/** Viết lại chuỗi `iters` lần; ký tự không có luật còn lại cuối cùng → `tip` */
export function expand(sp: Species): string {
  let s = sp.axiom;
  for (let k = 0; k < sp.iters; k++) {
    let o = "";
    for (const ch of s) o += sp.rules[ch] ?? ch;
    s = o;
  }
  let o = "";
  for (const ch of s) o += sp.rules[ch] !== undefined ? sp.tip : ch;
  return o;
}

type V3 = [number, number, number];
const EXP_CACHE = new Map<string, string>();

/**
 * Mọc một cây tại gốc (x, y, z) — y = ô đầu tiên trên mặt đất. Trả về mảng phẳng [x, y, z, id, …] (toạ độ thế giới).
 * `turn` (0..7) xoay cả cây quanh trục đứng theo bội 45°, `scale` nhân bước.
 */
export function growTree(sp: Species, x: number, y: number, z: number, turn = 0, scale = 1): Int32Array {
  let str = EXP_CACHE.get(sp.id);
  if (str === undefined) {
    str = expand(sp);
    EXP_CACHE.set(sp.id, str);
  }
  const cp = dcos(sp.pitch * RAD);
  const sPitch = dsin(sp.pitch * RAD);
  const cr = dcos(sp.roll * RAD);
  const sr = dsin(sp.roll * RAD);
  const cy = dcos(sp.yaw * RAD);
  const sy = dsin(sp.yaw * RAD);
  const t0 = (turn & 7) * 45 * RAD;
  const c0 = dcos(t0);
  const s0 = dsin(t0);
  // khung ban đầu: H lên, L/U nằm ngang (xoay theo `turn`)
  let H: V3 = [0, 1, 0];
  let L: V3 = [c0, 0, s0];
  let U: V3 = [-s0, 0, c0];
  let p: V3 = [x + 0.5, y, z + 0.5];
  let step = sp.step * scale;
  const stack: { H: V3; L: V3; U: V3; p: V3; step: number }[] = [];
  const cells = new Map<number, number>();
  const K = (ix: number, iy: number, iz: number) => ((ix - x + 512) * 1024 + (iy - y + 512)) * 1024 + (iz - z + 512);
  const put = (ix: number, iy: number, iz: number, id: number, force: boolean) => {
    const k = K(ix, iy, iz);
    if (!force && cells.has(k)) return;
    cells.set(k, id);
  };
  // quay cặp (a, b) trong mặt phẳng của chúng một góc (c = cos, s = sin)
  const rot = (a: V3, b: V3, c: number, s: number): [V3, V3] => [
    [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s],
    [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s],
  ];
  const wood: number[] = [];
  const leaves: number[] = [];
  const crystals: number[] = [];
  for (const ch of str) {
    switch (ch) {
      case "F": {
        const q: V3 = [p[0] + H[0] * step, p[1] + H[1] * step, p[2] + H[2] * step];
        // raster nối theo mặt: lấy mẫu dày, mỗi lần đổi đúng một trục (thứ tự x → y → z)
        let cx = Math.floor(p[0]);
        let cyy = Math.floor(p[1]);
        let cz = Math.floor(p[2]);
        wood.push(cx, cyy, cz);
        const n = Math.max(1, Math.ceil(step * 4));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const tx = Math.floor(p[0] + (q[0] - p[0]) * t);
          const ty = Math.floor(p[1] + (q[1] - p[1]) * t);
          const tz = Math.floor(p[2] + (q[2] - p[2]) * t);
          while (cx !== tx || cyy !== ty || cz !== tz) {
            if (cx !== tx) cx += tx > cx ? 1 : -1;
            else if (cyy !== ty) cyy += ty > cyy ? 1 : -1;
            else cz += tz > cz ? 1 : -1;
            wood.push(cx, cyy, cz);
          }
        }
        p = q;
        break;
      }
      case "L":
        leaves.push(p[0], p[1], p[2]);
        break;
      case "C":
        crystals.push(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]));
        break;
      case "+":
        [H, L] = rot(H, L, cy, sy);
        break;
      case "-":
        [H, L] = rot(H, L, cy, -sy);
        break;
      case "&":
        [H, U] = rot(H, U, cp, sPitch);
        break;
      case "^":
        [H, U] = rot(H, U, cp, -sPitch);
        break;
      case "/":
        [L, U] = rot(L, U, cr, sr);
        break;
      case "\\":
        [L, U] = rot(L, U, cr, -sr);
        break;
      case "[":
        stack.push({ H, L, U, p, step });
        break;
      case "]": {
        const s = stack.pop();
        if (s) ({ H, L, U, p, step } = s);
        break;
      }
      case "!":
        step *= sp.shrink;
        break;
    }
  }
  // gỗ trước (ưu tiên), pha lê, rồi lá chỉ vào ô trống
  for (let i = 0; i < wood.length; i += 3) put(wood[i], wood[i + 1], wood[i + 2], sp.wood, true);
  for (let i = 0; i < crystals.length; i += 3) put(crystals[i], crystals[i + 1], crystals[i + 2], B.crystal, true);
  const [rx, ry] = sp.leafR;
  const rxs = rx * Math.sqrt(scale);
  const rys = ry * Math.sqrt(scale);
  const ex = Math.ceil(rxs);
  const ey = Math.ceil(rys);
  for (let i = 0; i < leaves.length; i += 3) {
    const lx = leaves[i];
    const ly = leaves[i + 1];
    const lz = leaves[i + 2];
    const bx = Math.floor(lx);
    const by = Math.floor(ly);
    const bz = Math.floor(lz);
    for (let dy = -ey; dy <= ey; dy++)
      for (let dz = -ex; dz <= ex; dz++)
        for (let dx = -ex; dx <= ex; dx++) {
          const ux = (bx + dx + 0.5 - lx) / rxs;
          const uy = (by + dy + 0.5 - ly) / rys;
          const uz = (bz + dz + 0.5 - lz) / rxs;
          if (ux * ux + uy * uy + uz * uz <= 1) put(bx + dx, by + dy, bz + dz, sp.leaf, false);
        }
  }
  const out = new Int32Array(cells.size * 4);
  let o = 0;
  for (const [k, id] of cells) {
    const kz = (k % 1024) - 512;
    const r = Math.floor(k / 1024);
    const ky = (r % 1024) - 512;
    const kx = Math.floor(r / 1024) - 512;
    out[o++] = kx + x;
    out[o++] = ky + y;
    out[o++] = kz + z;
    out[o++] = id;
  }
  return out;
}
