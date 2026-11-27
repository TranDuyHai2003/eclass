/**
 * Sigil recogniser (pure, testable): classifies one drawn stroke by curve features and scores how well it
 * fits the ideal curve. Used by components/world/combat/spells.ts.
 */
export type SpellId = "shield" | "bolt" | "vortex" | "meteor" | "wave";
type Pt = { x: number; y: number };


function resample(pts: Pt[], n: number): Pt[] {
  const len = pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
  const step = len / (n - 1);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(q);
      a = q;
      d = Math.hypot(b.x - a.x, b.y - a.y);
      acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function recognize(raw: Pt[]): { id: SpellId; score: number } | null {
  if (raw.length < 6) return null;
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(w, h);
  if (size < 40) return null;
  const P = resample(raw, 64).map((p) => ({ x: (p.x - (Math.min(...xs) + w / 2)) / size, y: (p.y - (Math.min(...ys) + h / 2)) / size }));
  // Góc rẽ có dấu giữa các đoạn (bước 2 để bớt nhiễu tay)
  const turns: number[] = [];
  for (let i = 2; i < P.length - 2; i += 2) {
    const a = Math.atan2(P[i].y - P[i - 2].y, P[i].x - P[i - 2].x);
    const b = Math.atan2(P[i + 2].y - P[i].y, P[i + 2].x - P[i].x);
    turns.push(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  }
  const total = turns.reduce((a, t) => a + t, 0);
  const corners = turns.filter((t) => Math.abs(t) > 1.5).length;
  const pathLen = P.reduce((a, p, i) => (i ? a + Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y) : 0), 0);
  const closure = Math.hypot(P[0].x - P[63].x, P[0].y - P[63].y) / pathLen;
  const cx = P.reduce((a, p) => a + p.x, 0) / P.length;
  const cy = P.reduce((a, p) => a + p.y, 0) / P.length;
  const radii = P.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const rMean = radii.reduce((a, r) => a + r, 0) / radii.length;
  const rStd = Math.sqrt(radii.reduce((a, r) => a + (r - rMean) ** 2, 0) / radii.length);

  // 1) Zigzag: nhiều góc gãy
  if (corners >= 3) {
    const sharp = turns.filter((t) => Math.abs(t) > 1.5);
    const regular = 1 - Math.min(1, (Math.max(...sharp.map(Math.abs)) - Math.min(...sharp.map(Math.abs))) / 1.6);
    return { id: "bolt", score: clamp01(0.55 + 0.45 * regular) };
  }
  // 2) Xoắn ốc: quay quá 1,5 vòng, bán kính tăng / giảm đều
  if (Math.abs(total) > Math.PI * 3) {
    let mono = 0;
    for (let i = 4; i < radii.length; i += 4) mono += Math.sign(radii[i] - radii[i - 4]);
    return { id: "vortex", score: clamp01(0.4 + 0.6 * (Math.abs(mono) / (radii.length / 4))) };
  }
  // 3) Đường tròn: khép kín, quay ~1 vòng, bán kính đều
  if (closure < 0.2 && Math.abs(total) > Math.PI * 1.5) return { id: "shield", score: clamp01(1 - (rStd / rMean) * 3.2) };
  // 4/5) Theo trục x đơn điệu → parabol (1 cực trị) hoặc sóng sin (cắt trung bình ≥ 2 lần)
  let incr = 0;
  for (let i = 1; i < P.length; i++) incr += Math.sign(P[i].x - P[i - 1].x);
  if (Math.abs(incr) / (P.length - 1) > 0.8 && w > h * 0.6) {
    // Đếm cực trị theo y (đổi dấu của dy, bước 3 để bớt rung tay): parabol 1, sóng sin ≥ 2
    let ext = 0;
    let prev = 0;
    for (let i = 3; i < P.length; i += 3) {
      const d = P[i].y - P[i - 3].y;
      const sg = Math.abs(d) < 0.01 ? 0 : Math.sign(d);
      if (sg && prev && sg !== prev) ext++;
      if (sg) prev = sg;
    }
    if (ext >= 2) return { id: "wave", score: clamp01(0.5 + 0.12 * Math.min(ext, 4)) };
    // Bình phương tối thiểu y = a x² + b x + c → R²
    const n = P.length;
    const S = (f: (p: Pt) => number) => P.reduce((a, p) => a + f(p), 0);
    const [s0, s1, s2, s3, s4] = [n, S((p) => p.x), S((p) => p.x ** 2), S((p) => p.x ** 3), S((p) => p.x ** 4)];
    const [t0, t1, t2] = [S((p) => p.y), S((p) => p.x * p.y), S((p) => p.x ** 2 * p.y)];
    const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const A = [[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]];
    const D = det(A) || 1e-9;
    const a = det([[t2, s3, s2], [t1, s2, s1], [t0, s1, s0]]) / D;
    const b = det([[s4, t2, s2], [s3, t1, s1], [s2, t0, s0]]) / D;
    const c = det([[s4, s3, t2], [s3, s2, t1], [s2, s1, t0]]) / D;
    const mean = t0 / n;
    const ssTot = S((p) => (p.y - mean) ** 2) || 1e-9;
    const ssRes = S((p) => (p.y - (a * p.x * p.x + b * p.x + c)) ** 2);
    const r2 = 1 - ssRes / ssTot;
    if (r2 > 0.55 && Math.abs(a) > 0.3) return { id: "meteor", score: clamp01((r2 - 0.55) / 0.42) };
  }
  return null;
}

export function tier(score: number): { label: string; mult: number } {
  if (score >= 0.9) return { label: "Perfect", mult: 1.5 };
  if (score >= 0.75) return { label: "Good", mult: 1.2 };
  if (score >= 0.55) return { label: "OK", mult: 1 };
  return { label: "Rough", mult: 0.6 };
}

