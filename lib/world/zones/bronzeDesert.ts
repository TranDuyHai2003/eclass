/**
 * Khu "Sa Mạc Tấm Đồng" (id desert) — tấm đồng khắc 64 × 64 m giữa hai bờ cát; bọ gom cát đẩy cát dọc đường nút.
 * Luật (mẫu nút Chladni — dùng CHUNG hàm chladni của lib/world/harmonicState.ts với shader): cần gạt ở chân đài quan sát
 * đổi mode (m, n). Đứng ở chỗ |F| > DANGER (bụng sóng) quá SINK_S giây → tấm lún, đưa về bờ gần. Đúng mode thì có đường
 * nút nối cổng bờ Tây (v = GATE_W) với cổng bờ Đông (v = GATE_E) — đúng MỘT mode trong MODES (test BFS).
 * Bờ Đông: sân của phù thuỷ "Gối Xếp Im" (cùng chủ đề nút sóng dừng — WITCHES_CODEX.md) + cửa đồng về đáy hub.
 * Toạ độ cục bộ (gốc khu: lib/world/zoneGraph.ts). Thuần — test: tests/world/sirenZones.test.ts.
 */
import { chladni } from "../harmonicState";
import { zbox, zdisc, zstairs, zwall, type ZoneColliders } from "./types";

export const DESERT_HALF = { x: 52, z: 42 };
/** tấm đồng: [−HALF, HALF]² mét ↔ toạ độ tấm (u, v) ∈ [−1, 1]² */
export const PLATE = { half: 32, y: 0 };
export const toPlate = (x: number) => x / PLATE.half;

/** Năm mode chọn bằng cần gạt; MODE_ANSWER là chỉ số đáp án */
export const MODES: readonly (readonly [number, number])[] = [
  [1, 3],
  [2, 3],
  [1, 4],
  [2, 5],
  [3, 4],
];
export const MODE_ANSWER = 2;
/** |F| > DANGER = bụng sóng (rung, nguy hiểm); |F| < SAND = cát dồn (đường đi rõ) */
export const DANGER = 0.35;
export const SAND = 0.18;
export const SINK_S = 0.6;
/** cổng hai bờ (toạ độ tấm v) và nửa bề rộng cổng (m) */
export const GATE_W = -0.15;
export const GATE_E = 0.15;
export const GATE_HALF = 2;

export const plateF = (x: number, z: number, m: number, n: number) => chladni(toPlate(x), toPlate(z), m, n);
export const onPlate = (x: number, z: number) => Math.abs(x) <= PLATE.half && Math.abs(z) <= PLATE.half;
export const plateDanger = (x: number, z: number, m: number, n: number) => onPlate(x, z) && Math.abs(plateF(x, z, m, n)) > DANGER;

/**
 * Có đường đi an toàn (|F| ≤ DANGER) nối cổng Tây với cổng Đông không — BFS trên lưới N × N của tấm (thuần, dùng cho test
 * và cho đèn cổng sáng khi đúng). Kết quả cho mỗi mode được ghi nhớ.
 */
const CONN = new Map<string, boolean>();
export function nodalConnected(m: number, n: number, N = 161): boolean {
  const key = `${m},${n},${N}`;
  const hit = CONN.get(key);
  if (hit !== undefined) return hit;
  const P = (i: number) => -1 + (2 * i) / (N - 1);
  const R = GATE_HALF / PLATE.half;
  const ok = (i: number, j: number) => Math.abs(chladni(P(i), P(j), m, n)) <= DANGER;
  const seen = new Uint8Array(N * N);
  const q: number[] = [];
  for (let j = 0; j < N; j++)
    if (Math.abs(P(j) - GATE_W) <= R && ok(0, j)) {
      seen[j] = 1;
      q.push(j);
    }
  let found = false;
  while (q.length) {
    const k = q.pop()!;
    const i = (k / N) | 0;
    const j = k % N;
    if (i === N - 1 && Math.abs(P(j) - GATE_E) <= R) {
      found = true;
      break;
    }
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = i + a;
      const y = j + b;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const kk = x * N + y;
      if (seen[kk] || !ok(x, y)) continue;
      seen[kk] = 1;
      q.push(kk);
    }
  }
  CONN.set(key, found);
  return found;
}

/** Bờ Tây / Đông, đài quan sát + cần gạt, sân phù thuỷ */
export const SHORE_W = { x: -42, hx: 10.05, hz: 20 };
export const SHORE_E = { x: 42, hx: 10.05, hz: 20 };
export const TOWER = { x: -42, z: -13, top: 6 };
export const LEVER = { x: -38.5, z: -6.5 };
/** sân phù thuỷ Gối Xếp Im (vách vải dài 6 m — WITCHES_CODEX §2) */
export const WITCH_ARENA = { x: 42, z: -10, r: 8 };

/** tường bờ ở mép tấm (khoét đúng cổng) + cồn cát bao quanh */
function edgeWalls(id: string, x: number, gateV: number) {
  const gz = gateV * PLATE.half;
  const lo = -PLATE.half - 0.5;
  const hi = PLATE.half + 0.5;
  const a = gz - GATE_HALF;
  const b = gz + GATE_HALF;
  return [zwall(`${id}a`, x, (lo + a) / 2, 0.25, (a - lo) / 2, -1, 2.2), zwall(`${id}b`, x, (b + hi) / 2, 0.25, (hi - b) / 2, -1, 2.2)];
}

export const DESERT_COLLIDERS: ZoneColliders = {
  surfs: [
    { ...zbox("plate", 0, PLATE.y, 0, PLATE.half, PLATE.half, 1.5, 0, "plate"), dyn: 0 },
    zbox("shoreW", SHORE_W.x, 0, 0, SHORE_W.hx, SHORE_W.hz, 2),
    zbox("shoreE", SHORE_E.x, 0, 0, SHORE_E.hx, SHORE_E.hz, 2),
    zdisc("towerTop", TOWER.x, TOWER.top, TOWER.z, 2.6, 0.5),
    ...zstairs("towerSt", [TOWER.x, 0, TOWER.z + 9], [TOWER.x, TOWER.top, TOWER.z + 2.7], 2),
  ],
  walls: [
    ...edgeWalls("eW", -PLATE.half - 0.25, GATE_W),
    ...edgeWalls("eE", PLATE.half + 0.25, GATE_E),
    // cồn cát: mép ngoài hai bờ + hai cạnh bắc / nam của tấm
    zwall("dN", 0, -PLATE.half - 1, DESERT_HALF.x, 0.5, -1, 3),
    zwall("dS", 0, PLATE.half + 1, DESERT_HALF.x, 0.5, -1, 3),
    zwall("dWn", SHORE_W.x, -SHORE_W.hz - 0.5, SHORE_W.hx, 0.5, -1, 3),
    zwall("dWs", SHORE_W.x, SHORE_W.hz + 0.5, SHORE_W.hx, 0.5, -1, 3),
    zwall("dEn", SHORE_E.x, -SHORE_E.hz - 0.5, SHORE_E.hx, 0.5, -1, 3),
    zwall("dEs", SHORE_E.x, SHORE_E.hz + 0.5, SHORE_E.hx, 0.5, -1, 3),
    zwall("dWw", -DESERT_HALF.x - 0.5, 0, 0.5, SHORE_W.hz + 1, -1, 3),
    zwall("dEe", DESERT_HALF.x + 0.5, 0, 0.5, SHORE_E.hz + 1, -1, 3),
  ],
  cyls: [{ id: "tower", x: TOWER.x, z: TOWER.z, r: 1.2, y0: -1, y1: TOWER.top - 0.6 }],
};

/**
 * Bọ gom cát: trượt về đường nút (giảm |F| theo gradient) rồi bò dọc theo nút (hướng tiếp tuyến), giữ trong tấm.
 * st = [x, z, hướng ±1]; không cấp phát.
 */
export function beetleStep(st: Float32Array, i: number, m: number, n: number, dt: number): void {
  const o = i * 3;
  const x = st[o];
  const z = st[o + 1];
  const e = 0.25;
  const f = plateF(x, z, m, n);
  const gx = (plateF(x + e, z, m, n) - plateF(x - e, z, m, n)) / (2 * e);
  const gz = (plateF(x, z + e, m, n) - plateF(x, z - e, m, n)) / (2 * e);
  const g2 = gx * gx + gz * gz + 1e-4;
  const g = Math.sqrt(g2);
  // bước Newton về F = 0 (giới hạn) + bò dọc tiếp tuyến 1,6 m/s
  const pull = Math.max(-1, Math.min(1, f / g2)) * Math.min(1, dt * 4);
  let nx = x - gx * pull + (-gz / g) * st[o + 2] * 1.6 * dt;
  let nz = z - gz * pull + (gx / g) * st[o + 2] * 1.6 * dt;
  const lim = PLATE.half - 1.2;
  if (Math.abs(nx) > lim || Math.abs(nz) > lim) {
    st[o + 2] = -st[o + 2];
    nx = Math.max(-lim, Math.min(lim, nx));
    nz = Math.max(-lim, Math.min(lim, nz));
  }
  st[o] = nx;
  st[o + 1] = nz;
}
