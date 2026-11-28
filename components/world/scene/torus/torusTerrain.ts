"use client";
/**
 * Quần đảo Xuyến — dựng hình tĩnh THỦ TỤC (tạm, chờ mô hình Blender) thành 2 lưới gộp:
 *  - toon: mặt cỏ, vách đá, cầu gỗ, cây, đá, Hộp Chuông, Bia Xuyến, khung cổng (màu theo đỉnh, một vật liệu toon)
 *  - glow: đường khâu mép (san hô = cặp mép x, ngọc lam = cặp mép z), cột mốc, ngấn pha lê (HDR, bloom bắt)
 * Mặt cỏ lấy mẫu ĐÚNG hàm độ cao của lib/world/torusWorld.ts → chân nhân vật khớp mặt đất.
 * Hai lưới này được vẽ lặp 3 × 3 (hoặc 5 × 5) bằng InstancedMesh — 2 lệnh vẽ cho cả quần đảo.
 */
import * as THREE from "three";
import { BELL_BOX, BELL_Y0, BRIDGES, CORNER_STONE, ISLANDS, PORTAL, SEAM_X_COLOR, SEAM_Z_COLOR, STONE, SENTINEL, TREES, islandHeight, islandRadius, type Island } from "@/lib/world/torusWorld";

/** gom nhiều hình (có màu đỉnh) thành một BufferGeometry chỉ mục */
class Builder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /** thêm một hình three (đã có normal) với ma trận + màu (hoặc hàm màu theo vị trí thế giới) */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.Color | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)) {
    const base = this.pos.length / 3;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(w.x, w.y, w.z);
      const c = typeof color === "function" ? color(v, w) : color;
      this.col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    g.dispose();
  }
  /** thêm lưới đã có màu đỉnh sẵn (mô hình Blender đã nướng), nhân thêm `tint` nếu có */
  addColored(g: THREE.BufferGeometry, m: THREE.Matrix4, tint?: THREE.Color) {
    const base = this.pos.length / 3;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const c = g.getAttribute("color");
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(w.x, w.y, w.z);
      const r = c.getX(i) * (tint ? tint.r : 1);
      const gg = c.getY(i) * (tint ? tint.g : 1);
      const b = c.getZ(i) * (tint ? tint.b : 1);
      this.col.push(r, gg, b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }
  /** thêm lưới tự dựng (đỉnh + màu + tam giác), normal tính sau */
  raw(pts: number[], cols: number[], tris: number[]) {
    const base = this.pos.length / 3;
    for (let i = 0; i < pts.length; i++) this.pos.push(pts[i]);
    for (let i = 0; i < pts.length; i++) this.nor.push(0);
    for (const c of cols) this.col.push(c);
    for (const t of tris) this.idx.push(base + t);
  }
  build(smoothRaw = true): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    // normal của lưới tự dựng (đỉnh normal = 0) tính lại; hình three giữ normal gốc
    const nor = new Float32Array(this.nor);
    if (smoothRaw) {
      const tmp = g.clone();
      tmp.computeVertexNormals();
      const cn = tmp.getAttribute("normal") as THREE.BufferAttribute;
      for (let i = 0; i < nor.length / 3; i++) {
        if (nor[i * 3] === 0 && nor[i * 3 + 1] === 0 && nor[i * 3 + 2] === 0) {
          nor[i * 3] = cn.getX(i);
          nor[i * 3 + 1] = cn.getY(i);
          nor[i * 3 + 2] = cn.getZ(i);
        }
      }
      tmp.dispose();
    }
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ───────────── Mô hình Blender (public/world/torus/torus_props.glb) ─────────────
/** mỗi node: phần toon + phần phát sáng (glow_*), hình học trong khung của node, màu đỉnh = màu vật liệu × GI nướng */
type PropGeo = { toon: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[] };
const PROPS = new Map<string, PropGeo>();
export const TORUS_PROP_NODES = ["tw_tree_a", "tw_tree_b", "tw_stone", "tw_portal", "tw_bellbox", "tw_pylon", "tw_floater", "tw_plank"] as const;
/** nạp mô hình từ cảnh GLB (gọi trước buildTorusGeo); thiếu node nào thì phần đó dùng hình thủ tục cũ */
export function setTorusProps(scene: THREE.Object3D | null) {
  PROPS.forEach((pg) => [...pg.toon, ...pg.glow].forEach((g) => g.dispose()));
  PROPS.clear();
  if (!scene) return;
  scene.updateMatrixWorld(true);
  for (const name of TORUS_PROP_NODES) {
    const node = scene.getObjectByName(name);
    if (!node) continue;
    const inv = node.matrixWorld.clone().invert();
    const pg: PropGeo = { toon: [], glow: [] };
    node.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const src = mesh.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", src.getAttribute("position").clone());
      const nor = src.getAttribute("normal");
      const n = g.getAttribute("position").count;
      const bake = src.getAttribute("color");
      const glow = mat.name.startsWith("glow_");
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const k = glow ? 2.4 : 1;
        col[i * 3] = mat.color.r * (bake && !glow ? bake.getX(i) : 1) * k;
        col[i * 3 + 1] = mat.color.g * (bake && !glow ? bake.getY(i) : 1) * k;
        col[i * 3 + 2] = mat.color.b * (bake && !glow ? bake.getZ(i) : 1) * k;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      if (src.index) g.setIndex(src.index.clone());
      // glb_slim bỏ NORMAL của vật liệu không chiếu sáng (glow_*) → tính lại
      if (nor) g.setAttribute("normal", nor.clone());
      else g.computeVertexNormals();
      g.applyMatrix4(inv.clone().multiply(mesh.matrixWorld));
      (glow ? pg.glow : pg.toon).push(g);
    });
    PROPS.set(name, pg);
  }
}
/** đặt một mô hình (toon → b, glow → gl) với ma trận m; trả false nếu chưa nạp (dùng hình thủ tục) */
function placeProp(name: (typeof TORUS_PROP_NODES)[number], b: Builder, m: THREE.Matrix4, gl?: Builder, glowTint?: THREE.Color): boolean {
  const pg = PROPS.get(name);
  if (!pg) return false;
  pg.toon.forEach((g) => b.addColored(g, m));
  if (gl) pg.glow.forEach((g) => gl.addColored(g, m, glowTint));
  return true;
}
const M4 = new THREE.Matrix4();
const at = (x: number, y: number, z: number, yaw = 0, s = 1) => M4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(s, s, s));

/** nhiễu băm tất định (không cần đẹp, chỉ để biến thiên màu / đá) */
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const C = (hex: string) => new THREE.Color(hex);
const GRASS_A = C("#7ccf7a");
const GRASS_B = C("#b4e486");
const GRASS_RIM = C("#d9df8e");
const ROCK_TOP = C("#e2b98c");
const ROCK_MID = C("#b98a86");
const ROCK_LOW = C("#6e5c8e");
const WOOD = C("#b9824f");
const WOOD_D = C("#8a5a36");
const STONE_C = C("#e9e1d3");
const STONE_D = C("#c9bfb1");
const GOLD = C("#e8b64c");

function islandMesh(b: Builder, is: Island, seed: number, lod = false) {
  const J = lod ? 28 : 72; // phân đoạn quanh bờ
  const K = lod ? 3 : 9; // vòng mặt cỏ
  const pts: number[] = [];
  const cols: number[] = [];
  const tris: number[] = [];
  const tmp = new THREE.Color();
  // tâm
  pts.push(is.x, is.top + is.dome, is.z);
  tmp.copy(GRASS_A);
  cols.push(tmp.r, tmp.g, tmp.b);
  const ring = (k: number, j: number) => 1 + (k - 1) * J + (j % J);
  for (let k = 1; k <= K; k++) {
    const q = k / K;
    for (let j = 0; j < J; j++) {
      const th = (j / J) * Math.PI * 2;
      const rr = islandRadius(is, th) * q * (k === K ? 0.999 : 1);
      const lx = Math.cos(th) * rr;
      const lz = Math.sin(th) * rr;
      const h = islandHeight(is, lx, lz) ?? is.top;
      pts.push(is.x + lx, h, is.z + lz);
      const n = vnoise((is.x + lx) * 0.35 + seed, (is.z + lz) * 0.35);
      tmp.copy(GRASS_A).lerp(GRASS_B, 0.25 + 0.55 * n);
      if (q > 0.86) tmp.lerp(GRASS_RIM, ((q - 0.86) / 0.14) * 0.55);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let j = 0; j < J; j++) tris.push(0, ring(1, j + 1), ring(1, j));
  for (let k = 1; k < K; k++)
    for (let j = 0; j < J; j++) {
      const a = ring(k, j);
      const bb = ring(k, j + 1);
      const c = ring(k + 1, j);
      const d = ring(k + 1, j + 1);
      tris.push(a, bb, c, bb, d, c);
    }
  b.raw(pts, cols, tris);

  // vành + vách đá: các vòng đi xuống, co dần thành mũi nhọn (đảo nổi), bờ đá lồi lõm theo nhiễu
  const F = lod ? [0, 0.07, 0.3, 0.62, 1] : [0, 0.02, 0.07, 0.16, 0.3, 0.46, 0.62, 0.78, 0.9, 1];
  const cp: number[] = [];
  const cc: number[] = [];
  const ct: number[] = [];
  for (let f = 0; f < F.length; f++) {
    const t = F[f];
    for (let j = 0; j <= J; j++) {
      const th = (j / J) * Math.PI * 2;
      const r0 = islandRadius(is, th);
      const n = vnoise(th * 3 + seed, t * 6) - 0.5;
      const lip = t === 0 ? 0.999 : t < 0.05 ? 1.04 : 1;
      const shrink = t <= 0.05 ? 1 : Math.max(0.04, 1 - Math.pow((t - 0.05) / 0.95, 1.35) * 0.97);
      const rr = r0 * lip * shrink * (1 + (t > 0.05 && t < 0.98 ? n * 0.16 : 0));
      const y = is.top - (t < 0.05 ? t * 6 : 0.3 + (t - 0.05) * is.depth) + (t > 0.05 ? n * 0.4 : 0);
      cp.push(is.x + Math.cos(th) * rr, y, is.z + Math.sin(th) * rr);
      // dải đá: kem → hồng đất → tím than; vân ngang
      const band = 0.5 + 0.5 * Math.sin(y * 3.1 + n * 4);
      const c = t < 0.3 ? ROCK_TOP.clone().lerp(ROCK_MID, t / 0.3) : ROCK_MID.clone().lerp(ROCK_LOW, (t - 0.3) / 0.7);
      c.multiplyScalar(0.9 + band * 0.12);
      if (t === 0) c.copy(GRASS_RIM).lerp(ROCK_TOP, 0.4);
      cc.push(c.r, c.g, c.b);
    }
  }
  const W = J + 1;
  for (let f = 0; f < F.length - 1; f++)
    for (let j = 0; j < J; j++) {
      const a = f * W + j;
      const bb = f * W + j + 1;
      const c = (f + 1) * W + j;
      const d = (f + 1) * W + j + 1;
      ct.push(a, c, bb, bb, c, d);
    }
  b.raw(cp, cc, ct);
}

/** cầu gỗ: ván + hai lan can dây; cầu sáng dựng riêng (hiện khi rung Chuông) */
function bridgeMesh(b: Builder, br: (typeof BRIDGES)[number]) {
  const len = Math.hypot(br.bx - br.ax, br.bz - br.az);
  const yaw = Math.atan2(br.bx - br.ax, br.bz - br.az);
  const n = Math.max(4, Math.round(len / 0.55));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = br.ax + (br.bx - br.ax) * t;
    const z = br.az + (br.bz - br.az) * t;
    const y = br.ya + (br.yb - br.ya) * t - 0.07;
    q.setFromEuler(new THREE.Euler(Math.atan2(br.yb - br.ya, len) * -1, yaw, (hash(i, len) - 0.5) * 0.04, "YXZ"));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(br.w, 1, (len / n) * 0.86));
    // ván Blender (2 tấm + dây buộc); chưa nạp → hộp thủ tục
    if (placeProp("tw_plank", b, m)) continue;
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(br.w, 0.12, (len / n) * 0.86));
    b.add(new THREE.BoxGeometry(1, 1, 1), m, i % 3 === 1 ? WOOD_D : WOOD);
  }
  // hai thanh dầm dưới ván
  for (const s of [-1, 1]) {
    const ox = Math.cos(yaw) * (br.w / 2 - 0.15) * s;
    const oz = -Math.sin(yaw) * (br.w / 2 - 0.15) * s;
    q.setFromEuler(new THREE.Euler(-Math.atan2(br.yb - br.ya, len), yaw, 0, "YXZ"));
    m.compose(new THREE.Vector3((br.ax + br.bx) / 2 + ox, (br.ya + br.yb) / 2 - 0.22, (br.az + br.bz) / 2 + oz), q, new THREE.Vector3(0.16, 0.16, len));
    b.add(new THREE.BoxGeometry(1, 1, 1), m, WOOD_D);
    // cột lan can + tay vịn
    const posts = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const x = br.ax + (br.bx - br.ax) * t + ox * 1.06;
      const z = br.az + (br.bz - br.az) * t + oz * 1.06;
      const y = br.ya + (br.yb - br.ya) * t;
      m.compose(new THREE.Vector3(x, y + 0.42, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      b.add(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 6), m, WOOD_D);
    }
    m.compose(new THREE.Vector3((br.ax + br.bx) / 2 + ox * 1.06, (br.ya + br.yb) / 2 + 0.86, (br.az + br.bz) / 2 + oz * 1.06), q, new THREE.Vector3(0.07, 0.07, len));
    b.add(new THREE.BoxGeometry(1, 1, 1), m, WOOD);
  }
}

function treeMesh(b: Builder, x: number, z: number, s: number, ground: number, k: number) {
  if (placeProp(k % 3 === 0 ? "tw_tree_b" : "tw_tree_a", b, at(x, ground - 0.05, z, hash(k, 5) * Math.PI * 2, s * 0.92))) return;
  const m = new THREE.Matrix4();
  const lean = (hash(k, 3) - 0.5) * 0.18;
  m.compose(new THREE.Vector3(x, ground + 1.1 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, lean * 0.6)), new THREE.Vector3(s, s, s));
  b.add(new THREE.CylinderGeometry(0.13, 0.24, 2.3, 7), m, C("#8a5d3f"));
  // tán: 4 khối tròn dẹt chồng nhau (xanh lá → xanh vàng nắng ở đỉnh)
  const lumps: [number, number, number, number][] = [
    [0, 2.45, 0, 1.25],
    [0.65, 2.15, 0.3, 0.9],
    [-0.55, 2.2, -0.35, 0.95],
    [0.1, 3.05, -0.1, 0.85],
  ];
  const leafA = C(k % 3 === 0 ? "#5fb871" : "#4fae78");
  const leafB = C(k % 3 === 0 ? "#c6e88a" : "#a5e3a0");
  for (const [lx, ly, lz, r] of lumps) {
    m.compose(new THREE.Vector3(x + lx * s, ground + ly * s, z + lz * s), new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(k, lx) * 3, hash(k, ly) * 3, 0)), new THREE.Vector3(r * s, r * s * 0.82, r * s));
    b.add(new THREE.IcosahedronGeometry(1, 1), m, (p, n) => leafA.clone().lerp(leafB, Math.min(1, Math.max(0, n.y * 0.6 + 0.35 + (p.y - ground - 2.4 * s) * 0.25))));
  }
}

function boxAt(b: Builder, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, c: THREE.Color, yaw = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sx, sy, sz));
  b.add(new THREE.BoxGeometry(1, 1, 1), m, c);
}

/** Hộp Chuông: ba vách đá trắng + mái, nẹp vàng quanh miệng, bậc đế — khớp hộp va chạm trong torusWorld */
function bellBoxMesh(b: Builder) {
  const B = BELL_BOX;
  const y0 = BELL_Y0;
  if (placeProp("tw_bellbox", b, at((B.back - B.wall + B.open) / 2, y0, B.z))) return;
  const x0 = B.back - B.wall;
  const zo = B.half + B.wall;
  const top = y0 + B.h;
  const midX = (x0 + B.open) / 2;
  const lenX = B.open - x0;
  // vách sau / hai vách bên / mái / sàn
  boxAt(b, B.back - B.wall / 2, (y0 - 0.6 + top + B.wall) / 2, B.z, B.wall, top + B.wall - (y0 - 0.6), zo * 2, STONE_C);
  boxAt(b, midX, (y0 - 0.6 + top + B.wall) / 2, B.z + B.half + B.wall / 2, lenX, top + B.wall - (y0 - 0.6), B.wall, STONE_C);
  boxAt(b, midX, (y0 - 0.6 + top + B.wall) / 2, B.z - B.half - B.wall / 2, lenX, top + B.wall - (y0 - 0.6), B.wall, STONE_C);
  boxAt(b, midX, top + B.wall / 2, B.z, lenX, B.wall, zo * 2, STONE_D);
  boxAt(b, midX, y0 - 0.3, B.z, lenX, 0.6, zo * 2, STONE_D);
  // mái chóp (kim tự tháp thấp) + nẹp vàng viền miệng hộp
  const m = new THREE.Matrix4().compose(new THREE.Vector3(midX, top + B.wall + 0.32, B.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(lenX * 0.78, 0.65, zo * 1.6));
  b.add(new THREE.ConeGeometry(1, 1, 4), m, STONE_D);
  boxAt(b, B.open + 0.04, top + 0.05, B.z, 0.1, 0.14, zo * 2 + 0.06, GOLD);
  for (const s of [-1, 1]) boxAt(b, B.open + 0.04, (y0 + top) / 2, B.z + s * (B.half + 0.06), 0.1, B.h, 0.14, GOLD);
  // vòng nẹp vàng quanh thân (ngang lưng chừng)
  boxAt(b, midX, y0 + 0.5, B.z, lenX + 0.06, 0.12, zo * 2 + 0.06, GOLD);
}

/** Bia Xuyến: phiến đá đứng trên bệ tròn, khắc ô vuông (vẽ bằng glow) */
function stoneMesh(b: Builder, x: number, z: number, ground: number, scale = 1) {
  if (placeProp("tw_stone", b, at(x, ground, z, 0, scale))) return;
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, ground + 0.12, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
  b.add(new THREE.CylinderGeometry(0.95, 1.1, 0.26, 10), m, STONE_D);
  m.compose(new THREE.Vector3(x, ground + 0.95 * scale, z), new THREE.Quaternion(), new THREE.Vector3(1.05 * scale, 1.5 * scale, 0.3 * scale));
  b.add(new THREE.BoxGeometry(1, 1, 1), m, STONE_C);
  m.compose(new THREE.Vector3(x, ground + 1.78 * scale, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 4)), new THREE.Vector3(0.52 * scale, 0.52 * scale, 0.32 * scale));
  b.add(new THREE.BoxGeometry(1, 1, 1), m, GOLD);
}

function portalMesh(b: Builder, x: number, z: number, ground: number) {
  const m = new THREE.Matrix4();
  // vòm đá tròn quay mặt về tâm đảo (đông bắc)
  const yaw = Math.atan2(-x, -z);
  if (placeProp("tw_portal", b, at(x, ground, z, yaw))) return;
  m.compose(new THREE.Vector3(x, ground + 1.85, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.TorusGeometry(1.55, 0.2, 10, 40), m, STONE_C);
  m.compose(new THREE.Vector3(x, ground + 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.CylinderGeometry(1.3, 1.5, 0.22, 16), m, STONE_D);
}

/** bệ Mắt Canh (bậc tròn 2 tầng) */
function pedestalMesh(b: Builder, x: number, z: number, ground: number) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, ground + 0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.CylinderGeometry(1.9, 2.15, 0.24, 12), m, STONE_D);
  m.compose(new THREE.Vector3(x, ground + 0.36, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.CylinderGeometry(1.15, 1.3, 0.26, 12), m, STONE_C);
}

/** đá trang trí + đảo nhỏ trôi (chỉ để nhìn — đặt xa đường bay của câu đố) */
const FLOATERS: [number, number, number, number][] = [
  [-15, 12.5, -2.5, 2.2],
  [13, -16, 3.6, 1.6],
  [-16.5, -13, 5.5, 1.2],
  [15.5, 16.5, -4.5, 1.8],
];

/**
 * Bản rút gọn cho vòng ô ngoài (5 × 5, cách ≥ 48 m, chìm trong sương): đảo ít đỉnh, cây = một khối nón, không cầu.
 * Tam giác ~1/8 bản đầy đủ → 16 ô ngoài rẻ hơn 2 ô gần.
 */
export function buildTorusLod(ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const b = new Builder();
  ISLANDS.forEach((is, i) => islandMesh(b, is, i * 7.3, true));
  const m = new THREE.Matrix4();
  TREES.forEach((t, k) => {
    const g = ground(t.x, t.z);
    m.compose(new THREE.Vector3(t.x, g + 2.2 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(1.3 * t.s, 2.6 * t.s, 1.3 * t.s));
    b.add(new THREE.ConeGeometry(1, 1, 6), m, k % 3 === 0 ? C("#5fb871") : C("#4fae78"));
  });
  return b.build();
}

export interface TorusGeo {
  toon: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** cầu sáng (hiện khi rung Chuông) */
  light: THREE.BufferGeometry;
}

export function buildTorusGeo(ground: (x: number, z: number) => number): TorusGeo {
  const toon = new Builder();
  const glow = new Builder();
  ISLANDS.forEach((is, i) => islandMesh(toon, is, i * 7.3));
  for (const br of BRIDGES) if (!br.light) bridgeMesh(toon, br);
  TREES.forEach((t, k) => treeMesh(toon, t.x, t.z, t.s, ground(t.x, t.z), k));
  bellBoxMesh(toon);
  stoneMesh(toon, STONE.x, STONE.z, ground(STONE.x, STONE.z));
  stoneMesh(toon, CORNER_STONE.x, CORNER_STONE.z, ground(CORNER_STONE.x, CORNER_STONE.z), 0.75);
  portalMesh(toon, PORTAL.x, PORTAL.z, ground(PORTAL.x, PORTAL.z));
  {
    // mặt cổng: đĩa sáng xanh nhạt trong vòm đá
    const g0 = ground(PORTAL.x, PORTAL.z);
    const pm = new THREE.Matrix4().compose(new THREE.Vector3(PORTAL.x, g0 + 1.85, PORTAL.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(-PORTAL.x, -PORTAL.z), 0)), new THREE.Vector3(1, 1, 1));
    glow.add(new THREE.CircleGeometry(1.36, 32), pm, (p) => new THREE.Color("#9fe6ff").lerp(new THREE.Color("#ffd9a8"), Math.min(1, Math.hypot(p.x - PORTAL.x, p.y - g0 - 1.85, p.z - PORTAL.z) / 1.36)).multiplyScalar(0.85));
  }
  pedestalMesh(toon, SENTINEL.x, SENTINEL.z, ground(SENTINEL.x + 0.01, SENTINEL.z + 0.01));
  // đá rải trên đảo
  const rocks: [number, number, number][] = [
    [-8.2, -3.4, 0.5],
    [4.6, -7.6, 0.45],
    [7.8, 4.8, 0.35],
    [-2.2, -8.4, 0.4],
    [26.8, 5.6, 0.4],
    [-5.6, 26.4, 0.45],
    [21.6, 25.6, 0.5],
  ];
  const m = new THREE.Matrix4();
  rocks.forEach(([x, z, s], k) => {
    m.compose(new THREE.Vector3(x, ground(x, z) + s * 0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(k, 1) * 3, hash(k, 2) * 3, 0)), new THREE.Vector3(s * 1.2, s * 0.8, s));
    toon.add(new THREE.DodecahedronGeometry(1, 0), m, STONE_D);
  });
  // đảo đá nhỏ trôi lơ lửng (hình nón ngược + mặt cỏ)
  FLOATERS.forEach(([x, z, y, r], k) => {
    if (placeProp("tw_floater", toon, M4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hash(k, 9) * 6, 0)), new THREE.Vector3(r, r * 0.9, r)), glow, new THREE.Color("#c9b6ff"))) return;
    m.compose(new THREE.Vector3(x, y - r * 0.9, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, hash(k, 9) * 6, 0)), new THREE.Vector3(r, r * 1.9, r));
    toon.add(new THREE.ConeGeometry(1, 1, 9), m, (p) => ROCK_MID.clone().lerp(ROCK_LOW, Math.min(1, Math.max(0, (y - p.y) / (r * 1.8)))));
    m.compose(new THREE.Vector3(x, y - 0.05, z), new THREE.Quaternion(), new THREE.Vector3(r * 1.02, 0.18, r * 1.02));
    toon.add(new THREE.CylinderGeometry(1, 1, 1, 9), m, GRASS_A);
  });

  // ── glow: đường khâu mép trên mặt đảo (x = ±24 qua Đảo Mép Đông–Tây + Đảo Bốn Góc; z = ±24 qua Đảo Mép Bắc–Nam + Bốn Góc)
  const seam = (axis: "x" | "z", color: string) => {
    const c = new THREE.Color(color).multiplyScalar(2.2);
    const pts: number[] = [];
    const cols: number[] = [];
    const tris: number[] = [];
    const w = 0.09;
    // các đoạn: dò dọc đường mép, chỉ vẽ chỗ có đất (đảo hoặc cầu)
    let prev = false;
    let start = 0;
    for (let s = -24; s <= 24.001; s += 0.25) {
      const x = axis === "x" ? 24 : s;
      const z = axis === "x" ? s : 24;
      const y = ground(x, z);
      const on = y > -50;
      if (on) {
        const k = pts.length / 3;
        const ox = axis === "x" ? w : 0;
        const oz = axis === "x" ? 0 : w;
        pts.push(x - ox, y + 0.035, z - oz, x + ox, y + 0.035, z + oz);
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (prev && k > start) tris.push(k - 2, k - 1, k, k - 1, k + 1, k);
        if (!prev) start = k;
      }
      prev = on;
    }
    glow.raw(pts, cols, tris);
    // cột mốc ở hai đầu mỗi đoạn mép trên đảo: trụ đá mảnh + ngấn sáng
  };
  seam("x", SEAM_X_COLOR);
  seam("z", SEAM_Z_COLOR);
  // cột mốc mép: trên Đảo Mép Đông–Tây (mép x) và Đảo Mép Bắc–Nam (mép z), hai bên đường khâu
  const posts: [number, number, string][] = [
    [24, 2.6, SEAM_X_COLOR],
    [-8.6, 24, SEAM_Z_COLOR],
    [0.6, 24, SEAM_Z_COLOR],
  ];
  for (const [x, z, col] of posts) {
    const g0 = ground(x, z);
    if (placeProp("tw_pylon", toon, at(x, g0, z), glow, new THREE.Color(col))) continue;
    m.compose(new THREE.Vector3(x, g0 + 1.05, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    toon.add(new THREE.CylinderGeometry(0.16, 0.22, 2.1, 6), m, STONE_C);
    m.compose(new THREE.Vector3(x, g0 + 2.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(0.32, 0.42, 0.32));
    glow.add(new THREE.OctahedronGeometry(1, 0), m, new THREE.Color(col).multiplyScalar(2.6));
  }
  // ngấn sáng trên Bia Xuyến (ô vuông có mũi tên hai cặp mép)
  {
    const x = STONE.x;
    const z = STONE.z + 0.16;
    const g0 = ground(STONE.x, STONE.z);
    const sq = 0.36;
    const cx = new THREE.Color(SEAM_X_COLOR).multiplyScalar(2.4);
    const cz = new THREE.Color(SEAM_Z_COLOR).multiplyScalar(2.4);
    const y = g0 + 0.98;
    boxAt(glow, x - sq, y, z, 0.05, sq * 2, 0.02, cx);
    boxAt(glow, x + sq, y, z, 0.05, sq * 2, 0.02, cx);
    boxAt(glow, x, y - sq, z, sq * 2, 0.05, 0.02, cz);
    boxAt(glow, x, y + sq, z, sq * 2, 0.05, 0.02, cz);
  }

  // ── cầu sáng: ván kính nối Đảo Mép Đông–Tây với Đảo Bốn Góc
  const light = new Builder();
  const lb = BRIDGES.find((x) => x.light)!;
  {
    const len = Math.hypot(lb.bx - lb.ax, lb.bz - lb.az);
    const yaw = Math.atan2(lb.bx - lb.ax, lb.bz - lb.az);
    const n = Math.round(len / 0.7);
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      q.setFromEuler(new THREE.Euler(-Math.atan2(lb.yb - lb.ya, len), yaw, 0, "YXZ"));
      m.compose(new THREE.Vector3(lb.ax + (lb.bx - lb.ax) * t, lb.ya + (lb.yb - lb.ya) * t - 0.05, lb.az + (lb.bz - lb.az) * t), q, new THREE.Vector3(lb.w, 0.08, (len / n) * 0.8));
      light.add(new THREE.BoxGeometry(1, 1, 1), m, new THREE.Color(i % 2 ? "#ffd9a0" : "#9ff0ff").multiplyScalar(1.6));
    }
  }
  return { toon: toon.build(), glow: glow.build(false), light: light.build(false) };
}
