/**
 * Totem Đối xứng (Expanse) — nhóm đối xứng trên lưới khối nguyên, thuần (không three):
 * mỗi phần tử là ma trận nguyên 3×3 (hàng chính), tác động lên vị trí tương đối với tâm totem.
 *  • C₂, C₄: quay quanh trục đứng y; D₄: C₄ + phản xạ (nhóm của hình vuông, 8 phần tử);
 *  • Oₕ: nhóm đối xứng đầy đủ của khối lập phương = mọi ma trận hoán vị có dấu (3! × 2³ = 48 phần tử).
 * Quỹ đạo của một khối = tập ảnh của nó qua mọi phần tử; |quỹ đạo| = |G| / |ổn định hoá| (định lý quỹ đạo – ổn định hoá):
 * khối nằm trên trục / mặt đối xứng có ít bản sao hơn.
 */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type V3i = [number, number, number];
export type GroupId = "C2" | "C4" | "D4" | "Oh";

const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ROT_Y: Mat3 = [0, 0, 1, 0, 1, 0, -1, 0, 0]; // 90° quanh y: (x, z) → (z, −x)
const MIRROR_X: Mat3 = [-1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
export const apply = (m: Mat3, v: V3i): V3i => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/** sinh nhóm từ các phần tử sinh (đóng dưới phép nhân) */
function generate(gens: Mat3[]): Mat3[] {
  const seen = new Map<string, Mat3>([[I.join(","), I]]);
  const queue: Mat3[] = [I];
  while (queue.length) {
    const a = queue.pop()!;
    for (const g of gens) {
      const p = mul(g, a);
      const k = p.join(",");
      if (!seen.has(k)) {
        seen.set(k, p);
        queue.push(p);
      }
    }
  }
  return [...seen.values()];
}

const ROT_X: Mat3 = [1, 0, 0, 0, 0, -1, 0, 1, 0];
export const GROUPS: Record<GroupId, Mat3[]> = {
  C2: generate([mul(ROT_Y, ROT_Y)]),
  C4: generate([ROT_Y]),
  D4: generate([ROT_Y, MIRROR_X]),
  Oh: generate([ROT_Y, ROT_X, [-1, 0, 0, 0, -1, 0, 0, 0, -1]]),
};

export const GROUP_INFO: Record<GroupId, { vi: string; en: string }> = {
  C2: { vi: "C₂ · quay 180°", en: "C₂ · 180° turn" },
  C4: { vi: "C₄ · quay 90°", en: "C₄ · quarter turns" },
  D4: { vi: "D₄ · quay + soi gương", en: "D₄ · turns + mirrors" },
  Oh: { vi: "Oₕ · khối lập phương (48)", en: "Oₕ · the cube group (48)" },
};

/** quỹ đạo (không trùng lặp) của vị trí tương đối v dưới nhóm g — gồm cả chính v */
export function orbit(v: V3i, g: GroupId): V3i[] {
  const seen = new Map<string, V3i>();
  for (const m of GROUPS[g]) {
    const w = apply(m, v);
    seen.set(w.join(","), w);
  }
  return [...seen.values()];
}
