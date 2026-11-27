"use client";
/**
 * Sân khấu Monty Hall — góc đông nam sân Sảnh Bất Khả, lưng tựa tường nam, mặt quay về tâm sân.
 * Blender (`props/monty.glb`, GI nướng: đèn rọi + nắng hoàng hôn + đèn hốc): sàn tia mặt trời, khung vòm marquee,
 * rèm nhung, ba cánh cửa có bản lề (game xoay mở ra phía khán giả), giàn đèn, bục MC, bảng điểm (màn hình vẽ bằng canvas).
 * Phần thưởng (`props/monty_prizes.glb`, toon): hai chú dê chibi + xe mui trần đồ chơi có nơ.
 * Bóng đèn marquee chạy đuổi bằng shader (theo vị trí thế giới); chùm đèn rọi cộng sáng, cửa được chọn sáng nhất.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { rate } from "@/lib/world/monty";
import { bakedMaterial } from "../fx/baked";
import { toonize } from "../fx/glbToon";
import { useWorld } from "../store";
import { Avatar } from "../player/Avatar";
import { Label3D } from "../ui/Labels";
import { useMonty } from "./montyState";

const GLB = worldAsset("props/monty.glb");
const PRIZES = worldAsset("props/monty_prizes.glb");
useGLTF.preload(GLB);
useGLTF.preload(PRIZES);

/** Gốc sân khấu = giữa mép trước sàn diễn (game); sân khấu kéo về +z */
export const MONTY = { x: 12, z: 11.8 };
const DECK_H = 0.45;
/** x (tương đối) của cửa 1, 2, 3 — nhìn từ khán giả cửa 1 ở bên trái */
const DX = [2.7, 0, -2.7];
const DOOR_Z = 4.0;
const ALC_Z = 5.95;
/** MC đứng sau bục (bên trái sân khấu nhìn từ khán giả) */
export const HOST = { x: MONTY.x + 4.25, z: MONTY.z + 1.45 };
/** Chỗ đứng của người chơi (giữa sân khấu, nhìn vào ba cửa) */
export const MARK = { x: MONTY.x, z: MONTY.z + 0.5 };
const STAGE_U = { uExposure: { value: 1.18 }, uFloor: { value: 0.3 }, uTint: { value: new THREE.Color(1, 0.97, 0.95) }, uScale: { value: 3.7 } };
const CHASE = { uT: { value: 0 } };

/** Bóng đèn marquee: sáng tối chạy đuổi theo vị trí thế giới (một vật liệu cho hàng trăm bóng) */
function chaseMaterial(color: THREE.Color) {
  const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.4), toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = CHASE.uT;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform float uT;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nfloat ph = floor((vWP.x + vWP.y * 0.8) * 3.2);\nfloat on = step(0.5, fract(ph / 3.0 + uT * 1.6));\ndiffuseColor.rgb *= mix(0.32, 1.25, on);");
  };
  return m;
}

/** Màn hình bảng điểm: vẽ canvas mỗi khi số liệu đổi */
function useScoreboard() {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 512;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas, tex };
  }, []);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const tally = useMonty((s) => s.tally);
  const sim = useMonty((s) => s.sim);
  useEffect(() => {
    const g = canvas.getContext("2d");
    if (!g) return;
    const useSim = sim.stayN > 0;
    const t = useSim ? sim : tally;
    const W = canvas.width;
    const H = canvas.height;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1f45");
    bg.addColorStop(1, "#0b0d22");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // lưới điểm LED mờ
    g.fillStyle = "rgba(140,220,255,0.06)";
    for (let y = 6; y < H; y += 12) for (let x = 6; x < W; x += 12) g.fillRect(x, y, 3, 3);
    g.textAlign = "center";
    g.fillStyle = "#ffe08a";
    g.font = "bold 52px system-ui, sans-serif";
    g.fillText(lang === "vi" ? "BẢNG ĐIỂM" : "SCOREBOARD", W / 2, 70);
    g.font = "28px system-ui, sans-serif";
    g.fillStyle = "#9fdcff";
    g.fillText(useSim ? (lang === "vi" ? `Máy chơi ${t.stayN} + ${t.swapN} ván` : `Computer: ${t.stayN} + ${t.swapN} games`) : lang === "vi" ? `Bạn đã chơi ${t.stayN + t.swapN} ván` : `You played ${t.stayN + t.swapN} games`, W / 2, 112);
    const rows: [string, number, number, string][] = [
      [lang === "vi" ? "GIỮ" : "STAY", t.stayWin, t.stayN, "#ff8fb0"],
      [lang === "vi" ? "ĐỔI" : "SWITCH", t.swapWin, t.swapN, "#7ff0ff"],
    ];
    rows.forEach(([name, w, n, col], i) => {
      const y = 190 + i * 150;
      const x0 = 190;
      const bw = W - x0 - 60;
      g.textAlign = "left";
      g.fillStyle = col;
      g.font = "bold 44px system-ui, sans-serif";
      g.fillText(name, 40, y + 46);
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(x0, y, bw, 64);
      const r = rate(w, n);
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 18;
      g.fillRect(x0, y, bw * r, 64);
      g.shadowBlur = 0;
      // vạch tham chiếu 1/3 và 2/3
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.setLineDash([6, 6]);
      [1 / 3, 2 / 3].forEach((v) => {
        g.beginPath();
        g.moveTo(x0 + bw * v, y - 8);
        g.lineTo(x0 + bw * v, y + 72);
        g.stroke();
      });
      g.setLineDash([]);
      g.fillStyle = "#ffffff";
      g.font = "bold 40px system-ui, sans-serif";
      g.textAlign = "right";
      g.fillText(n ? `${Math.round(r * 100)}%` : "—", x0 + bw - 10, y + 47);
      g.font = "24px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.fillText(lang === "vi" ? `thắng ${w} / ${n}` : `won ${w} / ${n}`, x0, y + 100);
    });
    g.textAlign = "center";
    g.font = "24px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.fillText("1/3            2/3", W / 2 + 60, H - 22);
    tex.needsUpdate = true;
  }, [canvas, tex, tally, sim, lang]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export function MontyStage() {
  const gltf = useGLTF(GLB);
  const prizes = useGLTF(PRIZES);
  const screenTex = useScoreboard();
  const { stage, doors, mats } = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const root = new THREE.Group();
    const doorNodes: THREE.Object3D[] = [];
    const src = gltf.scene.clone(true);
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const conv = (sm: THREE.Material) => {
        const s = sm as THREE.MeshStandardMaterial;
        let mat = cache.get(s.name);
        if (!mat) {
          if (s.name === "m_screen") mat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
          else if (s.name === "glow_bulb" || s.name === "glow_gold" || s.name === "glow_cyan") mat = chaseMaterial(s.color);
          else if (s.name.startsWith("glow_")) mat = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(2.2), toneMapped: false });
          else mat = bakedMaterial(s, STAGE_U);
          cache.set(s.name, mat);
        }
        return mat;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      // GLB đã bỏ UV → dựng UV cho màn hình bảng điểm theo khung (mặt quay về −z: bên phải khán giả là −x)
      if ((m.material as THREE.Material).name === "" && (m.material as THREE.MeshBasicMaterial).map === screenTex) {
        const g = m.geometry.clone();
        g.computeBoundingBox();
        const b = g.boundingBox!;
        const pos = g.getAttribute("position");
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (b.max.x - pos.getX(i)) / (b.max.x - b.min.x);
          uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / (b.max.y - b.min.y);
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        m.geometry = g;
      }
    });
    for (let k = 1; k <= 3; k++) {
      const d = src.getObjectByName(`mh_door_${k}`);
      if (d) doorNodes.push(d);
    }
    root.add(src);
    return { stage: root, doors: doorNodes, mats: [...cache.values()] };
  }, [gltf, screenTex]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  // Dê ×2 + xe (toon), mỗi thứ một nhóm riêng
  const { goats, car } = useMemo(() => {
    const base = toonize(prizes.scene);
    const pick = (prefix: string) => {
      const g = new THREE.Group();
      base.children.filter((c) => c.name.startsWith(prefix)).forEach((c) => g.add(c.clone(true)));
      return g;
    };
    const goat = pick("goat_");
    return { goats: [goat, goat.clone(true)], car: pick("car_") };
  }, [prizes]);

  // Chùm đèn rọi (nón cộng sáng, mờ dần theo chiều dài)
  const beam = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.16, 1.15, 1, 28, 1, true);
    geo.translate(0, -0.5, 0);
    geo.rotateX(-Math.PI / 2); // trục −y → +z: đỉnh ở gốc, loe theo +z cục bộ
    const mat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0.3 }, uC: { value: new THREE.Color("#fff1d0") } },
      vertexShader: "varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ vZ = position.z; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform float uA; uniform vec3 uC; varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float fall = smoothstep(1.0, 0.15, vZ) * smoothstep(0.0, 0.08, vZ); gl_FragColor = vec4(uC * uA * edge * fall, 1.0); }",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    return { geo, mats: [0, 1, 2].map(() => mat.clone()) };
  }, []);
  useEffect(() => () => [beam.geo, ...beam.mats].forEach((x) => x.dispose()), [beam]);
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  useEffect(() => {
    // giàn đèn: (x, cao 8,2, trước sân khấu 2,2 m) → chiếu vào giữa cửa
    DX.forEach((dx, i) => {
      const b = beams.current[i];
      if (!b) return;
      const from = new THREE.Vector3(MONTY.x + dx, 7.75, MONTY.z - 1.75);
      const to = new THREE.Vector3(MONTY.x + dx, DECK_H, MONTY.z + DOOR_Z - 0.6);
      b.position.copy(from);
      b.lookAt(to);
      b.scale.set(1, 1, from.distanceTo(to));
    });
  }, [beam]);

  // Pháo giấy khi trúng xe
  const CONF = 260;
  const conf = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.07, 0.11);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    const seed = Array.from({ length: CONF }, (_, i) => ({ a: (i * 2.399) % (Math.PI * 2), r: 0.3 + ((i * 7919) % 100) / 100, v: 2.5 + ((i * 104729) % 100) / 30, s: ((i * 31) % 17) / 17 }));
    return { geo, mat, seed };
  }, []);
  useEffect(() => () => [conf.geo, conf.mat].forEach((x) => x.dispose()), [conf]);
  const confRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const im = confRef.current;
    if (!im) return;
    const pal = ["#ff6f91", "#ffd54a", "#7ff0ff", "#b58bff", "#ffffff", "#7dff9a"].map((c) => new THREE.Color(c).multiplyScalar(1.6));
    for (let i = 0; i < CONF; i++) im.setColorAt(i, pal[i % pal.length]);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [conf]);

  const goatRefs = useRef<(THREE.Group | null)[]>([]);
  const carRef = useRef<THREE.Group>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  const doorAng = useRef([0, 0, 0]);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    CHASE.uT.value = t;
    const ms = useMonty.getState();
    // Cửa: xoay quanh bản lề, mở ra phía khán giả (86°) để lộ trọn phần thưởng trong hốc
    doors.forEach((d, i) => {
      const target = ms.open[i] * 1.5;
      doorAng.current[i] += (target - doorAng.current[i]) * Math.min(1, dt * 3.2);
      d.rotation.y = doorAng.current[i];
    });
    // Phần thưởng: xe ở cửa `car`, dê ở hai cửa kia
    const slots = [0, 1, 2].filter((k) => k !== ms.car);
    const place = (g: THREE.Object3D | null, k: number, phase: number) => {
      if (!g) return;
      g.position.set(MONTY.x + DX[k], DECK_H + 0.1, MONTY.z + ALC_Z + 0.1);
      const shown = ms.open[k] > 0;
      // bàn xoay đung đưa nhẹ; dê nhún nhảy khi cửa mở
      g.rotation.y = Math.sin(t * 0.7 + phase) * 0.45;
      if (shown && g !== carRef.current) g.position.y += Math.abs(Math.sin(t * 5 + phase)) * 0.06;
      if (shown && g === carRef.current) g.position.y += Math.sin(t * 9) * 0.008;
    };
    place(carRef.current, ms.car, 0);
    goatRefs.current.forEach((g, i) => place(g, slots[i], i * 2.1));
    // Đèn rọi: cửa được chọn sáng nhất, cửa dê đã mở tối đi
    beam.mats.forEach((m, i) => {
      const a = ms.pick === i || ms.final === i ? 0.75 : ms.opened.includes(i) ? 0.12 : ms.phase === "idle" ? 0.3 + 0.12 * Math.sin(t * 3 + i * 2.1) : 0.22;
      (m.uniforms.uA as { value: number }).value += (a - (m.uniforms.uA as { value: number }).value) * Math.min(1, dt * 4);
    });
    // Pháo giấy
    const im = confRef.current;
    if (im) {
      const age = (performance.now() - ms.burst) / 1000;
      const on = age >= 0 && age < 5;
      im.visible = on;
      if (on) {
        const cx = MONTY.x + DX[ms.car];
        for (let i = 0; i < CONF; i++) {
          const s = conf.seed[i];
          const tt = age;
          const x = cx + Math.cos(s.a) * s.r * (1 + tt * 0.9);
          const z = MONTY.z + ALC_Z - 2.2 + Math.sin(s.a) * s.r * (1 + tt * 0.9);
          const y = Math.max(DECK_H + 0.02, 3.4 + s.v * tt - 2.6 * tt * tt * 0.5 * 0.9 - tt * 0.4);
          tmp.p.set(x, y, z);
          tmp.e.set(tt * (3 + s.s * 6), tt * (2 + s.s * 4), s.a);
          tmp.q.setFromEuler(tmp.e);
          tmp.s.setScalar(age > 4 ? 5 - age : 1);
          tmp.m.compose(tmp.p, tmp.q, tmp.s);
          im.setMatrixAt(i, tmp.m);
        }
        im.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      <primitive object={stage} position={[MONTY.x, 0, MONTY.z]} />
      {goats.map((g, i) => (
        <primitive key={i} object={g} ref={(el: THREE.Group | null) => void (goatRefs.current[i] = el)} />
      ))}
      <primitive object={car} ref={carRef} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => void (beams.current[i] = el)} geometry={beam.geo} material={beam.mats[i]} frustumCulled={false} renderOrder={5} />
      ))}
      <instancedMesh ref={confRef} args={[conf.geo, conf.mat, CONF]} frustumCulled={false} visible={false} />
      {/* MC Lumi sau bục */}
      <group position={[HOST.x, DECK_H, HOST.z]} rotation-y={Math.PI + 0.3}>
        <Avatar url={worldAsset(AVATAR_BY_ID["school-girl"]?.file ?? "avatars/school-girl.vrm")} pose="idle" npc instance="npc-host" />
        <Label3D text="Lumi · MC Ba Cánh Cửa" position={[0, 2.05, 0]} variant="name" />
      </group>
    </group>
  );
}

/** Mặt sàn sân khấu (0,45) + hai bậc thềm cong phía trước (chỉ dải |x| < 3,2) */
export function montyGround(x: number, z: number) {
  const lx = x - MONTY.x;
  const lz = z - MONTY.z;
  if (Math.abs(lx) > 6.2 || lz < -2 || lz > 4.4) return null;
  const ell = (g: number) => (lx / (5.2 + g)) ** 2 + (lz / (0.9 + g)) ** 2 <= 1;
  const onDeck = Math.abs(lx) <= 5.2 && lz <= 4.3 && (lz >= 0 || ell(0));
  if (onDeck) return DECK_H;
  if (Math.abs(lx) < 3.2 && lz < 0) {
    if (ell(0.42)) return 0.3;
    if (ell(0.84)) return 0.15;
  }
  return 0;
}

export function montyBlocked(x: number, z: number, y: number) {
  const lx = x - MONTY.x;
  const lz = z - MONTY.z;
  if (Math.abs(lx) > 8.2 || lz < -3 || lz > 8) return false;
  // tường cửa + trụ vòm + khối hốc phía sau
  if (Math.abs(lx) < 6.15 && lz > 3.82) return true;
  if (Math.abs(lx) > 4.95 && Math.abs(lx) < 6.15 && lz > 3.0) return true;
  // mép sàn hai bên (chỉ lên được bằng bậc thềm phía trước)
  const g = montyGround(x, z) ?? 0;
  if (g >= DECK_H && y < 0.28 && Math.abs(lx) >= 3.2) return true;
  // bục MC + MC
  if (Math.hypot(lx - 4.25, lz - 0.9) < 0.75 || Math.hypot(x - HOST.x, z - HOST.z) < 0.4) return true;
  // tháp giàn đèn + chân bảng điểm
  if (Math.hypot(Math.abs(lx) - 7, lz + 2.2) < 0.55) return true;
  if (Math.hypot(lx + 8.75, lz - 0.6) < 0.25 || Math.hypot(lx + 6.45, lz - 0.6) < 0.25) return true;
  return false;
}
