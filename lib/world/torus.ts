/**
 * Quần đảo Xuyến (Torus Archipelago) — toán thuần của không gian XUYẾN PHẲNG (không three.js, có test).
 *
 * Xuyến phẳng = ô vuông L × L dán hai cặp mép đối: đi qua mép phải (x = +L/2) thì ra ở mép trái (x = −L/2),
 * qua mép nam (z = +L/2) thì ra mép bắc (z = −L/2). Trạng thái logic chỉ có MỘT bản, toạ độ luôn nằm trong ô gốc
 * [−L/2, L/2)²; phần hình được vẽ lặp 3 × 3 để nhìn xa thấy chính mình.
 *
 *  - wrap / torusDelta / torusDist: quấn toạ độ, hiệu ngắn nhất ("ảnh gần nhất" — minimum image) và khoảng cách trên xuyến.
 *  - stepBallistic / simulateArrow: mũi tên bay parabol (trọng lực thật, cùng tích phân với CombatScene) và QUẤN MÉP.
 *  - segAabb / segSphere / segHitsCapsule: va chạm đoạn thẳng (một khung bay) với hộp / cầu / thân người.
 */

/** cạnh ô vuông (m) */
export const TORUS_L = 48;

/** đưa v về [−L/2, L/2) */
export function wrap(v: number, L = TORUS_L): number {
  const h = L / 2;
  if (v >= -h && v < h) return v === 0 ? 0 : v;
  let r = ((((v + h) % L) + L) % L) - h;
  if (r >= h) r -= L;
  if (r < -h) r += L;
  return r === 0 ? 0 : r; // bỏ −0
}

/** hiệu ngắn nhất b − a trên vòng tròn chu vi L (thuộc [−L/2, L/2)) */
export function delta(a: number, b: number, L = TORUS_L): number {
  return wrap(b - a, L);
}

/** vectơ ngắn nhất từ A tới B trên xuyến (ảnh gần nhất của B) */
export function torusDelta(ax: number, az: number, bx: number, bz: number, L = TORUS_L): { dx: number; dz: number } {
  return { dx: delta(ax, bx, L), dz: delta(az, bz, L) };
}

/** khoảng cách ngắn nhất trên xuyến phẳng (mặt xz) */
export function torusDist(ax: number, az: number, bx: number, bz: number, L = TORUS_L): number {
  return Math.hypot(delta(ax, bx, L), delta(az, bz, L));
}

/** khoảng cách "đi thẳng không qua mép" (trong ô gốc) — để so với đường tắt qua mép */
export function planeDist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az);
}

/**
 * Lượng phải cộng vào (x, z) để về ô gốc (bội số của L). (0, 0) = đang ở trong ô.
 * Dùng khi quấn người chơi: dời cả máy quay đúng lượng này (CAM.shift) → không giật.
 */
export function wrapShift(x: number, z: number, L = TORUS_L): { sx: number; sz: number } {
  const sx = wrap(x, L) - x;
  const sz = wrap(z, L) - z;
  return { sx: Math.abs(sx) < 1e-9 ? 0 : sx, sz: Math.abs(sz) < 1e-9 ? 0 : sz };
}

/** 9 ô (i, j) của lưới vẽ 3 × 3 — ô gốc (0, 0) đứng đầu */
export const TILES3: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
/** lưới (2n+1)² ô, ô gốc đứng đầu, xếp theo khoảng cách tăng dần */
export function tiles(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) out.push([i, j]);
  return out.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
}

// ───────────── Đạn đạo (mũi tên Cung Vòng) ─────────────

export interface Ballistic {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Một bước bay (Euler bán ẩn — y hệt CombatScene: v.y −= g·dt rồi p += v·dt) rồi quấn x, z về ô gốc.
 * Trả về lượng đã dời (sx, sz) — khác 0 nghĩa là mũi tên vừa đi qua mép.
 */
export function stepBallistic(b: Ballistic, dt: number, g: number, L = TORUS_L): { sx: number; sz: number } {
  b.vy -= g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  const s = wrapShift(b.x, b.z, L);
  b.x += s.sx;
  b.z += s.sz;
  return s;
}

export interface SimPoint {
  x: number;
  y: number;
  z: number;
  t: number;
  /** vừa quấn qua mép ở bước này */
  wrapped: boolean;
}
export interface SimResult {
  pts: SimPoint[];
  /** lý do dừng */
  end: "ground" | "hit" | "time";
  /** số lần đi qua mép */
  wraps: number;
  /** quãng đường ngang đã bay (m) */
  dist: number;
  /** điểm có độ cao lớn nhất (đỉnh parabol) */
  apex: SimPoint;
}

/**
 * Mô phỏng trước quỹ đạo (đường chấm của Cung Vòng): bay tới khi chạm đất, chạm vật (hit trả true — đoạn a→b trong toạ độ ô gốc,
 * a có thể nằm ngoài ô một chút ngay sau khi quấn), hoặc hết thời gian.
 */
export function simulateArrow(
  start: Ballistic,
  o: { g: number; dt: number; maxT: number; L?: number; ground?: (x: number, z: number) => number; hit?: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean },
): SimResult {
  const L = o.L ?? TORUS_L;
  const b: Ballistic = { ...start };
  const w0 = wrapShift(b.x, b.z, L);
  b.x += w0.sx;
  b.z += w0.sz;
  const first: SimPoint = { x: b.x, y: b.y, z: b.z, t: 0, wrapped: false };
  const pts: SimPoint[] = [first];
  let apex = first;
  let wraps = 0;
  let dist = 0;
  let end: SimResult["end"] = "time";
  const hs = Math.hypot(b.vx, b.vz);
  for (let t = o.dt; t <= o.maxT + 1e-9; t += o.dt) {
    const ax = b.x;
    const ay = b.y;
    const az = b.z;
    const s = stepBallistic(b, o.dt, o.g, L);
    dist += hs * o.dt;
    const wrapped = s.sx !== 0 || s.sz !== 0;
    if (wrapped) wraps++;
    const p: SimPoint = { x: b.x, y: b.y, z: b.z, t, wrapped };
    // đoạn bay khung này trong toạ độ liên tục quanh điểm cuối: điểm đầu dời theo cùng lượng quấn
    if (o.hit?.(ax + s.sx, ay, az + s.sz, b.x, b.y, b.z)) {
      pts.push(p);
      end = "hit";
      break;
    }
    if (o.ground && b.y < o.ground(b.x, b.z)) {
      pts.push(p);
      end = "ground";
      break;
    }
    pts.push(p);
    if (p.y > apex.y) apex = p;
  }
  return { pts, end, wraps, dist, apex };
}

/**
 * Góc nâng (rad) để mũi tên bay ngang quãng d rồi về đúng độ cao dy so với lúc bắn, vận tốc v, trọng lực g.
 * Hai nghiệm (bắn thấp / bắn cầu) — đúng "2 góc cùng trúng" của Arc Bow; null nếu quá xa (d > v²/g khi dy = 0).
 */
export function launchAngles(d: number, dy: number, v: number, g: number): [number, number] | null {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  if (disc < 0 || d <= 0) return null;
  const r = Math.sqrt(disc);
  return [Math.atan((v2 - r) / (g * d)), Math.atan((v2 + r) / (g * d))];
}

// ───────────── Va chạm đoạn thẳng (một khung bay) ─────────────

export interface Box3 {
  min: [number, number, number];
  max: [number, number, number];
}

/** tham số t ∈ [0, 1] nơi đoạn a→b đi vào hộp (0 nếu a đã ở trong), null nếu không chạm (phương pháp slab) */
export function segAabb(ax: number, ay: number, az: number, bx: number, by: number, bz: number, box: Box3): number | null {
  let t0 = 0;
  let t1 = 1;
  const a = [ax, ay, az];
  const d = [bx - ax, by - ay, bz - az];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (a[i] < box.min[i] || a[i] > box.max[i]) return null;
      continue;
    }
    let ta = (box.min[i] - a[i]) / d[i];
    let tb = (box.max[i] - a[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/** tham số t ∈ [0, 1] nơi đoạn a→b chạm mặt cầu tâm c bán kính r (0 nếu a ở trong), null nếu không chạm */
export function segSphere(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, r: number): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const fx = ax - cx;
  const fy = ay - cy;
  const fz = az - cz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Đoạn a→b (toạ độ ô gốc, dài ≪ L) chạm thân hình trụ đứng (tâm cx, cz; y từ y0 tới y1; bán kính r) — so với ẢNH GẦN NHẤT
 * của thân người so với điểm giữa đoạn (thân đứng sát mép vẫn bị trúng từ phía bên kia mép).
 */
export function segHitsCapsule(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cz: number, y0: number, y1: number, r: number, L = TORUS_L): boolean {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const qx = mx + delta(mx, cx, L);
  const qz = mz + delta(mz, cz, L);
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const n = Math.max(1, Math.ceil(len / (r * 0.5)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    if (y < y0 || y > y1) continue;
    if ((x - qx) ** 2 + (z - qz) ** 2 < r * r) return true;
  }
  return false;
}

/** điểm (x, z) quy về toạ độ cục bộ quanh tâm (cx, cz) theo ảnh gần nhất — để thử va chạm với vật đứng sát mép */
export function local(x: number, z: number, cx: number, cz: number, L = TORUS_L): { x: number; z: number } {
  return { x: delta(cx, x, L), z: delta(cz, z, L) };
}

/** đường thẳng hướng (p, q) nguyên trên xuyến khép lại sau quãng L·√(p² + q²) khi gcd(p, q) = 1 */
export function closedLineLength(p: number, q: number, L = TORUS_L): number {
  const g = gcd(Math.abs(p), Math.abs(q)) || 1;
  return (L * Math.hypot(p, q)) / g;
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
