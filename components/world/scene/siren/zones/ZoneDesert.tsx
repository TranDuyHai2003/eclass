"use client";
/**
 * Khu "Sa Mạc Tấm Đồng" (lib/world/zones/bronzeDesert.ts): tấm đồng khắc guilloche 64 × 64 m giữa hai bờ cát, đài quan sát
 * dựng từ máy đếm nhịp + âm thoa, bọ gom cát đẩy cát dọc đường nút, mặt trời đồng khắc trên trời trắng nóng.
 * Luật: cần gạt đổi mode (m, n) → cát dồn về đường nút (F ≈ 0, CÙNG hàm chladni với luật), bụng sóng rung nóng đỏ;
 * đứng trên bụng > 0,6 s → bị hất về bờ gần. Đúng mode → hai cổng sáng, có đường cát nối hai bờ.
 * Bờ Đông: sân phù thuỷ Gối Xếp Im (siren/witches/GoiXepIm.tsx — tải lười, lỗi thì hiện dấu chờ) + cửa đồng về đáy hub.
 * Lệnh vẽ: cát nền 1 · tấm đồng 1 · khối đồng (lan can, thang, cần gạt) 1 · cồn cát 1 · hình cắt giấy 1 (+ cửa, phù thuỷ).
 */
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHLADNI_GLSL, HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { t as tt, type Lang } from "@/lib/world/i18n";
import { ZONE_DEFS, ZONE_DYN, ZONE_FLAGS, type V3 } from "@/lib/world/zoneGraph";
import { DANGER, DESERT_COLLIDERS, DESERT_HALF, GATE_E, GATE_W, LEVER, MODES, PLATE, SAND, SINK_S, TOWER, WITCH_ARENA, WITCH_WALL, beetleStep, nodalConnected, onPlate, plateF } from "@/lib/world/zones/bronzeDesert";
import { create } from "zustand";
import { useWorld } from "../../../store";
import { netZoneFlag } from "../../../net";
import { registerAction } from "../../../actions";
import { motion } from "../../../combat/combat";
import { floatText, Label3D } from "../../../ui/Labels";
import { reduceMotion } from "../SirenGravity";
import { synth } from "../sirenSynth";
import { CutoutBatch, createCutoutMat, type CutItem } from "./zoneMats";
import { bakeParts, useCutTex, useKit, useRepTex, useZoneGroup } from "./zoneHooks";
import { ZONE_RT, teleportLocal, useZones, zoneHint } from "./zoneRuntime";

const O = ZONE_DEFS.desert.origin;
/** mode hiện tại (trời + lỗ cửa đọc) */
export const DESERT_SKY = { m: MODES[0][0], n: MODES[0][1] };
const DS = { mode: 0, prev: 0, at: -1e9, dangerT: 0, told: -1 };
const useDesertUi = create<{ mode: number }>(() => ({ mode: DS.mode }));

/** đổi mode tấm đồng (cần gạt của mình hoặc của người khác cùng phòng — tin "zf") */
function setDesertMode(i: number) {
  if (i === DS.mode) return;
  DS.prev = DS.mode;
  DS.mode = i;
  DS.at = performance.now();
  DS.told = -1;
  const [m, n] = MODES[i];
  DESERT_SKY.m = m;
  DESERT_SKY.n = n;
  useDesertUi.setState({ mode: i });
}
/** mode do người khác gạt (đã kẹp vào danh sách MODES) */
export function desertShared(i: number) {
  if (!Number.isInteger(i) || i < 0 || i >= MODES.length || i === DS.mode) return;
  setDesertMode(i);
  if (ZONE_RT.id === "desert") synth.impact("metal", 5);
}
/** chỉ gửi lại khi chính mình đã từng gạt (người mới vào không ghi đè mode của phòng) */
export const desertLocal = (): Record<string, number> => (DS.at > 0 ? { desert: DS.mode } : {});
const BEETLES = 8;

/** vách vải phù thuỷ dựng / hạ → bật tường chặn (lib: WITCH_WALL); vách dựng lên ngay chỗ người chơi đứng → đẩy ra phía trước vách */
function witchWall(up: boolean) {
  ZONE_FLAGS[WITCH_WALL.flag] = up;
  if (!up) return;
  const p = useWorld.getState().player;
  const lx = p.x - O[0];
  const lz = p.z - O[2];
  // vách dọc trục z ở x = WITCH_WALL.x; người chơi đánh từ phía Tây (−x)
  if (Math.abs(lx - WITCH_WALL.x) < WITCH_WALL.half + 0.45 && Math.abs(lz - WITCH_WALL.z) < WITCH_WALL.L / 2 + 0.45) p.x = O[0] + WITCH_WALL.x - WITCH_WALL.half - 0.5;
}

export function desertNearby(l: V3, lang: Lang) {
  if (Math.hypot(l[0] - LEVER.x, l[2] - LEVER.z) > 2.2 || l[1] > 1) return null;
  const [m, n] = MODES[DS.mode];
  return { kind: "action" as const, id: "zone:desert:lever", label: tt(lang, "dsLever", { m, n }) };
}

// tấm đồng: vân đồng + cát dồn về đường nút (chuyển dần từ mode cũ) + bụng sóng rung nóng + cổng
const PLATE_VERT = /* glsl */ `
varying vec2 vP;
varying float vFogDepth;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = position.xy * vec2(1.0, -1.0);
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PLATE_FRAG = /* glsl */ `
${CHLADNI_GLSL}
uniform sampler2D uBronze;
uniform sampler2D uSand;
uniform vec2 uMode;
uniform vec2 uPrev;
uniform float uSettle;
uniform float uTime;
uniform float uCalm;
uniform float uHalf;
uniform float uConn;
uniform vec2 uGates;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vP;
varying float vFogDepth;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 q = vP / uHalf;
  float a = abs(chladni(q, uMode.x, uMode.y));
  float ap = abs(chladni(q, uPrev.x, uPrev.y));
  float g = hsh(floor(vP * 9.0));
  float sNow = 1.0 - smoothstep(${SAND.toFixed(3)} * 0.5, ${DANGER.toFixed(3)}, a + (g - 0.5) * 0.08);
  float sPrev = 1.0 - smoothstep(${SAND.toFixed(3)} * 0.5, ${DANGER.toFixed(3)}, ap + (g - 0.5) * 0.08);
  float sand = mix(sPrev, sNow, uSettle);
  vec3 bronze = texture2D(uBronze, vP * 0.045).rgb;
  // vân guilloche đồng tâm khắc trên tấm
  float r = length(vP);
  bronze *= 0.9 + 0.1 * sin(r * 3.0 + 4.0 * sin(atan(vP.y, vP.x) * 6.0));
  vec3 sandC = texture2D(uSand, vP * 0.11).rgb * 1.05;
  float danger = smoothstep(${DANGER.toFixed(3)}, ${DANGER.toFixed(3)} + 0.3, a) * uSettle;
  float vib = uCalm > 0.5 ? 0.5 : 0.5 + 0.5 * sin(uTime * 34.0 + a * 22.0 + g * 6.0);
  vec3 c = mix(bronze, bronze * vec3(1.3, 0.78, 0.55) + vec3(0.22, 0.03, 0.0) * vib, danger * 0.75);
  // hạt cát nhảy trên bụng (12 Hz)
  float hop = step(0.985, hsh(floor(vP * 14.0) + floor(uTime * 12.0) * (1.0 - uCalm)));
  c = mix(c, sandC * 1.2, hop * danger * 0.6);
  c = mix(c, sandC, smoothstep(0.3, 0.7, sand));
  // vệt nút mảnh khắc lam ở tâm đường cát
  c = mix(c, vec3(0.25, 0.42, 0.5), (1.0 - smoothstep(0.0, 0.04, a)) * uSettle * 0.45);
  // cổng hai bờ: viền sáng (vàng khi có đường nối)
  float gw = 1.0 - smoothstep(1.6, 2.4, length(vP - vec2(-uHalf, uGates.x * uHalf)));
  float ge = 1.0 - smoothstep(1.6, 2.4, length(vP - vec2(uHalf, uGates.y * uHalf)));
  c = mix(c, mix(vec3(0.85, 0.55, 0.9), vec3(1.2, 0.95, 0.45), uConn), (gw + ge) * 0.5);
  c = mix(c, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.9);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Phù thuỷ Gối Xếp Im: tải lười (file do nhánh phù thuỷ sở hữu); lỗi → dấu chờ */
const GoiXepIm = lazy(() => import("../witches/GoiXepIm").then((m) => ({ default: m.GoiXepIm })));
class WitchGuard extends Component<{ children: ReactNode; onFail: () => void }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("[desert] không gắn được Gối Xếp Im — dùng dấu chờ:", e);
    this.props.onFail();
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}

export function ZoneDesert() {
  const g = useZoneGroup("desert");
  const tex = useCutTex();
  const bronzeTex = useRepTex("bronze", 1, 1);
  const sandTex = useRepTex("sand", 1, 1);
  const sandFloor = useRepTex("sand", DESERT_HALF.x / 5, DESERT_HALF.z / 5);
  const rm = useMemo(() => reduceMotion(), []);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const here = useZones((s) => s.zone === "desert");
  const [witchFail, setWitchFail] = useState(false);
  const modeIdx = useDesertUi((u) => u.mode);

  const plateMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: PLATE_VERT,
      fragmentShader: PLATE_FRAG,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uBronze: { value: null }, uSand: { value: null }, uMode: { value: new THREE.Vector2() }, uPrev: { value: new THREE.Vector2() }, uSettle: { value: 1 }, uTime: { value: 0 }, uCalm: { value: 0 }, uHalf: { value: PLATE.half }, uConn: { value: 0 }, uGates: { value: new THREE.Vector2(GATE_W, GATE_E) } },
      ]),
    });
    m.uniforms.uBronze.value = bronzeTex;
    m.uniforms.uSand.value = sandTex;
    return m;
  }, [bronzeTex, sandTex]);

  // ── đồ đồng dựng tay (Blender — zoneHooks.useKit): lan can mép tấm (đoạn 2 m có cột + vòng guilloche, khoét cổng), bậc có mũi,
  //    sàn đài tròn, đế máy đếm nhịp của cần gạt → GỘP thành 1 hình tĩnh (1 lệnh vẽ); cần gạt riêng (lắc lò xo)
  const kit = useKit(["zk_rail", "zk_step", "zk_disc", "zk_lever_b", "zk_lever_a", "zk_dune"] as const);
  const { bronze, arm } = useMemo(() => {
    const M = (x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sx, sy, sz));
    const rails: THREE.Matrix4[] = [];
    for (const w of DESERT_COLLIDERS.walls)
      if (w.id.startsWith("e")) {
        // tường dọc z → lan can quay π/2; chia đoạn 2 m (co nhẹ cho khít chiều dài)
        const L = Math.max(w.hx, w.hz) * 2;
        const n = Math.max(1, Math.round(L / 2));
        const along = w.hz > w.hx;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          rails.push(M(w.x + (along ? 0 : t * L), -0.05, w.z + (along ? t * L : 0), along ? Math.PI / 2 : 0, L / n / 2, 1, 1));
        }
      }
    const steps: THREE.Matrix4[] = [];
    for (const st of DESERT_COLLIDERS.surfs) if (st.id.startsWith("towerSt")) steps.push(M(st.x, st.y, st.z, st.yaw ?? 0, (st.hx ?? 1) * 2, 0.35, (st.hz ?? 0.3) * 2));
    const geo = bakeParts([
      { geo: kit.zk_rail, at: rails },
      { geo: kit.zk_step, at: steps },
      { geo: kit.zk_disc, at: [M(TOWER.x, TOWER.top, TOWER.z)] },
      { geo: kit.zk_lever_b, at: [M(LEVER.x, 0, LEVER.z)] },
    ]);
    const mat = new THREE.MeshLambertMaterial({ color: "#e6b27a", map: bronzeTex });
    const bronze = new THREE.Mesh(geo, mat);
    bronze.name = "perf:desert:bronze";
    const arm = new THREE.Mesh(kit.zk_lever_a, mat);
    arm.position.set(LEVER.x, 1.2, LEVER.z);
    return { bronze, arm };
  }, [bronzeTex, kit]);
  // ── cồn cát lưỡi liềm (barchan, Blender): gió Tây → sừng chỉ về phía Đông; to nhỏ + lệch hướng nhẹ cho khỏi lặp
  const dunes = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    for (const w of DESERT_COLLIDERS.walls)
      if (w.id.startsWith("d")) {
        const L = Math.max(w.hx, w.hz) * 2;
        const n = Math.max(2, Math.round(L / 7));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          pts.push([w.x + (w.hx > w.hz ? t * L : 0), w.z + (w.hx > w.hz ? 0 : t * L), 3 + ((i * 7) % 5), Math.sin(i * 2.3 + w.x) * 0.35]);
        }
      }
    const mesh = new THREE.InstancedMesh(kit.zk_dune, new THREE.MeshLambertMaterial({ map: sandFloor }), pts.length);
    const M = new THREE.Matrix4();
    const E = new THREE.Euler();
    pts.forEach(([x, z, s, yaw], i) => mesh.setMatrixAt(i, M.compose(new THREE.Vector3(x, -0.22, z), new THREE.Quaternion().setFromEuler(E.set(0, yaw, 0)), new THREE.Vector3(s * 1.7, s * 0.62, s * 1.15))));
    mesh.frustumCulled = false;
    mesh.name = "perf:desert:dunes";
    return mesh;
  }, [sandFloor, kit]);

  // ── hình cắt giấy: đài quan sát, bọ gom cát, cánh gà ở hai cổng, dấu chờ sân phù thuỷ, bóng xa
  const { batch, mat, iBeetle, iWitch } = useMemo(() => {
    const items: CutItem[] = [{ cut: "tower", at: [TOWER.x - 0.6, -0.2, TOWER.z - 3.6], w: 5.6, yaw: Math.PI / 2 }];
    const iBeetle = items.length;
    for (let i = 0; i < BEETLES; i++) items.push({ cut: "beetle_a", at: [0, 0, 0], w: 1.7, bill: 1 });
    for (const [x, gv] of [
      [-PLATE.half - 0.6, GATE_W],
      [PLATE.half + 0.6, GATE_E],
    ] as const) {
      const z = gv * PLATE.half;
      items.push({ cut: "curtain", at: [x, -0.1, z - 2.9], w: 1.9, yaw: x < 0 ? Math.PI / 2 : -Math.PI / 2, sway: 0.04 });
      items.push({ cut: "curtain", at: [x, -0.1, z + 2.9], w: 1.9, yaw: x < 0 ? -Math.PI / 2 : Math.PI / 2, sway: 0.04 });
    }
    const iWitch = items.length;
    items.push({ cut: "curtain", at: [WITCH_ARENA.x, 0, WITCH_ARENA.z], w: 4.2, yaw: -Math.PI / 2, sway: 0.08, tint: [0.95, 0.8, 0.9] });
    items.push({ cut: "board", at: [-20, -14, -190], w: 70, yaw: 0.1, sil: 0.6 });
    items.push({ cut: "crab_b", at: [170, -10, 120], w: 50, yaw: -2.2, sil: 0.65 });
    items.push({ cut: "chair", at: [-150, -6, 160], w: 24, yaw: 2.6, sil: 0.65 });
    const mat = createCutoutMat(tex, "#a8743a");
    return { batch: new CutoutBatch(items, mat), mat, iBeetle, iWitch };
  }, [tex]);

  useEffect(
    () => () => {
      batch.dispose();
      mat.dispose();
      plateMat.dispose();
      bronze.geometry.dispose();
      (bronze.material as THREE.Material).dispose();
      arm.geometry.dispose();
      kit.zk_rail.dispose();
      kit.zk_step.dispose();
      kit.zk_disc.dispose();
      kit.zk_lever_b.dispose();
      dunes.geometry.dispose();
      (dunes.material as THREE.Material).dispose();
      dunes.dispose();
    },
    [batch, mat, plateMat, bronze, arm, dunes, kit],
  );

  // ── cần gạt
  useEffect(() => {
    const off = registerAction("zone:desert:lever", () => {
      setDesertMode((DS.mode + 1) % MODES.length);
      netZoneFlag("desert", DS.mode);
      const [m, n] = MODES[DS.mode];
      const lg: Lang = useWorld.getState().lang === "vi" ? "vi" : "en";
      floatText(new THREE.Vector3(LEVER.x + O[0], 2.6, LEVER.z + O[2]), `(${m}, ${n})`, "crit");
      zoneHint(tt(lg, "dsMode", { m, n }));
      synth.impact("metal", 7);
      synth.bell(55 * (m + n), 0.4, 5);
    });
    return off;
  }, []);

  const S = useRef({
    beetles: (() => {
      const st = new Float32Array(BEETLES * 3);
      for (let i = 0; i < BEETLES; i++) {
        st[i * 3] = Math.cos(i * 2.4) * 18;
        st[i * 3 + 1] = Math.sin(i * 1.7) * 18;
        st[i * 3 + 2] = i % 2 ? 1 : -1;
      }
      return st;
    })(),
    prev: new Float32Array(BEETLES * 2),
    lever: { x: 0, v: 0 } as Spring,
    beat: -1,
    introAt: -1e9,
  });
  useFrame((_, rawDt) => {
    if (ZONE_RT.id !== "desert") return;
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const w = useWorld.getState();
    const lg: Lang = w.lang === "vi" ? "vi" : "en";
    const st = S.current;
    const [m, n] = MODES[DS.mode];
    const [pm, pn] = MODES[DS.prev];
    DESERT_SKY.m = m;
    DESERT_SKY.n = n;
    const settle = Math.min(1, (now - DS.at) / 1400);
    const conn = nodalConnected(m, n);
    const u = plateMat.uniforms;
    (u.uMode.value as THREE.Vector2).set(m, n);
    (u.uPrev.value as THREE.Vector2).set(pm, pn);
    u.uSettle.value = settle;
    u.uTime.value = HARMONIC.time;
    u.uCalm.value = rm ? 1 : 0;
    u.uConn.value = conn ? settle : 0;
    mat.uniforms.uTime.value = rm ? 0 : HARMONIC.time;
    mat.uniforms.uCollage.value = HARMONIC.collageTime;
    mat.uniforms.uBoil.value = rm ? 0 : 1;
    if (settle >= 1 && DS.told !== DS.mode) {
      DS.told = DS.mode;
      if (DS.at > 0) zoneHint(tt(lg, conn ? "dsPath" : "dsNoPath"));
      if (conn && DS.at > 0) synth.resolve(220);
    }
    const lx = w.player.x - O[0];
    const ly = w.player.y - O[1];
    const lz = w.player.z - O[2];
    if (now - st.introAt > 60000 && lx < -30) {
      st.introAt = now;
      zoneHint(tt(lg, "dsIntro"));
    }
    // ── bụng sóng hất người: lún dần (mặt động dyn 0), quá SINK_S giây → về bờ gần
    const onIt = onPlate(lx, lz) && ly < 0.6 && motion.grounded;
    if (onIt && Math.abs(plateF(lx, lz, m, n)) > DANGER && settle > 0.6) {
      DS.dangerT += dt;
      if (!rm && Math.floor(DS.dangerT * 10) !== Math.floor((DS.dangerT - dt) * 10)) w.addShake(0.05);
    } else DS.dangerT = Math.max(0, DS.dangerT - dt * 2);
    ZONE_DYN[0] = Math.min(0.35, (DS.dangerT / SINK_S) * 0.35);
    if (DS.dangerT > SINK_S) {
      DS.dangerT = 0;
      ZONE_DYN[0] = 0;
      const west = lx < 0;
      teleportLocal("desert", west ? [-35, 0, GATE_W * PLATE.half] : [35, 0, GATE_E * PLATE.half], "bronze");
      zoneHint(tt(lg, "dsSank"));
      synth.impact("metal", 9);
      synth.dissonant(110, 0.6, 0.35);
    }
    // ── bọ gom cát: bò dọc đường nút, flipbook 8 Hz, lật theo hướng bò trên màn hình
    const B = st.beetles;
    const fr = Math.floor(HARMONIC.stopTime * 8) % 2 ? "beetle_b" : "beetle_a";
    for (let i = 0; i < BEETLES; i++) {
      st.prev[i * 2] = B[i * 3];
      st.prev[i * 2 + 1] = B[i * 3 + 1];
      beetleStep(B, i, m, n, dt * (rm ? 0.5 : 1));
      const vx = B[i * 3] - st.prev[i * 2];
      const vz = B[i * 3 + 1] - st.prev[i * 2 + 1];
      // hướng phải màn hình ≈ (cos yaw máy quay, −sin yaw máy quay)
      const right = vx * Math.cos(w.camYaw) - vz * Math.sin(w.camYaw);
      batch.flip(iBeetle + i, right >= 0 ? 1 : -1);
      batch.frame(iBeetle + i, fr);
      batch.place(iBeetle + i, B[i * 3], 0.02, B[i * 3 + 1], 0, 1.7, 1.7 / 1.6137);
    }
    // dấu chờ sân phù thuỷ chỉ hiện khi chưa gắn được phù thuỷ
    batch.place(iWitch, WITCH_ARENA.x, witchFail ? 0 : -50, WITCH_ARENA.z, -Math.PI / 2, 4.2, 4.2 / 0.5461);
    batch.needs();
    // ── cần gạt: lò xo vượt đích mỗi lần gạt
    springStep(st.lever, DS.mode % 2 ? 0.7 : -0.7, 14, 0.3, dt);
    arm.rotation.x = st.lever.x;
    // ── âm nền: tiếng đồng ngân theo mode mỗi 2 ô nhịp, bọ lách cách theo phách
    const bi = Math.floor(HARMONIC.beat);
    if (bi !== st.beat) {
      st.beat = bi;
      if (bi % 8 === 0) synth.bell(55 * (m + n), 0.12, 6);
      if (bi % 2 === 1) synth.impact("wood", 0.9);
    }
  });

  const [mm, nn] = MODES[modeIdx];
  return (
    <>
    <group ref={g} position={O}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.04} name="perf:desert:sand">
        <planeGeometry args={[DESERT_HALF.x * 2 + 30, DESERT_HALF.z * 2 + 30]} />
        <meshLambertMaterial map={sandFloor} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} material={plateMat} name="perf:desert:plate">
        <planeGeometry args={[PLATE.half * 2, PLATE.half * 2]} />
      </mesh>
      <primitive object={bronze} />
      <primitive object={arm} />
      <primitive object={dunes} />
      <primitive object={batch.mesh} />
      <Label3D text={`${tt(lang, "dsTower")} · (${mm}, ${nn})`} position={[TOWER.x, TOWER.top + 4.2, TOWER.z]} maxDist={90} />
      <Label3D text={tt(lang, "dsGateW")} position={[-PLATE.half - 1, 3.6, GATE_W * PLATE.half]} maxDist={60} />
      <Label3D text={tt(lang, "dsGateE")} position={[PLATE.half + 1, 3.6, GATE_E * PLATE.half]} maxDist={60} />
      {(!here || witchFail) && <Label3D text={tt(lang, "dsWitch")} position={[WITCH_ARENA.x, 9.2, WITCH_ARENA.z]} maxDist={70} />}
    </group>
      {here && !witchFail && (
        <WitchGuard onFail={() => setWitchFail(true)}>
          <Suspense fallback={null}>
            <GoiXepIm origin={{ x: WITCH_ARENA.x + O[0], y: O[1], z: WITCH_ARENA.z + O[2] }} radius={WITCH_ARENA.r} yaw={WITCH_ARENA.yaw} onWall={witchWall} />
          </Suspense>
        </WitchGuard>
      )}
    </>
  );
}
