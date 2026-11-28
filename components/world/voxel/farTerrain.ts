"use client";
/**
 * Địa hình xa (LOD) quanh vùng voxel: các ô 64 m, bước 2 / 4 / 8 m theo khoảng cách, dựng trong MỘT worker riêng
 * (không chen hàng đợi chunk gần). Ô hạ thấp 0,8 m: chỗ đã có voxel thì voxel che, ngoài bán kính voxel thì ô hiện ra —
 * chân trời 160–420 m tuỳ chất lượng với ~1 lệnh vẽ mỗi ô. Đổi bậc chi tiết khi người chơi đi xa → dựng lại ô đó.
 */
import * as THREE from "three";
import { farAccept, farPos, farReplan } from "@/lib/world/perfGate";

const TILE = 64;
const SINK = 0.8;
type FarMsg = { t: "far"; key: string; x0: number; z0: number; p: Float32Array; n: Int8Array; c: Uint8Array; idx: Uint16Array | Uint32Array };
type Tile = { key: string; mesh: THREE.Mesh | null; pending: boolean };
type DepthMsg = { t: "depth"; x0: number; z0: number; n: number; step: number; d: Uint8Array };
/** bản đồ độ sâu nước: 128² ô × 2 m = 256 m quanh người chơi, dựng lại khi đi lệch > 48 m */
const DEPTH_N = 128;
const DEPTH_STEP = 2;

export class FarTerrain {
  readonly group = new THREE.Group();
  private worker: Worker;
  private tiles = new Map<string, Tile>();
  private center = [NaN, NaN];
  private busy = 0;
  private want: { key: string; x0: number; z0: number; step: number; d: number }[] = [];
  /** các ô (khoá "x0,z0,bậc") đang cần quanh tâm hiện tại — kết quả worker ngoài tập này là cũ */
  private keep = new Set<string>();
  readonly stats = { tiles: 0, pending: 0 };
  /** độ sâu nước (R8, 0…1 = 0…DEPTH_MAX m) + vùng phủ (x0, z0, cỡ) — mặt nước đọc thẳng các uniform này */
  readonly depth = {
    tex: new THREE.DataTexture(new Uint8Array(DEPTH_N * DEPTH_N).fill(255), DEPTH_N, DEPTH_N, THREE.RedFormat),
    area: { value: new THREE.Vector3(0, 0, -1) },
  };
  private depthAt = [NaN, NaN];
  private depthBusy = false;

  constructor(
    private material: THREE.Material,
    private radius: number,
    private innerSkip: number,
  ) {
    this.group.name = "far-terrain";
    this.worker = new Worker(new URL("./voxel.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<FarMsg | DepthMsg>) => (e.data.t === "depth" ? this.onDepth(e.data) : this.onTile(e.data));
    this.depth.tex.magFilter = this.depth.tex.minFilter = THREE.LinearFilter;
    this.depth.tex.needsUpdate = true;
  }

  setRadius(radius: number, innerSkip: number) {
    this.radius = radius;
    this.innerSkip = innerSkip;
    this.center = [NaN, NaN];
  }

  private stepFor(d: number) {
    return d < 160 ? 2 : d < 300 ? 4 : 8;
  }

  update(px: number, pz: number) {
    // độ sâu nước: ưu tiên trước ô xa (rẻ: 16k lần blockTop)
    if (!this.depthBusy && !(Math.abs(px - this.depthAt[0]) < 48 && Math.abs(pz - this.depthAt[1]) < 48)) {
      const half = (DEPTH_N * DEPTH_STEP) / 2;
      const x0 = Math.round(px / 16) * 16 - half;
      const z0 = Math.round(pz / 16) * 16 - half;
      this.depthAt = [x0 + half, z0 + half];
      this.depthBusy = true;
      this.worker.postMessage({ t: "depth", x0, z0, n: DEPTH_N, step: DEPTH_STEP });
    }
    const tx = Math.floor(px / TILE);
    const tz = Math.floor(pz / TILE);
    if (tx !== this.center[0] || tz !== this.center[1]) {
      this.center[0] = tx;
      this.center[1] = tz;
      const R = Math.ceil(this.radius / TILE);
      const keep = new Set<string>();
      const info = new Map<string, { x0: number; z0: number; step: number; d: number }>();
      this.want.length = 0;
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const x0 = (tx + dx) * TILE;
          const z0 = (tz + dz) * TILE;
          // khoảng cách gần nhất từ người chơi tới ô; ô nằm trọn trong vùng voxel thì bỏ
          const nx = Math.max(x0, Math.min(px, x0 + TILE));
          const nz = Math.max(z0, Math.min(pz, z0 + TILE));
          const dNear = Math.hypot(nx - px, nz - pz);
          if (dNear > this.radius) continue;
          const fx = Math.max(Math.abs(x0 - px), Math.abs(x0 + TILE - px));
          const fz = Math.max(Math.abs(z0 - pz), Math.abs(z0 + TILE - pz));
          if (Math.hypot(fx, fz) < this.innerSkip) continue;
          const step = this.stepFor(dNear);
          const key = `${x0},${z0},${step}`;
          keep.add(key);
          info.set(key, { x0, z0, step, d: dNear });
        }
      // lib/world/perfGate.farReplan: bỏ ô không còn cần ở bậc nào; ô cũ khác bậc giữ tới khi ô thay thế về (khỏi lỗ);
      // xếp hàng MỌI ô cần chưa có lưới và không đang dựng (trước đây ô chờ từ lần đổi tâm trước bị bỏ quên → trống địa hình)
      const plan = farReplan(this.tiles, keep);
      for (const k of plan.drop) {
        this.remove(this.tiles.get(k)!);
        this.tiles.delete(k);
      }
      for (const k of plan.queue) {
        if (!this.tiles.has(k)) this.tiles.set(k, { key: k, mesh: null, pending: false });
        this.want.push({ key: k, ...info.get(k)! });
      }
      this.keep = keep;
      this.want.sort((a, b) => a.d - b.d);
    }
    while (this.busy < 2 && this.want.length) {
      const w = this.want.shift()!;
      const t = this.tiles.get(w.key);
      if (!t || t.pending || t.mesh) continue;
      t.pending = true;
      this.busy++;
      this.worker.postMessage({ t: "far", key: w.key, x0: w.x0, z0: w.z0, size: TILE, step: w.step });
    }
    this.stats.pending = this.want.length + this.busy;
  }

  private onTile(m: FarMsg) {
    this.busy--;
    const t = this.tiles.get(m.key);
    if (!t) return;
    t.pending = false;
    // kết quả cũ (bậc chi tiết ở chỗ này đã đổi trong lúc worker bận): bỏ, KHÔNG xoá ô mới hơn cùng chỗ
    if (!farAccept(m.key, this.keep)) {
      if (!t.mesh) this.tiles.delete(m.key);
      return;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.p, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(m.n, 3, true));
    g.setAttribute("color", new THREE.BufferAttribute(m.c, 3, true));
    g.setIndex(new THREE.BufferAttribute(m.idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.position.set(m.x0, -SINK, m.z0);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    t.mesh = mesh;
    // gỡ các ô cũ cùng chỗ khác bậc chi tiết
    const pos = farPos(m.key);
    for (const [k, o] of this.tiles)
      if (k !== m.key && farPos(k) === pos) {
        this.remove(o);
        this.tiles.delete(k);
      }
    this.stats.tiles = this.group.children.length;
  }

  private onDepth(m: DepthMsg) {
    this.depthBusy = false;
    (this.depth.tex.image.data as Uint8Array).set(m.d);
    this.depth.tex.needsUpdate = true;
    this.depth.area.value.set(m.x0, m.z0, m.n * m.step);
  }

  private remove(t: Tile) {
    if (!t.mesh) return;
    this.group.remove(t.mesh);
    t.mesh.geometry.dispose();
    t.mesh = null;
  }

  dispose() {
    this.worker.terminate();
    this.depth.tex.dispose();
    for (const t of this.tiles.values()) this.remove(t);
    this.tiles.clear();
  }
}
