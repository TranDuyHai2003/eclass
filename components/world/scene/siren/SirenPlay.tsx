"use client";
/**
 * Điểm tương tác toán – nhạc – vật lý của Mê cung Hoạ âm (logic thuần: lib/world/sirenMusic.ts).
 *  - Sân Hoà âm (đảo góc Đông Nam): ba đàn một dây — bấm F dời ngựa đàn; đủ quãng tám / quãng năm / quãng bốn → mở rương.
 *  - Ống Fourier (sân Đông): bấm F ở chân ống bậc n để bật / tắt hoạ âm sin(nt)/n; bảng vẽ sóng đang ghép so với
 *    sóng mục tiêu (vuông → răng cưa).
 *  - Con lắc cộng hưởng (sân Bắc): bấm F đẩy; đẩy đúng lúc vòng sáng dưới chân loé (đúng chu kỳ riêng) thì biên độ lớn dần
 *    tới khi chuông kêu.
 *  - Bệ hợp âm (sân Tây, tổ đội): Đô + Sol cùng ngân → mở rương. Vị trí người khác lấy từ netPeers (không thêm gói mạng);
 *    một mình vẫn được: bệ ngân 4 s sau khi rời chân.
 *  - Cầu thang phím đàn: bước lên bậc nào kêu nốt đó (thang trưởng thuần, đi lên = gam đi lên).
 *  - Dây đàn sóng dừng trên cầu Bắc: rung lần lượt mode 1–4, nút sóng đánh dấu — đúng chỗ an toàn của đòn "sóng dừng".
 *  - Gợi ý ngắn khi lần đầu vào mỗi vùng.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { create } from "zustand";
import { useWorld } from "../../store";
import { motion } from "../../combat/combat";
import { rollDrops } from "../../combat/items";
import { registerAction } from "../../actions";
import { netPeers, netStatus, samplePeer } from "../../net";
import { floatText, Label3D } from "../../ui/Labels";
import { GATES, GATE_OPEN, PIPES, surfAt } from "@/lib/world/sirenMaze";
import {
  CHORD_PLATES,
  HARMONY_COURT,
  MONOCHORDS,
  MONO_STOPS,
  PENDULUM,
  ROOT,
  WAVE_TARGET,
  chordState,
  fourierSum,
  harmonySolved,
  monoLength,
  monoRatio,
  nameInterval,
  nextStop,
  onPlate,
  pendulumDecay,
  pendulumPeriod,
  pendulumPush,
  pendulumRings,
  targetSum,
  waveSolved,
  type WaveTarget,
} from "@/lib/world/sirenMusic";
import { CUBE, HOLE, MOON, PLANET, WORM } from "@/lib/world/sirenGravity";
import { synth } from "./sirenSynth";
import { offHub } from "./zones/zoneRuntime";

type Lang = "vi" | "en";
const L = (vi: string, en: string) => (useWorld.getState().lang === "vi" ? vi : en);

export const usePlay = create<{ stops: number[]; pipes: boolean[]; target: WaveTarget; looted: Record<string, boolean>; open: Record<string, boolean> }>(() => ({
  stops: [0, 0, 0],
  pipes: [false, false, false, false, false, false],
  target: "square",
  looted: {},
  open: {},
}));
const PEND = { A: 0, t0: 0 };
const PLATE_AT: [number, number] = [-1e9, -1e9];
const HINTED = new Set<string>();

/** Thang trưởng thuần (ngữ điệu thuần) cho cầu thang phím đàn */
const JUST_MAJOR = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
const scaleNote = (i: number) => ROOT * JUST_MAJOR[i % 7] * Math.pow(2, Math.floor(i / 7));

function openGate(id: string) {
  if (GATE_OPEN[id]) return;
  GATE_OPEN[id] = true;
  usePlay.setState((s) => ({ open: { ...s.open, [id]: true } }));
}
function reward(at: THREE.Vector3, n = 3) {
  for (let i = 0; i < n; i++) rollDrops("mite", at.clone().add(new THREE.Vector3(Math.cos(i * 2.1) * 0.8, 1.2, Math.sin(i * 2.1) * 0.8)));
  useWorld.getState().burst([at.x, at.y + 1.5, at.z], "#ffd27a", 60);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Điểm tương tác gần người chơi (Siren.tsx gộp vào findNearby) */
export function playNearby(p: THREE.Vector3): { kind: "action"; id: string; label: string } | null {
  const st = usePlay.getState();
  for (let i = 0; i < MONOCHORDS.length; i++) {
    const m = MONOCHORDS[i];
    if (Math.hypot(p.x - m.x, p.z - m.z) < 2 && Math.abs(p.y - m.y) < 1.5) {
      const cur = nameInterval(monoRatio(st.stops[i]));
      const tg = nameInterval(monoRatio(m.target));
      const [a, b] = MONO_STOPS[st.stops[i]];
      return { kind: "action", id: `siren:mono:${i}`, label: L(`Dời ngựa đàn — ${a}:${b} ${cur?.vi ?? ""} (cần ${tg?.vi})`, `Move the bridge — ${a}:${b} ${cur?.en ?? ""} (need ${tg?.en})`) };
    }
  }
  for (let n = 1; n <= PIPES.length; n++) {
    const q = PIPES[n - 1];
    if (Math.hypot(p.x - q.x, p.z - q.z) < q.r + 1.6 && p.y < 2) {
      const on = st.pipes[n - 1];
      return { kind: "action", id: `siren:pipe:${n}`, label: L(`${on ? "Tắt" : "Bật"} hoạ âm bậc ${n} — mục tiêu: ${WAVE_TARGET[st.target].vi}`, `${on ? "Mute" : "Sound"} harmonic ${n} — goal: ${WAVE_TARGET[st.target].en}`) };
    }
  }
  if (Math.hypot(p.x - PENDULUM.x, p.z - PENDULUM.z) < 2.6 && p.y < 2) return { kind: "action", id: "siren:pendulum", label: L("Đẩy con lắc — đẩy khi vòng sáng loé (đúng chu kỳ riêng)", "Push the pendulum — push when the ring flashes (its natural period)") };
  for (const g of GATES) {
    if (!GATE_OPEN[g.id] || st.looted[g.id]) continue;
    if (Math.hypot(p.x - g.x, p.z - g.z) < 2.2) return { kind: "action", id: `siren:chest:${g.id}`, label: L("Mở rương", "Open the chest") };
  }
  return null;
}

// ───────────── Gợi ý khi vào vùng mới ─────────────
const HINTS: { id: string; at: [number, number, number]; r: number; vi: string; en: string }[] = [
  { id: "harmony", at: [HARMONY_COURT.x, 0, HARMONY_COURT.z], r: 8, vi: "Sân Hoà âm: chỉnh ba đàn một dây đúng quãng để mở rương", en: "Harmony Court: tune the three monochords to open the chest" },
  { id: "pipes", at: [46, 0, 0], r: 7, vi: "Ống Fourier: bật đúng các hoạ âm để ghép ra sóng trên bảng", en: "Fourier Pipes: sound the right harmonics to build the wave on the board" },
  { id: "pendulum", at: [PENDULUM.x, 0, PENDULUM.z], r: 6, vi: "Con lắc: đẩy đúng nhịp để cộng hưởng", en: "Pendulum: push in rhythm to resonate" },
  { id: "chord", at: [-48, 0, 0], r: 8, vi: "Bệ hợp âm: Đô + Sol cùng ngân (rủ bạn, hoặc chạy thật nhanh)", en: "Chord plates: C + G ringing together (bring a friend, or run fast)" },
  { id: "cone", at: [22, 8, -49], r: 5, vi: "Nón sáng: chỉ đi tới, lệch tối đa 45°", en: "Light cone: forward only, at most 45° off" },
  { id: "cube", at: [CUBE.c[0], CUBE.c[1] - CUBE.a, CUBE.c[2]], r: 6, vi: "Lồng Escher: bước vào chân tường để đi lên tường", en: "Escher Cage: walk into a wall to walk up it" },
  { id: "moon", at: [MOON.x, 36, MOON.z], r: 8, vi: "Đảo Trăng: trọng lực ¼ — nhảy lên các bậc đá", en: "Moon Isle: ¼ gravity — jump up the stones" },
  { id: "planet", at: [PLANET.c[0], PLANET.c[1], PLANET.c[2]], r: PLANET.rInf, vi: "Hành tinh tí hon: đi vòng quanh; chạy (Shift) rồi nhảy để thoát", en: "Tiny Planet: walk around it; run (Shift) and jump to escape" },
  { id: "hole", at: [HOLE.c[0], HOLE.c[1], HOLE.c[2]], r: HOLE.rInf, vi: "Hố đen: bay vòng quanh để vào quỹ đạo — đừng chạm chân trời", en: "Black hole: fly sideways to orbit — don't touch the horizon" },
  { id: "worm", at: [WORM.a[0], WORM.a[1], WORM.a[2]], r: 6, vi: "Lỗ sâu: đi thẳng vào để lên Đỉnh Trăng", en: "Wormhole: walk straight in to reach the Moon Summit" },
];

// ───────────── Hình ─────────────
const WOOD = new THREE.Color("#8a5a3a");

function Monochords() {
  const stops = usePlay((s) => s.stops);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en")) as Lang;
  return (
    <>
      {MONOCHORDS.map((m, i) => {
        const len = monoLength(stops[i]);
        const ok = stops[i] === m.target;
        const tg = nameInterval(monoRatio(m.target));
        return (
          <group key={m.id} position={[m.x, m.y, m.z]} rotation-y={m.yaw}>
            {/* thân đàn hộp cộng hưởng */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.7, 0.5, 3.2]} />
              <meshToonMaterial color={WOOD} />
            </mesh>
            {/* dây (vàng khi đúng quãng) */}
            <mesh position={[0, 0.74, 0]}>
              <boxGeometry args={[0.03, 0.03, 3]} />
              <meshBasicMaterial color={ok ? "#a8ff54" : "#ffe7a0"} toneMapped={false} />
            </mesh>
            {/* ngựa đàn: chia dây theo tỉ lệ ℓ / L */}
            <mesh position={[0, 0.76, -1.5 + 3 * len]}>
              <boxGeometry args={[0.5, 0.12, 0.08]} />
              <meshToonMaterial color={ok ? "#a8ff54" : "#ffba35"} />
            </mesh>
            <Label3D text={`${tg?.[lang]} ${MONO_STOPS[m.target][0]}:${MONO_STOPS[m.target][1]}${ok ? " ✓" : ""}`} position={[0, 1.6, 0]} variant="small" maxDist={22} />
          </group>
        );
      })}
    </>
  );
}

const GATE_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main(){
  float s = 0.5 + 0.5 * sin(vUv.x * 60.0 + sin(vUv.y * 12.0 + uTime * 3.0) * 2.0 - uTime * 2.0);
  float a = (0.25 + 0.45 * s) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
  gl_FragColor = vec4(mix(vec3(0.66, 1.0, 0.33), vec3(1.0, 0.4, 0.7), s) * 1.6, a);
}`;
function Gates() {
  const open = usePlay((s) => s.open);
  const looted = usePlay((s) => s.looted);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: GATE_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    mat.uniforms.uTime.value += dt;
  });
  return (
    <>
      {GATES.map((g) => (
        <group key={g.id} position={[g.x, g.y0, g.z]}>
          {!open[g.id] && (
            <mesh material={mat} position-y={(g.y1 - g.y0) / 2}>
              <cylinderGeometry args={[g.r, g.r, g.y1 - g.y0, 32, 1, true]} />
            </mesh>
          )}
          {!looted[g.id] && (
            <mesh position-y={0.4}>
              <boxGeometry args={[0.9, 0.7, 0.6]} />
              <meshToonMaterial color="#ffcf5a" emissive={open[g.id] ? "#6a4a00" : "#000000"} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function FourierBoard() {
  const pipes = usePlay((s) => s.pipes);
  const target = usePlay((s) => s.target);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en")) as Lang;
  const lines = useMemo(() => {
    const N = 120;
    const mk = (fn: (t: number) => number, x: number, color: string) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * 2 * Math.PI;
        pts.push(new THREE.Vector3(x, fn(t) * 1.6, -4.5 + (9 * i) / N));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
    };
    // vàng: sóng mục tiêu; xanh axit: sóng đang ghép từ các ống đang bật
    return [mk((t) => targetSum(target, t), -0.04, "#ffba35"), mk((t) => fourierSum(pipes, t), -0.06, "#a8ff54")];
  }, [pipes, target]);
  useEffect(
    () => () =>
      lines.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }),
    [lines],
  );
  return (
    <group>
      <group position={[53, 15, 2]}>
        <mesh rotation-y={-Math.PI / 2}>
          <planeGeometry args={[10, 5]} />
          <meshBasicMaterial color="#20172c" />
        </mesh>
        {lines.map((l, i) => (
          <primitive key={i} object={l} />
        ))}
        <Label3D text={lang === "vi" ? `Mục tiêu: ${WAVE_TARGET[target].vi}` : `Goal: ${WAVE_TARGET[target].en}`} position={[0, 3, 0]} variant="small" maxDist={40} />
      </group>
      {PIPES.map((p, i) => (
        <mesh key={i} position={[p.x, 0.12, p.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[p.r + 0.15, p.r + 0.45, 24]} />
          <meshBasicMaterial color={pipes[i] ? "#a8ff54" : "#5a4a70"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Pendulum() {
  const arm = useRef<THREE.Group>(null);
  const marker = useRef<THREE.MeshBasicMaterial>(null);
  const T = pendulumPeriod();
  const top = PENDULUM.len + 1.6;
  useFrame((_, dt) => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const now = performance.now();
    PEND.A = pendulumDecay(PEND.A, dt);
    const t = (now - PEND.t0) / 1000;
    if (arm.current) arm.current.rotation.x = PEND.A * Math.sin((2 * Math.PI * t) / T);
    if (marker.current) {
      const ph = (((t / T) % 1) + 1) % 1;
      const good = PEND.A > 0.05 && (ph < 0.1 || ph > 0.9);
      marker.current.color.set(good ? "#a8ff54" : "#4a3a60");
    }
  });
  return (
    <group position={[PENDULUM.x, PENDULUM.y, PENDULUM.z]}>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, top / 2, 0]}>
          <boxGeometry args={[0.25, top, 0.25]} />
          <meshToonMaterial color="#3a2a66" />
        </mesh>
      ))}
      <mesh position={[0, top, 0]}>
        <boxGeometry args={[3.2, 0.25, 0.25]} />
        <meshToonMaterial color="#3a2a66" />
      </mesh>
      <group ref={arm} position={[0, top, 0]}>
        <mesh position={[0, -PENDULUM.len / 2, 0]}>
          <boxGeometry args={[0.06, PENDULUM.len, 0.06]} />
          <meshToonMaterial color="#ffcf5a" />
        </mesh>
        <mesh position={[0, -PENDULUM.len, 0]}>
          <sphereGeometry args={[0.45, 20, 14]} />
          <meshToonMaterial color="#ff64b0" />
        </mesh>
      </group>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.8, 1.15, 32]} />
        <meshBasicMaterial ref={marker} color="#4a3a60" toneMapped={false} />
      </mesh>
    </group>
  );
}

function ChordPlates() {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const was = useRef([false, false, false]);
  useFrame(() => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const now = performance.now();
    const p = useWorld.getState().player;
    for (const i of [0, 1] as const) {
      if (onPlate(i, p.x, p.y, p.z)) PLATE_AT[i] = now;
      // người chơi khác (vị trí nội suy từ netPeers — không gửi gói mới)
      if (netStatus() === "online")
        for (const peer of netPeers().values()) {
          const s = samplePeer(peer, now);
          if (s && onPlate(i, s.x, s.y, s.z)) PLATE_AT[i] = now;
        }
    }
    const st = chordState(PLATE_AT, now);
    for (const i of [0, 1] as const) {
      const m = mats.current[i];
      if (m) m.color.set(i ? "#55d9f5" : "#ff64b0").multiplyScalar(0.4 + st.ring[i] * 2.2);
      const on = st.ring[i] > 0.97;
      if (on && !was.current[i]) synth.pluck(ROOT * Math.pow(2, CHORD_PLATES[i].semis / 12), 0.6, 4);
      was.current[i] = on;
    }
    if (st.chord && !was.current[2]) {
      synth.chord(ROOT, [1, 5 / 4, 3 / 2, 2]);
      if (!GATE_OPEN.chord) {
        openGate("chord");
        floatText(V(-42, 3, 7.5), L("Hợp âm Đô – Sol! Rương đã mở", "C–G chord! The chest is open"), "crit");
      }
    }
    was.current[2] = st.chord;
  });
  return (
    <>
      {CHORD_PLATES.map((c, i) => (
        <group key={c.id} position={[c.x, c.y + 0.05, c.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[c.r, 32]} />
            <meshBasicMaterial ref={(m) => void (mats.current[i] = m)} color={i ? "#55d9f5" : "#ff64b0"} toneMapped={false} />
          </mesh>
          <Label3D text={i ? "Sol (3:2)" : "Đô (1:1)"} position={[0, 1.4, 0]} variant="small" maxDist={25} />
        </group>
      ))}
    </>
  );
}

/** Dây đàn sóng dừng căng dọc cầu Bắc: mode n = 1…4 lần lượt, nút sóng đứng yên */
function StandingString() {
  const { geo, line } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#ffe7a0" }));
    l.frustumCulled = false;
    return { geo: g, line: l };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      (line.material as THREE.Material).dispose();
    },
    [geo, line],
  );
  const lastMode = useRef(0);
  useFrame(() => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const t = performance.now() / 1000;
    const n = 1 + (Math.floor(t / 6) % 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      // y(x, t) = A sin(nπx/L) cos(ωt): nút sóng tại x = kL/n
      pos.setXYZ(i, 0, 5 + 0.9 * Math.sin(n * Math.PI * u) * Math.cos(t * 2 * Math.PI * 0.8 * n), -16 - 18 * u);
    }
    pos.needsUpdate = true;
    if (n !== lastMode.current) {
      lastMode.current = n;
      const p = useWorld.getState().player;
      if (Math.hypot(p.x, p.z + 25) < 14 && p.y < 8) synth.pluck(110 * n, 0.4, 2.5);
    }
  });
  return (
    <group>
      <primitive object={line} />
      {[-16, -34].map((z) => (
        <mesh key={z} position={[0, 2.5, z]}>
          <boxGeometry args={[0.2, 5, 0.2]} />
          <meshToonMaterial color="#263f97" />
        </mesh>
      ))}
    </group>
  );
}

export function SirenPlay() {
  useEffect(() => {
    const offs: (() => void)[] = [];
    MONOCHORDS.forEach((m, i) =>
      offs.push(
        registerAction(`siren:mono:${i}`, () => {
          const st = usePlay.getState();
          const stops = [...st.stops];
          stops[i] = nextStop(stops[i]);
          usePlay.setState({ stops });
          // dây buông + phần dây sau ngựa đàn (nghe quãng đang chọn)
          const f = ROOT * Math.pow(2, i * 0.25 - 1);
          synth.interval(f, f * monoRatio(stops[i]));
          const iv = nameInterval(monoRatio(stops[i]));
          const [a, b] = MONO_STOPS[stops[i]];
          floatText(V(m.x, 2, m.z), `${a}:${b} ${iv ? (useWorld.getState().lang === "vi" ? iv.vi : iv.en) : ""}`, stops[i] === m.target ? "crit" : "info");
          if (harmonySolved(stops) && !GATE_OPEN.harmony) {
            openGate("harmony");
            setTimeout(() => synth.chord(ROOT / 2, [1, 3 / 2, 2, 3, 4]), 600);
            floatText(V(HARMONY_COURT.x, 3, HARMONY_COURT.z), L("Quãng tám · quãng năm · quãng bốn — rương đã mở!", "Octave · fifth · fourth — the chest is open!"), "crit");
          }
        }),
      ),
    );
    for (let n = 1; n <= PIPES.length; n++)
      offs.push(
        registerAction(`siren:pipe:${n}`, () => {
          const st = usePlay.getState();
          const pipes = [...st.pipes];
          pipes[n - 1] = !pipes[n - 1];
          usePlay.setState({ pipes });
          if (pipes[n - 1]) synth.pluck(110 * n, 0.7 / Math.sqrt(n), 2.5);
          if (waveSolved(pipes, st.target)) {
            const at = V(PIPES[0].x - 2, 0, 0);
            setTimeout(() => synth.chord(110, [1, 2, 3, 4, 5, 6]), 400);
            floatText(at.clone().setY(3), L(`Đúng ${WAVE_TARGET[st.target].vi}!`, `That's the ${WAVE_TARGET[st.target].en}!`), "crit");
            reward(at, st.target === "square" ? 2 : 3);
            setTimeout(() => usePlay.setState({ target: st.target === "square" ? "saw" : "square", pipes: [false, false, false, false, false, false] }), 2500);
          }
        }),
      );
    offs.push(
      registerAction("siren:pendulum", () => {
        const now = performance.now();
        const T = pendulumPeriod();
        if (PEND.A < 0.05) PEND.t0 = now;
        const ph = (((now - PEND.t0) / 1000 / T) % 1 + 1) % 1;
        const before = PEND.A;
        PEND.A = pendulumPush(PEND.A, ph);
        const at = V(PENDULUM.x, 2.5, PENDULUM.z);
        if (pendulumRings(PEND.A)) {
          synth.bell(ROOT, 0.9, 5);
          floatText(at, L("Cộng hưởng! Chuông ngân", "Resonance! The bell rings"), "crit");
          reward(V(PENDULUM.x, 0, PENDULUM.z), 2);
          setTimeout(() => (PEND.A = 0.2), 1500);
        } else if (PEND.A > before + 0.01) {
          synth.impact("wood", 4);
          floatText(at, L("đúng nhịp ↑", "in time ↑"), "info");
        } else {
          synth.impact("wood", 2);
          floatText(at, L("lệch nhịp ↓", "off beat ↓"), "hurt");
        }
      }),
    );
    for (const g of GATES)
      offs.push(
        registerAction(`siren:chest:${g.id}`, () => {
          if (!GATE_OPEN[g.id] || usePlay.getState().looted[g.id]) return;
          usePlay.setState((s) => ({ looted: { ...s.looted, [g.id]: true } }));
          synth.bell(ROOT * 2, 0.6, 2.5);
          reward(V(g.x, 0, g.z), 4);
        }),
      );
    return () => {
      offs.forEach((f) => f());
      for (const g of GATES) GATE_OPEN[g.id] = false;
      usePlay.setState({ stops: [0, 0, 0], pipes: [false, false, false, false, false, false], target: "square", looted: {}, open: {} });
    };
  }, []);
  // cầu thang phím đàn + gợi ý vùng mới
  const lastStep = useRef("");
  const hintAt = useRef(0);
  useFrame(() => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const p = useWorld.getState().player;
    if (motion.grounded) {
      const s = surfAt(p.x, p.z, p.y);
      const id = s?.step ? s.id : "";
      if (id && id !== lastStep.current) {
        const i = Number(id.split(".")[1]) || 0;
        synth.pluck(scaleNote(i), 0.45, 1.1);
      }
      lastStep.current = id;
    }
    const now = performance.now();
    if (now - hintAt.current < 600) return;
    hintAt.current = now;
    for (const h of HINTS) {
      if (HINTED.has(h.id)) continue;
      if (Math.hypot(p.x - h.at[0], p.y - h.at[1], p.z - h.at[2]) > h.r) continue;
      HINTED.add(h.id);
      floatText(p.clone().setY(p.y + 2.6), useWorld.getState().lang === "vi" ? h.vi : h.en, "info");
      synth.bell(ROOT * 2, 0.25, 1.5);
      break;
    }
  });
  return (
    <group name="perf:play">
      <Monochords />
      <Gates />
      <FourierBoard />
      <Pendulum />
      <ChordPlates />
      <StandingString />
    </group>
  );
}
