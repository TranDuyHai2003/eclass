/**
 * W6 — WAVE FUNCTION COLLAPSE, mô hình "simple tiled" (M. Gumin, github.com/mxgmn/WaveFunctionCollapse) cho mê cung tàn tích.
 *
 * Mảnh ghép = 16 mặt nạ cổng N/E/S/W (bit mở / đóng). Hai ô kề nhau hợp lệ khi cổng chung khớp (cùng mở hoặc cùng đóng).
 * Vòng lặp: chọn ô còn ÍT KHẢ NĂNG nhất (số mảnh còn lại — thay cho entropy Shannon để khỏi dùng Math.log, vốn có thể lệch
 * bit cuối giữa các trình duyệt; hoà thì xếp theo hạng ngẫu nhiên có hạt) → "sụp" về một mảnh theo trọng số → LAN RÀNG BUỘC
 * sang hàng xóm (AC-3) → lặp. Mâu thuẫn (ô hết khả năng) → khởi động lại với hạt kế tiếp.
 * Hậu xử lý (WFC không bảo đảm liên thông): BFS từ cổng vào, mở bức tường giữa vùng đã tới và ô chưa tới cho đến khi tới hết.
 * Tất định: chỉ số nguyên + mulberry32 (Math.imul).
 */
export const DN = 1; // bắc (−z)
export const DE = 2; // đông (+x)
export const DS = 4; // nam (+z)
export const DW = 8; // tây (−x)
const DIRS = [
  { bit: DN, opp: DS, dx: 0, dz: -1 },
  { bit: DE, opp: DW, dx: 1, dz: 0 },
  { bit: DS, opp: DN, dx: 0, dz: 1 },
  { bit: DW, opp: DE, dx: -1, dz: 0 },
];

const popcount4 = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
/** Trọng số nguyên theo loại mảnh: rỗng 1, cụt 2, thẳng 10, góc 8, chữ T 4, ngã tư 2 (gợi ý từ nghiên cứu Codex) */
export const TILE_WEIGHT: number[] = Array.from({ length: 16 }, (_, m) => {
  const c = popcount4(m);
  if (c === 0) return 1;
  if (c === 1) return 2;
  if (c === 2) return m === (DN | DS) || m === (DE | DW) ? 10 : 8;
  if (c === 3) return 4;
  return 2;
});
/** WITH[bit][v]: tập (bitset 16) các mảnh có cổng `bit` mở (v = 1) / đóng (v = 0) */
const WITH: Record<number, [number, number]> = {};
for (const d of DIRS) {
  let open = 0;
  let closed = 0;
  for (let m = 0; m < 16; m++) {
    if (m & d.bit) open |= 1 << m;
    else closed |= 1 << m;
  }
  WITH[d.bit] = [closed, open];
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Maze = {
  w: number;
  h: number;
  /** mặt nạ cổng của từng ô (chỉ số j·w + i) */
  tiles: Uint8Array;
  /** số lần chạy WFC (1 = không mâu thuẫn) */
  attempts: number;
  /** số bức tường phải mở để liên thông */
  opened: number;
  entrance: number;
  goal: number;
  dist: Int16Array;
};

/** Một lần chạy WFC; null nếu mâu thuẫn */
function runWfc(w: number, h: number, entrance: number, rand: () => number): Uint8Array | null {
  const n = w * h;
  const dom = new Uint16Array(n).fill(0xffff);
  const rank = new Float64Array(n);
  for (let c = 0; c < n; c++) rank[c] = rand();
  const queue: number[] = [];
  // biên: cổng hướng ra ngoài phải đóng, trừ cổng nam của ô lối vào
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = j * w + i;
      for (const d of DIRS) {
        const ni = i + d.dx;
        const nj = j + d.dz;
        if (ni >= 0 && nj >= 0 && ni < w && nj < h) continue;
        dom[c] &= WITH[d.bit][c === entrance && d.bit === DS ? 1 : 0];
      }
      queue.push(c);
    }
  const propagate = (): boolean => {
    while (queue.length) {
      const c = queue.pop()!;
      const i = c % w;
      const j = (c - i) / w;
      for (const d of DIRS) {
        const ni = i + d.dx;
        const nj = j + d.dz;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const nb = nj * w + ni;
        const canOpen = (dom[c] & WITH[d.bit][1]) !== 0;
        const canClose = (dom[c] & WITH[d.bit][0]) !== 0;
        const allowed = (canOpen ? WITH[d.opp][1] : 0) | (canClose ? WITH[d.opp][0] : 0);
        const next = dom[nb] & allowed;
        if (next === dom[nb]) continue;
        if (!next) return false;
        dom[nb] = next;
        queue.push(nb);
      }
    }
    return true;
  };
  if (!propagate()) return null;
  for (;;) {
    // ô ít khả năng nhất (> 1); hoà → hạng ngẫu nhiên
    let best = -1;
    let bestK = 99;
    for (let c = 0; c < n; c++) {
      let k = 0;
      for (let v = dom[c]; v; v &= v - 1) k++;
      if (k === 0) return null;
      if (k === 1) continue;
      if (k < bestK || (k === bestK && rank[c] < rank[best])) {
        best = c;
        bestK = k;
      }
    }
    if (best < 0) break;
    let total = 0;
    for (let m = 0; m < 16; m++) if (dom[best] & (1 << m)) total += TILE_WEIGHT[m];
    let r = Math.floor(rand() * total);
    let pick = 0;
    for (let m = 0; m < 16; m++) {
      if (!(dom[best] & (1 << m))) continue;
      r -= TILE_WEIGHT[m];
      if (r < 0) {
        pick = m;
        break;
      }
    }
    dom[best] = 1 << pick;
    queue.push(best);
    if (!propagate()) return null;
  }
  const tiles = new Uint8Array(n);
  for (let c = 0; c < n; c++) tiles[c] = 31 - Math.clz32(dom[c]);
  return tiles;
}

/** Mê cung DFS dự phòng (chỉ dùng khi WFC mâu thuẫn quá nhiều lần) */
function dfsMaze(w: number, h: number, entrance: number, rand: () => number): Uint8Array {
  const tiles = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  const stack = [entrance];
  seen[entrance] = 1;
  tiles[entrance] |= DS;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const i = c % w;
    const j = (c - i) / w;
    const opts = DIRS.filter((d) => {
      const ni = i + d.dx;
      const nj = j + d.dz;
      return ni >= 0 && nj >= 0 && ni < w && nj < h && !seen[nj * w + ni];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rand() * opts.length)];
    const nb = (j + d.dz) * w + i + d.dx;
    tiles[c] |= d.bit;
    tiles[nb] |= d.opp;
    seen[nb] = 1;
    stack.push(nb);
  }
  return tiles;
}

/** BFS khoảng cách (theo cổng mở) từ ô `from`; −1 = không tới */
export function mazeDistances(tiles: Uint8Array, w: number, h: number, from: number): Int16Array {
  const dist = new Int16Array(w * h).fill(-1);
  dist[from] = 0;
  const q = [from];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const i = c % w;
    const j = (c - i) / w;
    for (const d of DIRS) {
      if (!(tiles[c] & d.bit)) continue;
      const ni = i + d.dx;
      const nj = j + d.dz;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const nb = nj * w + ni;
      if (dist[nb] >= 0) continue;
      dist[nb] = dist[c] + 1;
      q.push(nb);
    }
  }
  return dist;
}

/** Mê cung w × h bằng WFC; lối vào ở cạnh nam, cột giữa. Tất định theo `seed`. */
export function wfcMaze(w: number, h: number, seed: number): Maze {
  const entrance = (h - 1) * w + Math.floor(w / 2);
  let tiles: Uint8Array | null = null;
  let attempts = 0;
  while (!tiles && attempts < 8) {
    tiles = runWfc(w, h, entrance, mulberry32(seed + attempts * 7919));
    attempts++;
  }
  if (!tiles) tiles = dfsMaze(w, h, entrance, mulberry32(seed));
  // liên thông: mở tường giữa vùng đã tới và ô chưa tới (thứ tự quét cố định → tất định)
  let opened = 0;
  for (;;) {
    const dist = mazeDistances(tiles, w, h, entrance);
    let done = true;
    outer: for (let c = 0; c < w * h; c++) {
      if (dist[c] < 0) continue;
      const i = c % w;
      const j = (c - i) / w;
      for (const d of DIRS) {
        const ni = i + d.dx;
        const nj = j + d.dz;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const nb = nj * w + ni;
        if (dist[nb] >= 0) continue;
        tiles[c] |= d.bit;
        tiles[nb] |= d.opp;
        opened++;
        done = false;
        break outer;
      }
    }
    if (done) break;
  }
  const dist = mazeDistances(tiles, w, h, entrance);
  let goal = entrance;
  for (let c = 0; c < w * h; c++) if (dist[c] > dist[goal]) goal = c;
  return { w, h, tiles, attempts, opened, entrance, goal, dist };
}
