"use client";
/**
 * Quản lý chunk voxel MỆNH LỆNH (không React state mỗi chunk):
 *  - Bể Web Worker (voxel.worker.ts) sinh + chiếu sáng + dựng lưới; luồng chính chỉ cài lưới.
 *  - Hàng đợi ưu tiên: gần trước, trong hướng nhìn trước; chunk bẩn (sửa khối) vượt lên đầu, lưới cũ giữ nguyên tới khi
 *    có lưới mới (không nháy). Mỗi kết quả mang `rev`; lệch phiên bản → bỏ.
 *  - Ngân sách cài mỗi khung: ~1,2 ms và ~384 KB (tránh khựng khi xoay máy quay ra vùng mới).
 *  - Sửa khối → chuyển cho mọi worker; đánh dấu bẩn mọi chunk trong tầm ánh sáng (±8 ô) của khối đó.
 */
import * as THREE from "three";
import { CHUNK } from "@/lib/world/terrain";
import { injectGen, hasGen, type Gen } from "@/lib/world/worldgen";
import { forEachEdit, onAnyEdit } from "@/lib/world/voxels";

type PackedMsg = { p: Int16Array; n: Int8Array; c: Uint8Array; l: Uint8Array; t: Uint8Array; idx: Uint16Array | Uint32Array; quads: number };
type FluidMsg = { p: Float32Array; n: Int8Array; l: Uint8Array; idx: Uint16Array | Uint32Array; quads: number };
type Result = { t: "mesh"; key: number; rev: number; cx: number; cz: number; solid: PackedMsg; glow: PackedMsg; water: FluidMsg; faces: number; ms: number; genMs: number; gen: Gen | null };
/** readyRev: kết quả đã nhận, đang chờ cài (ngân sách mỗi khung) — không giao lại việc cho cùng phiên bản */
type Entry = { cx: number; cz: number; rev: number; shownRev: number; readyRev: number; inflight: boolean; solid: THREE.Mesh | null; glow: THREE.Mesh | null; water: THREE.Mesh | null; tris: number };

export const LIGHT_MARGIN = 8;
const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
const BUDGET_MS = 1.2;
const BUDGET_BYTES = 384 * 1024;

export class ChunkManager {
  readonly group = new THREE.Group();
  private workers: Worker[] = [];
  private load: number[] = [];
  private chunks = new Map<number, Entry>();
  private ready: Result[] = [];
  private pendingEdits: number[] = [];
  private center = [NaN, NaN];
  private radius: number;
  private offEdit: () => void;
  private fwd = new THREE.Vector3();
  readonly stats = { meshMs: 0, genMs: 0, jobs: 0, installed: 0, tris: 0, chunks: 0, queued: 0, inflight: 0, installMs: 0, edits: 0, lastEdit: "" };

  constructor(
    private solidMat: THREE.Material,
    private glowMat: THREE.Material,
    radius: number,
    workerCount: number,
    /** vật liệu lưới nước (trong suốt, vẽ sau) */
    private waterMat: THREE.Material | null = null,
  ) {
    this.radius = radius;
    this.group.name = "voxel-terrain";
    const all: number[] = [];
    forEachEdit((x, y, z, id) => all.push(x, y, z, id));
    for (let i = 0; i < workerCount; i++) {
      const w = new Worker(new URL("./voxel.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<Result>) => this.onResult(i, e.data);
      if (all.length) w.postMessage({ t: "edits", d: new Int32Array(all) });
      this.workers.push(w);
      this.load.push(0);
    }
    this.offEdit = onAnyEdit((x, y, z, id) => {
      this.stats.edits++;
      this.stats.lastEdit = `${x} ${y} ${z} ${id}`;
      this.pendingEdits.push(x, y, z, id);
      // ánh sáng có thể đổi trong ±LIGHT_MARGIN ô → mọi chunk chứa vùng đó dựng lại
      const a0 = Math.floor((x - LIGHT_MARGIN) / CHUNK);
      const a1 = Math.floor((x + LIGHT_MARGIN) / CHUNK);
      const b0 = Math.floor((z - LIGHT_MARGIN) / CHUNK);
      const b1 = Math.floor((z + LIGHT_MARGIN) / CHUNK);
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) this.dirty(a, b);
    });
  }

  setRadius(r: number) {
    if (r === this.radius) return;
    this.radius = r;
    this.center = [NaN, NaN];
  }

  /** Màn chờ: số chunk GẦN (bán kính ≤ near) đã có lưới / cần — chỗ người chơi đứng phải đủ đất trước khi vào */
  nearProgress(near = 3): { done: number; need: number } {
    if (Number.isNaN(this.center[0])) return { done: 0, need: 1 };
    const r = Math.min(near, this.radius) + 0.5;
    let need = 0;
    let done = 0;
    for (const e of this.chunks.values()) {
      const dx = e.cx - this.center[0];
      const dz = e.cz - this.center[1];
      if (dx * dx + dz * dz > r * r) continue;
      need++;
      if (e.shownRev > 0) done++;
    }
    return { done, need: Math.max(1, need) };
  }

  dirty(cx: number, cz: number) {
    const e = this.chunks.get(ckey(cx, cz));
    if (e) e.rev++;
  }

  private onResult(wi: number, r: Result) {
    this.load[wi]--;
    if (r.gen && !hasGen(r.cx, r.cz)) injectGen(r.gen);
    this.stats.jobs++;
    this.stats.meshMs = this.stats.meshMs * 0.9 + r.ms * 0.1;
    this.stats.genMs = this.stats.genMs * 0.9 + r.genMs * 0.1;
    const e = this.chunks.get(r.key);
    if (!e) return;
    e.inflight = false;
    if (r.rev !== e.rev) return; // lỗi thời — sẽ được xếp lại
    e.readyRev = r.rev;
    this.ready.push(r);
  }

  /** gọi mỗi khung (useFrame) */
  update(camera: THREE.Camera, px: number, pz: number) {
    // 0) gửi các khối vừa sửa cho mọi worker (trước mọi việc mới)
    if (this.pendingEdits.length) {
      const d = new Int32Array(this.pendingEdits);
      this.pendingEdits.length = 0;
      for (const w of this.workers) w.postMessage({ t: "edits", d });
    }
    const ccx = Math.floor(px / CHUNK);
    const ccz = Math.floor(pz / CHUNK);
    const R = this.radius;
    // 1) đổi tâm → thêm chunk mới trong bán kính tròn, bỏ chunk quá xa (trễ thêm 1 vòng để khỏi nạp / bỏ qua lại)
    if (ccx !== this.center[0] || ccz !== this.center[1]) {
      this.center[0] = ccx;
      this.center[1] = ccz;
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
          const k = ckey(ccx + dx, ccz + dz);
          if (!this.chunks.has(k)) this.chunks.set(k, { cx: ccx + dx, cz: ccz + dz, rev: 1, shownRev: 0, readyRev: 0, inflight: false, solid: null, glow: null, water: null, tris: 0 });
        }
      const keep = (R + 1.5) * (R + 1.5);
      for (const [k, e] of this.chunks) {
        const dx = e.cx - ccx;
        const dz = e.cz - ccz;
        if (dx * dx + dz * dz > keep) {
          this.drop(e);
          this.chunks.delete(k);
        }
      }
    }
    // 2) giao việc: mỗi worker tối đa 2 việc; chọn chunk cần dựng có điểm ưu tiên tốt nhất
    camera.getWorldDirection(this.fwd);
    let queued = 0;
    let inflight = 0;
    for (const e of this.chunks.values()) {
      if (e.inflight) inflight++;
      else if (e.rev !== e.shownRev && e.rev !== e.readyRev) queued++;
    }
    this.stats.queued = queued;
    this.stats.inflight = inflight;
    for (let wi = 0; wi < this.workers.length; wi++) {
      while (this.load[wi] < 2) {
        let best: Entry | null = null;
        let bs = Infinity;
        for (const e of this.chunks.values()) {
          if (e.inflight || e.rev === e.shownRev || e.rev === e.readyRev) continue;
          const dx = (e.cx + 0.5) * CHUNK - px;
          const dz = (e.cz + 0.5) * CHUNK - pz;
          const d = Math.hypot(dx, dz);
          // trong hướng nhìn được ưu tiên; chunk đã có lưới (chỉ cập nhật) được ưu tiên mạnh — sửa khối phải thấy ngay
          const facing = d > 1 ? (dx * this.fwd.x + dz * this.fwd.z) / d : 1;
          let score = d - facing * CHUNK * 0.75;
          if (e.shownRev > 0) score -= CHUNK * 4;
          if (score < bs) {
            bs = score;
            best = e;
          }
        }
        if (!best) break;
        best.inflight = true;
        this.load[wi]++;
        this.workers[wi].postMessage({ t: "mesh", key: ckey(best.cx, best.cz), rev: best.rev, cx: best.cx, cz: best.cz, wantGen: !hasGen(best.cx, best.cz), margin: LIGHT_MARGIN });
      }
    }
    // 3) cài lưới trong ngân sách
    const t0 = performance.now();
    let bytes = 0;
    while (this.ready.length) {
      if (performance.now() - t0 > BUDGET_MS || bytes > BUDGET_BYTES) break;
      const r = this.ready.shift()!;
      const e = this.chunks.get(r.key);
      if (!e || r.rev !== e.rev) continue;
      bytes += this.install(e, r);
    }
    this.stats.installMs = this.stats.installMs * 0.9 + (performance.now() - t0) * 0.1;
    this.stats.chunks = this.chunks.size;
  }

  private geometry(d: PackedMsg): THREE.BufferGeometry | null {
    if (!d.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(d.p, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(d.n, 3, true));
    g.setAttribute("color", new THREE.BufferAttribute(d.c, 3, true));
    g.setAttribute("aLight", new THREE.BufferAttribute(d.l, 2, true));
    g.setAttribute("aTile", new THREE.BufferAttribute(d.t, 1, false));
    g.setIndex(new THREE.BufferAttribute(d.idx, 1));
    g.computeBoundingSphere();
    return g;
  }

  private install(e: Entry, r: Result): number {
    const old = [e.solid, e.glow, e.water];
    const mk = (d: PackedMsg, mat: THREE.Material) => {
      const g = this.geometry(d);
      if (!g) return null;
      const m = new THREE.Mesh(g, mat);
      m.position.set(e.cx * CHUNK, 0, e.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      return m;
    };
    e.solid = mk(r.solid, this.solidMat);
    e.glow = mk(r.glow, this.glowMat);
    e.water = null;
    if (this.waterMat && r.water.idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(r.water.p, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(r.water.n, 3, true));
      g.setAttribute("aLight", new THREE.BufferAttribute(r.water.l, 2, true));
      g.setIndex(new THREE.BufferAttribute(r.water.idx, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.waterMat);
      m.position.set(e.cx * CHUNK, 0, e.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = 3;
      this.group.add(m);
      e.water = m;
    }
    for (const m of old)
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    e.shownRev = r.rev;
    const tris = (r.solid.quads + r.glow.quads + r.water.quads) * 2;
    this.stats.tris += tris - e.tris;
    e.tris = tris;
    this.stats.installed++;
    const sz = (d: PackedMsg) => d.p.byteLength + d.n.byteLength + d.c.byteLength + d.l.byteLength + d.t.byteLength + d.idx.byteLength;
    return sz(r.solid) + sz(r.glow) + r.water.p.byteLength + r.water.idx.byteLength;
  }

  private drop(e: Entry) {
    for (const m of [e.solid, e.glow, e.water])
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    this.stats.tris -= e.tris;
    e.solid = e.glow = e.water = null;
  }

  /** chunk đã có lưới (để biết vùng nào đã hiện) */
  shown(cx: number, cz: number) {
    const e = this.chunks.get(ckey(cx, cz));
    return !!e && e.shownRev > 0;
  }

  dispose() {
    this.offEdit();
    for (const w of this.workers) w.terminate();
    for (const e of this.chunks.values()) this.drop(e);
    this.chunks.clear();
    this.ready.length = 0;
  }
}
