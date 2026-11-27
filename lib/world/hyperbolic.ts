/**
 * Hình học hyperbolic trên ĐĨA POINCARÉ (thuần, không three) — Sàn Poincaré ở Thế giới Bất Khả:
 *  • đường trắc địa qua a, b = cung tròn VUÔNG GÓC với đường tròn đơn vị (hoặc đường kính nếu a, b, O thẳng hàng);
 *  • góc tại đỉnh = góc giữa hai tiếp tuyến của hai cung;
 *  • tổng ba góc tam giác < π, diện tích = π − tổng (Gauss–Bonnet, độ cong −1);
 *  • khoảng cách d = arcosh(1 + 2|a−b|² / ((1−|a|²)(1−|b|²))).
 * Lát {p, q}: tam giác cơ bản góc π/p (tại tâm), π/q, π/2; cạnh thứ ba là đường tròn tâm (d, 0) bán kính r với
 *   d = 1 / √(1 − sin²(π/p) / cos²(π/q)),  r = d·sin(π/p) / cos(π/q)  (vuông góc đường tròn đơn vị: d² = 1 + r²).
 */
export type P2 = [number, number];

const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const len = (a: P2) => Math.hypot(a[0], a[1]);

export type Geodesic = { line: true } | { line: false; c: P2; r: number };

/** đường trắc địa qua a, b (|a|, |b| < 1) */
export function geodesic(a: P2, b: P2): Geodesic {
  const cross = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(cross) < 1e-9) return { line: true };
  // tâm c cách đều a, b và a* = a / |a|² (ảnh nghịch đảo của a qua đường tròn đơn vị) ⇔ |c|² = 1 + r²
  // giải: 2c·a = |a|² + 1, 2c·b = |b|² + 1
  const ra = (dot(a, a) + 1) / 2;
  const rb = (dot(b, b) + 1) / 2;
  const det = a[0] * b[1] - a[1] * b[0];
  const c: P2 = [(ra * b[1] - rb * a[1]) / det, (a[0] * rb - b[0] * ra) / det];
  return { line: false, c, r: len(sub(a, c)) };
}

/** n + 1 điểm trên cung trắc địa từ a tới b (cung nằm trong đĩa) */
export function geodesicPoints(a: P2, b: P2, n = 32): P2[] {
  const g = geodesic(a, b);
  const out: P2[] = [];
  if (g.line) {
    for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
    return out;
  }
  const t0 = Math.atan2(a[1] - g.c[1], a[0] - g.c[0]);
  let t1 = Math.atan2(b[1] - g.c[1], b[0] - g.c[0]);
  // chọn chiều ngắn hơn (cung trong đĩa là cung nhỏ vì tâm nằm ngoài đĩa)
  let dt = t1 - t0;
  while (dt > Math.PI) dt -= 2 * Math.PI;
  while (dt < -Math.PI) dt += 2 * Math.PI;
  t1 = t0 + dt;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    out.push([g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]);
  }
  return out;
}

/** hướng tiếp tuyến (đơn vị) của cung trắc địa a→b tại a, chỉ về phía b */
function tangentAt(a: P2, b: P2): P2 {
  const pts = geodesicPoints(a, b, 400);
  const d = sub(pts[1], pts[0]);
  const l = len(d) || 1;
  return [d[0] / l, d[1] / l];
}

/** góc trong tại đỉnh a của tam giác trắc địa abc (radian) */
export function angleAt(a: P2, b: P2, c: P2): number {
  const u = tangentAt(a, b);
  const v = tangentAt(a, c);
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
}

export function triangleAngles(a: P2, b: P2, c: P2): [number, number, number] {
  return [angleAt(a, b, c), angleAt(b, c, a), angleAt(c, a, b)];
}

export function hypDistance(a: P2, b: P2): number {
  const d2 = dot(sub(a, b), sub(a, b));
  return Math.acosh(1 + (2 * d2) / ((1 - dot(a, a)) * (1 - dot(b, b))));
}

/** đường tròn cạnh của tam giác cơ bản {p, q} */
export function tilingCircle(p: number, q: number): { d: number; r: number } {
  const s = Math.sin(Math.PI / p);
  const c = Math.cos(Math.PI / q);
  const d = 1 / Math.sqrt(1 - (s * s) / (c * c));
  return { d, r: (d * s) / c };
}

// ── bố cục trên sân ──
/** tâm + bán kính (m) của đĩa trên sân; hai cột đỉnh cố định (toạ độ đĩa) */
export const DISK = { x: -1, z: 6, R: 3.2 };
export const PILLARS: [P2, P2] = [
  [0.55, -0.32],
  [-0.5, -0.42],
];
/** toạ độ sân → toạ độ đĩa (trục y của đĩa = −z sân) */
export const toDisk = (x: number, z: number): P2 => [(x - DISK.x) / DISK.R, -(z - DISK.z) / DISK.R];
export const fromDisk = (p: P2): [number, number] => [DISK.x + p[0] * DISK.R, DISK.z - p[1] * DISK.R];
