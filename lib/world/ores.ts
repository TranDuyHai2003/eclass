/**
 * G4 — Quặng toán học, đặt TẤT ĐỊNH theo seed toạ độ (worker và luồng chính sinh y hệt):
 *   • Tinh thể Số nguyên (tím): mỏ lộ thiên nhỏ trên mặt đất khô (để bậc 0 bắt đầu được ngay gần điểm xuất phát)
 *     + mạch nông trong vách hang;
 *   • Đồng Tỉ lệ (cam): mỏ trên đồi đá (đỉnh ≥ 12) + mạch sâu trong vách hang.
 * Không đụng khu cần trống (điểm xuất phát, Lò Ma trận, Totem — structures.inKeepClear) và bán kính 14 m quanh gốc.
 */
import { B } from "./blocks";
import { hash3 } from "./density";
import { inKeepClear } from "./structures";
import { CHUNK, WATER_LEVEL, blockTop } from "./terrain";

const SPAWN_R = 14;

/**
 * Ô đá trong vách hang → quặng hay đá. Mạch theo ô thô 2 × 2 × 2 (hash ô thô) rồi lọc từng khối → cụm 3–6 khối.
 * top = đỉnh cột theo bản đồ độ cao.
 */
export function caveOre(x: number, y: number, z: number, top: number): number {
  const gx = x >> 1;
  const gy = y >> 1;
  const gz = z >> 1;
  if (y > top - 16 && hash3(gx, gy, gz, 911) < 0.022 && hash3(x, y, z, 912) < 0.7) return B.intcrystal;
  if (y < top - 5 && hash3(gx, gy, gz, 921) < 0.02 && hash3(x, y, z, 922) < 0.65) return B.copper;
  return B.stone;
}

/** Tâm các mỏ lộ thiên của chunk: [x, z, id]* (tối đa 3) */
export function surfaceNodes(cx: number, cz: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 3; k++) {
    const h = hash3(cx, k, cz, 931);
    const x = cx * CHUNK + 3 + Math.floor(hash3(cx, k, cz, 932) * (CHUNK - 6));
    const z = cz * CHUNK + 3 + Math.floor(hash3(cx, k, cz, 933) * (CHUNK - 6));
    if (Math.hypot(x, z) < SPAWN_R || inKeepClear(x, z, 3)) continue;
    const top = blockTop(x, z);
    if (top <= WATER_LEVEL + 1) continue;
    if (k < 2 && h < 0.55) out.push(x, z, B.intcrystal);
    else if (k === 2 && top >= 12 && h < 0.7) out.push(x, z, B.copper);
  }
  return out;
}

/**
 * Các ô của mỏ lộ thiên chạm vào chunk (cx, cz) (xét cả mỏ của 8 chunk kề vì mỏ có thể vắt qua mép):
 * [x, y, z, id]* — y là 1–2 lớp trên cùng của cột (thay cỏ / đất / đá). Người gọi chỉ ghi khi ô đang đặc.
 */
export function surfaceOreCells(cx: number, cz: number): number[] {
  const out: number[] = [];
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) {
      const nodes = surfaceNodes(cx + a, cz + b);
      for (let i = 0; i < nodes.length; i += 3) {
        const nx = nodes[i];
        const nz = nodes[i + 1];
        const id = nodes[i + 2];
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = nx + dx;
            const z = nz + dz;
            if (x < x0 || z < z0 || x >= x0 + CHUNK || z >= z0 + CHUNK) continue;
            if ((dx || dz) && hash3(x, 0, z, 941) < 0.45) continue; // mép mỏ lởm chởm
            if (Math.hypot(x, z) < SPAWN_R || inKeepClear(x, z, 1)) continue;
            const top = blockTop(x, z);
            out.push(x, top - 1, z, id);
            if (hash3(x, 1, z, 942) < 0.6) out.push(x, top - 2, z, id);
          }
      }
    }
  return out;
}
