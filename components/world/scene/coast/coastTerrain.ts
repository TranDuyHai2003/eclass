"use client";
/**
 * Bờ Sóng — lưới địa hình thủ tục (CHỖ GIỮ: chỉ màu theo đỉnh, toon). Độ cao chỗ đi được lấy đúng coastGround (lib/world/coastWorld.ts);
 * chỗ bị chặn (vách quanh đầm, vách bắc, mép vùng) được nâng thành vách đá chỉ để nhìn.
 */
import * as THREE from "three";
import { BOUNDS, GROTTO, HEADLAND, ISLE, coastBlocked, inLagoon, natGround } from "@/lib/world/coastWorld";
import { LAGOON, smoothstep } from "@/lib/world/waves";

const C = {
  grass: new THREE.Color("#7ec46a"),
  grassDark: new THREE.Color("#5ea25a"),
  sand: new THREE.Color("#ead59c"),
  wet: new THREE.Color("#c9ad78"),
  bar: new THREE.Color("#dcc38a"),
  rock: new THREE.Color("#8f8b97"),
  rockDark: new THREE.Color("#6d6878"),
  pool: new THREE.Color("#b9c9b0"),
};

/** độ cao HIỂN THỊ: mặt đất thật + vách đá ở chỗ bị chặn */
export function visualHeight(x: number, z: number): { y: number; cliff: number } {
  const y = natGround(x, z);
  let cliff = 0;
  // vách hai bên đầm + phía tây mũi đất
  if (z < LAGOON.z1 + 1 && z > LAGOON.z0 - 1) {
    const dw = LAGOON.x0 - x;
    const de = x - LAGOON.x1;
    if (dw > 0) cliff = Math.max(cliff, smoothstep(0, 1.6, dw) * (2.6 + 0.6 * Math.sin(z * 0.9)));
    if (de > 0 && x < 13) cliff = Math.max(cliff, smoothstep(0, 1.6, de) * (2.4 + 0.5 * Math.sin(z * 1.3)) * smoothstep(13, 10.5, x));
  }
  if (z < HEADLAND.z && x < LAGOON.x0 - 5) cliff = Math.max(cliff, smoothstep(LAGOON.x0 - 5, LAGOON.x0 - 7, x) * 3.4);
  // vách bắc + hang
  if (z <= LAGOON.z0) {
    const out = Math.max(GROTTO.x0 - x, x - GROTTO.x1);
    if (out > 0) cliff = Math.max(cliff, smoothstep(0, 1.5, out) * 4.5);
    cliff = Math.max(cliff, smoothstep(GROTTO.z - 1, GROTTO.z - 3.5, z) * 6);
  }
  // mép vùng phía tây / nam
  cliff = Math.max(cliff, smoothstep(BOUNDS.x0 + 4, BOUNDS.x0, x) * 5, smoothstep(BOUNDS.z1 - 4, BOUNDS.z1, z) * (x < 0 ? 3 : 0));
  return { y: y + cliff, cliff };
}

export function buildCoastTerrain(step: number): THREE.BufferGeometry {
  const x0 = BOUNDS.x0 - 2;
  const x1 = BOUNDS.x1 + 2;
  const z0 = BOUNDS.z0 - 2;
  const z1 = BOUNDS.z1 + 2;
  const nx = Math.round((x1 - x0) / step);
  const nz = Math.round((z1 - z0) / step);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array(pos.length);
  const tmp = new THREE.Color();
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step;
      const z = z0 + j * step;
      const { y, cliff } = visualHeight(x, z);
      const k = (j * (nx + 1) + i) * 3;
      pos[k] = x;
      pos[k + 1] = Math.max(y, -3);
      pos[k + 2] = z;
      const dIsle = Math.hypot(x - ISLE.x, z - ISLE.z);
      const n = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 1.3 - x * 0.4);
      if (cliff > 0.4 || (dIsle > ISLE.flat + 0.4 && dIsle < ISLE.r + 1 && y > -1.5)) tmp.copy(C.rock).lerp(C.rockDark, n);
      else if (inLagoon(x, z)) tmp.copy(C.pool);
      else if (y > 0.95) tmp.copy(C.grass).lerp(C.grassDark, n * 0.6);
      else if (Math.abs(z) < 2.2 && x > 1 && x < 29) tmp.copy(C.bar);
      else if (y > 0.35) tmp.copy(C.sand);
      else tmp.copy(C.wet).lerp(C.sand, smoothstep(-1.2, 0.35, y) * 0.5);
      // bãi cỏ chuyển sang cát mềm
      if (y > 0.6 && y <= 0.95 && cliff < 0.4) tmp.lerp(C.grass, smoothstep(0.6, 0.95, y));
      col[k] = tmp.r;
      col[k + 1] = tmp.g;
      col[k + 2] = tmp.b;
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** đá rải dọc vách (vị trí tất định) — chỗ giữ cho mô hình đá Blender */
export function rockSpots(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = BOUNDS.x0 + r() * (BOUNDS.x1 - BOUNDS.x0);
    const z = BOUNDS.z0 + r() * (BOUNDS.z1 - BOUNDS.z0);
    const { y, cliff } = visualHeight(x, z);
    const dIsle = Math.hypot(x - ISLE.x, z - ISLE.z);
    const isleRim = dIsle > ISLE.flat + 0.3 && dIsle < ISLE.r - 0.3;
    if (!(cliff > 0.8 || isleRim) || (!coastBlocked(x, z) && !isleRim)) continue;
    out.push([x, y, z, 0.6 + r() * 1.4]);
  }
  return out;
}
