/**
 * Đài Phép Chiếu (Thế giới Bất Khả) — anamorphosis kiểu Felice Varini × chân dung lập thể Picasso:
 *  hàng trăm mảnh vỡ tam giác lơ lửng ở các độ sâu khác nhau; mỗi mảnh nằm trên MỘT TIA từ điểm nhìn V, cỡ tỉ lệ với độ sâu
 *  → từ đúng V, mọi mảnh chiếu xuống cùng một bức tranh (gương mặt nửa hồng nửa lam, mắt nhìn thẳng trên mặt nghiêng);
 *  bước khỏi V, bức tranh vỡ vụn. Mảnh trôi DỌC tia (đổi độ sâu, giữ cỡ góc) nên tranh vẫn nguyên từ V — toán: phép chiếu xuyên tâm.
 * Thuần (không three) để kiểm thử.
 */
export type V3 = [number, number, number];

/** chỗ đứng (đánh dấu trên sàn) + góc máy quay khớp Hub.tsx: camPos = (người + 1,3 m) + dist·(sin yaw·cos p, sin p, cos yaw·cos p) */
export const ANAM = { x: 9.0, z: 2.5, camYaw: -Math.PI / 2, camPitch: -0.15, camDist: 3.4, playerYaw: Math.PI / 2 };
/** khoảng cách mặt phẳng tranh; nửa bề rộng / cao (m) của tranh trên mặt phẳng đó; lệch lên */
export const PLANE = { d: 10, hw: 2.0, hh: 2.5, up: 0.35 };

export function viewPoint(): V3 {
  const cp = Math.cos(ANAM.camPitch);
  return [ANAM.x + Math.sin(ANAM.camYaw) * cp * ANAM.camDist, 1.3 + Math.sin(ANAM.camPitch) * ANAM.camDist, ANAM.z + Math.cos(ANAM.camYaw) * cp * ANAM.camDist];
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** khung máy quay tại V: forward (nhìn về đích), right, up */
export function viewBasis() {
  const V = viewPoint();
  const T: V3 = [ANAM.x, 1.3, ANAM.z];
  const f = norm([T[0] - V[0], T[1] - V[1], T[2] - V[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { V, f, r, u };
}

/** điểm (u, v) trên mặt phẳng tranh (m, gốc = tâm tranh) → hướng tia đơn vị từ V */
export function rayFor(u: number, v: number): V3 {
  const { f, r, u: up } = viewBasis();
  return norm([f[0] * PLANE.d + r[0] * u + up[0] * (v + PLANE.up), f[1] * PLANE.d + r[1] * u + up[1] * (v + PLANE.up), f[2] * PLANE.d + r[2] * u + up[2] * (v + PLANE.up)]);
}

/** chiếu điểm thế giới về mặt phẳng tranh nhìn từ V (để kiểm thử) */
export function projectToPlane(p: V3): [number, number] {
  const { V, f, r, u } = viewBasis();
  const d: V3 = [p[0] - V[0], p[1] - V[1], p[2] - V[2]];
  const k = PLANE.d / dot(d, f);
  return [dot(d, r) * k, dot(d, u) * k - PLANE.up];
}

// ── Bức chân dung lập thể (toạ độ chuẩn hoá x ∈ [−1, 1], y ∈ [−1, 1]) ──
export const PALETTE = {
  rose: "#E78AA9",
  slate: "#5D7A9A",
  ochre: "#C9A063",
  ivory: "#F2E6CD",
  ink: "#2A2533",
  vermilion: "#E0563F",
  teal: "#3FA7A0",
};
export type Tone = keyof typeof PALETTE;

/** vùng màu của tranh tại (x, y) hoặc null (trống) — mặt nghiêng + mắt nhìn thẳng, tóc, mũi gãy, miệng, cổ, nền mảng */
export function portrait(x: number, y: number): Tone | null {
  const inEll = (cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  // mắt nhìn thẳng (trên nửa lam) + đồng tử
  if (inEll(0.3, 0.2, 0.2, 0.1)) return inEll(0.32, 0.2, 0.06, 0.06) ? "ink" : "ivory";
  // mắt nghiêng (trên nửa hồng): hạnh nhân nhỏ
  if (inEll(-0.32, 0.24, 0.13, 0.06)) return "ink";
  // miệng
  if (inEll(0.02, -0.45, 0.16, 0.05)) return "vermilion";
  // mũi gãy nhô khỏi mặt nghiêng (tam giác)
  if (y < 0.1 && y > -0.25 && x < -0.55 && x > -0.95 + (0.1 - y) * 0.6) return "ochre";
  const head = inEll(0, 0.05, 0.62, 0.78);
  // tóc: chỏm trên + lọn sau gáy
  if ((inEll(0.05, 0.62, 0.7, 0.32) && y > 0.45) || inEll(0.62, 0.1, 0.16, 0.5)) return "ink";
  // mặt: chia đôi theo đường gãy chéo — hồng (nghiêng) | lam (thẳng)
  if (head) return x < 0.12 * y + 0.02 ? "rose" : "slate";
  // cổ + vai
  if (y < -0.7 && y > -1 && Math.abs(x - 0.05) < 0.22) return "ochre";
  if (y < -0.88 && Math.abs(x) < 0.8) return "teal";
  return null;
}

export type Shard = { pos: V3; dir: V3; t: number; size: number; rot: number; phase: number; tone: Tone };

/** gieo mảnh: điểm trên tranh (lấy mẫu loại bỏ) → tia từ V → độ sâu ngẫu nhiên (trên mặt sân) → cỡ ∝ độ sâu */
export function makeShards(n: number, seed = 7, floorY = 0.3): Shard[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const { V } = viewBasis();
  const out: Shard[] = [];
  let tries = 0;
  while (out.length < n && tries < n * 60) {
    tries++;
    const x = rnd() * 2 - 1;
    const y = rnd() * 2 - 1;
    const tone = portrait(x, y);
    if (!tone) continue;
    const dir = rayFor(x * PLANE.hw, y * PLANE.hh);
    const t = PLANE.d - 4 + rnd() * 7;
    const pos: V3 = [V[0] + dir[0] * t, V[1] + dir[1] * t, V[2] + dir[2] * t];
    if (pos[1] < floorY) continue;
    // cỡ góc cố định (≈ 7% bề rộng tranh) → cỡ thật tỉ lệ độ sâu
    out.push({ pos, dir, t, size: 0.16 * (0.75 + rnd() * 0.6), rot: rnd() * Math.PI * 2, phase: rnd() * Math.PI * 2, tone });
  }
  return out;
}
