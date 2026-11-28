/**
 * Lõi dựng chunk voxel thế hệ 2 (thuần, không three — chạy trong Web Worker và test Node):
 *  1) `buildVolume`: đọc khối MỘT lần vào mảng dày đặc có lề M khối quanh chunk (lề để tính ánh sáng tràn từ chunk bên
 *     cạnh + AO/mặt ở mép); theo TỪNG CỘT chỉ đọc khoảng y của cột (dưới = đặc, trên = rỗng — hợp đồng `columnRange`).
 *  2) `computeLight`: ánh sáng kiểu Minecraft 0…15 — trời (cột lộ trời = 15, lan ngang / xuống giảm 1 mỗi ô) + khối
 *     (khối phát sáng là nguồn), BFS trên mảng phẳng, lá cây cản thêm 1.
 *  3) `greedyMesh`: chỉ sinh mặt giáp ô trong suốt, GỘP THAM LAM các mặt liền nhau CÙNG (khối, màu, AO 4 góc, ánh sáng
 *     4 góc) thành một tứ giác — đồng cỏ / vách đá phẳng giảm hàng chục lần số mặt mà không mất AO / ánh sáng mịn.
 *     Đỉnh gọn: vị trí Int16 (cục bộ chunk), pháp tuyến Int8, màu Uint8 (đã nhân AO + bóng hướng), ánh sáng Uint8×2
 *     (trời, khối) — vật liệu nhân theo giờ trong ngày trong shader.
 * Tài liệu: 0fps "Meshing in a Minecraft game" (greedy), 0fps "Ambient occlusion for Minecraft-like worlds",
 * Minecraft wiki "Light" (sky/block light, propagation).
 */

export type Access = {
  blockAt: (x: number, y: number, z: number) => number;
  /** hợp đồng: y < lo đều đặc, y > hi đều rỗng */
  columnRange: (x: number, z: number) => [number, number];
  /** màu sRGB 0..1 của mặt (ny = pháp tuyến y của mặt: 1 trên, −1 dưới, 0 bên) */
  color: (x: number, y: number, z: number, id: number, ny: number) => [number, number, number];
};
export type BlockTraits = {
  /** ô cho ánh sáng / tầm nhìn đi qua (không khí luôn trong suốt) */
  transparent: (id: number) => boolean;
  /** mức phát sáng 0..15 */
  emit: (id: number) => number;
  /** tách sang lưới phát sáng (vật liệu riêng) */
  glow: (id: number) => boolean;
  /** cản thêm ánh sáng (lá: 1) */
  extraOpacity?: (id: number) => number;
  /** lớp hoạ tiết của mặt (ny: 1 trên, −1 dưới, 0 cạnh); 255 = không hoạ tiết */
  tile?: (id: number, ny: number) => number;
  /** khối "sprite" (đuốc…): không sinh mặt trong lưới chunk (vẽ riêng), ánh sáng / tầm nhìn đi qua như không khí */
  sprite?: (id: number) => boolean;
  /** nguồn chất lỏng (nước): dòng chảy tính trong `computeFlow`, vẽ ở lưới nước riêng — nên cũng là sprite */
  fluid?: (id: number) => boolean;
};

export type Volume = {
  ids: Uint8Array;
  W: number;
  H: number;
  /** lề quanh chunk (ô) */
  M: number;
  size: number;
  lo: number;
  x0: number;
  z0: number;
  sky?: Uint8Array;
  blk?: Uint8Array;
};
/** id dùng cho phần "đặc chắc chắn" dưới khoảng của cột (không đọc khối): đục, KHÔNG bao giờ sinh mặt */
export const SOLID_FILL = 255;

export function buildVolume(cx: number, cz: number, size: number, A: Access, M = 1): Volume {
  const W = size + 2 * M;
  const x0 = cx * size - M;
  const z0 = cz * size - M;
  const ra = new Int32Array(W * W);
  const rb = new Int32Array(W * W);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const [a, b] = A.columnRange(x0 + i, z0 + j);
      ra[j * W + i] = a;
      rb[j * W + i] = b;
      if (a < lo) lo = a;
      if (b > hi) hi = b;
    }
  lo -= 2; // chừa chỗ cho ngưỡng "min 3×3 − 1"
  hi += 2; // luôn có ít nhất 1 lớp không khí phía trên
  const H = hi - lo + 1;
  const ids = new Uint8Array(W * W * H);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      // đọc từ min(lo của 3×3 cột lân cận) − 1: ô kề hang / hố của cột bên cạnh vẫn đúng khối thật (lộ mặt)
      let m = ra[j * W + i];
      for (let b2 = j - 1; b2 <= j + 1; b2++)
        for (let a2 = i - 1; a2 <= i + 1; a2++) if (a2 >= 0 && b2 >= 0 && a2 < W && b2 < W && ra[b2 * W + a2] < m) m = ra[b2 * W + a2];
      const a = m - 1 - lo;
      const b = rb[j * W + i] - lo;
      for (let k = 0; k < a; k++) ids[(k * W + j) * W + i] = SOLID_FILL;
      for (let k = Math.max(0, a); k <= Math.min(H - 1, b); k++) ids[(k * W + j) * W + i] = A.blockAt(x0 + i, lo + k, z0 + j);
    }
  return { ids, W, H, M, size, lo, x0, z0 };
}

/** Ánh sáng trời + khối (0..15) trên toàn khối lề (BFS, hàng đợi Int32Array) */
export function computeLight(v: Volume, T: BlockTraits): void {
  const { ids, W, H } = v;
  const N = W * W * H;
  const sky = new Uint8Array(N);
  const blk = new Uint8Array(N);
  const trans = new Uint8Array(256);
  const extra = new Uint8Array(256);
  const emit = new Uint8Array(256);
  for (let id = 0; id < 256; id++) {
    trans[id] = id === 0 || T.transparent(id) || !!T.sprite?.(id) ? 1 : 0;
    extra[id] = T.extraOpacity ? T.extraOpacity(id) : 0;
    emit[id] = T.emit(id);
  }
  const layer = W * W;
  const q = new Int32Array(N);
  // trời: từ đỉnh xuống, cột lộ trời = 15 cho tới ô đục đầu tiên.
  // top[cột] = tầng cao nhất mà cột KHÔNG còn đủ 15 (ô đục / ô cản thêm đầu tiên); ô trên đó = 15.
  // Chỉ đưa vào hàng đợi BFS "lớp vỏ": ô < 15, hoặc ô 15 mà cột bên cạnh ở cùng tầng bị che (k ≤ top cột kề) —
  // ô 15 giữa trời trống không làm sáng thêm ai (giảm hàng đợi từ cả khối không khí xuống vài nghìn ô).
  let qh = 0;
  let qt = 0;
  const top = new Int32Array(layer).fill(-1);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      let lvl = 15;
      let t = -1;
      for (let k = H - 1; k >= 0; k--) {
        const c = (k * W + j) * W + i;
        const id = ids[c];
        if (!trans[id] || extra[id]) {
          t = k;
          if (!trans[id]) break;
        }
        lvl -= extra[id];
        if (lvl <= 0) break;
        sky[c] = lvl;
      }
      top[j * W + i] = t;
    }
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const col = j * W + i;
      let nt = top[col];
      if (i > 0 && top[col - 1] > nt) nt = top[col - 1];
      if (i < W - 1 && top[col + 1] > nt) nt = top[col + 1];
      if (j > 0 && top[col - W] > nt) nt = top[col - W];
      if (j < W - 1 && top[col + W] > nt) nt = top[col + W];
      for (let k = Math.min(H - 1, nt); k >= 0; k--) {
        const c = k * layer + col;
        if (sky[c]) q[qt++] = c;
        else if (k < top[col]) break; // dưới ô đục đầu tiên của cột: không còn ô trời trực tiếp
      }
    }
  const spread = (L: Uint8Array) => {
    while (qh < qt) {
      const c = q[qh++];
      const l = L[c];
      if (l <= 1) continue;
      const i = c % W;
      const j = Math.floor(c / W) % W;
      const k = Math.floor(c / layer);
      for (let d = 0; d < 6; d++) {
        let n: number;
        if (d === 0) {
          if (i === 0) continue;
          n = c - 1;
        } else if (d === 1) {
          if (i === W - 1) continue;
          n = c + 1;
        } else if (d === 2) {
          if (j === 0) continue;
          n = c - W;
        } else if (d === 3) {
          if (j === W - 1) continue;
          n = c + W;
        } else if (d === 4) {
          if (k === 0) continue;
          n = c - layer;
        } else {
          if (k === H - 1) continue;
          n = c + layer;
        }
        const id = ids[n];
        if (!trans[id]) continue;
        const nl = l - 1 - extra[id];
        if (nl > L[n]) {
          L[n] = nl;
          q[qt++] = n;
        }
      }
    }
  };
  spread(sky);
  // khối: nguồn = khối phát sáng (ánh sáng toả ra các ô trong suốt kề nó)
  qh = 0;
  qt = 0;
  for (let c = 0; c < N; c++) {
    const e = emit[ids[c]];
    if (e) {
      blk[c] = e;
      q[qt++] = c;
    }
  }
  // nguồn đục: lan ra ô kề rồi dừng (ô đục không truyền tiếp) — xử lý bằng cách cho phép lan từ nguồn dù nguồn đục
  {
    const n0 = qt;
    for (let t = 0; t < n0; t++) {
      const c = q[t];
      const l = blk[c];
      const i = c % W;
      const j = Math.floor(c / W) % W;
      const k = Math.floor(c / layer);
      const nb = [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, j > 0 ? c - W : -1, j < W - 1 ? c + W : -1, k > 0 ? c - layer : -1, k < H - 1 ? c + layer : -1];
      for (const n of nb)
        if (n >= 0 && trans[ids[n]] && l - 1 > blk[n]) {
          blk[n] = l - 1;
          q[qt++] = n;
        }
    }
    qh = n0;
  }
  spread(blk);
  v.sky = sky;
  v.blk = blk;
}

export type Packed = {
  /** Int16 x, y, z (cục bộ: x, z ∈ [0, size], y tuyệt đối) */
  p: Int16Array;
  /** Int8 pháp tuyến (−127…127) */
  n: Int8Array;
  /** Uint8 sRGB đã nhân AO + bóng hướng */
  c: Uint8Array;
  /** Uint8 (trời, khối) × 17 (0…255) */
  l: Uint8Array;
  /** Uint8 lớp hoạ tiết (255 = không) */
  t: Uint8Array;
  idx: Uint32Array;
  quads: number;
};
/** lưới nước: vị trí Float32 (mặt nước thấp theo mức chảy), pháp tuyến Int8, ánh sáng (trời, khối) Uint8 */
export type FluidPacked = { p: Float32Array; n: Int8Array; l: Uint8Array; idx: Uint32Array; quads: number };
export type ChunkMeshOut = { solid: Packed; glow: Packed; water: FluidPacked; faces: number };

/** mức nước: 8 = nguồn / đang rơi, 7…1 = chảy ngang (mỗi ô giảm 1), 0 = không */
export const FLOW_MAX = 8;

/**
 * Dòng chảy kiểu Minecraft, TẤT ĐỊNH từ các khối nguồn trong khối lề (không trạng thái, không lưu, không gửi mạng):
 *  - nguồn = 8; ô có không khí bên dưới → nước rơi xuống (ô dưới = 8), KHÔNG lan ngang;
 *  - đáy là khối đặc → lan ngang 4 hướng, mức giảm 1 (nguồn / nước rơi → 7) tới 1; trên mặt nước khác thì không lan.
 * Hàng đợi ưu tiên theo mức (8 → 1, quay lại khi nước rơi tạo mức 8 mới) → mỗi ô cập nhật ≤ 8 lần.
 * Lề ánh sáng 8 ô ≥ tầm lan 7 → chunk kề nhau tính trùng khớp (trừ thác nối nhiều tầng sát mép — hiếm).
 */
export function computeFlow(v: Volume, T: BlockTraits): Uint8Array {
  const { ids, W, H } = v;
  const layer = W * W;
  const lvl = new Uint8Array(ids.length);
  if (!T.fluid) return lvl;
  const fl = new Uint8Array(256);
  for (let id = 1; id < 256; id++) fl[id] = T.fluid(id) ? 1 : 0;
  const bucket: number[][] = Array.from({ length: FLOW_MAX + 1 }, () => []);
  const head = new Int32Array(FLOW_MAX + 1);
  let any = false;
  for (let c = 0; c < ids.length; c++)
    if (fl[ids[c]]) {
      lvl[c] = FLOW_MAX;
      bucket[FLOW_MAX].push(c);
      any = true;
    }
  if (!any) return lvl;
  let cur = FLOW_MAX;
  const push = (n: number, L: number) => {
    lvl[n] = L;
    bucket[L].push(n);
    if (L > cur) cur = L;
  };
  for (;;) {
    while (cur >= 1 && head[cur] >= bucket[cur].length) cur--;
    if (cur < 1) break;
    const c = bucket[cur][head[cur]++];
    const L = lvl[c];
    if (L !== cur) continue; // đã được nâng mức (bản ghi cũ)
    const k = (c / layer) | 0;
    if (k === 0) continue;
    const b = c - layer;
    if (ids[b] === 0) {
      if (lvl[b] < FLOW_MAX) push(b, FLOW_MAX);
      continue;
    }
    if (lvl[b] > 0 || fl[ids[b]]) continue;
    const nl = L === FLOW_MAX ? FLOW_MAX - 1 : L - 1;
    if (nl < 1) continue;
    const i = c % W;
    const j = ((c / W) | 0) % W;
    if (i > 0 && ids[c - 1] === 0 && lvl[c - 1] < nl) push(c - 1, nl);
    if (i < W - 1 && ids[c + 1] === 0 && lvl[c + 1] < nl) push(c + 1, nl);
    if (j > 0 && ids[c - W] === 0 && lvl[c - W] < nl) push(c - W, nl);
    if (j < W - 1 && ids[c + W] === 0 && lvl[c + W] < nl) push(c + W, nl);
  }
  return lvl;
}

/** độ cao mặt nước trong ô (0…1): có nước phía trên = đầy; nguồn / rơi 0,875; chảy theo mức */
function fluidHeight(lvl: Uint8Array, c: number, layer: number, H: number) {
  const k = (c / layer) | 0;
  if (k < H - 1 && lvl[c + layer]) return 1;
  const L = lvl[c];
  return L >= FLOW_MAX ? 0.875 : Math.max(0.12, (L / FLOW_MAX) * 0.875);
}

/** lưới nước: mặt giữa ô nước và ô trong suốt không phải nước (mặt trên thấp theo mức), cuộn ngược chiều kim đồng hồ */
export function fluidMesh(v: Volume, lvl: Uint8Array, T: BlockTraits): FluidPacked {
  const { ids, W, H, M, size, lo } = v;
  const layer = W * W;
  const trans = new Uint8Array(256);
  for (let id = 0; id < 256; id++) trans[id] = id === 0 || T.transparent(id) || !!T.sprite?.(id) ? 1 : 0;
  const P: number[] = [];
  const N: number[] = [];
  const Lt: number[] = [];
  const I: number[] = [];
  let quads = 0;
  const sky = v.sky;
  const blk = v.blk;
  // 6 mặt: pháp tuyến + 4 góc (đơn vị ô; y của góc trên = h) theo thứ tự ngược chiều kim đồng hồ nhìn từ ngoài
  const quad = (x: number, y: number, z: number, nx: number, ny: number, nz: number, h: number, c: number, nb: number) => {
    let pts: number[][];
    if (ny > 0) pts = [[0, h, 0], [0, h, 1], [1, h, 1], [1, h, 0]];
    else if (ny < 0) pts = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];
    else if (nx > 0) pts = [[1, 0, 0], [1, h, 0], [1, h, 1], [1, 0, 1]];
    else if (nx < 0) pts = [[0, 0, 0], [0, 0, 1], [0, h, 1], [0, h, 0]];
    else if (nz > 0) pts = [[0, 0, 1], [1, 0, 1], [1, h, 1], [0, h, 1]];
    else pts = [[0, 0, 0], [0, h, 0], [1, h, 0], [1, 0, 0]];
    const base = P.length / 3;
    // ánh sáng: ô kề phía ngoài (sáng hơn khi lộ trời), lấy max với chính ô nước
    const sl = sky ? Math.max(sky[c], sky[nb]) : 15;
    const bl = blk ? Math.max(blk[c], blk[nb]) : 0;
    for (const [a, b, d] of pts) {
      P.push(x + a, y + b, z + d);
      N.push(nx * 127, ny * 127, nz * 127);
      Lt.push(sl * 17, bl * 17);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    quads++;
  };
  for (let k = 1; k < H - 1; k++)
    for (let j = M; j < M + size; j++)
      for (let i = M; i < M + size; i++) {
        const c = k * layer + j * W + i;
        if (!lvl[c]) continue;
        const h = fluidHeight(lvl, c, layer, H);
        const x = i - M;
        const y = k + lo;
        const z = j - M;
        const open = (n: number) => !lvl[n] && trans[ids[n]];
        if (open(c + layer)) quad(x, y, z, 0, 1, 0, h, c, c + layer);
        if (ids[c - layer] === 0 && !lvl[c - layer]) quad(x, y, z, 0, -1, 0, h, c, c - layer);
        if (open(c + 1)) quad(x, y, z, 1, 0, 0, h, c, c + 1);
        if (open(c - 1)) quad(x, y, z, -1, 0, 0, h, c, c - 1);
        if (open(c + W)) quad(x, y, z, 0, 0, 1, h, c, c + W);
        if (open(c - W)) quad(x, y, z, 0, 0, -1, h, c, c - W);
      }
  return { p: new Float32Array(P), n: new Int8Array(N), l: new Uint8Array(Lt), idx: new Uint32Array(I), quads };
}

/** mức sáng theo số khối che (0 → 1,0 … 3 → 0,55) */
export const AO_LEVEL = [1, 0.82, 0.68, 0.55];
/** bóng theo hướng mặt: trên, dưới, ±x, ±z */
const SHADE = { up: 1, down: 0.55, x: 0.82, z: 0.72 };

export function vertexAO(s1: boolean, s2: boolean, c: boolean): number {
  if (s1 && s2) return 3;
  return (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
}

/** bộ đệm đỉnh tự giãn (typed array — không mảng JS số, không cấp phát theo tứ giác) */
class Out {
  p = new Int16Array(4096 * 3);
  n = new Int8Array(4096 * 3);
  c = new Uint8Array(4096 * 3);
  l = new Uint8Array(4096 * 2);
  t = new Uint8Array(4096);
  idx = new Uint32Array(4096 * 1.5);
  verts = 0;
  ni = 0;
  quads = 0;
  /** chừa chỗ cho 4 đỉnh + 6 chỉ số */
  reserve() {
    if ((this.verts + 4) * 3 > this.p.length) {
      const grow = <T extends Int16Array | Int8Array | Uint8Array>(a: T, k: number): T => {
        const b = new (a.constructor as new (n: number) => T)(a.length * 2);
        b.set(a.subarray(0, this.verts * k));
        return b;
      };
      this.p = grow(this.p, 3);
      this.n = grow(this.n, 3);
      this.c = grow(this.c, 3);
      this.l = grow(this.l, 2);
      this.t = grow(this.t, 1);
    }
    if (this.ni + 6 > this.idx.length) {
      const b = new Uint32Array(this.idx.length * 2);
      b.set(this.idx.subarray(0, this.ni));
      this.idx = b;
    }
  }
  done(): Packed {
    const v = this.verts;
    return { p: this.p.slice(0, v * 3), n: this.n.slice(0, v * 3), c: this.c.slice(0, v * 3), l: this.l.slice(0, v * 2), t: this.t.slice(0, v), idx: this.idx.slice(0, this.ni), quads: this.quads };
  }
}
/** lưới nước rỗng — mỗi lần một bản mới (buffer có thể bị chuyển nhượng sang luồng khác) */
const emptyFluid = (): FluidPacked => ({ p: new Float32Array(0), n: new Int8Array(0), l: new Uint8Array(0), idx: new Uint32Array(0), quads: 0 });
const TRI_A = [0, 1, 2, 0, 2, 3];
const TRI_B = [1, 2, 3, 1, 3, 0];

/**
 * Lưới tham lam. Mặt của ô đặc (id ≠ 0, không trong suốt) giáp ô trong suốt; khối trong suốt (kính, lá…) cũng sinh mặt
 * giáp KHÔNG KHÍ (không sinh mặt giữa hai ô cùng loại trong suốt).
 */
export function greedyMesh(v: Volume, A: Access, T: BlockTraits): ChunkMeshOut {
  const { ids, W, H, M, size, lo, x0, z0 } = v;
  const sky = v.sky;
  const blk = v.blk;
  const layer = W * W;
  const transTab = new Uint8Array(256);
  const glowTab = new Uint8Array(256);
  // lớp hoạ tiết theo (khối, mặt): 0 = trên, 1 = cạnh, 2 = dưới
  const tileTab = new Uint8Array(256 * 3).fill(255);
  const spriteTab = new Uint8Array(256);
  for (let id = 0; id < 256; id++) {
    spriteTab[id] = id > 0 && T.sprite?.(id) ? 1 : 0;
    transTab[id] = id === 0 || T.transparent(id) || spriteTab[id] ? 1 : 0;
    glowTab[id] = T.glow(id) ? 1 : 0;
    if (T.tile && id > 0 && id !== SOLID_FILL) {
      tileTab[id * 3] = T.tile(id, 1);
      tileTab[id * 3 + 1] = T.tile(id, 0);
      tileTab[id * 3 + 2] = T.tile(id, -1);
    }
  }
  // bước chỉ số phẳng theo trục x, y, z
  const STR = [1, layer, W];
  if (M < 2) throw new Error("greedyMesh: cần lề M ≥ 2");
  const solid = new Out();
  const glow = new Out();
  // mặt nạ một lát: A = id | ao<<8 | (màu 565 << 16) ; B = ánh sáng 4 góc (4 × 8 bit) ; 0 = không có mặt
  const maxUV = Math.max(W, H) * Math.max(W, H);
  const mA = new Int32Array(maxUV);
  const mB = new Int32Array(maxUV);
  /** 1 = AO và ánh sáng đều ở 4 góc → được gộp; 0 = giữ tứ giác đơn (tránh xoá dải chuyển lặp lại) */
  const mU = new Uint8Array(maxUV);
  const cols = new Float32Array(maxUV * 3);
  let faces = 0;

  // 6 hướng: trục a (0 = x, 1 = y, 2 = z), dấu s; u, v = hai trục còn lại
  for (let a = 0; a < 3; a++)
    for (const s of [1, -1]) {
      const ua = a === 0 ? 2 : 0; // trục u
      const va = a === 1 ? 2 : 1; // trục v
      const nU = W; // trục u luôn là x hoặc z
      const ny = a === 1 ? s : 0;
      const shade = a === 1 ? (s > 0 ? SHADE.up : SHADE.down) : a === 0 ? SHADE.x : SHADE.z;
      // khoảng duyệt theo trục: x, z chỉ ô trong chunk; y bỏ lớp đáy (đặc lấp) và lớp đỉnh (không khí) → ô kề luôn trong mảng
      const LO = [M, 1, M];
      const HI = [M + size, H - 1, M + size];
      const sA = STR[a] * s;
      const sU = STR[ua];
      const sV = STR[va];
      const loU = LO[ua];
      const hiU = HI[ua];
      const loV = LO[va];
      const hiV = HI[va];
      // y của ô = lo + chỉ số tầng; trục v là y khi a ≠ 1
      for (let w = LO[a]; w < HI[a]; w++) {
        let any = false;
        const baseW = w * STR[a];
        for (let vv = loV; vv < hiV; vv++) {
          const baseV = baseW + vv * sV;
          const rowM = vv * nU;
          for (let uu = loU; uu < hiU; uu++) {
            const mi = rowM + uu;
            mA[mi] = 0;
            const c = baseV + uu * sU;
            const id = ids[c];
            if (id === 0 || id === SOLID_FILL || spriteTab[id]) continue;
            const pc = c + sA;
            const nid = ids[pc];
            if (!transTab[nid]) continue; // giáp ô đục → ẩn
            if (transTab[id] && nid !== 0 && !spriteTab[nid]) continue; // khối trong suốt chỉ sinh mặt giáp không khí (hoặc sprite)
            const pk = (pc / layer) | 0;
            // AO + ánh sáng 4 góc: (−u,−v) (+u,−v) (+u,+v) (−u,+v)
            let aoBits = 0;
            let lBits = 0;
            for (let q = 0; q < 4; q++) {
              const du = q === 1 || q === 2 ? 1 : -1;
              const dv = q >= 2 ? 1 : -1;
              const c1 = pc + du * sU;
              const c2 = pc + dv * sV;
              const c3 = c1 + dv * sV;
              // chỉ trục v có thể là y (u = z hoặc x); tầng ngoài mảng: dưới = đặc, trên = trống
              const k2 = va === 1 ? pk + dv : pk;
              const inV = k2 >= 0 && k2 < H;
              const s1 = !transTab[ids[c1]];
              const s2 = inV ? !transTab[ids[c2]] : k2 < 0;
              const cc = inV ? !transTab[ids[c3]] : k2 < 0;
              const ao = s1 && s2 ? 3 : (s1 ? 1 : 0) + (s2 ? 1 : 0) + (cc ? 1 : 0);
              aoBits |= ao << (q * 2);
              if (sky && blk) {
                let ss = sky[pc];
                let bb = blk[pc];
                let n = 1;
                if (!s1) {
                  ss += sky[c1];
                  bb += blk[c1];
                  n++;
                }
                if (!s2) {
                  ss += inV ? sky[c2] : 15;
                  bb += inV ? blk[c2] : 0;
                  n++;
                }
                if (!cc && !(s1 && s2)) {
                  ss += inV ? sky[c3] : 15;
                  bb += inV ? blk[c3] : 0;
                  n++;
                }
                const sl = ((ss + (n >> 1)) / n) | 0;
                const bl = ((bb + (n >> 1)) / n) | 0;
                lBits |= ((sl << 4) | bl) << (q * 8);
              } else lBits |= 0xf0 << (q * 8);
            }
            const ci = c % W;
            const cj = ((c / W) | 0) % W;
            const ck = (c / layer) | 0;
            const rgb = A.color(x0 + ci, lo + ck, z0 + cj, id, ny);
            const r5 = Math.min(31, (rgb[0] * 31 + 0.5) | 0);
            const g6 = Math.min(63, (rgb[1] * 63 + 0.5) | 0);
            const b5 = Math.min(31, (rgb[2] * 31 + 0.5) | 0);
            mA[mi] = id | (aoBits << 8) | (((r5 << 11) | (g6 << 5) | b5) << 16);
            mB[mi] = lBits;
            const ao0 = aoBits & 3;
            const l0 = lBits & 0xff;
            mU[mi] = aoBits === ao0 * 0x55 && lBits >>> 0 === (l0 * 0x01010101) >>> 0 ? 1 : 0;
            cols[mi * 3] = rgb[0];
            cols[mi * 3 + 1] = rgb[1];
            cols[mi * 3 + 2] = rgb[2];
            any = true;
          }
        }
        if (!any) continue;
        // gộp tham lam
        for (let vv = loV; vv < hiV; vv++)
          for (let uu = loU; uu < hiU; ) {
            const mi = vv * nU + uu;
            const ka = mA[mi];
            if (!ka) {
              uu++;
              continue;
            }
            const kb = mB[mi];
            let wU = 1;
            let hV = 1;
            if (mU[mi]) {
              while (uu + wU < hiU && mU[mi + wU] && mA[mi + wU] === ka && mB[mi + wU] === kb) wU++;
              outer: while (vv + hV < hiV) {
                const row = (vv + hV) * nU + uu;
                for (let t = 0; t < wU; t++) if (!mU[row + t] || mA[row + t] !== ka || mB[row + t] !== kb) break outer;
                hV++;
              }
            }
            for (let dv = 0; dv < hV; dv++) mA.fill(0, (vv + dv) * nU + uu, (vv + dv) * nU + uu + wU);
            // phát tứ giác
            const id = ka & 0xff;
            const out = glowTab[id] ? glow : solid;
            out.reserve();
            const base = out.verts;
            const plane = w + (s > 0 ? 1 : 0);
            const r = cols[mi * 3];
            const g = cols[mi * 3 + 1];
            const b = cols[mi * 3 + 2];
            const ao0 = (ka >> 8) & 3;
            const ao1 = (ka >> 10) & 3;
            const ao2 = (ka >> 12) & 3;
            const ao3 = (ka >> 14) & 3;
            const nx = a === 0 ? s * 127 : 0;
            const nyv = a === 1 ? s * 127 : 0;
            const nz = a === 2 ? s * 127 : 0;
            const tl = tileTab[id * 3 + (ny > 0 ? 0 : ny < 0 ? 2 : 1)];
            for (let q = 0; q < 4; q++) {
              const uq = uu + (q === 1 || q === 2 ? wU : 0);
              const vq = vv + (q >= 2 ? hV : 0);
              // chỉ số → toạ độ cục bộ (x, z trừ lề; y cộng lo)
              const px = a === 0 ? plane : ua === 0 ? uq : vq;
              const py = a === 1 ? plane : vq; // y chỉ có thể là trục a hoặc trục v
              const pz = a === 2 ? plane : ua === 2 ? uq : vq;
              const vi = out.verts * 3;
              out.p[vi] = px - M;
              out.p[vi + 1] = py + lo;
              out.p[vi + 2] = pz - M;
              out.n[vi] = nx;
              out.n[vi + 1] = nyv;
              out.n[vi + 2] = nz;
              const m = shade * AO_LEVEL[q === 0 ? ao0 : q === 1 ? ao1 : q === 2 ? ao2 : ao3];
              out.c[vi] = Math.round(r * m * 255);
              out.c[vi + 1] = Math.round(g * m * 255);
              out.c[vi + 2] = Math.round(b * m * 255);
              const lb = (kb >>> (q * 8)) & 0xff;
              out.l[out.verts * 2] = (lb >> 4) * 17;
              out.l[out.verts * 2 + 1] = (lb & 15) * 17;
              out.t[out.verts] = tl;
              out.verts++;
            }
            // thứ tự cuộn (ngược chiều kim đồng hồ nhìn từ ngoài) + lật đường chéo theo AO
            const tri = ao0 + ao2 > ao1 + ao3 ? TRI_B : TRI_A;
            // e_u × e_v: x-mặt (u = z, v = y) → −x; y-mặt (u = x, v = z) → −y; z-mặt (u = x, v = y) → +z
            const handed = (a === 2 ? 1 : -1) * s > 0;
            if (handed) for (let t = 0; t < 6; t++) out.idx[out.ni++] = base + tri[t];
            else for (let t = 5; t >= 0; t--) out.idx[out.ni++] = base + tri[t];
            out.quads++;
            faces += wU * hV;
            uu += wU;
          }
      }
    }
  return { solid: solid.done(), glow: glow.done(), water: emptyFluid(), faces };
}

/** Gọn: dựng cả chunk (khối + ánh sáng + lưới) */
export function buildChunkMesh(cx: number, cz: number, size: number, A: Access, T: BlockTraits, lightMargin = 8): ChunkMeshOut {
  const v = buildVolume(cx, cz, size, A, lightMargin);
  computeLight(v, T);
  const r = greedyMesh(v, A, T);
  r.water = fluidMesh(v, computeFlow(v, T), T);
  return r;
}
