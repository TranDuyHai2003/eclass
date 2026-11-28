"use client";
/**
 * Khu "Biển Phím Không Bờ" (lib/world/zones/keySea.ts): bàn phím sứ khổng lồ 3 quãng tám nổi trên biển giấy than gợn sóng,
 * đồi phím sứ lặp theo chu kỳ 12 phím ở hai bên chân trời, ghế gập chìm nửa thân trôi trên biển, trăng sứ nứt men.
 * Men phím theo LỚP CAO ĐỘ (12 màu lặp mỗi quãng tám) → mắt thấy được phép lặp. Bước lên phím kêu nốt C3·2^(k/12).
 * Cua Kẹp Quãng kẹp một phím; đứng lên phím cùng tên ở quãng trên + F; bảng đo f₁, f₂, f₂ ÷ f₁. Ba vòng → hạ đê sứ.
 * Lệnh vẽ: biển 1 · phím trắng + bến 1 · phím đen + đê 1 · đồi phím 1 · hình cắt giấy 1 (+ cửa: DoorSet).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { fmtNum, t as tt, type Lang } from "@/lib/world/i18n";
import { ZONE_DEFS, ZONE_DYN, ZONE_FLAGS, type V3 } from "@/lib/world/zoneGraph";
import { CRAB_Z, DIKE, KB, KEY_DYN0, KEY_N, KEYS_HALF, OCTAVE_ROUNDS, PIER_E, PIER_W, SEA_Y, isBlack, isOctave, keyAt, keyFreq, keyX, noteName, pitchClass } from "@/lib/world/zones/keySea";
import { useWorld } from "../../../store";
import { registerAction } from "../../../actions";
import { rollDrops } from "../../../combat/items";
import { floatText, Label3D } from "../../../ui/Labels";
import { reduceMotion } from "../SirenGravity";
import { synth } from "../sirenSynth";
import { CutoutBatch, createCutoutMat, type CutItem } from "./zoneMats";
import { useCutTex, useRepTex, useZoneGroup } from "./zoneHooks";
import { ZONE_RT, zoneHint } from "./zoneRuntime";

const O = ZONE_DEFS.keys.origin;
const KY = { round: 0, done: false, meter: "", here: -1 };

function standingKey(l: V3): number {
  const k = keyAt(l[0], l[2]);
  if (k < 0) return -1;
  const top = isBlack(k) ? KB.blackTop : KB.top;
  return Math.abs(l[1] - (top - ZONE_DYN[KEY_DYN0 + k])) < 0.45 ? k : -1;
}

export function keysNearby(l: V3, lang: Lang) {
  if (KY.done) return null;
  const k = standingKey(l);
  if (k < 0) return null;
  return { kind: "action" as const, id: "zone:keys:pick", label: tt(lang, "kyPick", { k: noteName(k, lang), f: fmtNum(keyFreq(k), lang, 1) }) };
}

/** men theo lớp cao độ (12 màu, lặp mỗi quãng tám) */
function glaze(pc: number, black: boolean, out: THREE.Color) {
  return out.setHSL(pc / 12, black ? 0.45 : 0.62, black ? 0.2 : 0.74);
}

const SEA_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFogDepth;
varying float vH;
void main(){
  vUv = uv;
  vec3 p = position;
  float h = sin(p.x * 0.09 + uTime * 0.6) * 0.35 + sin(p.y * 0.13 - uTime * 0.45) * 0.25 + sin((p.x + p.y) * 0.31 + uTime * 1.1) * 0.08;
  p.z += h;
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SEA_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vFogDepth;
varying float vH;
void main(){
  vec3 c = texture2D(uMap, vUv * 40.0).rgb;
  c *= 0.9 + vH * 0.5;
  // dải sáng như vệt giấy than chưa in hết
  c += vec3(0.2, 0.25, 0.6) * smoothstep(0.42, 0.6, vH) * 0.4;
  c = mix(c, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.92);
  gl_FragColor = vec4(c, 1.0);
}`;

export function ZoneKeys() {
  const g = useZoneGroup("keys");
  const tex = useCutTex();
  const porc = useRepTex("porcelain", 1, 1);
  const carbon = useRepTex("carbon", 1, 1);
  const rm = useMemo(() => reduceMotion(), []);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [meter, setMeter] = useState("");
  const [round, setRound] = useState(KY.round);

  const seaMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uTime: { value: 0 } }]) }),
    [],
  );
  useMemo(() => {
    seaMat.uniforms.uMap.value = carbon;
  }, [seaMat, carbon]);

  // ── phím trắng (+ 2 bến + nền đê) và phím đen (+ đê): hộp đơn vị co giãn theo instance
  const { white, black, hills, M } = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, -0.5, 0);
    const wm = new THREE.MeshLambertMaterial({ map: porc });
    const bm = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    const whites = [...Array(KEY_N).keys()].filter((k) => !isBlack(k));
    const blacks = [...Array(KEY_N).keys()].filter((k) => isBlack(k));
    const white = new THREE.InstancedMesh(box, wm, whites.length + 3);
    const black = new THREE.InstancedMesh(box, bm, blacks.length + 1);
    const M = new THREE.Matrix4();
    const C = new THREE.Color();
    whites.forEach((k, i) => {
      white.setMatrixAt(i, M.compose(new THREE.Vector3(keyX(k), KB.top, 0), new THREE.Quaternion(), new THREE.Vector3(KB.W - 0.08, 1.4, KB.LEN)));
      white.setColorAt(i, glaze(pitchClass(k), false, C));
    });
    const piers: [number, number, number][] = [
      [PIER_W.x, PIER_W.hx * 2, PIER_W.hz * 2],
      [PIER_E.x, PIER_E.hx * 2, PIER_E.hz * 2],
      [DIKE.x, 2.6, 9],
    ];
    piers.forEach(([x, sx, sz], j) => {
      white.setMatrixAt(whites.length + j, M.compose(new THREE.Vector3(x, 0, 0), new THREE.Quaternion(), new THREE.Vector3(sx, 1.6, sz)));
      white.setColorAt(whites.length + j, C.set("#f4efe6"));
    });
    blacks.forEach((k, i) => {
      black.setMatrixAt(i, M.compose(new THREE.Vector3(keyX(k), KB.blackTop, (KB.blackZ0 + KB.blackZ1) / 2), new THREE.Quaternion(), new THREE.Vector3(KB.blackW, 1.6, KB.blackZ1 - KB.blackZ0)));
      black.setColorAt(i, glaze(pitchClass(k), true, C));
    });
    black.setMatrixAt(blacks.length, M.compose(new THREE.Vector3(DIKE.x, DIKE.h, 0), new THREE.Quaternion(), new THREE.Vector3(1.2, DIKE.h + 2, DIKE.hz * 2)));
    black.setColorAt(blacks.length, C.set("#2a1d3a"));
    // đồi phím sứ hai bên: chiều cao lặp đúng chu kỳ 12 phím (mắt "nghe" được quãng tám)
    const H: [number, number, number, number][] = [];
    for (const side of [-1, 1])
      for (let r = 0; r < 4; r++)
        for (let i = 0; i < 52; i++) {
          const k = i + r * 5;
          const x = -88 + i * 3.4;
          const z = side * (17 + r * 10);
          const hgt = 1.2 + r * 2.4 + 3.2 * (0.5 + 0.5 * Math.cos((2 * Math.PI * k) / 12)) + (isBlack(k) ? 1.2 : 0);
          H.push([x, z, hgt, k]);
        }
    const hills = new THREE.InstancedMesh(box, wm, H.length);
    H.forEach(([x, z, hgt, k], i) => {
      hills.setMatrixAt(i, M.compose(new THREE.Vector3(x, SEA_Y + hgt - 0.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(k), 0, 0.04 * Math.cos(k * 1.7))), new THREE.Vector3(isBlack(k) ? 2.0 : 3.2, hgt, 8)));
      hills.setColorAt(i, glaze(pitchClass(k), isBlack(k), C));
    });
    for (const m of [white, black, hills]) m.frustumCulled = false;
    return { white, black, hills, M, whites, blacks };
  }, [porc]);
  const keySlot = useMemo(() => {
    // bán âm → (mesh, chỉ số instance)
    const s: [THREE.InstancedMesh, number][] = [];
    let wi = 0;
    let bi = 0;
    for (let k = 0; k < KEY_N; k++) s.push(isBlack(k) ? [black, bi++] : [white, wi++]);
    return s;
  }, [white, black]);

  // ── hình cắt giấy: cua, ghế chìm nửa thân trôi trên biển, bóng xa của khu khác
  const { batch, mat } = useMemo(() => {
    const items: CutItem[] = [{ cut: "crab_a", at: [keyX(OCTAVE_ROUNDS[0]), SEA_Y + 0.2, CRAB_Z], w: 4.6, bill: 1 }];
    const chairs: [number, number, number][] = [
      [-20, 14, 0.4],
      [6, -16, -1.1],
      [24, 19, 2.2],
      [-34, -13, 0.9],
      [40, -18, -0.4],
      [-6, 26, 1.6],
    ];
    for (const [x, z, yaw] of chairs) items.push({ cut: "chair", at: [x, SEA_Y - 0.9, z], w: 1.6, yaw });
    items.push({ cut: "ticket_machine", at: [-160, -12, -150], w: 30, yaw: 0.7, sil: 0.7 });
    items.push({ cut: "tower", at: [140, -10, -170], w: 24, yaw: -0.6, sil: 0.7 });
    items.push({ cut: "board", at: [10, 40, 190], w: 60, yaw: Math.PI, sil: 0.55 });
    const mat = createCutoutMat(tex, "#2a1a3a");
    return { batch: new CutoutBatch(items, mat), mat };
  }, [tex]);

  useEffect(
    () => () => {
      batch.dispose();
      mat.dispose();
      seaMat.dispose();
      white.geometry.dispose();
      (white.material as THREE.Material).dispose();
      (black.material as THREE.Material).dispose();
      [white, black, hills].forEach((m) => m.dispose());
    },
    [batch, mat, seaMat, white, black, hills],
  );

  // ── hành động: chọn phím
  useEffect(() => {
    const off = registerAction("zone:keys:pick", () => {
      if (KY.done) return;
      const p = useWorld.getState().player;
      const k2 = standingKey([p.x - O[0], p.y - O[1], p.z - O[2]]);
      if (k2 < 0) return;
      const lg: Lang = useWorld.getState().lang === "vi" ? "vi" : "en";
      const k1 = OCTAVE_ROUNDS[KY.round];
      const f1 = keyFreq(k1);
      const f2 = keyFreq(k2);
      const r = fmtNum(f2 / f1, lg, 3);
      KY.meter = tt(lg, "kyMeter", { f1: fmtNum(f1, lg, 1), f2: fmtNum(f2, lg, 1), r });
      setMeter(KY.meter);
      synth.interval(f1, f2, 0.6);
      const at = new THREE.Vector3(keyX(k2) + O[0], 2, O[2] + 2);
      if (isOctave(k1, k2)) {
        floatText(at, tt(lg, "kyRight"), "crit");
        KY.round++;
        setRound(KY.round);
        if (KY.round >= OCTAVE_ROUNDS.length) {
          KY.done = true;
          ZONE_FLAGS.dike = true;
          zoneHint(tt(lg, "kyDone"));
          setTimeout(() => synth.chord(keyFreq(12), [1, 2, 3, 4], 0.5), 500);
          for (let i = 0; i < 3; i++) rollDrops("mite", at.clone().add(new THREE.Vector3(i - 1, 0, 0)));
          useWorld.getState().burst([at.x, 2, at.z], "#9fe6ff", 70);
        } else setTimeout(() => zoneHint(tt(lg, "kyIntro", { k: noteName(OCTAVE_ROUNDS[KY.round], lg) })), 1500);
      } else floatText(at, tt(lg, "kyWrong", { k: noteName(k2, lg), r }), "info");
    });
    return off;
  }, []);

  const S = useRef({ springs: Array.from({ length: KEY_N }, () => ({ x: 0, v: 0 }) as Spring), crab: { x: keyX(OCTAVE_ROUNDS[0]), v: 0 } as Spring, dike: { x: 0, v: 0 } as Spring, beat: -1, introAt: -1e9, clampAt: -1e9 });
  const C = useMemo(() => new THREE.Color(), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const SC = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, rawDt) => {
    if (ZONE_RT.id !== "keys") return;
    const dt = Math.min(0.05, rawDt);
    const w = useWorld.getState();
    const lg: Lang = w.lang === "vi" ? "vi" : "en";
    const l: V3 = [w.player.x - O[0], w.player.y - O[1], w.player.z - O[2]];
    const st = S.current;
    seaMat.uniforms.uTime.value = rm ? 0 : HARMONIC.time;
    mat.uniforms.uTime.value = rm ? 0 : HARMONIC.time;
    mat.uniforms.uCollage.value = HARMONIC.collageTime;
    mat.uniforms.uBoil.value = rm ? 0 : 1;
    if (performance.now() - st.introAt > 60000 && !KY.done) {
      st.introAt = performance.now();
      zoneHint(tt(lg, "kyIntro", { k: noteName(OCTAVE_ROUNDS[KY.round], lg) }));
    }
    // ── phím lún dưới chân (lò xo ζ 0,35 — nảy như phím đàn), phím cua kẹp lún nhẹ + sáng
    const here = standingKey(l);
    if (here !== KY.here) {
      KY.here = here;
      if (here >= 0) {
        synth.pluck(keyFreq(here), 0.42, 1.6);
        synth.impact("glass", 1.6);
      }
    }
    const clamp = KY.done ? -1 : OCTAVE_ROUNDS[KY.round];
    let wd = false;
    let bd = false;
    for (let k = 0; k < KEY_N; k++) {
      const sp = st.springs[k];
      const target = k === here ? 0.16 : k === clamp ? 0.08 : 0;
      if (Math.abs(sp.x - target) < 1e-4 && Math.abs(sp.v) < 1e-3 && k !== clamp) continue;
      springStep(sp, target, 22, 0.35, dt);
      ZONE_DYN[KEY_DYN0 + k] = Math.max(-0.05, sp.x);
      const [mesh, i] = keySlot[k];
      const b = isBlack(k);
      P.set(keyX(k), (b ? KB.blackTop : KB.top) - sp.x, b ? (KB.blackZ0 + KB.blackZ1) / 2 : 0);
      SC.set(b ? KB.blackW : KB.W - 0.08, b ? 1.6 : 1.4, b ? KB.blackZ1 - KB.blackZ0 : KB.LEN);
      mesh.setMatrixAt(i, M.compose(P, Q, SC));
      glaze(pitchClass(k), b, C);
      if (k === clamp) C.multiplyScalar(1.25 + 0.25 * Math.sin(HARMONIC.beatPhase * Math.PI * 2));
      mesh.setColorAt(i, C);
      if (b) bd = true;
      else wd = true;
    }
    if (wd) {
      white.instanceMatrix.needsUpdate = true;
      white.instanceColor!.needsUpdate = true;
    }
    // ── đê sứ: hạ xuống khi giải xong
    const dk = st.dike;
    if (ZONE_FLAGS.dike || Math.abs(dk.v) > 1e-3) {
      springStep(dk, ZONE_FLAGS.dike ? DIKE.h + 2.4 : 0, 4, 0.8, dt);
      P.set(DIKE.x, DIKE.h - dk.x, 0);
      SC.set(1.2, DIKE.h + 2, DIKE.hz * 2);
      black.setMatrixAt(black.count - 1, M.compose(P, Q, SC));
      bd = true;
    }
    if (bd) {
      black.instanceMatrix.needsUpdate = true;
      if (black.instanceColor) black.instanceColor.needsUpdate = true;
    }
    // ── cua: bò ngang tới phím đang kẹp (lò xo), càng kẹp / mở 8 Hz khi bò, kẹp theo phách khi đứng
    const cx = clamp >= 0 ? keyX(clamp) : PIER_E.x - 6;
    springStep(st.crab, cx, 2.2, 0.9, dt);
    const moving = Math.abs(st.crab.v) > 0.3;
    const shut = moving ? Math.floor(HARMONIC.stopTime * 8) % 2 === 0 : HARMONIC.beatPhase < 0.25;
    batch.frame(0, shut ? "crab_b" : "crab_a");
    const bob = rm ? 0 : Math.abs(Math.sin(HARMONIC.time * 3)) * 0.15 * (moving ? 1 : 0.3);
    batch.place(0, st.crab.x, SEA_Y + 0.1 + bob, CRAB_Z, 0, 4.6, 4.6 / 1.1247);
    batch.needs();
    // ── âm nền: đêm biển — tiếng sứ lách cách khoá nhịp, đi vòng quanh một hợp âm (lặp mỗi quãng)
    const bi = Math.floor(HARMONIC.beat);
    if (bi !== st.beat) {
      st.beat = bi;
      if (bi % 2 === 0) synth.pluck(keyFreq(12 + [0, 7, 4, 11, 9, 4, 7, 2][(bi / 2) % 8]), 0.1, 2.6);
      if (bi % 4 === 0) synth.impact("glass", 1.1);
    }
  });

  const clampKey = round < OCTAVE_ROUNDS.length ? OCTAVE_ROUNDS[round] : -1;
  return (
    <group ref={g} position={O}>
      <mesh rotation-x={-Math.PI / 2} position-y={SEA_Y} material={seaMat} name="perf:keys:sea">
        <planeGeometry args={[KEYS_HALF.x * 10, KEYS_HALF.x * 10, 64, 64]} />
      </mesh>
      <primitive object={white} />
      <primitive object={black} />
      <primitive object={hills} />
      <primitive object={batch.mesh} />
      {[0, 12, 24].map((k) => (
        <Label3D key={k} text={noteName(k, lang)} position={[keyX(k), 1.4, -KB.LEN / 2 - 0.6]} maxDist={45} />
      ))}
      {clampKey >= 0 && <Label3D text={`${noteName(clampKey, lang)} · ${fmtNum(keyFreq(clampKey), lang, 1)} Hz → ?`} position={[keyX(clampKey), 5.4, CRAB_Z]} maxDist={60} />}
      {meter && <Label3D text={meter} position={[keyX(clampKey >= 0 ? clampKey : 24), 6.6, CRAB_Z]} maxDist={60} variant="math" />}
      <Label3D text={tt(lang, "znEnter")} position={[PIER_E.x + 3, 4.6, 0]} maxDist={30} />
    </group>
  );
}
