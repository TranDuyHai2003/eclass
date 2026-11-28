/**
 * Mê cung Hoạ âm — bản đồ nhiều tầng quanh đấu trường boss + cổng dịch chuyển kiểu Portal + "lỗ hổng vòng lặp".
 * Hàm thuần (không three.js): dùng chung cho cảnh (va chạm, dịch chuyển), hình học và test.
 *
 * Toạ độ: y lên trên, bắc = −z. Đấu trường boss (lib/world/boss.ts) giữ nguyên ở tâm, mặt sàn y = 0, bán kính 15.
 *
 * Tầng:   Đáy  y = −16  (hai đệm sen lơ lửng; rơi khỏi mép → lỗ hổng vòng lặp)
 *         L0   y = 0    (đấu trường + 4 cầu + 4 sân khu + vòng cầu ngoài)
 *         L1   y = 8    (sân đỡ Bồi âm, ban công Giao thoa, Giếng vô tận)
 *         L2   y = 16   (vọng lâu Phổ)
 *         L3   y = 26   (Vương miện Sóng sin)
 * Khu (theo hướng): Nam = Sóng sin · Đông = Bồi âm (ống đàn) · Bắc = Giao thoa · Tây = Phổ.
 *
 * Lỗ hổng vòng lặp:
 *  - Rơi qua đáy (y < WRAP_BOT) → hiện ra từ bầu trời (y + WRAP_H) ngay phía trên, giữ nguyên vận tốc (bay quá trần thì ngược lại).
 *  - Bay / đi quá màn sân khấu (r > WRAP_R) → bước ra từ màn phía đối tâm (dán biên đối tâm như mặt phẳng xạ ảnh).
 * Cổng: mỗi cổng là một khung cứng (tâm c, pháp tuyến n hướng ra phía chơi, trục up), lỗ elip rx × ry.
 *  Đi vào cổng A theo −nA → ra ở cổng B theo +nB; vị trí / vận tốc biến đổi bằng T = M_B · R_y(π) · M_A⁻¹
 *  ("vật nhanh đi vào, vật nhanh đi ra"): cổng sàn → cổng tường biến rơi thành bay ngang, v.v.
 */

import { KEYS, KEY_MAX, STAFF, dynOffset, type DynKind } from "./sirenFloor";

export type V3 = [number, number, number];
export type Zone = "arena" | "sine" | "over" | "inter" | "spec" | "void" | "crown" | "moon" | "cone" | "escher";
export const ZONES: Zone[] = ["arena", "sine", "over", "inter", "spec", "void", "crown", "moon", "cone", "escher"];

/** Mặt đi được: đĩa hoặc tấm chữ nhật xoay quanh trục y (yaw: trục z cục bộ = (sin yaw, cos yaw)) */
export interface Surf {
  id: string;
  kind: "disc" | "box";
  x: number;
  z: number;
  /** cao độ mặt trên */
  y: number;
  r?: number;
  hx?: number;
  hz?: number;
  yaw?: number;
  /** bề dày (khối đặc từ y − thick tới y) */
  thick: number;
  zone: Zone;
  /** bậc thang (vẽ khác, test độ cao bậc) */
  step?: boolean;
  /** phải đi bộ (hoặc qua cổng) tới được từ đấu trường — test kiểm tra */
  reach?: boolean;
  /** đệm nảy: hệ số đàn hồi e (vận tốc bật = e · vận tốc chạm) */
  bounce?: number;
  /** mặt ĐỘNG (lib/world/sirenFloor.ts): đài nổi nhấp nhô · cầu khuông nhạc uốn sóng · phím sàn lò xo; di = chỉ số đài / phím */
  dyn?: DynKind;
  di?: number;
}

/** Tường dựng đứng (tấm hộp) — có thể mang cổng */
export interface Wall {
  id: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
  y0: number;
  y1: number;
  zone: Zone;
}

/** Cột trụ (ống đàn, thanh phổ…) — chặn đi xuyên */
export interface Pillar {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  zone: Zone;
}

export type PortalKind = "wall" | "floor" | "ceil";
export interface Portal {
  id: string;
  /** id cổng nối tới */
  to: string;
  pair: string;
  kind: PortalKind;
  c: V3;
  /** pháp tuyến đơn vị hướng ra phía người chơi đứng */
  n: V3;
  /** trục "lên" của khung (vuông góc n) */
  up: V3;
  rx: number;
  ry: number;
  /** cổng tường: id tường mang cổng (khoét lỗ va chạm) */
  wall?: string;
}

export interface Updraft {
  x: number;
  z: number;
  r: number;
  top: number;
  y?: number;
}

// ───────────── Hằng số ─────────────
export const VOID = -1e4;
/** bước lên tối đa (bậc thang cao ≤ RISE) */
export const STEP_UP = 0.8;
export const RISE = 0.45;
/** tâm thân người chơi cao hơn gót */
export const BODY = 0.9;
export const HEAD = 1.6;
export const WRAP_BOT = -50;
export const WRAP_H = 130;
export const WRAP_TOP = WRAP_BOT + WRAP_H;
export const WRAP_R = 80;
/** tốc độ rơi tối đa (khép vòng lặp rơi vô tận) */
export const TERMINAL = 32;
/** tốc độ tối đa sau khi qua cổng */
export const PORTAL_MAX = 32;
/** khoảng đặt thân ra trước mặt cổng đích */
export const EXIT_OFF = 1.0;
/** chỉ "lên đạn" lại cổng khi thân đã rời mặt cổng xa hơn mức này */
export const REARM = 1.4;
/** tốc độ ra tối thiểu theo pháp tuyến cổng đích (để không bị kẹt / vào lại ngay) */
export const MIN_OUT: Record<PortalKind, number> = { floor: 8, wall: 6, ceil: 1.5 };
/** trọng lực của Player (Hub.tsx) và ma sát trượt sau khi bị bắn ra */
export const GRAVITY = 22;
export const DRAG_AIR = 0.5;
export const DRAG_GROUND = 8;

// ───────────── Bố cục ─────────────
const disc = (id: string, x: number, y: number, z: number, r: number, zone: Zone, thick = 1.2, reach = true): Surf => ({ id, kind: "disc", x, y, z, r, thick, zone, reach });
const box = (id: string, x: number, y: number, z: number, hx: number, hz: number, yaw: number, zone: Zone, thick = 1, reach = true): Surf => ({ id, kind: "box", x, y, z, hx, hz, yaw, thick, zone, reach });
/** Cầu thẳng nối tâm hai điểm (rộng w) */
function bridge(id: string, ax: number, az: number, bx: number, bz: number, y: number, w: number, zone: Zone): Surf {
  const L = Math.hypot(bx - ax, bz - az);
  return box(id, (ax + bx) / 2, y, (az + bz) / 2, w / 2, L / 2, Math.atan2(bx - ax, bz - az), zone, 0.8);
}

/**
 * Cầu thang lơ lửng thẳng từ A (trên mặt dưới) tới B (mép mặt trên): bậc cao đều ≤ RISE, bậc cuối cao bằng B.
 * Các bậc nằm giữa A và B (không đè lên mặt trên nếu đi tới từ bên ngoài).
 */
export function stairs(id: string, a: V3, b: V3, w: number, zone: Zone): Surf[] {
  const n = Math.ceil(Math.abs(b[1] - a[1]) / RISE - 1e-9);
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const out: Surf[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    out.push({ id: `${id}.${i}`, kind: "box", x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + ((b[1] - a[1]) * (i + 1)) / n, hx: w / 2, hz: L / n / 2 + 0.06, yaw, thick: 0.35, zone, step: true, reach: true });
  }
  return out;
}

/** Cầu thang xoắn quanh (cx, cz) bán kính R từ góc a0 tới a1 (rad, ngược chiều kim đồng hồ nhìn từ trên: x = cos, z = sin) */
export function spiral(id: string, cx: number, cz: number, R: number, a0: number, a1: number, y0: number, y1: number, w: number, zone: Zone): Surf[] {
  const n = Math.ceil(Math.abs(y1 - y0) / RISE - 1e-9);
  const arc = (Math.abs(a1 - a0) * R) / n;
  const out: Surf[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const tx = -Math.sin(a) * Math.sign(a1 - a0);
    const tz = Math.cos(a) * Math.sign(a1 - a0);
    out.push({ id: `${id}.${i}`, kind: "box", x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, y: y0 + ((y1 - y0) * (i + 1)) / n, hx: w / 2, hz: arc / 2 + 0.08, yaw: Math.atan2(tx, tz), thick: 0.35, zone, step: true, reach: true });
  }
  return out;
}

/** Bốn đài nổi trong đấu trường (giữ nguyên thiết kế trận boss) */
export const ARENA_PLATFORMS = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  return { x: Math.cos(a) * 10, z: Math.sin(a) * 10, r: 2.6, top: i % 2 ? 5 : 3.4 };
});

/** Sân khu L0 */
export const COURTS: Record<"sine" | "over" | "inter" | "spec", { x: number; z: number; r: number }> = {
  sine: { x: 0, z: 44, r: 10 },
  over: { x: 44, z: 0, r: 10 },
  inter: { x: 0, z: -44, r: 10 },
  spec: { x: -44, z: 0, r: 10 },
};
const CORNERS: [number, number, Zone][] = [
  [31, 31, "sine"],
  [31, -31, "over"],
  [-31, -31, "inter"],
  [-31, 31, "spec"],
];

/** góc kết thúc cầu thang xoắn Đáy → góc Tây Nam: bậc cuối kề mép đĩa góc (bán kính 5) */
const SP = { cx: -26, cz: 26, R: 8.5 };
const SP_END = (() => {
  const d = Math.hypot(-31 - SP.cx, 31 - SP.cz);
  const toCorner = Math.atan2(31 - SP.cz, -31 - SP.cx);
  const want = 5.45;
  const da = Math.acos((SP.R * SP.R + d * d - want * want) / (2 * SP.R * d));
  return toCorner - da;
})();

export const SURFS: Surf[] = [
  // Đấu trường + đài nổi (đài chỉ lên được bằng cột gió / tàu lượn)
  disc("arena", 0, 0, 0, 15.6, "arena", 1.2),
  ...ARENA_PLATFORMS.map((p, i): Surf => ({ ...disc(`plat${i}`, p.x, p.top, p.z, p.r, "arena", 0.9, false), dyn: "plat", di: i })),
  // Bốn cầu chính
  bridge("brS", 0, 14, 0, 35, 0, 4, "sine"),
  bridge("brE", 14, 0, 35, 0, 0, 4, "over"),
  bridge("brN", 0, -14, 0, -35, 0, 4, "inter"),
  bridge("brW", -14, 0, -35, 0, 0, 4, "spec"),
  // Bốn sân khu
  disc("cS", COURTS.sine.x, 0, COURTS.sine.z, 10, "sine", 1.4),
  disc("cE", COURTS.over.x, 0, COURTS.over.z, 10, "over", 1.4),
  disc("cN", COURTS.inter.x, 0, COURTS.inter.z, 10, "inter", 1.4),
  disc("cW", COURTS.spec.x, 0, COURTS.spec.z, 10, "spec", 1.4),
  // Vòng ngoài: 4 đảo góc + 8 cầu gãy khúc
  // góc Đông Nam rộng hơn: Sân Hoà âm (ba đàn một dây, lib/world/sirenMusic.ts)
  ...CORNERS.map(([x, z, zone], i) => disc(`k${i}`, x, 0, z, i === 0 ? 7 : 5, zone, 1)),
  bridge("rSE1", 0, 44, 31, 31, 0, 3, "sine"),
  bridge("rSE2", 31, 31, 44, 0, 0, 3, "over"),
  bridge("rNE1", 44, 0, 31, -31, 0, 3, "over"),
  bridge("rNE2", 31, -31, 0, -44, 0, 3, "inter"),
  bridge("rNW1", 0, -44, -31, -31, 0, 3, "inter"),
  bridge("rNW2", -31, -31, -44, 0, 0, 3, "spec"),
  bridge("rSW1", -44, 0, -31, 31, 0, 3, "spec"),
  bridge("rSW2", -31, 31, 0, 44, 0, 3, "sine"),
  // L1: sân đỡ Bồi âm (nơi cú ném từ Giếng Giao thoa đáp xuống) + cầu thang từ sân Đông
  box("deckE", 32.5, 8, 0, 8.5, 5, 0, "over", 1.2),
  ...stairs("stE", [44, 0, -9.4], [32, 8, -5], 2.2, "over"),
  // L1: ban công Giao thoa nhìn xuống Giếng ném
  disc("balN", 10.5, 8, -49.5, 3.5, "inter", 1),
  ...stairs("stN", [-7, 0, -51], [7.15, 8, -50.6], 2.2, "inter"),
  // L1: Giếng vô tận (cổng sàn dưới, cổng trần trên nắp)
  disc("wellNW", -28, 8, -28, 5, "inter", 1.2),
  disc("lidNW", -28, 21.2, -28, 3, "inter", 1.2, false),
  ...stairs("stNW", [-9.2, 0, -41.5], [-23.45, 8, -30.05], 2.2, "inter"),
  // L2: vọng lâu Phổ + chiếu nghỉ + hai đợt thang gấp khúc
  box("lookW", -38, 16, 0, 5, 5, 0, "spec", 1.2),
  disc("landW", -54, 8, -14, 3.2, "spec", 1),
  ...stairs("stW1", [-38.5, 0, -7.8], [-51, 8, -13.2], 2.2, "spec"),
  ...stairs("stW2", [-55, 8, -11.5], [-40, 16, -5], 2.2, "spec"),
  // L3: Vương miện Sóng sin (lên bằng cột gió hoặc lò xo cổng)
  disc("crown", 0, 26, 40, 6, "crown", 1.5),
  // Đáy: hai đệm sen + thang xoắn lên góc Tây Nam
  disc("bSW", -26, -16, 26, 7, "void", 2),
  disc("bNE", 26, -16, -26, 7, "void", 2),
  ...spiral("spSW", SP.cx, SP.cz, SP.R, SP_END - Math.PI * 1.8, SP_END, -16, 0, 3, "void"),
  // ── Mở rộng thẳng đứng (lib/world/sirenGravity.ts: các vùng trọng lực kỳ dị) ──
  // Đệm nảy: e > 1 nảy cao dần (Đáy → góc Tây Nam; góc Tây Bắc → Giếng vô tận), e < 1 nảy thấp dần (sân Nam, hứng cú nhảy từ Vương miện)
  { ...disc("padSW", -28.5, -15.85, 28.5, 1.6, "void", 0.3), bounce: 1.25 },
  { ...disc("padNW", -31, 0.12, -31, 1.6, "inter", 0.3), bounce: 1.12 },
  { ...disc("padS", 6, 0.12, 38, 1.8, "sine", 0.3), bounce: 0.7 },
  // Hành lang nón sáng L1: ban công Giao thoa → (một chiều) → sân đỡ Bồi âm; giữa đường là cửa Lồng Escher
  box("coneA", 22, 8, -49, 8, 3, 0, "cone", 0.8),
  box("coneB", 27, 8, -25.5, 3, 20.5, 0, "cone", 0.8),
  // Lồng Escher: sàn trong (đứng ở ngưỡng cửa) + mái (chỉ tới bằng bay)
  box("cubeFloor", 36, 8, -30, 6, 6, 0, "escher", 0.6),
  box("cubeRoof", 36, 20.4, -30, 6.3, 6.3, 0, "escher", 0.4, false),
  // Thang trời: Vương miện → Đảo Trăng (trọng lực yếu) → bậc đá → Đỉnh Lỗ sâu
  ...stairs("stSky", [-5.6, 26, 41.5], [-17.2, 36, 50.8], 2.2, "moon"),
  disc("moonI", -24, 36, 52, 7, "moon", 1.6),
  ...[0, 1, 2, 3].map((i) => {
    const a = Math.PI * 0.15 + i * ((70 * Math.PI) / 180);
    return disc(`moonS${i}`, -24 + Math.cos(a) * 9, 39.5 + i * 3.5, 52 + Math.sin(a) * 9, 2, "moon", 1);
  }),
  disc("summit", -24, 53, 52, 6.5, "moon", 1.2),
];
// Mặt động: cầu Nam thành cầu khuông nhạc; mọi bậc cầu thang thành phím sàn (frac = vị trí bậc trong cầu thang)
{
  const staff = SURFS.find((s) => s.id === STAFF.id)!;
  staff.dyn = "staff";
  const groups = new Map<string, Surf[]>();
  for (const s of SURFS) if (s.step) {
    const g = s.id.split(".")[0];
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  let k = 0;
  for (const st of groups.values())
    st.forEach((s, i) => {
      if (k >= KEY_MAX) return;
      s.dyn = "key";
      s.di = k;
      KEYS.frac[k++] = st.length > 1 ? i / (st.length - 1) : 0;
    });
  KEYS.n = k;
}
/** cao độ mặt trên của s tại (x, z) lúc này (mặt tĩnh: s.y) — va chạm CPU dùng CÙNG hàm với hình (sirenFloor) */
export function surfTop(s: Surf, x: number, z: number): number {
  return s.dyn ? s.y + dynOffset(s.dyn, s.di ?? 0, s.x, s.z, s.yaw ?? 0, x, z) : s.y;
}
export const SURF_BY_ID: Record<string, Surf> = Object.fromEntries(SURFS.map((s) => [s.id, s]));

export const WALLS: Wall[] = [
  // Mặt tiền ống đàn ở sân Đông: mang 2 cổng (thấp: Góc gập, cao: Giếng ném)
  { id: "wE", x: 41.5, z: 0, hx: 0.5, hz: 4, yaw: 0, y0: 0, y1: 14, zone: "over" },
  // Bình phong sân Tây (cổng Mưa trần)
  { id: "wW", x: -52.5, z: 0, hx: 0.5, hz: 3, yaw: 0, y0: 0, y1: 5.5, zone: "spec" },
  // Bức tường treo mép vọng lâu (cổng Mạch nước)
  { id: "wL", x: -43.5, z: 0, hx: 0.5, hz: 3, yaw: 0, y0: 16, y1: 21.5, zone: "spec" },
  // Bình phong sân Nam (cổng Góc gập)
  { id: "wS", x: 0, z: 51.5, hx: 3, hz: 0.5, yaw: 0, y0: 0, y1: 5.5, zone: "sine" },
  // Vỏ Lồng Escher (chặn người ở ngoài; cửa ở mặt tây, rộng 3 m, cao 3,2 m)
  { id: "cbWn", x: 29.85, z: -33.75, hx: 0.15, hz: 2.25, yaw: 0, y0: 8, y1: 20.2, zone: "escher" },
  { id: "cbWs", x: 29.85, z: -26.25, hx: 0.15, hz: 2.25, yaw: 0, y0: 8, y1: 20.2, zone: "escher" },
  { id: "cbWt", x: 29.85, z: -30, hx: 0.15, hz: 1.5, yaw: 0, y0: 11.2, y1: 20.2, zone: "escher" },
  { id: "cbE", x: 42.15, z: -30, hx: 0.15, hz: 6.3, yaw: 0, y0: 8, y1: 20.2, zone: "escher" },
  { id: "cbN", x: 36, z: -36.15, hx: 6.3, hz: 0.15, yaw: 0, y0: 8, y1: 20.2, zone: "escher" },
  { id: "cbS", x: 36, z: -23.85, hx: 6.3, hz: 0.15, yaw: 0, y0: 8, y1: 20.2, zone: "escher" },
];
export const WALL_BY_ID: Record<string, Wall> = Object.fromEntries(WALLS.map((w) => [w.id, w]));

/** Cổng động (màn chắn quanh rương thưởng): chặn khi đóng; câu đố / cơ chế tổ đội mở (lib/world/sirenMusic.ts) */
export interface Gate {
  id: string;
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
}
export const GATES: Gate[] = [
  // giữa Sân Hoà âm (ba đàn một dây đúng quãng thì mở)
  { id: "harmony", x: 31, z: 31, r: 1.5, y0: 0, y1: 3.5 },
  // cạnh hai bệ hợp âm sân Tây (hai bệ cùng ngân thì mở)
  { id: "chord", x: -42, z: 7.5, r: 1.3, y0: 0, y1: 3 },
];
/** Trạng thái mở cổng (cảnh đặt) */
export const GATE_OPEN: Record<string, boolean> = {};

/** Ống đàn bồi âm: chiều cao 24/n (dãy điều hoà) — cột mốc khu Đông */
export const PIPES: Pillar[] = [1, 2, 3, 4, 5, 6].map((n, i) => ({ x: 47 + (i % 2) * 2.6, z: -6 + i * 2.4, r: 1.1 - i * 0.08, y0: 0, y1: 24 / n + 2, zone: "over" as Zone }));
/** Thanh phổ (biên độ các hoạ âm của sóng vuông: 1/n với n lẻ) — cột mốc khu Tây, quanh vọng lâu */
export const BARS: Pillar[] = [1, 3, 5, 7, 9].map((n, i) => ({ x: -36 + i * 2.2, z: 7.5, r: 0.75, y0: 0, y1: 14 / n + 1.5, zone: "spec" as Zone }));
export const PILLARS: Pillar[] = [...PIPES, ...BARS];

const UPY: V3 = [0, 1, 0];
export const PORTALS: Portal[] = [
  // A · Giếng ném: rơi vào sàn sân Giao thoa → bắn ngang ra khỏi mặt tiền ống đàn, đáp xuống sân đỡ L1
  { id: "A1", to: "A2", pair: "A", kind: "floor", c: [5, 0, -47], n: [0, 1, 0], up: [0, 0, -1], rx: 1.8, ry: 1.8 },
  { id: "A2", to: "A1", pair: "A", kind: "wall", c: [41, 9.75, 0], n: [-1, 0, 0], up: UPY, rx: 1.3, ry: 1.75, wall: "wE" },
  // B · Mưa trần: bước vào bình phong sân Tây → rơi xuống từ trần dưới vọng lâu; cưỡi cột gió lên trần → bay ngang ra bình phong
  { id: "B1", to: "B2", pair: "B", kind: "wall", c: [-52, 1.75, 0], n: [1, 0, 0], up: UPY, rx: 1.3, ry: 1.75, wall: "wW" },
  { id: "B2", to: "B1", pair: "B", kind: "ceil", c: [-38, 14.8, 0], n: [0, -1, 0], up: [-1, 0, 0], rx: 1.7, ry: 1.7 },
  // C · Lò xo: sàn đệm Đáy ↔ sàn Vương miện (hai cổng sàn: rơi vào cái này, vọt lên từ cái kia — nảy mãi nếu không lái)
  { id: "C1", to: "C2", pair: "C", kind: "floor", c: [26, -16, -26], n: [0, 1, 0], up: [0, 0, -1], rx: 1.8, ry: 1.8 },
  { id: "C2", to: "C1", pair: "C", kind: "floor", c: [0, 26, 40], n: [0, 1, 0], up: [0, 0, -1], rx: 1.8, ry: 1.8 },
  // D · Góc gập: tường ↔ tường vuông góc (đi về nam ở sân Sóng sin → bước ra về phía tây ở sân Bồi âm)
  { id: "D1", to: "D2", pair: "D", kind: "wall", c: [0, 1.75, 51], n: [0, 0, -1], up: UPY, rx: 1.3, ry: 1.75, wall: "wS" },
  { id: "D2", to: "D1", pair: "D", kind: "wall", c: [41, 1.75, 0], n: [-1, 0, 0], up: UPY, rx: 1.3, ry: 1.75, wall: "wE" },
  // E · Mạch nước: tường vọng lâu L2 ↔ sàn sân Sóng sin (rơi vào sàn → bắn ngang lên vọng lâu)
  { id: "E1", to: "E2", pair: "E", kind: "wall", c: [-43, 17.75, 0], n: [1, 0, 0], up: UPY, rx: 1.3, ry: 1.75, wall: "wL" },
  { id: "E2", to: "E1", pair: "E", kind: "floor", c: [-6, 0, 44], n: [0, 1, 0], up: [0, 0, -1], rx: 1.8, ry: 1.8 },
  // F · Giếng vô tận: trần nắp ngay trên sàn giếng — rơi vào sàn lại rơi ra từ trần, mãi mãi (lái ngang để thoát)
  { id: "F1", to: "F2", pair: "F", kind: "ceil", c: [-28, 20, -28], n: [0, -1, 0], up: [0, 0, -1], rx: 1.6, ry: 1.6 },
  { id: "F2", to: "F1", pair: "F", kind: "floor", c: [-28, 8, -28], n: [0, 1, 0], up: [0, 0, -1], rx: 1.6, ry: 1.6 },
];
export const PORTAL_BY_ID: Record<string, Portal> = Object.fromEntries(PORTALS.map((p) => [p.id, p]));
export const PAIRS: Record<string, { vi: string; en: string; color: string }> = {
  A: { vi: "Giếng ném", en: "Fling Well", color: "#ffba35" },
  B: { vi: "Mưa trần", en: "Ceiling Rain", color: "#55d9f5" },
  C: { vi: "Lò xo", en: "Spring Loop", color: "#ff64b0" },
  D: { vi: "Góc gập", en: "Folded Corner", color: "#ff805d" },
  E: { vi: "Mạch nước", en: "Geyser", color: "#b48cff" },
  F: { vi: "Giếng vô tận", en: "Endless Well", color: "#fff27a" },
};

export const MAZE_UPDRAFTS: Updraft[] = [
  // dưới trần Mưa trần (giang cánh trong cột gió để bị hút lên cổng)
  { x: -38, z: 0, r: 1.5, top: 15.6 },
  // cạnh Vương miện
  { x: 6.5, z: 45, r: 1.5, top: 30 },
];

/** Tên khu (nhãn 3D) */
export const ZONE_LABEL: { zone: string; vi: string; en: string; at: V3 }[] = [
  { zone: "sine", vi: "Vườn Sóng sin", en: "Sine Garden", at: [0, 7, 44] },
  { zone: "over", vi: "Ống Bồi âm", en: "Overtone Pipes", at: [44, 7, 8] },
  { zone: "inter", vi: "Sân Giao thoa", en: "Interference Court", at: [-6, 6, -44] },
  { zone: "spec", vi: "Tháp Phổ", en: "Spectrum Tower", at: [-44, 7, 8] },
  { zone: "cone", vi: "Hành lang Nón sáng (một chiều)", en: "Light-cone Corridor (one way)", at: [20, 12, -49] },
  { zone: "escher", vi: "Lồng Escher — tường nào cũng là sàn", en: "Escher Cage — every wall is a floor", at: [28.5, 13, -30] },
  { zone: "moon", vi: "Đảo Trăng (trọng lực ¼)", en: "Moon Isle (¼ gravity)", at: [-24, 41, 52] },
  { zone: "planet", vi: "Hành tinh tí hon — chạy rồi nhảy để thoát", en: "Tiny Planet — run and jump to escape", at: [-24, 55, 32] },
  { zone: "hole", vi: "Hố đen tí hon", en: "Tiny Black Hole", at: [30, 51, 40] },
  { zone: "worm", vi: "Lỗ sâu", en: "Wormhole", at: [-24, 58, 52] },
];

// ───────────── Hình học điểm ─────────────

/** (x, z) có nằm trong hình chiếu của mặt / tường không (lề pad mở rộng) */
export function inFootprint(s: { kind?: "disc" | "box"; x: number; z: number; r?: number; hx?: number; hz?: number; yaw?: number }, x: number, z: number, pad = 0): boolean {
  const dx = x - s.x;
  const dz = z - s.z;
  if (s.kind === "disc") return dx * dx + dz * dz <= ((s.r ?? 0) + pad) ** 2;
  const c = Math.cos(s.yaw ?? 0);
  const sn = Math.sin(s.yaw ?? 0);
  // trục z cục bộ = (sin yaw, cos yaw), trục x cục bộ = (cos yaw, −sin yaw)
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  return Math.abs(lx) <= (s.hx ?? 0) + pad && Math.abs(lz) <= (s.hz ?? 0) + pad;
}

/** Hai mặt sàn có chồng lên nhau (theo mặt bằng) không — lấy mẫu lưới trên mặt nhỏ hơn */
export function surfsOverlap(a: Surf, b: Surf, step = 0.35): boolean {
  const ra = a.kind === "disc" ? a.r! : Math.hypot(a.hx!, a.hz!);
  const rb = b.kind === "disc" ? b.r! : Math.hypot(b.hx!, b.hz!);
  if (Math.hypot(a.x - b.x, a.z - b.z) > ra + rb) return false;
  const [s, o, R] = ra <= rb ? [a, b, ra] : [b, a, rb];
  for (let x = -R; x <= R; x += step)
    for (let z = -R; z <= R; z += step) {
      const px = s.x + x;
      const pz = s.z + z;
      if (inFootprint(s, px, pz, -0.02) && inFootprint(o, px, pz, -0.02)) return true;
    }
  return false;
}

/** Hạ mặt VẼ mỗi tầng (m) — đủ lớn cho độ chính xác depth ở ~100 m, đủ nhỏ để mắt không thấy bậc ở mép nối */
export const RENDER_SINK = 0.025;
/**
 * Chống z-fighting: các mặt sàn chồng nhau ở CÙNG cao độ (cầu × sân, vành đai × sân, bậc × đài…) được xếp tầng vẽ
 * bằng tô màu đồ thị tham lam (mặt lớn trước → tầng 0; mặt chồng lên mặt đã xếp cùng độ cao lấy tầng trống nhỏ nhất).
 * Chỉ dùng để VẼ (mặt hạ RENDER_SINK × tầng); va chạm / đứng vẫn theo Surf.y. extra: mặt vẽ riêng ngoài SURFS (đấu trường) giữ tầng 0.
 */
export function renderLayers(surfs: Surf[] = SURFS): Map<string, number> {
  const area = (s: Surf) => (s.kind === "disc" ? Math.PI * s.r! * s.r! : 4 * s.hx! * s.hz!);
  const order = [...surfs].sort((a, b) => (a.zone === "arena" ? -1 : 0) - (b.zone === "arena" ? -1 : 0) || area(b) - area(a));
  const out = new Map<string, number>();
  const done: Surf[] = [];
  for (const s of order) {
    const used = new Set<number>();
    for (const d of done) if (Math.abs(d.y - s.y) < 0.02 && surfsOverlap(s, d)) used.add(out.get(d.id)!);
    let k = 0;
    while (used.has(k)) k++;
    out.set(s.id, k);
    done.push(s);
  }
  return out;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Hệ trục của cổng: right = up × n, up, n (tam diện thuận) */
export function basis(p: Portal): { r: V3; u: V3; n: V3 } {
  return { r: cross(p.up, p.n), u: p.up, n: p.n };
}
/** Toạ độ cục bộ (theo r, u, n) của điểm q */
export function toLocal(p: Portal, q: V3): V3 {
  const b = basis(p);
  const d = sub(q, p.c);
  return [dot(d, b.r), dot(d, b.u), dot(d, b.n)];
}
export function fromLocal(p: Portal, l: V3): V3 {
  const b = basis(p);
  return [p.c[0] + b.r[0] * l[0] + b.u[0] * l[1] + b.n[0] * l[2], p.c[1] + b.r[1] * l[0] + b.u[1] * l[1] + b.n[1] * l[2], p.c[2] + b.r[2] * l[0] + b.u[2] * l[1] + b.n[2] * l[2]];
}
/** Đổi hướng (vectơ tự do) qua cặp cổng: R_y(π) trong hệ cục bộ → (−r, u, −n) */
export function mapDir(src: Portal, dst: Portal, v: V3): V3 {
  const a = basis(src);
  const b = basis(dst);
  const lr = -dot(v, a.r);
  const lu = dot(v, a.u);
  const ln = -dot(v, a.n);
  return [b.r[0] * lr + b.u[0] * lu + b.n[0] * ln, b.r[1] * lr + b.u[1] * lu + b.n[1] * ln, b.r[2] * lr + b.u[2] * lu + b.n[2] * ln];
}
export function mapPoint(src: Portal, dst: Portal, q: V3): V3 {
  const l = toLocal(src, q);
  return fromLocal(dst, [-l[0], l[1], -l[2]]);
}

/** Lỗ elip có chứa điểm cục bộ (lr, lu) không (scale < 1 thu hẹp) */
export function inAperture(p: Portal, lr: number, lu: number, scale = 1): boolean {
  return (lr / (p.rx * scale)) ** 2 + (lu / (p.ry * scale)) ** 2 <= 1;
}

/**
 * Đoạn a → b (tâm thân) có xuyên mặt cổng từ phía trước ra phía sau, trong lỗ elip không.
 * Trả về tỉ lệ t và toạ độ cục bộ điểm cắt.
 */
export function crossing(p: Portal, a: V3, b: V3): { t: number; lr: number; lu: number } | null {
  const la = toLocal(p, a);
  const lb = toLocal(p, b);
  if (!(la[2] >= 0 && lb[2] < 0)) return null;
  const t = la[2] / (la[2] - lb[2]);
  const lr = la[0] + (lb[0] - la[0]) * t;
  const lu = la[1] + (lb[1] - la[1]) * t;
  if (!inAperture(p, lr, lu)) return null;
  return { t, lr, lu };
}

/**
 * Qua cổng: điểm cắt (lr, lu) và vận tốc v (thế giới) → vị trí tâm thân + vận tốc ở cổng đích.
 * Giữ độ lớn vận tốc, bảo đảm thành phần ra ≥ MIN_OUT, chặn trần PORTAL_MAX; thân đặt cách mặt cổng EXIT_OFF,
 * lệch ngang thu vào trong 60 % lỗ để không vướng mép khung.
 */
export function traverse(src: Portal, dst: Portal, hit: { lr: number; lu: number }, v: V3): { pos: V3; vel: V3 } {
  let lr = -hit.lr;
  let lu = hit.lu;
  const k = Math.hypot(lr / (dst.rx * 0.6), lu / (dst.ry * 0.6));
  if (k > 1) {
    lr /= k;
    lu /= k;
  }
  const pos = fromLocal(dst, [lr, lu, EXIT_OFF]);
  const vel = mapDir(src, dst, v);
  const out = dot(vel, dst.n);
  const need = MIN_OUT[dst.kind];
  if (out < need) for (let i = 0; i < 3; i++) vel[i] += dst.n[i] * (need - out);
  const s = Math.hypot(vel[0], vel[1], vel[2]);
  if (s > PORTAL_MAX) for (let i = 0; i < 3; i++) vel[i] *= PORTAL_MAX / s;
  return { pos, vel };
}

/** Khoảng cách có dấu tới mặt cổng (dương = phía trước) */
export function signedDist(p: Portal, q: V3): number {
  return dot(sub(q, p.c), p.n);
}

/**
 * Góc máy quay (camYaw, quy ước của Player: máy đặt tại hướng (sin yaw, cos yaw) so với nhân vật, nhìn ngược lại)
 * sau khi qua cổng: xoay hướng nhìn bằng phép quay của cặp cổng; nếu hướng nhìn sau khi xoay gần thẳng đứng
 * thì nhìn theo hướng bay ngang (vel) hoặc giữ nguyên.
 */
export function mapCamYaw(src: Portal, dst: Portal, camYaw: number, vel?: V3): number {
  const f: V3 = [-Math.sin(camYaw), 0, -Math.cos(camYaw)];
  const g = mapDir(src, dst, f);
  let h = Math.hypot(g[0], g[2]);
  let gx = g[0];
  let gz = g[2];
  if (h < 0.3 && vel) {
    const hv = Math.hypot(vel[0], vel[2]);
    if (hv > 0.5) {
      gx = vel[0];
      gz = vel[2];
      h = hv;
    }
  }
  if (h < 0.3) return camYaw;
  return Math.atan2(-gx, -gz);
}

// ───────────── Va chạm / mặt đất ─────────────

/** (x, z) ở cao độ top có rơi vào lỗ một cổng sàn không */
export function inFloorHole(x: number, z: number, top: number): Portal | null {
  for (const p of PORTALS) {
    if (p.kind !== "floor" || Math.abs(p.c[1] - top) > 0.05) continue;
    const l = toLocal(p, [x, top, z]);
    if (inAperture(p, l[0], l[1])) return p;
  }
  return null;
}

/**
 * Mặt đất dưới chân: mặt cao nhất có mặt trên ≤ y + STEP_UP (bỏ qua lỗ cổng sàn); VOID nếu là vực.
 * Không truyền y (Player hỏi cho máy quay) → VOID: máy quay do mazeCamClamp lo.
 */
/** Mặt đang đứng (mặt trên trùng cao độ y) tại (x, z) — dùng để nhận ra đệm nảy */
export function surfAt(x: number, z: number, y: number): Surf | null {
  let best: Surf | null = null;
  let bestY = -Infinity;
  for (const s of SURFS) {
    if (!inFootprint(s, x, z)) continue;
    // mặt động: chân bám theo bằng lò xo / lerp nên cho dung sai rộng hơn
    const top = surfTop(s, x, z);
    if (Math.abs(top - y) > (s.dyn ? 0.3 : 0.06)) continue;
    if (!best || top > bestY) {
      best = s;
      bestY = top;
    }
  }
  return best;
}

export function mazeGround(x: number, z: number, y?: number): number {
  if (y === undefined) return VOID;
  let best = VOID;
  for (const s of SURFS) {
    if (!s.dyn && (s.y > y + STEP_UP || s.y <= best)) continue;
    if (!inFootprint(s, x, z)) continue;
    const top = s.dyn ? surfTop(s, x, z) : s.y;
    if (top > y + STEP_UP || top <= best) continue;
    if (inFloorHole(x, z, s.y)) continue;
    best = top;
  }
  return best;
}

/** Tường có lỗ cổng: tâm thân (cao y + BODY) nằm trong lỗ elip của một cổng trên tường này → không chặn */
function wallOpen(w: Wall, x: number, z: number, y: number): boolean {
  for (const p of PORTALS) {
    if (p.wall !== w.id) continue;
    const l = toLocal(p, [x, y + BODY, z]);
    if (inAperture(p, l[0], l[1], 0.95) && l[2] < 1.2) return true;
  }
  return false;
}

/** Va chạm ngang: tường (trừ lỗ cổng), trụ, cạnh dày của các mặt cao hơn, thân boss */
export function mazeBlocked(x: number, z: number, y: number): boolean {
  if (y < 3 && y > -1.5 && x * x + z * z < 2.2 * 2.2) return true;
  for (const w of WALLS) {
    if (y + HEAD <= w.y0 || y >= w.y1) continue;
    if (!inFootprint({ kind: "box", ...w }, x, z, 0.35)) continue;
    if (wallOpen(w, x, z, y)) continue;
    return true;
  }
  for (const g of GATES) {
    if (GATE_OPEN[g.id] || y + HEAD <= g.y0 || y >= g.y1) continue;
    if ((x - g.x) ** 2 + (z - g.z) ** 2 < (g.r + 0.35) ** 2) return true;
  }
  for (const c of PILLARS) {
    if (y + HEAD <= c.y0 || y >= c.y1) continue;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.35) ** 2) return true;
  }
  for (const s of SURFS) {
    const top = s.dyn ? surfTop(s, x, z) : s.y;
    if (y >= top - 0.95 || y + HEAD <= top - s.thick) continue;
    // chỉ chặn ở dải mép 0,6 m: đi ngang luôn chạm mép trước; ở sâu bên trong là đang bay / nảy XUYÊN lên khối
    // (khối một chiều) → không chặn, kẻo Player đẩy người chơi ra khỏi mép rồi rơi luôn
    if (inFootprint(s, x, z) && !inSlabHole(s, x, z) && !inFootprint(s, x, z, -0.6)) return true;
  }
  return false;
}

/** (x, z) nằm trong lỗ một cổng sàn (mặt trên) hoặc cổng trần (mặt dưới) của khối s — rơi / bay xuyên qua khối được */
function inSlabHole(s: Surf, x: number, z: number): boolean {
  for (const p of PORTALS) {
    if (p.kind === "wall") continue;
    const face = p.kind === "floor" ? s.y : s.y - s.thick;
    if (Math.abs(p.c[1] - face) > 0.05) continue;
    const l = toLocal(p, [x, p.c[1], z]);
    if (inAperture(p, l[0], l[1], 1.15)) return true;
  }
  return false;
}

/** Máy quay không chui xuống dưới mặt đang đứng phía trên mục tiêu */
export function mazeCamFloor(x: number, z: number, camY: number, targetY: number): number | null {
  const g = mazeGround(x, z, Math.min(camY, targetY) + 0.2);
  if (g === VOID || targetY < g) return null;
  return camY < g + 0.35 ? g + 0.35 : null;
}

// ───────────── Lỗ hổng vòng lặp ─────────────

/** Rơi qua đáy → hiện ra trên trời (và ngược lại). Trả về độ dời y (0 nếu không quấn) */
export function wrapY(y: number): number {
  if (y < WRAP_BOT) return WRAP_H;
  if (y > WRAP_TOP) return -WRAP_H;
  return 0;
}

/** Quá màn sân khấu (r > WRAP_R) → bước ra ở phía đối tâm, giữ hướng đi (nay hướng vào trong). null nếu chưa quá */
export function wrapXZ(x: number, z: number): [number, number] | null {
  const r = Math.hypot(x, z);
  if (r <= WRAP_R) return null;
  const k = (WRAP_R - 1.5) / r;
  return [-x * k, -z * k];
}

/** Điểm có mặt đất gần (x, z) nhất (dùng khi rơi vòng lặp quá nhiều lần trên vực) — trả về [x, z, cao độ] */
export function nearestLanding(x: number, z: number): [number, number, number] {
  let best: [number, number, number] = [0, 10, 0];
  let bd = Infinity;
  for (const s of SURFS) {
    if (s.step) continue;
    // điểm trong mặt gần (x, z) nhất (xấp xỉ: kéo về tâm tới khi vào trong)
    let px = x;
    let pz = z;
    for (let i = 0; i < 24 && !inFootprint(s, px, pz, -0.6); i++) {
      px += (s.x - px) * 0.25;
      pz += (s.z - pz) * 0.25;
    }
    if (!inFootprint(s, px, pz, -0.6) || inFloorHole(px, pz, s.y)) {
      px = s.x;
      pz = s.z;
      if (inFloorHole(px, pz, s.y)) continue;
    }
    const d = Math.hypot(px - x, pz - z) + Math.abs(s.y) * 0.02;
    if (d < bd) {
      bd = d;
      best = [px, pz, s.y];
    }
  }
  return best;
}

// ───────────── Mô phỏng bay ra khỏi cổng (test + gợi ý) ─────────────

/** Mặt cao nhất có mặt trên trong khoảng (lo, hi] tại (x, z) */
function surfBetween(x: number, z: number, lo: number, hi: number): Surf | null {
  let best: Surf | null = null;
  for (const s of SURFS) {
    if (s.y <= lo || s.y > hi) continue;
    if (!inFootprint(s, x, z) || inFloorHole(x, z, s.y)) continue;
    if (!best || s.y > best.y) best = s;
  }
  return best;
}

/**
 * Thả thân người chơi ra khỏi cổng với vận tốc vel (không bấm điều khiển): trọng lực + lực cản như cảnh.
 * Trả về mặt tiếp đất đầu tiên (id) hoặc cổng đi vào tiếp theo, hoặc null nếu rơi vào vực.
 */
export function simulateExit(pos: V3, vel: V3, maxT = 6): { land: string | null; portal: string | null; at: V3 } {
  const dt = 1 / 120;
  let [x, , z] = pos;
  let feet = pos[1] - BODY;
  let [vx, vy, vz] = vel;
  for (let t = 0; t < maxT; t += dt) {
    const prev: V3 = [x, feet + BODY, z];
    const h = Math.exp(-DRAG_AIR * dt);
    vx *= h;
    vz *= h;
    vy = Math.max(-TERMINAL, vy - GRAVITY * dt);
    const nx = x + vx * dt;
    const nz = z + vz * dt;
    if (!mazeBlocked(nx, nz, feet)) {
      x = nx;
      z = nz;
    } else {
      vx = 0;
      vz = 0;
    }
    const nf = feet + vy * dt;
    const cur: V3 = [x, nf + BODY, z];
    for (const p of PORTALS) if (crossing(p, prev, cur)) return { land: null, portal: p.id, at: cur };
    if (vy < 0) {
      const s = surfBetween(x, z, nf, feet + 1e-6);
      if (s) return { land: s.id, portal: null, at: [x, s.y, z] };
    }
    feet = nf;
    if (feet < WRAP_BOT) break;
  }
  return { land: null, portal: null, at: [x, feet, z] };
}
