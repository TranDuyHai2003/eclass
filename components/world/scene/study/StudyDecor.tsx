"use client";
/**
 * Hình học thủ tục của phòng Học cùng nhau (gác thư viện ấm áp, kiểu anime lo-fi).
 * Tối ưu điện thoại: mọi khối tĩnh GỘP theo vật liệu (≈ 10 lệnh vẽ cho cả phòng), sách là MỘT InstancedMesh,
 * vệt sáng đèn bàn là một InstancedMesh cộng màu; không bóng đổ thời gian thực (bóng tiếp xúc giả bằng mảng tối).
 * Bảng màu (theo nghiên cứu lo-fi): gỗ óc chó #694936, hổ phách #E9AD62, xanh xô thơm #83917D, xanh đá #46576C.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonGradient } from "../../fx/shaders";
import { CHAIR, DOOR, FIREPLACE, PLANTS, SEATS, SHELF_DEPTH, SHELF_RUNS, SR, TABLE, TABLES, WINDOWS } from "@/lib/world/studyRoom";
import { useStudy } from "./studyState";

const { W, D, H } = SR;
/** chiều cao giá sách, số tầng */
const SHELF_H = 2.45;
const SHELF_LEVELS = 5;
const WAINSCOT = 1.05;

/** Bậc tối của tông ấm (bóng nâu hồng thay vì tím lạnh của ngoài trời) */
let WARM: THREE.DataTexture | null = null;
function warmGrad() {
  if (!WARM)
    WARM = toonGradient([
      [0.5, 0.4, 0.42],
      [0.62, 0.5, 0.5],
      [1, 0.96, 0.9],
      [1, 0.98, 0.95],
      [1, 1, 1],
    ]);
  return WARM;
}
function toon(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: warmGrad(), ...extra });
}

// ───────────── Hoạ tiết vẽ bằng canvas (một lần) ─────────────

function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** Sàn gỗ ván dài so le, vân nhẹ */
function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const r = rand(7);
  const rows = 8;
  const h = 512 / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < 512) {
      const w = 180 + r() * 160;
      const l = 0.82 + r() * 0.22;
      g.fillStyle = `rgb(${Math.round(120 * l)},${Math.round(80 * l)},${Math.round(54 * l)})`;
      g.fillRect(x, i * h, w, h);
      // vân gỗ
      g.strokeStyle = `rgba(60,36,22,${0.12 + r() * 0.1})`;
      g.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const y = i * h + 6 + r() * (h - 12);
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + w * 0.3, y + (r() - 0.5) * 8, x + w * 0.7, y + (r() - 0.5) * 8, x + w, y);
        g.stroke();
      }
      g.fillStyle = "rgba(40,24,14,.55)";
      g.fillRect(x, i * h, 2, h);
      x += w;
    }
    g.fillStyle = "rgba(40,24,14,.6)";
    g.fillRect(0, i * h, 512, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Thảm lối giữa: nền đỏ rượu, viền hoa văn vàng, ô trám giữa */
function rugTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6d2f33";
  g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = "#d9a85b";
  g.lineWidth = 6;
  g.strokeRect(14, 14, 228, 996);
  g.lineWidth = 2;
  g.strokeRect(26, 26, 204, 972);
  g.fillStyle = "#46576c";
  g.fillRect(30, 30, 196, 964);
  g.fillStyle = "#7a3438";
  g.fillRect(40, 40, 176, 944);
  g.strokeStyle = "rgba(233,173,98,.55)";
  g.lineWidth = 2;
  for (let y = 80; y < 980; y += 72) {
    g.beginPath();
    g.moveTo(128, y - 30);
    g.lineTo(168, y);
    g.lineTo(128, y + 30);
    g.lineTo(88, y);
    g.closePath();
    g.stroke();
    g.fillStyle = "rgba(233,173,98,.35)";
    g.beginPath();
    g.arc(128, y, 5, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Vệt sáng mềm (đèn bàn hắt xuống mặt bàn / sàn) */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,214,150,0.9)");
  gr.addColorStop(0.35, "rgba(255,190,120,0.42)");
  gr.addColorStop(1, "rgba(255,170,100,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ───────────── Bộ dựng hình gộp ─────────────

type Bucket = THREE.BufferGeometry[];
class Builder {
  b: Record<string, Bucket> = {};
  private push(k: string, g: THREE.BufferGeometry) {
    // gộp được: chỉ giữ position / normal / uv, bỏ chỉ số
    const n = g.index ? g.toNonIndexed() : g;
    for (const a of Object.keys(n.attributes)) if (a !== "position" && a !== "normal" && a !== "uv") n.deleteAttribute(a);
    (this.b[k] ??= []).push(n);
  }
  box(k: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z);
    this.push(k, g);
  }
  cyl(k: string, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 10, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
    g.translate(x, y, z);
    this.push(k, g);
  }
  geo(k: string, g: THREE.BufferGeometry) {
    this.push(k, g);
  }
  merged(k: string) {
    const list = this.b[k];
    if (!list?.length) return null;
    const m = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    m.computeBoundingSphere();
    return m;
  }
}

function buildRoom() {
  const B = new Builder();
  // ── Tường: thạch cao kem phía trên, ván gỗ phía dưới (tường ngoài dày 0,2 m, nằm ngoài lòng phòng)
  const T = 0.2;
  B.box("wall", T, H, D * 2, -W - T / 2, H / 2, 0);
  B.box("wall", T, H, D * 2, W + T / 2, H / 2, 0);
  B.box("wall", W * 2 + T * 2, H, T, 0, H / 2, D + T / 2);
  // tường bắc: khoét hai ô cửa sổ
  {
    const xs = [-W, ...WINDOWS.flatMap((w) => [w.x - w.hw, w.x + w.hw]), W];
    for (let i = 0; i < xs.length; i += 2) B.box("wall", xs[i + 1] - xs[i], H, T, (xs[i] + xs[i + 1]) / 2, H / 2, -D - T / 2);
    for (const w of WINDOWS) {
      B.box("wall", w.hw * 2, w.y0, T, w.x, w.y0 / 2, -D - T / 2);
      B.box("wall", w.hw * 2, H - w.y1, T, w.x, (H + w.y1) / 2, -D - T / 2);
    }
  }
  // ốp gỗ chân tường (chừa cửa sổ không cần — bậu cửa cao hơn ốp)
  B.box("panel", 0.05, WAINSCOT, D * 2, -W + 0.025, WAINSCOT / 2, 0);
  B.box("panel", 0.05, WAINSCOT, D * 2, W - 0.025, WAINSCOT / 2, 0);
  B.box("panel", W * 2, WAINSCOT, 0.05, 0, WAINSCOT / 2, -D + 0.025);
  B.box("panel", W * 2, WAINSCOT, 0.05, 0, WAINSCOT / 2, D - 0.025);
  // nẹp trên ốp + phào trần
  for (const [w, d, x, z] of [
    [0.09, D * 2, -W + 0.05, 0],
    [0.09, D * 2, W - 0.05, 0],
    [W * 2, 0.09, 0, -D + 0.05],
    [W * 2, 0.09, 0, D - 0.05],
  ] as const) {
    B.box("dark", w, 0.06, d, x, WAINSCOT, z);
    B.box("dark", w, 0.16, d, x, H - 0.08, z);
  }
  // ── Trần gỗ + xà ngang
  B.box("ceil", W * 2, 0.1, D * 2, 0, H + 0.05, 0);
  for (let z = -D + 1; z < D; z += 1.6) B.box("dark", W * 2, 0.26, 0.22, 0, H - 0.13, z);
  B.box("dark", 0.26, 0.2, D * 2, -2.2, H - 0.36, 0);
  B.box("dark", 0.26, 0.2, D * 2, 2.2, H - 0.36, 0);

  // ── Cửa sổ: khung + song chắn + bậu (gỗ sẫm), bậu ngồi có nệm
  for (const w of WINDOWS) {
    const z = -D;
    const hgt = w.y1 - w.y0;
    B.box("dark", w.hw * 2 + 0.24, 0.12, 0.34, w.x, w.y0 - 0.02, z + 0.08);
    B.box("dark", w.hw * 2 + 0.24, 0.14, 0.18, w.x, w.y1 + 0.05, z);
    for (const s of [-1, 1]) B.box("dark", 0.12, hgt + 0.2, 0.2, w.x + s * (w.hw + 0.06), (w.y0 + w.y1) / 2, z);
    for (const s of [-1 / 3, 1 / 3]) B.box("dark", 0.045, hgt, 0.08, w.x + s * w.hw * 2 * 0.5, (w.y0 + w.y1) / 2, z - 0.02);
    for (let k = 1; k < 5; k++) B.box("dark", w.hw * 2, 0.04, 0.08, w.x, w.y0 + (hgt * k) / 5, z - 0.02);
    // vòm bán nguyệt trang trí phía trên cửa sổ
    const arch = new THREE.TorusGeometry(w.hw + 0.02, 0.07, 6, 18, Math.PI);
    arch.translate(w.x, w.y1 + 0.12, z + 0.05);
    B.geo("dark", arch);
  }

  // ── Giá sách
  for (const run of SHELF_RUNS) {
    const x = run.side * (W - SHELF_DEPTH / 2);
    const len = run.z1 - run.z0;
    const zc = (run.z0 + run.z1) / 2;
    B.box("dark", SHELF_DEPTH, SHELF_H, 0.04, x + run.side * (SHELF_DEPTH / 2 - 0.02), SHELF_H / 2, zc, Math.PI / 2);
    for (let i = 0; i <= SHELF_LEVELS; i++) B.box("wood", SHELF_DEPTH, 0.05, len, x, 0.1 + (i * (SHELF_H - 0.15)) / SHELF_LEVELS, zc);
    B.box("dark", SHELF_DEPTH + 0.06, 0.1, len + 0.06, x, SHELF_H + 0.02, zc);
    const bays = Math.max(1, Math.round(len / 1.05));
    for (let i = 0; i <= bays; i++) B.box("dark", SHELF_DEPTH, SHELF_H, 0.05, x, SHELF_H / 2, run.z0 + (len * i) / bays);
  }

  // ── Lò sưởi (tường tây): thân đá, hốc lửa tối, bệ gỗ, ống khói lên trần
  {
    const f = FIREPLACE;
    const x = -W + f.depth / 2;
    B.box("stone", f.depth, 1.35, f.hw * 2, x, 0.675, f.z);
    B.box("soot", 0.08, 0.8, f.hw * 1.2, x + f.depth / 2 - 0.02, 0.45, f.z);
    B.box("dark", f.depth + 0.22, 0.1, f.hw * 2 + 0.3, x + 0.08, 1.4, f.z);
    B.box("stone", f.depth * 0.8, H - 1.45, f.hw * 1.6, x - f.depth * 0.1, 1.45 + (H - 1.45) / 2, f.z);
    B.box("stone", 0.9, 0.06, f.hw * 2 + 0.4, x + 0.4, 0.03, f.z);
    // củi
    B.cyl("log", 0.07, 0.07, 0.7, x + 0.12, 0.13, f.z - 0.08, 7, Math.PI / 2, 0.2);
    B.cyl("log", 0.06, 0.06, 0.65, x + 0.18, 0.2, f.z + 0.1, 7, Math.PI / 2, -0.35);
  }

  // ── Bàn học + ghế
  for (const t of TABLES) {
    B.box("wood", TABLE.hx * 2, 0.06, TABLE.hz * 2, t.x, TABLE.h - 0.03, t.z);
    B.box("dark", TABLE.hx * 2 - 0.1, 0.1, TABLE.hz * 2 - 0.1, t.x, TABLE.h - 0.11, t.z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box("dark", 0.07, TABLE.h - 0.06, 0.07, t.x + sx * (TABLE.hx - 0.08), (TABLE.h - 0.06) / 2, t.z + sz * (TABLE.hz - 0.08));
    // vách ngăn thấp giữa hai chỗ (riêng tư, ít xao nhãng) + giá sách nhỏ phía trước
    B.box("dark", 0.03, 0.32, TABLE.hz * 2 - 0.1, t.x, TABLE.h + 0.16, t.z - 0.02);
    B.box("wood", TABLE.hx * 2 - 0.1, 0.14, 0.18, t.x, TABLE.h + 0.07, t.z - TABLE.hz + 0.1);
  }
  for (const s of SEATS) {
    const y = CHAIR.seat;
    B.box("wood", CHAIR.hx * 2, 0.05, CHAIR.hz * 2, s.x, y, s.z);
    B.box("cushion", CHAIR.hx * 1.8, 0.04, CHAIR.hz * 1.7, s.x, y + 0.045, s.z - 0.01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box("dark", 0.045, y, 0.045, s.x + sx * (CHAIR.hx - 0.04), y / 2, s.z + sz * (CHAIR.hz - 0.04));
    // tựa lưng phía sau (nam)
    for (const sx of [-1, 1]) B.box("dark", 0.045, CHAIR.back - y, 0.045, s.x + sx * (CHAIR.hx - 0.04), y + (CHAIR.back - y) / 2, s.z + CHAIR.hz - 0.04);
    B.box("wood", CHAIR.hx * 2, 0.16, 0.035, s.x, CHAIR.back - 0.1, s.z + CHAIR.hz - 0.04);
    B.box("wood", CHAIR.hx * 2, 0.06, 0.035, s.x, y + 0.25, s.z + CHAIR.hz - 0.04);
  }

  // ── Đèn bàn kiểu "banker" (chao xanh, đế đồng) mỗi bàn một chiếc + đồ trên bàn
  const r = rand(11);
  TABLES.forEach((t, i) => {
    const lx = t.x;
    const lz = t.z - TABLE.hz + 0.32;
    const y0 = TABLE.h;
    B.cyl("brass", 0.09, 0.11, 0.03, lx, y0 + 0.015, lz, 14);
    B.cyl("brass", 0.012, 0.012, 0.34, lx, y0 + 0.19, lz, 6);
    const shade = new THREE.CylinderGeometry(0.06, 0.06, 0.46, 14, 1, true, 0, Math.PI);
    shade.rotateZ(Math.PI / 2);
    shade.rotateX(-0.35);
    shade.translate(lx, y0 + 0.39, lz + 0.02);
    B.geo("shade", shade);
    B.cyl("bulb", 0.028, 0.028, 0.38, lx, y0 + 0.37, lz + 0.03, 8, 0, Math.PI / 2);
    // sách mở + vở + cốc trà cho mỗi chỗ ngồi
    for (const s of [-1, 1]) {
      const bx = t.x + s * CHAIR.dx;
      const bz = t.z + 0.08;
      const a = (r() - 0.5) * 0.3;
      B.box("paper", 0.22, 0.02, 0.3, bx - 0.115, y0 + 0.012, bz, a, 0, 0.05);
      B.box("paper", 0.22, 0.02, 0.3, bx + 0.115, y0 + 0.012, bz, a, 0, -0.05);
      if ((i + (s > 0 ? 1 : 0)) % 2) B.box("cover", 0.2, 0.03, 0.27, bx + s * 0.42, y0 + 0.016, bz + 0.05, 0.4 * s);
      else {
        B.cyl("cup", 0.04, 0.035, 0.09, bx + s * 0.42, y0 + 0.045, bz - 0.05, 10);
        B.cyl("tea", 0.036, 0.036, 0.005, bx + s * 0.42, y0 + 0.08, bz - 0.05, 10);
      }
    }
  });

  // ── Đèn treo trên lối giữa (chao đồng) + dây
  for (const z of [-3.6, 0, 3.4]) {
    B.cyl("dark", 0.006, 0.006, 1.2, 0, H - 0.6, z, 4);
    const shade = new THREE.ConeGeometry(0.32, 0.26, 16, 1, true);
    shade.translate(0, H - 1.32, z);
    B.geo("brass", shade);
    B.geo("bulb", new THREE.SphereGeometry(0.09, 10, 8).translate(0, H - 1.44, z));
  }

  // ── Cửa ra (tường nam): cửa đôi gỗ + tay nắm đồng + ô kính trên cửa sáng ấm
  {
    const z = D - 0.03;
    B.box("dark", DOOR.hw * 2 + 0.3, 2.75, 0.1, 0, 1.375, z);
    for (const s of [-1, 1]) {
      B.box("door", DOOR.hw - 0.04, 2.4, 0.08, (s * DOOR.hw) / 2, 1.22, z - 0.04);
      for (const y of [0.7, 1.75]) B.box("wood", DOOR.hw - 0.28, 0.7, 0.03, (s * DOOR.hw) / 2, y, z - 0.09);
      B.cyl("brass", 0.03, 0.03, 0.06, s * 0.12, 1.1, z - 0.1, 8, Math.PI / 2);
    }
  }

  // ── Chậu cây hai góc nam + một cây trên bậu mỗi cửa sổ
  for (const p of PLANTS) {
    B.cyl("pot", p.r * 0.85, p.r * 0.65, 0.5, p.x, 0.25, p.z, 12);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + r();
      const leaf = new THREE.ConeGeometry(0.1, 0.7 + r() * 0.4, 5);
      leaf.translate(0, 0.35, 0);
      leaf.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55)));
      leaf.translate(p.x, 0.5, p.z);
      B.geo("leaf", leaf);
    }
    B.geo("leaf", new THREE.IcosahedronGeometry(0.3, 0).translate(p.x, 0.75, p.z));
  }
  for (const w of WINDOWS) {
    B.cyl("pot", 0.1, 0.08, 0.14, w.x - w.hw + 0.3, w.y0 + 0.11, -D + 0.16, 10);
    B.geo("leaf", new THREE.IcosahedronGeometry(0.15, 0).translate(w.x - w.hw + 0.3, w.y0 + 0.3, -D + 0.16));
  }
  return B;
}

/** Sách trên giá: một InstancedMesh, màu theo từng cuốn (gáy sách nhiều màu trầm) */
function buildBooks() {
  const r = rand(2026);
  const pal = ["#694936", "#46576c", "#83917d", "#7a3438", "#c49a5a", "#3f4a3c", "#8b5a3c", "#5b4a6e", "#d8c4a0", "#2f3b4a", "#9c6b4a"].map((c) => new THREE.Color(c));
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const lv = (SHELF_H - 0.15) / SHELF_LEVELS;
  for (const run of SHELF_RUNS) {
    const x = run.side * (W - SHELF_DEPTH / 2);
    for (let i = 0; i < SHELF_LEVELS; i++) {
      const y0 = 0.125 + i * lv;
      let z = run.z0 + 0.06;
      while (z < run.z1 - 0.08) {
        // chừa khoảng trống ngẫu nhiên (giá không đầy kín — trông "được dùng")
        if (r() < 0.06) {
          z += 0.12 + r() * 0.25;
          continue;
        }
        const t = 0.025 + r() * 0.035;
        const h = lv * (0.62 + r() * 0.3);
        const d = SHELF_DEPTH * (0.6 + r() * 0.25);
        const lean = r() < 0.05 ? (r() - 0.5) * 0.5 : 0;
        e.set(lean, 0, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x + run.side * (SHELF_DEPTH / 2 - d / 2 - 0.03), y0 + h / 2, z + t / 2), q, new THREE.Vector3(d, h, t));
        mats.push(m.clone());
        const c = pal[Math.floor(r() * pal.length)].clone().multiplyScalar(0.8 + r() * 0.35);
        cols.push(c);
        z += t + 0.004;
      }
    }
  }
  return { mats, cols };
}

const MAT_KEYS = ["wall", "panel", "dark", "wood", "ceil", "stone", "soot", "log", "cushion", "brass", "shade", "bulb", "paper", "cover", "cup", "tea", "door", "pot", "leaf"] as const;

export function StudyDecor() {
  const room = useMemo(() => {
    const B = buildRoom();
    const geos = Object.fromEntries(MAT_KEYS.map((k) => [k, B.merged(k)])) as Record<(typeof MAT_KEYS)[number], THREE.BufferGeometry | null>;
    const mats: Record<(typeof MAT_KEYS)[number], THREE.Material> = {
      wall: toon("#e6d3b3"),
      panel: toon("#694936"),
      dark: toon("#4a3020"),
      wood: toon("#8a5d3b"),
      ceil: toon("#3d281b"),
      stone: toon("#8f8378"),
      soot: new THREE.MeshBasicMaterial({ color: "#140c08" }),
      log: toon("#5a3a24"),
      cushion: toon("#83917d"),
      brass: toon("#c9a25a", { emissive: "#3a2808" }),
      shade: new THREE.MeshToonMaterial({ color: "#2f6b4f", emissive: "#1d5a3c", emissiveIntensity: 0.9, gradientMap: warmGrad(), side: THREE.DoubleSide }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd08a").multiplyScalar(2.2), toneMapped: false }),
      paper: toon("#f4ead6"),
      cover: toon("#46576c"),
      cup: toon("#e9e2d6"),
      tea: new THREE.MeshBasicMaterial({ color: "#7a4a22" }),
      door: toon("#5b3a26"),
      pot: toon("#b8674a"),
      leaf: toon("#5f8a55"),
    };
    return { geos, mats };
  }, []);
  const floorTex = useMemo(() => {
    const t = plankTexture();
    t.repeat.set(3.5, 3.2);
    return t;
  }, []);
  const rugTex = useMemo(() => rugTexture(), []);
  const floorMat = useMemo(() => toon("#ffffff", { map: floorTex }), [floorTex]);
  const rugMat = useMemo(() => toon("#ffffff", { map: rugTex }), [rugTex]);
  const books = useMemo(() => buildBooks(), []);
  const bookMesh = useRef<THREE.InstancedMesh>(null);
  const bookMat = useMemo(() => toon("#ffffff"), []);
  const bookGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => {
    const im = bookMesh.current;
    if (!im) return;
    books.mats.forEach((m, i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, books.cols[i]);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [books]);
  useEffect(
    () => () => {
      Object.values(room.geos).forEach((g) => g?.dispose());
      Object.values(room.mats).forEach((m) => m.dispose());
      floorTex.dispose();
      rugTex.dispose();
      floorMat.dispose();
      rugMat.dispose();
      bookMat.dispose();
      bookGeo.dispose();
    },
    [room, floorTex, rugTex, floorMat, rugMat, bookMat, bookGeo],
  );
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floorMat}>
        <planeGeometry args={[W * 2, D * 2]} />
      </mesh>
      {/* thảm lối giữa (từ cửa tới tấm Lời thề) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -0.4]} material={rugMat}>
        <planeGeometry args={[2.3, 10.6]} />
      </mesh>
      {MAT_KEYS.map((k) => (room.geos[k] ? <mesh key={k} geometry={room.geos[k]!} material={room.mats[k]} /> : null))}
      <instancedMesh ref={bookMesh} args={[bookGeo, bookMat, books.mats.length]} frustumCulled={false} />
      <LampGlow />
      <Fire />
      <Dust />
    </group>
  );
}

/** Vệt sáng đèn bàn trên mặt bàn + quầng sáng đèn treo trên sàn (cộng màu, không cần đèn thật) */
function LampGlow() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => glowTexture(), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.85 }), [tex]);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const spots = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (const t of TABLES) out.push([t.x, TABLE.h + 0.004, t.z - 0.05, 1.9]);
    for (const z of [-3.6, 0, 3.4]) out.push([0, 0.012, z, 3.2]);
    return out;
  }, []);
  useEffect(() => {
    const im = ref.current;
    if (!im) return;
    const m = new THREE.Matrix4();
    spots.forEach(([x, y, z, s], i) => im.setMatrixAt(i, m.makeScale(s, 1, s * 0.7).setPosition(x, y, z)));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [spots]);
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
      geo.dispose();
    },
    [tex, mat, geo],
  );
  return <instancedMesh ref={ref} args={[geo, mat, spots.length]} renderOrder={1} />;
}

const fireShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      vec2 p = vUv;
      float t = uTime;
      float q = n(vec2(p.x * 5.0, p.y * 3.0 - t * 2.2)) * 0.6 + n(vec2(p.x * 11.0, p.y * 6.0 - t * 3.7)) * 0.4;
      float w = 1.0 - abs(p.x - 0.5) * 2.0;
      float flame = smoothstep(0.0, 0.5, w * (1.15 - p.y) - q * 0.55 + 0.1);
      vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.45), smoothstep(0.2, 0.9, flame * (1.0 - p.y)));
      gl_FragColor = vec4(col * 2.2, flame * smoothstep(1.0, 0.6, p.y));
    }`,
};

/** Lửa lò sưởi (một tấm shader cộng màu) + đèn điểm chập chờn — chế độ tập trung thì lửa cháy chậm, đèn đứng yên */
function Fire() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...fireShader, uniforms: THREE.UniformsUtils.clone(fireShader.uniforms), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const light = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    const focus = useStudy.getState().focus;
    t.current += Math.min(0.05, dt) * (focus ? 0.35 : 1);
    mat.uniforms.uTime.value = t.current;
    if (light.current) light.current.intensity = focus ? 9 : 9 + Math.sin(t.current * 9.1) * 1.2 + Math.sin(t.current * 23.7) * 0.8;
  });
  const x = -W + FIREPLACE.depth - 0.02;
  return (
    <group>
      <mesh position={[x, 0.42, FIREPLACE.z]} rotation-y={Math.PI / 2} material={mat}>
        <planeGeometry args={[1.05, 0.75]} />
      </mesh>
      <pointLight ref={light} position={[x + 0.5, 0.7, FIREPLACE.z]} color="#ff8a3d" intensity={9} distance={7} decay={1.6} />
    </group>
  );
}

/** Bụi lơ lửng trong ánh đèn (rất ít hạt); tập trung → đứng yên */
function Dust() {
  const N = 70;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const r = rand(5);
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (r() - 0.5) * 8;
      p[i * 3 + 1] = 0.6 + r() * 3.6;
      p[i * 3 + 2] = (r() - 0.5) * 10;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: "#ffe2a8", size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const ref = useRef<THREE.Points>(null);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame((st) => {
    if (!ref.current || useStudy.getState().focus) return;
    const t = st.clock.elapsedTime;
    ref.current.position.set(Math.sin(t * 0.07) * 0.3, Math.sin(t * 0.11) * 0.15, Math.cos(t * 0.05) * 0.3);
    ref.current.rotation.y = t * 0.01;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}
