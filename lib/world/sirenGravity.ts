/**
 * Mê cung Hoạ âm — các vùng TRỌNG LỰC KỲ DỊ (hàm thuần, không three.js; cảnh + test dùng chung).
 * Mỗi vùng là một ý tưởng vật lý / toán chơi được:
 *  - Hành tinh tí hon: g hướng vào tâm, giảm theo 1/r² — đi vòng quanh cả quả cầu; nhảy khi đang chạy vượt vận tốc thoát
 *    (escapeSpeed) thì bay khỏi hành tinh, đi bộ mà nhảy thì rơi lại (gần quỹ đạo).
 *  - Lồng Escher: hộp kín, trọng lực hướng về mặt đang đứng; bước vào chân tường → tường thành sàn (đi trên tường, trần).
 *  - Đảo Trăng: trọng lực yếu (g × 0,25) — nhảy cao gấp 4, rơi chậm.
 *  - Đệm nảy: vận tốc bật lại = e · vận tốc chạm (e < 1 nảy thấp dần: h_n = e^{2n}·h₀; e > 1 nảy cao dần, có trần).
 *  - Hành lang nón sáng: chỉ đi được theo các hướng lệch trục ≤ nửa góc nón (như hình học không gian–thời gian mà
 *    "quay người" không tự do) — muốn đi chéo phải chọn đúng đoạn có trục phù hợp.
 *  - Hố đen tí hon: hút 1/r², có thể bay quỹ đạo quanh nó; chạm chân trời → bị kéo giãn rồi nhả ra ở nơi khác.
 *  - Lỗ sâu: hai miệng cầu nối hai vùng xa nhau — đi thẳng vào miệng này, đi thẳng ra miệng kia, giữ vận tốc.
 */

export type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Bỏ thành phần theo pháp tuyến n (chiếu lên mặt tiếp xúc) */
export function tangent(v: V3, n: V3): V3 {
  return sub(v, mul(n, dot(v, n)));
}
export { add, sub, mul, dot, len, norm };

/** Trọng lực thường của Player */
export const G0 = 22;
export const JUMP = 7.4;
export const WALK = 4;
export const RUN = 7;

// ───────────── Bố cục các vùng ─────────────
export interface Planet {
  id: string;
  c: V3;
  R: number;
  /** gia tốc trọng trường ở mặt */
  g: number;
  /** ngoài bán kính này trả về trọng lực thường */
  rInf: number;
}
export const PLANET: Planet = { id: "planet", c: [-24, 48, 32], R: 4, g: 16, rInf: 12 };

export interface Cube {
  id: string;
  c: V3;
  /** nửa cạnh */
  a: number;
  /** cửa: trên mặt (trục k, dấu s), tâm cửa lệch theo trục còn lại u, rộng w, cao h từ mép sàn */
  door: { k: 0 | 1 | 2; s: 1 | -1; w: number; h: number };
}
/** Lồng Escher: sàn ở y = 8 (ngang hành lang nón sáng), cửa ở mặt tây */
export const CUBE: Cube = { id: "cube", c: [36, 14, -30], a: 6, door: { k: 0, s: -1, w: 3, h: 3.2 } };
export const CUBE_G = 18;

export interface MoonZone {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  scale: number;
}
/** Đảo Trăng + cột đá bậc lên Đài Lỗ sâu */
export const MOON: MoonZone = { x: -24, z: 52, r: 16, y0: 30, y1: 76, scale: 0.27 };

export interface ConeZone {
  id: string;
  /** hộp chữ nhật trục x/z: [x0, x1, z0, z1], cao độ sàn y */
  box: [number, number, number, number];
  y: number;
  /** trục "thời gian" (đơn vị, trên mặt phẳng xz): chỉ tiến theo trục này */
  axis: [number, number];
  /** nửa góc nón (rad): 45° ⇔ |ngang| ≤ |tiến| như nón ánh sáng với c = 1 */
  half: number;
  /** một chiều: không lùi được (thời gian chỉ đi tới) */
  oneWay: boolean;
}
const Q = Math.PI / 4;
export const CONES: ConeZone[] = [
  { id: "coneA", box: [14, 30, -52, -46], y: 8, axis: [1, 0], half: Q, oneWay: true },
  { id: "coneB", box: [24, 30, -46, -36], y: 8, axis: [0, 1], half: Q, oneWay: true },
  // z −36…−24: nút giao tự do trước cửa Lồng Escher
  { id: "coneC", box: [24, 30, -24, -5], y: 8, axis: [0, 1], half: Q, oneWay: true },
];

export interface BlackHole {
  c: V3;
  /** bán kính chân trời (chạm là bị nuốt) */
  rs: number;
  /** GM: vận tốc quỹ đạo tròn ở bán kính r là √(GM / r) */
  gm: number;
  rInf: number;
}
export const HOLE: BlackHole = { c: [30, 44, 40], rs: 1.3, gm: 220, rInf: 16 };

export interface Wormhole {
  id: string;
  /** hai miệng */
  a: V3;
  b: V3;
  R: number;
}
/** Lỗ sâu: Đáy (trên đệm sen Tây Nam) ↔ Đài Lỗ sâu (tầng cao nhất) */
export const WORM: Wormhole = { id: "worm", a: [-25, -14.8, 25.5], b: [-24, 54.2, 52], R: 2.4 };

// ───────────── Đảo Trăng / nón sáng / đệm nảy ─────────────

/** Hệ số trọng lực tại p (1 = thường) */
export function gravityScale(x: number, y: number, z: number): number {
  const m = MOON;
  if (y > m.y0 && y < m.y1 && (x - m.x) ** 2 + (z - m.z) ** 2 < m.r * m.r) return m.scale;
  return 1;
}

export function coneAt(x: number, y: number, z: number): ConeZone | null {
  for (const c of CONES) {
    if (Math.abs(y - c.y) > 1.2) continue;
    if (x >= c.box[0] && x <= c.box[1] && z >= c.box[2] && z <= c.box[3]) return c;
  }
  return null;
}

/**
 * Hướng đi (x, z) bị ép vào nón ánh sáng quanh trục: thành phần ngang ≤ tan(nửa góc) × thành phần tiến;
 * một chiều thì không có thành phần lùi (hướng lùi → đứng yên). Trả về hướng mới (độ dài giảm khi bị cắt).
 */
export function coneSteer(dx: number, dz: number, c: ConeZone): [number, number] {
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) return [dx, dz];
  const [ax, az] = c.axis;
  let along = dx * ax + dz * az;
  let side = -dx * az + dz * ax;
  if (c.oneWay && along <= 0) return [0, 0];
  const sg = along < 0 ? -1 : 1;
  along = Math.abs(along);
  const lim = along * Math.tan(c.half);
  if (Math.abs(side) > lim) side = Math.sign(side) * lim;
  along *= sg;
  return [ax * along - az * side, az * along + ax * side];
}

/** Trần vận tốc bật của đệm nảy (nảy cao dần tối đa ~18 m) */
export const BOUNCE_CAP = 28;
/** Vận tốc bật lên sau khi chạm đệm nảy (vin âm = đang rơi). null nếu quá chậm để nảy */
export function bounceSpeed(vin: number, e: number, cap = BOUNCE_CAP): number | null {
  const v = -vin * e;
  if (-vin < 2.5) return null;
  return Math.min(cap, v);
}
/** Độ cao lần nảy thứ n khi thả từ h0 với hệ số e (lý thuyết, không trần): h_n = e^{2n}·h₀ */
export function bounceHeight(h0: number, e: number, n: number): number {
  return h0 * Math.pow(e, 2 * n);
}

// ───────────── Hành tinh tí hon ─────────────
export function planetG(r: number, p: Planet = PLANET): number {
  return p.g * (p.R / Math.max(r, p.R)) ** 2;
}
/**
 * Vận tốc thoát khỏi VÙNG ẢNH HƯỞNG (bán kính rInf) từ mặt hành tinh, g ∝ 1/r²:
 * ½v² = g·R²·(1/R − 1/rInf) → v = √(2gR(1 − R/rInf)). (rInf → ∞ thì là √(2gR) quen thuộc.)
 * Với g = 16, R = 4, rInf = 12: ≈ 9,2 m/s — đi bộ (4) + nhảy (7,4) ≈ 8,4 không đủ; chạy (7) + nhảy ≈ 10,2 thì thoát.
 */
export function escapeSpeed(p: Planet = PLANET): number {
  return Math.sqrt(2 * p.g * p.R * (1 - p.R / p.rInf));
}
export function orbitSpeed(p: Planet = PLANET): number {
  return Math.sqrt(p.g * p.R);
}

// ───────────── Bộ điều khiển trọng lực kỳ dị (bước thuần) ─────────────
export type Mode = "world" | "planet" | "cube" | "hole";
export interface GState {
  mode: Mode;
  /** gót chân */
  pos: V3;
  vel: V3;
  grounded: boolean;
  /** lồng Escher: mặt đang đứng (trục k, dấu s — mặt ở toạ độ c[k] + s·a) */
  face: { k: 0 | 1 | 2; s: 1 | -1 };
}
export interface GInput {
  /** hướng muốn đi (thế giới), chưa chiếu — độ dài ≤ 1 */
  dir: V3;
  run: boolean;
  /** vừa bấm nhảy */
  jump: boolean;
}

/** Hướng "lên" tại trạng thái hiện tại */
export function upOf(s: GState): V3 {
  if (s.mode === "planet") return norm(sub(s.pos, PLANET.c));
  if (s.mode === "cube") {
    const u: V3 = [0, 0, 0];
    u[s.face.k] = -s.face.s;
    return u;
  }
  return [0, 1, 0];
}

/** Toạ độ p có nằm trong lòng lồng Escher không (lề m) */
export function inCube(p: V3, m = 0): boolean {
  const q = sub(p, CUBE.c);
  return Math.abs(q[0]) < CUBE.a - m && Math.abs(q[1]) < CUBE.a - m && Math.abs(q[2]) < CUBE.a - m;
}
/** Điểm q (cục bộ của lồng) trên mặt (k, s) có rơi vào ô cửa không (cửa đứng ở mép dưới một mặt bên) */
export function inDoor(q: V3, k: number, s: number): boolean {
  const d = CUBE.door;
  if (k !== d.k || s !== d.s) return false;
  const side = d.k === 0 ? 2 : 0;
  return Math.abs(q[side]) < d.w / 2 && q[1] + CUBE.a < d.h;
}

const BODY_R = 0.45;

/**
 * Một bước mô phỏng. Trả về trạng thái mới (đổi mode "world" khi rời vùng).
 * Hành tinh: trên mặt → đi theo mặt tiếp xúc, bám cầu; trên không → g(r) hướng tâm + điều khiển trên không yếu.
 * Lồng Escher: g hướng về mặt đang đứng; bước vào chân mặt khác → mặt đó thành sàn; rơi / bước qua cửa → ra ngoài.
 * Hố đen: rơi tự do 1/r² + đẩy nhẹ theo hướng điều khiển; chạm chân trời → "swallowed".
 */
export function stepGravity(s0: GState, inp: GInput, dt: number): GState & { event?: "jump" | "land" | "exit" | "swallowed" | "face" } {
  const s: GState = { mode: s0.mode, pos: [...s0.pos], vel: [...s0.vel], grounded: s0.grounded, face: { ...s0.face } };
  const speed = inp.run ? RUN : WALK;
  const want = (up: V3): V3 => {
    const d = tangent(inp.dir, up);
    const dl = len(d);
    return dl > 1e-4 ? mul(d, (speed * Math.min(1, len(inp.dir))) / dl) : [0, 0, 0];
  };
  // gia tốc mượt ~0,12 s như đi bộ thường
  const kk = 1 - Math.exp(-dt / 0.12);
  if (s.mode === "planet") {
    const P = PLANET;
    let up = norm(sub(s.pos, P.c));
    if (s.grounded) {
      s.vel = add(mul(tangent(s.vel, up), 1 - kk), mul(want(up), kk));
      s.pos = add(s.pos, mul(s.vel, dt));
      up = norm(sub(s.pos, P.c));
      s.pos = add(P.c, mul(up, P.R));
      s.vel = tangent(s.vel, up);
      if (inp.jump) {
        s.vel = add(s.vel, mul(up, JUMP));
        s.grounded = false;
        return { ...s, event: "jump" };
      }
      return s;
    }
    const r = len(sub(s.pos, P.c));
    s.vel = add(s.vel, mul(up, -planetG(r) * dt));
    // điều khiển trên không yếu (2 m/s²)
    s.vel = add(s.vel, mul(tangent(inp.dir, up), 2 * dt));
    s.pos = add(s.pos, mul(s.vel, dt));
    const r2 = len(sub(s.pos, P.c));
    if (r2 <= P.R) {
      const u2 = norm(sub(s.pos, P.c));
      s.pos = add(P.c, mul(u2, P.R));
      s.vel = tangent(s.vel, u2);
      s.grounded = true;
      return { ...s, event: "land" };
    }
    if (r2 > P.rInf) {
      s.mode = "world";
      return { ...s, event: "exit" };
    }
    return s;
  }
  if (s.mode === "cube") {
    const C = CUBE;
    const { k, s: sg } = s.face;
    const up = upOf(s);
    const q = sub(s.pos, C.c);
    let ev: "jump" | "land" | "exit" | "face" | undefined;
    const out = () => Math.abs(q[0]) > C.a + 0.6 || Math.abs(q[1]) > C.a + 0.6 || Math.abs(q[2]) > C.a + 0.6;
    if (s.grounded) {
      s.vel = add(mul(tangent(s.vel, up), 1 - kk), mul(want(up), kk));
      for (let i = 0; i < 3; i++) q[i] += s.vel[i] * dt;
      // chạm chân một mặt khác khi đang bước về phía nó → mặt đó thành sàn (trừ ô cửa: bước qua được)
      for (const j of [0, 1, 2] as const) {
        if (j === k) continue;
        const lim = C.a - BODY_R;
        if (Math.abs(q[j]) <= lim) continue;
        const sj = (q[j] > 0 ? 1 : -1) as 1 | -1;
        if (inDoor(q, j, sj)) continue;
        if (s.vel[j] * sj > 0.5) {
          q[j] = sj * C.a;
          q[k] = sg * (C.a - BODY_R);
          s.face = { k: j, s: sj };
          s.vel = tangent(s.vel, upOf(s));
          ev = "face";
          break;
        }
        q[j] = sj * lim;
        s.vel[j] = 0;
      }
      if (ev !== "face") {
        if (inDoor(q, k, sg)) s.grounded = false;
        else q[k] = sg * C.a;
      }
      s.pos = add(C.c, q);
      if (out()) {
        s.mode = "world";
        return { ...s, event: "exit" };
      }
      if (inp.jump && s.grounded) {
        s.vel = add(s.vel, mul(upOf(s), JUMP));
        s.grounded = false;
        ev = "jump";
      }
      return { ...s, event: ev };
    }
    s.vel = add(s.vel, mul(up, -CUBE_G * dt));
    s.vel = add(s.vel, mul(tangent(inp.dir, up), 2 * dt));
    for (let i = 0; i < 3; i++) q[i] += s.vel[i] * dt;
    // các mặt khác: va vào thì trượt (trừ ô cửa)
    for (const j of [0, 1, 2] as const) {
      if (j === k) continue;
      const lim = C.a - BODY_R;
      if (Math.abs(q[j]) > lim && !inDoor(q, j, q[j] > 0 ? 1 : -1)) {
        q[j] = Math.sign(q[j]) * lim;
        s.vel[j] = 0;
      }
    }
    // mặt đối diện (trần) chặn đầu
    if (-sg * q[k] > C.a - 1.7) {
      q[k] = -sg * (C.a - 1.7);
      if (s.vel[k] * -sg > 0) s.vel[k] = 0;
    }
    if (sg * q[k] >= C.a && !inDoor(q, k, sg)) {
      q[k] = sg * C.a;
      s.vel = tangent(s.vel, up);
      s.grounded = true;
      ev = "land";
    }
    s.pos = add(C.c, q);
    if (out()) {
      s.mode = "world";
      return { ...s, event: "exit" };
    }
    return { ...s, event: ev };
  }
  if (s.mode === "hole") {
    const H = HOLE;
    const d = sub(s.pos, H.c);
    const r = Math.max(0.3, len(d));
    const a = mul(norm(d), -H.gm / (r * r));
    // đẩy nhẹ theo hướng điều khiển (như phản lực tàu lượn) để chỉnh quỹ đạo
    s.vel = add(s.vel, mul(add(a, mul(inp.dir, inp.run ? 7 : 4)), dt));
    s.pos = add(s.pos, mul(s.vel, dt));
    const r2 = len(sub(s.pos, H.c));
    if (r2 < H.rs) return { ...s, event: "swallowed" };
    if (r2 > H.rInf) {
      s.mode = "world";
      return { ...s, event: "exit" };
    }
    return s;
  }
  return s;
}

/** Ở chế độ thường: có nên chuyển sang vùng trọng lực kỳ dị không (đi vào vùng ảnh hưởng) */
export function enterMode(pos: V3): Mode {
  const body = add(pos, [0, 0.9, 0]);
  if (len(sub(body, PLANET.c)) < PLANET.rInf - 0.5) return "planet";
  if (inCube(body, 0.2)) return "cube";
  if (len(sub(body, HOLE.c)) < HOLE.rInf - 0.5) return "hole";
  return "world";
}

/** Thế năng + động năng riêng (để test bảo toàn năng lượng quỹ đạo quanh hố đen) */
export function orbitEnergy(pos: V3, vel: V3): number {
  return 0.5 * dot(vel, vel) - HOLE.gm / len(sub(pos, HOLE.c));
}

// ───────────── Lỗ sâu ─────────────

/** Đoạn a → b (tâm thân) có lọt vào lõi miệng m (bán kính 0,55·R) không */
export function wormEnter(m: V3, a: V3, b: V3): boolean {
  const R = WORM.R * 0.55;
  if (len(sub(a, m)) < R) return false;
  // điểm gần tâm nhất trên đoạn
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(m, a), ab) / Math.max(1e-9, dot(ab, ab))));
  return len(sub(add(a, mul(ab, t)), m)) < R;
}

/**
 * Đi xuyên lỗ sâu: ra khỏi miệng kia theo hướng đang đi (chiếu lên mặt ngang), đặt ngay ngoài vỏ cầu, giữ tốc độ
 * nhưng chặn trong [2, 4] m/s — miệng nằm trên đài nhỏ, ra quá nhanh sẽ trượt khỏi mép đài.
 */
export function wormTraverse(from: V3, to: V3, entry: V3, vel: V3): { pos: V3; vel: V3 } {
  let dir: V3 = [vel[0], 0, vel[2]];
  if (Math.hypot(dir[0], dir[2]) < 0.5) dir = [from[0] - entry[0], 0, from[2] - entry[2]];
  if (Math.hypot(dir[0], dir[2]) < 1e-6) dir = [1, 0, 0];
  dir = norm(dir);
  const pos = add(to, mul(dir, WORM.R + 0.9));
  const sp = Math.max(2, Math.min(4, Math.hypot(vel[0], vel[2])));
  return { pos, vel: mul(dir, sp) };
}

// ───────────── Hệ quy chiếu máy quay ─────────────

/** Góc giữa hai vectơ đơn vị */
export function angleBetween(a: V3, b: V3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));
}
/**
 * Xoay vectơ "lên" hiện tại về đích với tốc độ góc tối đa (rad/s) + làm mượt mũ τ — đổi trọng lực không giật máy quay.
 * Trả về vectơ lên mới (đơn vị).
 */
export function easeUp(cur: V3, target: V3, dt: number, maxRate = Math.PI, tau = 0.18): V3 {
  const ang = angleBetween(cur, target);
  if (ang < 1e-4) return norm(target);
  const step = Math.min(ang, Math.max(ang * (1 - Math.exp(-dt / tau)), 0), maxRate * dt);
  // slerp theo góc step
  const t = step / ang;
  if (ang > Math.PI - 1e-3) {
    // ngược chiều: xoay quanh một trục vuông góc bất kỳ
    const ax: V3 = Math.abs(cur[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const p = norm(sub(ax, mul(cur, dot(ax, cur))));
    return norm(add(mul(cur, Math.cos(step)), mul(p, Math.sin(step))));
  }
  const so = Math.sin(ang);
  return norm(add(mul(norm(cur), Math.sin((1 - t) * ang) / so), mul(norm(target), Math.sin(t * ang) / so)));
}

/**
 * Máy quay trong Lồng Escher: tỉ lệ t ∈ [0, 1] dọc cần máy (mục tiêu → vị trí máy) để máy nằm trong lòng lồng (lề m).
 * Kéo máy về phía nhân vật thay vì trượt dọc tường → không xuyên tường, không giật ngang.
 */
export function cubeCamT(target: V3, pos: V3, m = CUBE.a - 0.35): number {
  let t = 1;
  for (let i = 0; i < 3; i++) {
    const d = pos[i] - target[i];
    if (Math.abs(d) < 1e-6) continue;
    const lim = (d > 0 ? CUBE.c[i] + m : CUBE.c[i] - m) - target[i];
    t = Math.min(t, Math.max(0, lim / d));
  }
  return t;
}
