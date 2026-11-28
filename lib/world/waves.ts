/**
 * Bờ Sóng (Wave Coast) — vật lý sóng THUẦN, tất định. Logic (CPU) và hình (shader GLSL trong components/world/scene/coast/*)
 * dùng CÙNG công thức + CÙNG đồng hồ `coastClock(Date.now())` → hai người chơi / logic / hình luôn thấy cùng một con sóng.
 * Mọi chu kỳ đều là ước của CYCLE = 240 s, nên đồng hồ quấn về 0 mà sóng không giật (và float32 trong shader không mất chính xác).
 *
 *  - Thuỷ triều: mực nước = sin chậm (chu kỳ 48 s ~ "một ngày nén").
 *  - Biển: tổng sóng Gerstner (GPU Gems ch.1), nước sâu ω² = g·k; đo độ cao tại (x, z) phải giải ngược độ dời ngang (điểm bất động).
 *  - Đầm Giao thoa: hai nguồn điểm cùng biên độ; biên độ chồng chập M = |2A·cos((k(r₁ − r₂) − φ)/2)| — nút ở hiệu đường đi (m + ½)λ.
 *  - Con lắc cộng hưởng: điểm treo lắc ngang theo sóng lừng 3 s; lực quán tính và trọng lực đều ∝ m → khối lượng triệt tiêu.
 *  - Khúc xạ: định luật Snell 2D, phản xạ toàn phần, lần tia qua lăng kính đều.
 * Test: tests/world/waveCoast.test.ts. Kế hoạch: docs/ai-reviews/game-3d/PLAN.md mục T20.
 */

export const G = 9.8;
const TAU = Math.PI * 2;
/** đồng hồ chung (s) — mọi chu kỳ trong vùng chia hết 240 */
export const CYCLE = 240;
export function coastClock(ms: number): number {
  const s = ms / 1000;
  return s - Math.floor(s / CYCLE) * CYCLE;
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ───────────── Thuỷ triều ─────────────
export const TIDE = { T: 48, mid: 0, amp: 0.8 } as const;
export function tideLevel(t: number): number {
  return TIDE.mid + TIDE.amp * Math.sin((TAU * t) / TIDE.T);
}
/** +1 nước đang lên, −1 đang rút */
export function tideTrend(t: number): 1 | -1 {
  return Math.cos((TAU * t) / TIDE.T) >= 0 ? 1 : -1;
}
/** số giây tới khi mực nước ≤ y lần kế tiếp (0 nếu đang ≤ y; Infinity nếu không bao giờ) */
export function waitBelow(y: number, t: number): number {
  const s = (y - TIDE.mid) / TIDE.amp;
  if (s >= 1) return 0;
  if (s < -1) return Infinity;
  const w = TAU / TIDE.T;
  const th = (((w * t) % TAU) + TAU) % TAU;
  if (Math.sin(th) <= s) return 0;
  // vào lại vùng sin ≤ s ở θ₀ = π − asin(s)
  const th0 = Math.PI - Math.asin(s);
  return ((((th0 - th) % TAU) + TAU) % TAU) / w;
}
/** số giây mỗi chu kỳ mà mực nước ≤ y */
export function windowBelow(y: number): number {
  const s = clamp((y - TIDE.mid) / TIDE.amp, -1, 1);
  return ((Math.PI + 2 * Math.asin(s)) / TAU) * TIDE.T;
}

// ───────────── Biển: sóng Gerstner ─────────────
export interface Wave {
  /** hướng truyền (vectơ đơn vị) */
  dx: number;
  dz: number;
  /** số sóng k (rad/m), tần số góc ω (rad/s) */
  k: number;
  w: number;
  /** biên độ đứng (m) */
  a: number;
  /** biên độ dời ngang (m) = độ dốc / k */
  qa: number;
  ph: number;
  T: number;
}
function mk(deg: number, T: number, a: number, steep: number, ph: number): Wave {
  const w = TAU / T;
  const k = (w * w) / G; // nước sâu: ω² = g·k
  const r = (deg * Math.PI) / 180;
  return { dx: Math.cos(r), dz: Math.sin(r), k, w, a, qa: steep / k, ph, T };
}
/**
 * 6 con sóng chạy vào bờ (bờ ở phía −x). Tổng độ dốc Σ k·qa = 0,55 ≤ 0,6 → mặt sóng không tự gập (giải ngược hội tụ).
 * Sóng 3 s là sóng lừng — cùng nhịp với cầu phao treo con lắc (SWELL).
 */
export const SEA: Wave[] = [mk(190, 6, 0.16, 0.05, 0.3), mk(160, 4, 0.12, 0.08, 1.7), mk(180, 3, 0.16, 0.16, 0), mk(215, 2, 0.06, 0.12, 2.2), mk(130, 1.5, 0.035, 0.08, 4.1), mk(250, 1.2, 0.02, 0.06, 5.3)];
export const SEA_STEEP = SEA.reduce((s, w) => s + w.k * w.qa, 0);
/** sóng nhỏ dần khi vào chỗ nông (theo x của điểm gốc) — shader dùng đúng hàm này */
export function shoal(x: number): number {
  return 0.15 + 0.85 * smoothstep(-6, 16, x);
}
/** điểm gốc (u, v) → vị trí đã dời của mặt biển (chưa cộng mực triều) */
export function gerstner(u: number, v: number, t: number, waves: Wave[] = SEA): { x: number; y: number; z: number } {
  const s = shoal(u);
  let x = u;
  let y = 0;
  let z = v;
  for (const w of waves) {
    const th = w.k * (w.dx * u + w.dz * v) - w.w * t + w.ph;
    const c = Math.cos(th) * w.qa * s;
    x += w.dx * c;
    z += w.dz * c;
    y += w.a * s * Math.sin(th);
  }
  return { x, y, z };
}
/** độ cao mặt biển tại ĐÚNG điểm (x, z) trên thế giới: giải u = x − dời(u) bằng lặp điểm bất động (Crest buoyancy) */
export function seaHeight(x: number, z: number, t: number, iters = 8): number {
  let u = x;
  let v = z;
  for (let i = 0; i < iters; i++) {
    const p = gerstner(u, v, t);
    u += x - p.x;
    v += z - p.z;
  }
  return tideLevel(t) + gerstner(u, v, t).y;
}

// ───────────── Đầm Giao thoa: hai nguồn điểm ─────────────
export const LAGOON = {
  s1: { x: -5, z: -44.5 },
  s2: { x: 1, z: -44.5 },
  lambda: 4,
  T: 1.6,
  A: 0.16,
  /** mặt nước tĩnh / đáy đầm (m) — đầm nằm trên mũi đất cao, không thông với biển */
  water: 1.35,
  floor: 1.0,
  /** chữ nhật mặt nước */
  x0: -12,
  x1: 8,
  z0: -46.5,
  z1: -19.5,
} as const;
export const LAG_K = TAU / LAGOON.lambda;
export const LAG_W = TAU / LAGOON.T;
/** biên độ dưới mức này = "lặng": đi được; trên mức này sóng đỉnh đánh bạt người chơi */
export const SAFE_M = 0.12;
function rr(x: number, z: number) {
  return [Math.hypot(x - LAGOON.s1.x, z - LAGOON.s1.z), Math.hypot(x - LAGOON.s2.x, z - LAGOON.s2.z)] as const;
}
/** độ cao (so với mặt tĩnh) — h = A·sin(k r₁ − ωt) + A·sin(k r₂ − ωt + φ) */
export function lagoonH(x: number, z: number, t: number, phi: number): number {
  const [r1, r2] = rr(x, z);
  return LAGOON.A * (Math.sin(LAG_K * r1 - LAG_W * t) + Math.sin(LAG_K * r2 - LAG_W * t + phi));
}
/** biên độ chồng chập (không phụ thuộc t): M = |2A·cos((k(r₁ − r₂) − φ)/2)| */
export function lagoonAmp(x: number, z: number, phi: number): number {
  const [r1, r2] = rr(x, z);
  return Math.abs(2 * LAGOON.A * Math.cos((LAG_K * (r1 - r2) - phi) / 2));
}
export function lagoonSafe(x: number, z: number, phi: number): boolean {
  return lagoonAmp(x, z, phi) <= SAFE_M;
}
/** đỉnh sóng đang ở đúng chỗ này và biên độ ở đây lớn → bị đánh bạt */
export function lagoonSlam(x: number, z: number, t: number, phi: number): boolean {
  const m = lagoonAmp(x, z, phi);
  return m > SAFE_M && lagoonH(x, z, t, phi) >= 0.9 * m;
}
/** hiệu đường đi r₁ − r₂ (m) */
export function pathDiff(x: number, z: number): number {
  const [r1, r2] = rr(x, z);
  return r1 - r2;
}
/** điểm trên đường nút (hyperbol r₁ − r₂ = Δ) ở độ sâu z (chọn nhánh x giữa hai mép đầm) — tìm bằng chia đôi */
export function nodalX(delta: number, z: number, lo: number = LAGOON.x0, hi: number = LAGOON.x1): number | null {
  // r₁ − r₂ tăng đơn điệu theo x trên một đường z cố định
  let a = lo;
  let b = hi;
  const f = (x: number) => pathDiff(x, z) - delta;
  if (f(a) * f(b) > 0) return null;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (f(a) * f(m) <= 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
}

// ───────────── Con lắc cộng hưởng trên cầu phao ─────────────
/** cầu phao lắc ngang theo sóng lừng: x_p(t) = X·sin(ωt) với chu kỳ 3 s (cùng sóng SEA[2]) */
export const SWELL = { T: 3, X: 0.18 } as const;
export const SWELL_W = TAU / SWELL.T;
export const PEND_DAMP = 0.12;
/** chiều dài dây chọn bằng tời (m). Chỉ 2,24 m có chu kỳ riêng ≈ 3 s */
export const LENGTHS = [0.9, 1.4, 2.24, 3.4, 4.4] as const;
export const RESONANT_L = G * (SWELL.T / TAU) ** 2;
/** góc (rad) quả lắc chạm thanh chuông */
export const BELL_ANGLE = 0.62;
/** cú đẩy tay: cộng thêm vận tốc góc (rad/s) theo chiều +θ */
export const PUSH_J = 0.3;
export const PUSH_GAP = 0.45;
export function natPeriod(L: number): number {
  return TAU * Math.sqrt(L / G);
}
export function pivotX(t: number): number {
  return SWELL.X * Math.sin(SWELL_W * t);
}
export function pivotAcc(t: number): number {
  return -SWELL.X * SWELL_W * SWELL_W * Math.sin(SWELL_W * t);
}
export interface Pend {
  th: number;
  om: number;
}
/**
 * Gia tốc góc từ LỰC: tiếp tuyến −m·g·sinθ (trọng lực) − m·a_p·cosθ (quán tính do điểm treo lắc) − c·m·L·ω (ma sát ∝ phản lực ∝ m),
 * chia cho m·L. Khối lượng m triệt tiêu thật sự — đổi quả nặng / nhẹ không đổi gì (à há "chu kỳ không phụ thuộc khối lượng").
 */
export function pendAccel(th: number, om: number, L: number, t: number, m: number, drive = true): number {
  const F = -m * G * Math.sin(th) - (drive ? m * pivotAcc(t) * Math.cos(th) : 0) - PEND_DAMP * m * L * om;
  return F / (m * L);
}
export const PEND_H = 1 / 120;
/** một bước RK4 cố định h (tất định, không phụ thuộc FPS) */
export function stepPend(p: Pend, L: number, m: number, t: number, h = PEND_H, drive = true): void {
  const f = (th: number, om: number, tt: number) => pendAccel(th, om, L, tt, m, drive);
  const k1t = p.om;
  const k1o = f(p.th, p.om, t);
  const k2t = p.om + (h / 2) * k1o;
  const k2o = f(p.th + (h / 2) * k1t, p.om + (h / 2) * k1o, t + h / 2);
  const k3t = p.om + (h / 2) * k2o;
  const k3o = f(p.th + (h / 2) * k2t, p.om + (h / 2) * k2o, t + h / 2);
  const k4t = p.om + h * k3o;
  const k4o = f(p.th + h * k3t, p.om + h * k3o, t + h);
  p.th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  p.om += (h / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
}
/**
 * Quả lắc chạm thanh chuông ở ±BELL_ANGLE: dội lại (mất 25 % vận tốc góc). Trả về bên chạm (+1 / −1) hoặc 0.
 * Gọi sau mỗi bước — biên độ không vượt quá chuông.
 */
export function bellStrike(p: Pend): -1 | 0 | 1 {
  if (Math.abs(p.th) < BELL_ANGLE) return 0;
  const s = p.th > 0 ? 1 : -1;
  p.th = s * BELL_ANGLE;
  if (p.om * s > 0) p.om = -p.om * 0.75;
  return s;
}
/** năng lượng riêng (trên m·L²) — để HUD vẽ "biên độ tương đương" */
export function pendAmp(p: Pend, L: number): number {
  // E = ½ω² + (g/L)(1 − cosθ) → biên độ θmax với (g/L)(1 − cos θmax) = E
  const E = 0.5 * p.om * p.om + (G / L) * (1 - Math.cos(p.th));
  const c = 1 - (E * L) / G;
  return c <= -1 ? Math.PI : Math.acos(c);
}
/**
 * Cửa sổ đẩy "đúng nhịp": quả lắc đang đi qua đáy theo chiều +θ (|θ| nhỏ, ω > 0). Đẩy lúc này mới thêm năng lượng nhiều nhất;
 * đẩy lúc nó đang lao về phía bạn (ω < 0) thì hãm lại.
 */
export function pushQuality(p: Pend, L: number): number {
  if (p.om <= 0) return -1;
  const amp = Math.max(0.02, pendAmp(p, L));
  return clamp(1 - Math.abs(p.th) / amp, 0, 1);
}

// ───────────── Khúc xạ (mặt phẳng ngang x–z) ─────────────
export interface V2 {
  x: number;
  z: number;
}
const dot = (a: V2, b: V2) => a.x * b.x + a.z * b.z;
export function norm(a: V2): V2 {
  const l = Math.hypot(a.x, a.z) || 1;
  return { x: a.x / l, z: a.z / l };
}
/** Snell: d đơn vị, n đơn vị hướng VỀ phía tia tới (d·n < 0). null = phản xạ toàn phần */
export function refract2(d: V2, n: V2, n1: number, n2: number): V2 | null {
  const eta = n1 / n2;
  const ci = -dot(n, d);
  const k = 1 - eta * eta * (1 - ci * ci);
  if (k < 0) return null;
  const c = eta * ci - Math.sqrt(k);
  return norm({ x: eta * d.x + c * n.x, z: eta * d.z + c * n.z });
}
export function reflect2(d: V2, n: V2): V2 {
  const k = 2 * dot(d, n);
  return { x: d.x - k * n.x, z: d.z - k * n.z };
}
/** góc tới / khúc xạ (độ) so với pháp tuyến */
export function angleTo(d: V2, n: V2): number {
  return (Math.acos(clamp(Math.abs(dot(d, n)), 0, 1)) * 180) / Math.PI;
}
/** lăng kính tam giác đều cạnh `side`, tâm (cx, cz), quay `rot` rad (đỉnh đầu ở góc rot + 90°) */
export function prismPoly(cx: number, cz: number, side: number, rot: number): V2[] {
  const R = side / Math.sqrt(3);
  return [0, 1, 2].map((i) => {
    const a = rot + Math.PI / 2 + (i * TAU) / 3;
    return { x: cx + R * Math.cos(a), z: cz + R * Math.sin(a) };
  });
}
/** pháp tuyến hướng RA NGOÀI của cạnh i (đa giác lồi, thứ tự bất kỳ) */
function outward(poly: V2[], i: number): V2 {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const n = norm({ x: b.z - a.z, z: -(b.x - a.x) });
  let cx = 0;
  let cz = 0;
  for (const p of poly) {
    cx += p.x / poly.length;
    cz += p.z / poly.length;
  }
  return dot(n, { x: a.x - cx, z: a.z - cz }) < 0 ? { x: -n.x, z: -n.z } : n;
}
/** giao tia o + t·d với các cạnh: trả (t, cạnh) gần nhất có t > eps */
function hitEdge(o: V2, d: V2, poly: V2[], eps = 1e-7): { t: number; i: number } | null {
  let best: { t: number; i: number } | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - o.x) * ez - (a.z - o.z) * ex) / den;
    const u = ((a.x - o.x) * d.z - (a.z - o.z) * d.x) / den;
    if (t > eps && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best.t)) best = { t, i };
  }
  return best;
}
export interface Trace {
  /** các điểm gấp khúc (điểm đầu, điểm vào, các điểm phản xạ trong, điểm ra) */
  pts: V2[];
  /** hướng tia cuối (sau điểm cuối của pts) */
  dir: V2;
  /** số lần phản xạ toàn phần bên trong */
  tir: number;
  hitPrism: boolean;
  /** góc tới / khúc xạ ở mặt vào và mặt ra (độ) — HUD */
  inAngle: number;
  inRefr: number;
  outInner: number;
  outAngle: number;
}
/** lần tia qua một khối thuỷ tinh lồi chiết suất n (không khí n = 1) */
export function traceGlass(o: V2, d0: V2, poly: V2[], n: number): Trace {
  const res: Trace = { pts: [o], dir: norm(d0), tir: 0, hitPrism: false, inAngle: 0, inRefr: 0, outInner: 0, outAngle: 0 };
  const h = hitEdge(o, res.dir, poly);
  if (!h) return res;
  res.hitPrism = true;
  let p: V2 = { x: o.x + res.dir.x * h.t, z: o.z + res.dir.z * h.t };
  res.pts.push(p);
  let nOut = outward(poly, h.i);
  res.inAngle = angleTo(res.dir, nOut);
  let d = refract2(res.dir, nOut, 1, n)!; // từ không khí vào thuỷ tinh luôn khúc xạ được
  res.inRefr = angleTo(d, nOut);
  for (let bounce = 0; bounce < 8; bounce++) {
    const e = hitEdge(p, d, poly);
    if (!e) break;
    p = { x: p.x + d.x * e.t, z: p.z + d.z * e.t };
    res.pts.push(p);
    nOut = outward(poly, e.i);
    const inner = angleTo(d, nOut);
    const out = refract2(d, { x: -nOut.x, z: -nOut.z }, n, 1);
    if (out) {
      res.outInner = inner;
      res.outAngle = angleTo(out, nOut);
      res.dir = out;
      return res;
    }
    res.tir++;
    d = reflect2(d, nOut);
  }
  res.dir = d;
  return res;
}
/** góc lệch (độ, có dấu: dương = quay ngược chiều kim đồng hồ nhìn từ trên +y… theo hệ x–z) giữa tia đầu và tia cuối */
export function deviation(d0: V2, d1: V2): number {
  return (Math.atan2(d0.x * d1.z - d0.z * d1.x, dot(d0, d1)) * 180) / Math.PI;
}
/** tia (điểm p, hướng d) có đi qua đĩa tâm c bán kính r ở phía trước không */
export function rayHitsDisc(p: V2, d: V2, c: V2, r: number, maxT = 60): boolean {
  const t = (c.x - p.x) * d.x + (c.z - p.z) * d.z;
  if (t < 0 || t > maxT) return false;
  const qx = p.x + d.x * t - c.x;
  const qz = p.z + d.z * t - c.z;
  return qx * qx + qz * qz <= r * r;
}
/** chiết suất thuỷ tinh (N-BK7): đỏ / lục / lam — logic dùng lục, hình vẽ ba dải */
export const GLASS_N = { r: 1.5143, g: 1.5187, b: 1.5224 } as const;
export function criticalAngle(n: number): number {
  return (Math.asin(1 / n) * 180) / Math.PI;
}
