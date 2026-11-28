/**
 * Địa hình XA (LOD) ngoài bán kính voxel: lưới độ cao thô theo ô vuông (64 m), bước 2 / 4 / 8 m theo khoảng cách
 * (kiểu clipmap / Distant Horizons rút gọn). Độ cao + màu lấy từ CÙNG hàm sinh (blockTop, màu mặt) nên khớp chân trời
 * với vùng voxel; nước dưới mực biển san phẳng bằng mặt nước. Có "váy" (skirt) quanh mép để không hở khe giữa các ô
 * khác bước. Thuần — chạy trong Web Worker.
 */
export type FarAccess = {
  top: (x: number, z: number) => number;
  /** màu sRGB 0..1 của mặt đất ở (x, z, đỉnh) */
  color: (x: number, z: number, top: number) => [number, number, number];
  water: number;
  waterColor: [number, number, number];
};
export type FarTile = { p: Float32Array; n: Int8Array; c: Uint8Array; idx: Uint16Array | Uint32Array };

/** độ sâu nước tối đa mã hoá trong bản đồ độ sâu (m) — byte 255 */
export const WATER_DEPTH_MAX = 8;

/** ô bắt đầu ở (x0, z0), cạnh `size` m, bước `step` m. Toạ độ đỉnh cục bộ (cộng x0, z0 khi đặt lưới). */
export function buildFarTile(x0: number, z0: number, size: number, step: number, A: FarAccess, skirt = 6): FarTile {
  const n = Math.round(size / step) + 1;
  const hs = new Float32Array(n * n);
  const cs = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const t = A.top(x, z);
      const k = j * n + i;
      if (t <= A.water) {
        hs[k] = A.water + 0.2;
        cs[k * 3] = A.waterColor[0];
        cs[k * 3 + 1] = A.waterColor[1];
        cs[k * 3 + 2] = A.waterColor[2];
      } else {
        hs[k] = t;
        const c = A.color(x, z, t);
        cs[k * 3] = c[0];
        cs[k * 3 + 1] = c[1];
        cs[k * 3 + 2] = c[2];
      }
    }
  // đỉnh: lưới n × n + váy 4 cạnh (mỗi cạnh n đỉnh hạ thấp)
  const vCount = n * n + 4 * n;
  const p = new Float32Array(vCount * 3);
  const nn = new Int8Array(vCount * 3);
  const c = new Uint8Array(vCount * 3);
  const setV = (v: number, x: number, y: number, z: number, k: number, nx: number, ny: number, nz: number) => {
    p[v * 3] = x;
    p[v * 3 + 1] = y;
    p[v * 3 + 2] = z;
    const L = Math.hypot(nx, ny, nz) || 1;
    nn[v * 3] = Math.round((nx / L) * 127);
    nn[v * 3 + 1] = Math.round((ny / L) * 127);
    nn[v * 3 + 2] = Math.round((nz / L) * 127);
    c[v * 3] = Math.round(cs[k * 3] * 255);
    c[v * 3 + 1] = Math.round(cs[k * 3 + 1] * 255);
    c[v * 3 + 2] = Math.round(cs[k * 3 + 2] * 255);
  };
  const H = (i: number, j: number) => hs[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const nx = H(i - 1, j) - H(i + 1, j);
      const nz = H(i, j - 1) - H(i, j + 1);
      setV(k, i * step, hs[k], j * step, k, nx, 2 * step, nz);
    }
  // váy: cạnh z = 0, z = max, x = 0, x = max
  const edges: [number, number][][] = [
    Array.from({ length: n }, (_, i) => [i, 0] as [number, number]),
    Array.from({ length: n }, (_, i) => [i, n - 1] as [number, number]),
    Array.from({ length: n }, (_, j) => [0, j] as [number, number]),
    Array.from({ length: n }, (_, j) => [n - 1, j] as [number, number]),
  ];
  let v = n * n;
  const skirtStart: number[] = [];
  for (const e of edges) {
    skirtStart.push(v);
    for (const [i, j] of e) {
      const k = j * n + i;
      setV(v++, i * step, hs[k] - skirt, j * step, k, 0, 1, 0);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const d = a + n;
      const e2 = d + 1;
      idx.push(a, d, b, b, d, e2);
    }
  // váy: nối mép lưới với dải hạ thấp (hai mặt đều vẽ được nhờ vật liệu DoubleSide không cần — xếp cuộn theo hướng ra ngoài)
  edges.forEach((e, ei) => {
    const s0 = skirtStart[ei];
    for (let t = 0; t < n - 1; t++) {
      const [i0, j0] = e[t];
      const [i1, j1] = e[t + 1];
      const a = j0 * n + i0;
      const b = j1 * n + i1;
      const a2 = s0 + t;
      const b2 = s0 + t + 1;
      // cạnh z = 0 và x = max hướng ra ngoài theo một chiều, hai cạnh kia ngược lại
      if (ei === 0 || ei === 3) idx.push(a, b, a2, b, b2, a2);
      else idx.push(a, a2, b, b, a2, b2);
    }
  });
  const I = vCount < 65536 ? new Uint16Array(idx) : new Uint32Array(idx);
  return { p, n: nn, c, idx: I };
}
