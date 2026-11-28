/**
 * Ma Tham Lam (Greedy Ghoul) — logic thuần (không three), test ở tests/world/ruleMonsters.test.ts.
 *
 * Quy luật toán học = cách đánh: nó đi theo THUẬT TOÁN THAM LAM (greedy best-first) trên lưới ô 1 m:
 * mỗi bước chọn ô kề (8 hướng) làm khoảng cách đường thẳng tới bạn giảm NHIỀU NHẤT, không bao giờ lùi lại để đi vòng.
 * Vì vậy nó mắc kẹt ở CỰC TIỂU ĐỊA PHƯƠNG: trong lòng một bức rào chữ U mà bạn đứng ngay sau lưng rào —
 * mọi ô kề đều xa bạn hơn ô nó đang đứng, dù đường vòng vẫn có. Lúc kẹt nó bối rối (không đánh được) và hở giáp.
 */

export type Blocked = (i: number, j: number) => boolean;

/** 8 ô kề (thứ tự cố định → kết quả tất định khi hoà) */
const N8: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Một bước tham lam từ ô (i, j) về phía điểm (tx, tz) (cùng hệ toạ độ ô, ô (i, j) có tâm tại (i, j)).
 * Không cắt góc: đi chéo cần cả hai ô thẳng bên cạnh trống. Không ô kề nào GẦN HƠN ô hiện tại → kẹt (stuck).
 */
export function greedyStep(i: number, j: number, tx: number, tz: number, blocked: Blocked): { i: number; j: number; stuck: boolean } {
  const here = Math.hypot(tx - i, tz - j);
  let best: [number, number] | null = null;
  let bd = here - 1e-6;
  for (const [di, dj] of N8) {
    const ni = i + di;
    const nj = j + dj;
    if (blocked(ni, nj)) continue;
    if (di && dj && (blocked(i + di, j) || blocked(i, j + dj))) continue;
    const d = Math.hypot(tx - ni, tz - nj);
    if (d < bd) {
      bd = d;
      best = [ni, nj];
    }
  }
  if (!best) return { i, j, stuck: here > 0.75 };
  return { i: best[0], j: best[1], stuck: false };
}

/** Đi tham lam tối đa `max` bước — trả về đường đi và có kẹt không (để test / gợi ý) */
export function greedyPath(i: number, j: number, tx: number, tz: number, blocked: Blocked, max = 60): { path: [number, number][]; stuck: boolean } {
  const path: [number, number][] = [[i, j]];
  for (let k = 0; k < max; k++) {
    const s = greedyStep(i, j, tx, tz, blocked);
    if (s.stuck) return { path, stuck: true };
    if (s.i === i && s.j === j) return { path, stuck: false };
    i = s.i;
    j = s.j;
    path.push([i, j]);
  }
  return { path, stuck: false };
}

/** BFS (tìm đường đầy đủ) — để chứng minh rằng ĐƯỜNG VẪN CÓ khi con ma tham lam bị kẹt */
export function bfsReachable(si: number, sj: number, ti: number, tj: number, blocked: Blocked, limit = 900): boolean {
  const key = (a: number, b: number) => `${a},${b}`;
  const seen = new Set([key(si, sj)]);
  const q: [number, number][] = [[si, sj]];
  while (q.length && seen.size < limit) {
    const [a, b] = q.shift()!;
    if (a === ti && b === tj) return true;
    for (const [di, dj] of N8) {
      const ni = a + di;
      const nj = b + dj;
      if (blocked(ni, nj) || seen.has(key(ni, nj))) continue;
      if (di && dj && (blocked(a + di, b) || blocked(a, b + dj))) continue;
      seen.add(key(ni, nj));
      q.push([ni, nj]);
    }
  }
  return false;
}

/** Bán kính sào huyệt: người chơi ra ngoài thì con ma quay về (đi thẳng về tổ) */
export const LAIR_R = 11;
/** Một bẫy chữ U: tâm cách tổ 5 ô, miệng U quay vào tổ; lòng U rộng 3 ô, sâu 2 ô */
export const U_DIST = 5;

/**
 * Các ô rào của sào huyệt (toạ độ ô tương đối với tổ): ba chữ U ở hướng +x, −x, +z (miệng quay vào trong).
 * Ví dụ chữ U phía +x: lưng rào i = 6 (j = −2…2), hai cánh j = ±2 (i = 4…5); lòng U = i 4…5, j −1…1.
 */
export function lairCells(): [number, number][] {
  const out: [number, number][] = [];
  // dựng chữ U hướng +x rồi xoay 90°·k
  const base: [number, number][] = [];
  for (let j = -2; j <= 2; j++) base.push([U_DIST + 1, j]);
  for (const j of [-2, 2]) for (let i = U_DIST - 1; i <= U_DIST; i++) base.push([i, j]);
  const rot = (c: [number, number], k: number): [number, number] => {
    let [a, b] = c;
    for (let r = 0; r < k; r++) [a, b] = [-b, a];
    return [a, b];
  };
  for (const k of [0, 2, 1]) for (const c of base) out.push(rot(c, k));
  return out;
}

const LAIR = new Set(lairCells().map(([i, j]) => i * 1000 + j));
/** Ô (i, j) (tương đối tổ) có rào không */
export function lairBlocked(i: number, j: number): boolean {
  return LAIR.has(i * 1000 + j);
}

/** Điểm con ma nhắm tới: người chơi nếu còn trong sào huyệt, không thì về tổ (0, 0) */
export function ghoulTarget(px: number, pz: number): [number, number] {
  return Math.hypot(px, pz) <= LAIR_R ? [px, pz] : [0, 0];
}

/** Hệ số sát thương: kẹt (cực tiểu địa phương) → hở giáp ×2,2; còn đang lao tới → "nuốt đòn" ×0,35 */
export function ghoulDamageMul(stuck: boolean): number {
  return stuck ? 2.2 : 0.35;
}
