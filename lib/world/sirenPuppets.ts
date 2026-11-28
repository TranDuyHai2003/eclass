/**
 * Con rối giấy của Mê cung Hoạ âm (thuần — test được; hình ở components/world/scene/siren/SirenPuppets.tsx).
 * Thiết kế NGUYÊN BẢN theo chủ đề nhạc cụ: búa đàn diễu hành, kẹp gỗ hợp xướng, đầu máy đếm nhịp lên dây cót, chim âm thoa.
 * Mỗi con rối là khung xương 2D phân cấp (bộ phận cắt giấy trong atlas, khớp quay quanh điểm ghim) dựng trong mặt phẳng
 * quay về máy quay. Chuyển động phân lớp (docs/ai-reviews/siren-witch/PLAN.md):
 *   gốc theo quỹ đạo 60 Hz (beat liên tục) → thân nghiêng theo vận tốc (cảnh) → khớp lệch pha, dáng đổi 12 Hz (puppetTime)
 *   → dây treo rung sau gia tốc (lò xo, cảnh) → mặt flipbook 8 Hz (stopTime) → bóng đổ chuyển động riêng.
 * Nghi thức lặp: đoàn búa đàn diễu quanh mép đấu trường, mỗi beat một bước "lao tới rồi khựng"; dàn hợp xướng nhấp nhô
 * theo canon (mỗi giọng trễ 1/7 chu kỳ).
 */
import { HARMONIC_BPM } from "./harmonicState";
import { PUPPET_RECTS } from "./sirenPuppetAtlas";

const TAU = Math.PI * 2;

/** ô atlas */
export const CELL = {
  hammerHead: 0,
  shank: 1,
  leg: 2,
  peg: 3,
  clip: 4,
  metroBody: 5,
  metroArm: 6,
  key: 7,
  fork: 8,
  wing: 9,
  face0: 10,
  face1: 11,
  face2: 12,
  collar: 13,
  shadow: 14,
  string: 15,
} as const;

/** tỉ lệ rộng / cao của phần hình thật trong ô (atlas vuông → tỉ lệ uv = tỉ lệ điểm ảnh) */
export function cellAspect(cell: number): number {
  const r = PUPPET_RECTS[cell];
  return (r[2] - r[0]) / Math.max(1e-6, r[3] - r[1]);
}

/**
 * Bộ phận: ghim vào cha tại (ax, ay) (m, trong hệ cha, gốc = điểm ghim của cha; cha −1 = gốc con rối ở chân),
 * điểm ghim trên chính ảnh (px, py) ∈ [0, 1]² (0, 0 = dưới-trái), cao h (m), rộng w (mặc định h · tỉ lệ ảnh),
 * z: lớp chồng giấy (m, dương = gần máy quay), mirror: lật ngang ảnh, world: góc KHÔNG kế thừa cha (dây treo luôn rủ theo trọng lực),
 * base: góc nghỉ (rad, ngược chiều kim đồng hồ).
 */
export type PartDef = { cell: number; parent: number; ax: number; ay: number; px: number; py: number; h: number; w?: number; z: number; mirror?: boolean; world?: boolean; base?: number; face?: boolean };
export type Species = "hammer" | "peg" | "metro" | "fork";

const P = (cell: number, parent: number, ax: number, ay: number, px: number, py: number, h: number, z: number, o: Partial<PartDef> = {}): PartDef => ({ cell, parent, ax, ay, px, py, h, z, ...o });

/** Búa đàn diễu hành: cán búa làm thân, đầu búa nỉ đỏ đội mặt nạ, chân dải giấy gấp, chìa cót bên hông, hai dây rối */
const HAMMER: PartDef[] = [
  P(CELL.shank, -1, 0, 1.0, 0.5, 0.02, 1.55, 0),
  P(CELL.leg, 0, -0.1, 0.06, 0.5, 0.98, 1.05, -0.02),
  P(CELL.leg, 0, 0.1, 0.06, 0.5, 0.98, 1.05, -0.03, { mirror: true }),
  P(CELL.key, 0, 0.08, 0.75, 0.5, 0.08, 0.5, -0.04, { base: -Math.PI / 2 }),
  P(CELL.collar, 0, 0, 1.12, 0.5, 0.5, 0.75, 0.02),
  P(CELL.hammerHead, 0, 0, 1.5, 0.45, 0.06, 0.62, 0.03),
  P(CELL.face0, 5, -0.14, 0.3, 0.5, 0.5, 0.52, 0.05, { face: true }),
  P(CELL.string, 5, -0.42, 0.42, 0.5, 0, 7, -0.01, { w: 0.03, world: true }),
  P(CELL.string, 5, 0.4, 0.2, 0.5, 0, 7, -0.01, { w: 0.03, world: true }),
];
/** Kẹp gỗ hợp xướng: hai nửa kẹp làm chân (mở / khép như kéo), cổ áo xếp ly làm thân, tay kẹp giấy treo dây */
const PEG: PartDef[] = [
  P(CELL.peg, -1, -0.06, 1.25, 0.5, 0.96, 1.3, 0),
  P(CELL.peg, -1, 0.06, 1.25, 0.5, 0.96, 1.3, 0.01, { mirror: true }),
  P(CELL.collar, -1, 0, 1.3, 0.5, 0.5, 0.85, 0.02),
  P(CELL.face0, 2, 0, 0.28, 0.5, 0.12, 0.8, 0.04, { face: true }),
  P(CELL.clip, 2, -0.3, 0.05, 0.5, 0.95, 0.85, -0.01),
  P(CELL.clip, 2, 0.3, 0.05, 0.5, 0.95, 0.85, -0.02, { mirror: true }),
  P(CELL.string, 4, 0, -0.78, 0.5, 0, 8, -0.03, { w: 0.03, world: true }),
  P(CELL.string, 5, 0, -0.78, 0.5, 0, 8, -0.03, { w: 0.03, world: true }),
];
/** Đầu máy đếm nhịp: thân kim tự tháp làm đầu, quả lắc gõ nhịp, chìa cót hông, chân dải giấy */
const METRO: PartDef[] = [
  P(CELL.leg, -1, -0.2, 0.95, 0.5, 0.98, 0.95, -0.01),
  P(CELL.leg, -1, 0.2, 0.95, 0.5, 0.98, 0.95, -0.02, { mirror: true }),
  P(CELL.metroBody, -1, 0, 0.85, 0.5, 0.02, 1.7, 0),
  P(CELL.face0, 2, 0, 0.5, 0.5, 0.5, 0.62, 0.02, { face: true }),
  P(CELL.metroArm, 2, 0, 0.22, 0.5, 0.04, 1.75, 0.04),
  P(CELL.key, 2, 0.3, 0.7, 0.5, 0.08, 0.55, -0.02, { base: -Math.PI / 2 }),
];
/** Chim âm thoa: âm thoa nằm ngang làm thân (chạc làm đuôi), hai cánh quạt giấy nhạc, mặt nạ ở đầu cán */
const FORK: PartDef[] = [
  P(CELL.fork, -1, 0, 0, 0.5, 0.5, 1.5, 0, { base: Math.PI / 2 }),
  P(CELL.wing, -1, 0.02, 0.08, 0.04, 0.5, 0.8, -0.02, { base: 0.6 }),
  P(CELL.wing, -1, -0.02, 0.08, 0.04, 0.5, 0.8, -0.03, { base: -0.6, mirror: true }),
  P(CELL.face0, -1, 0.62, 0, 0.5, 0.5, 0.45, 0.03, { face: true }),
];
export const RIGS: Record<Species, PartDef[]> = { hammer: HAMMER, peg: PEG, metro: METRO, fork: FORK };
/** con rối đi trên mặt đất (có bóng đổ) — đoàn búa đàn diễu "trên không" ngoài mép đấu trường, treo bằng dây rối */
export const GROUNDED: Record<Species, boolean> = { hammer: false, peg: false, metro: true, fork: false };
/** tỉ lệ cả con rối (khung xương tính theo m ở tỉ lệ 1) */
export const SPECIES_SCALE: Record<Species, number> = { hammer: 0.75, peg: 0.85, metro: 0.85, fork: 0.8 };

// ───────────── Đoàn rối (nghi thức lặp) ─────────────
export type Puppet = { sp: Species; seed: number; /** chỉ số trong đoàn */ j: number; /** tham số quỹ đạo */ a: number; b: number; c: number; cx: number; cz: number; r: number };
/** bán kính đường diễu: NGOÀI mép đấu trường (15,6) — không che trận đánh / chỗ xuất hiện, bước trên khoảng không */
export const MARCH_R = 16.6;
/** bước mỗi beat (m) */
export const MARCH_STEP = 0.8;
export const MARCH_GAP = 1.7;
export const CHOIR_R = 18.5;
export const CHOIR_N = 7;
/** sân khu (lib/world/sirenMaze COURTS) — chép toạ độ để lib này không phụ thuộc mê cung */
const COURT_XZ: [number, number][] = [
  [0, 44],
  [44, 0],
  [0, -44],
  [-44, 0],
];

export const TROUPE: Puppet[] = [
  // đoàn búa đàn: 10 con nối đuôi, đi quanh ngoài mép đấu trường (góc tăng: x = cos, z = sin)
  ...Array.from({ length: 10 }, (_, j): Puppet => ({ sp: "hammer", seed: j * 0.618, j, a: Math.PI / 2 - (j * MARCH_GAP) / MARCH_R, b: 0, c: 0, cx: 0, cz: 0, r: MARCH_R })),
  // dàn hợp xướng 7 giọng lơ lửng trên vực, cung Đông Bắc (giữa cầu Đông và cầu Bắc)
  ...Array.from({ length: CHOIR_N }, (_, j): Puppet => ({ sp: "peg", seed: 0.3 + j * 0.41, j, a: -Math.PI / 4 + (j - (CHOIR_N - 1) / 2) * 0.13, b: 0, c: 0, cx: 0, cz: 0, r: CHOIR_R })),
  // bốn đầu máy đếm nhịp: quỹ đạo Lissajous 2 : 3 trong bốn sân khu
  ...COURT_XZ.map(([cx, cz], j): Puppet => ({ sp: "metro", seed: 0.7 + j * 0.53, j, a: 2, b: 3, c: j * 1.7, cx, cz, r: 4.2 })),
  // sáu chim âm thoa: Lissajous a : b trên đấu trường
  ...[
    [2, 3],
    [3, 5],
    [2, 5],
    [3, 4],
    [4, 5],
    [1, 2],
  ].map(([a, b], j): Puppet => ({ sp: "fork", seed: 0.2 + j * 0.37, j, a, b, c: j * 1.1, cx: 0, cz: 0, r: 8 + (j % 3) * 1.6 })),
];

/** bước diễu "lao tới rồi khựng": 0 vận tốc đúng mỗi beat (smoothstep trong từng beat) — vẫn liên tục C¹ */
export function marchDistance(beat: number): number {
  const f = beat - Math.floor(beat);
  return (Math.floor(beat) + f * f * (3 - 2 * f)) * MARCH_STEP;
}

/** vị trí gốc (chân) của con rối ở beat b (liên tục — 60 Hz) → out[0..2] */
export function rootPos(p: Puppet, beat: number, out: Float32Array | number[], o = 0): void {
  if (p.sp === "hammer") {
    const ang = p.a + marchDistance(beat) / p.r;
    out[o] = Math.cos(ang) * p.r;
    out[o + 1] = 0;
    out[o + 2] = Math.sin(ang) * p.r;
  } else if (p.sp === "peg") {
    // canon: mỗi giọng trượt / nhấp nhô trễ 1/14 chu kỳ 4 beat (giọng đầu và cuối ngược pha)
    const c = (TAU * beat) / 4 - (p.j * Math.PI) / CHOIR_N;
    const ang = p.a + 0.025 * Math.sin(c * 0.5);
    out[o] = Math.cos(ang) * p.r;
    out[o + 1] = 1.2 + 0.35 * Math.sin(c);
    out[o + 2] = Math.sin(ang) * p.r;
  } else if (p.sp === "metro") {
    const th = (TAU * beat) / 48 + p.c;
    out[o] = p.cx + p.r * Math.sin(p.a * th + 0.5);
    out[o + 1] = 0;
    out[o + 2] = p.cz + p.r * Math.sin(p.b * th);
  } else {
    const th = (TAU * beat) / 128 + p.c;
    out[o] = p.r * Math.sin(p.a * th + 0.9);
    out[o + 1] = 8.5 + 1.6 * Math.sin((p.a + p.b) * th * 0.5) + p.j * 0.35;
    out[o + 2] = p.r * Math.sin(p.b * th);
  }
}

/** beat lượng tử hoá theo thời gian con rối 12 Hz (dáng "on twos" như hoạt hình rối) */
export const puppetBeat = (puppetTime: number) => (puppetTime * HARMONIC_BPM) / 60;

/**
 * Góc khớp (cộng vào base) + hệ số co ngang (chìa cót quay 3D giả) của từng bộ phận ở beat lượng tử pb.
 * Trả về độ nhấc thân (m) cộng vào gốc. Không cấp phát.
 */
export function animate(p: Puppet, pb: number, rot: Float32Array, sx: Float32Array): number {
  const rig = RIGS[p.sp];
  for (let k = 0; k < rig.length; k++) {
    rot[k] = rig[k].base ?? 0;
    sx[k] = 1;
  }
  const ph = pb - Math.floor(pb);
  if (p.sp === "hammer") {
    const step = Math.sin(Math.PI * pb);
    rot[0] += 0.06 * Math.sin(TAU * pb + p.seed);
    rot[1] += 0.42 * step;
    rot[2] -= 0.42 * step;
    sx[3] = Math.cos(pb * 2.2 + p.seed * 5);
    // búa gõ xuống đúng beat rồi nhấc lên
    rot[5] += -0.55 * Math.exp(-ph * 7) + 0.14;
    rot[6] += 0.08 * Math.sin(TAU * pb * 0.5);
    return 0.09 * Math.abs(step);
  }
  if (p.sp === "peg") {
    const c = (TAU * pb) / 4 - (p.j * Math.PI) / CHOIR_N;
    const open = 0.12 + 0.16 * Math.sin(Math.PI * pb + p.j);
    rot[0] += open;
    rot[1] -= open;
    rot[3] += 0.16 * Math.sin(c);
    const raise = 0.35 + 0.8 * (0.5 + 0.5 * Math.sin(c));
    rot[4] -= raise;
    rot[5] += 0.35 + 0.8 * (0.5 + 0.5 * Math.sin(c + Math.PI));
    return 0;
  }
  if (p.sp === "metro") {
    rot[4] += 0.5 * Math.cos(Math.PI * pb);
    const st = Math.sin(TAU * pb);
    rot[0] += 0.38 * st;
    rot[1] -= 0.38 * st;
    rot[2] += 0.05 * Math.sin(Math.PI * pb);
    sx[5] = Math.cos(pb * 1.7 + p.seed * 3);
    return 0.06 * Math.abs(st);
  }
  const flap = 0.55 * Math.sin(TAU * pb * 2 + p.seed * 4);
  rot[0] += 0.12 * Math.sin(Math.PI * pb);
  rot[1] += flap;
  rot[2] -= flap;
  return 0;
}

/**
 * Mặt flipbook 8 Hz (stopTime): mở mắt (0) · chớp 2 khung (1) · mắt xoáy (2) — xoáy nhiều hơn khi bất hoà (pha boss II/III).
 * calm (giảm chuyển động): luôn 0.
 */
export function faceFrame(stopTime: number, seed: number, beat: number, dissonance: number, calm = false): 0 | 1 | 2 {
  if (calm) return 0;
  const n = Math.round(stopTime * 8);
  const s = Math.floor(seed * 97);
  if ((n + s * 13) % 29 < 2) return 1;
  if ((n + s * 7) % 61 < 4) return 2;
  if (dissonance > 0.4 && beat - Math.floor(beat / 4) * 4 < 1 && s % 2 === 0) return 2;
  return 0;
}

/** Tư thế 2D đã ghép: tâm quad (cx, cy), góc, rộng (âm = lật), cao, lớp z — mỗi bộ phận 6 số */
export const POSE_STRIDE = 6;
const PIV = new Float32Array(32 * 3);
/**
 * Ghép khung xương 2D (cha trước con): rootAng = nghiêng cả con rối (theo vận tốc), sway = lệch dây treo (rad).
 * out[k·6 …] = cx, cy, góc, w, h, z.
 */
export function compose(rig: PartDef[], rot: Float32Array, sx: Float32Array, rootAng: number, sway: number, out: Float32Array): void {
  for (let k = 0; k < rig.length; k++) {
    const d = rig[k];
    let bx = 0;
    let by = 0;
    let ba = rootAng;
    if (d.parent >= 0) {
      bx = PIV[d.parent * 3];
      by = PIV[d.parent * 3 + 1];
      ba = PIV[d.parent * 3 + 2];
    }
    const c = Math.cos(ba);
    const s = Math.sin(ba);
    const x = bx + c * d.ax - s * d.ay;
    const y = by + s * d.ax + c * d.ay;
    const a = d.world ? rot[k] + sway : ba + rot[k];
    PIV[k * 3] = x;
    PIV[k * 3 + 1] = y;
    PIV[k * 3 + 2] = a;
    const h = d.h;
    const w = (d.w ?? h * cellAspect(d.cell)) * sx[k] * (d.mirror ? -1 : 1);
    // tâm quad = điểm ghim + R(a) · ((0,5 − px)·w, (0,5 − py)·h)
    const ox = (0.5 - d.px) * w;
    const oy = (0.5 - d.py) * h;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const o = k * POSE_STRIDE;
    out[o] = x + ca * ox - sa * oy;
    out[o + 1] = y + sa * ox + ca * oy;
    out[o + 2] = a;
    out[o + 3] = w;
    out[o + 4] = h;
    out[o + 5] = d.z;
  }
}
/** điểm ghim (đã ghép) của bộ phận k sau compose — test */
export const pivotOf = (k: number): [number, number, number] => [PIV[k * 3], PIV[k * 3 + 1], PIV[k * 3 + 2]];

/** tổng số quad (bộ phận + bóng) của cả đoàn */
export const TOTAL_PARTS = TROUPE.reduce((n, p) => n + RIGS[p.sp].length + (GROUNDED[p.sp] ? 1 : 0), 0);
