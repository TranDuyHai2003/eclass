"use client";
/**
 * Phòng thí nghiệm vũ trụ — mô phỏng 3D chạy NGAY TRÊN kỳ quan khi mở trạm (F):
 *  • Lorenz: thả hai hạt sáng lệch nhau ε trên chính hấp dẫn lạ; vệt sáng của chúng bám nhau rồi tách hẳn (hiệu ứng cánh bướm).
 *  • Fibonacci: đĩa hologram mọc từng hạt theo góc xoay α — góc vàng 137,5° xếp kín, góc hữu tỉ thành tia, lệch nhẹ thành xoắn hở.
 *  • Hopf: một điểm trên quả cầu S² ↔ một vòng tròn sáng trong khối thớ; cả một vĩ tuyến ↔ một mặt xuyến; hai điểm ↔ hai vòng móc nhau.
 *  • Nút ba lá: tô 3 màu lan dần dọc nút (mỗi giao đủ 3 màu → không thể gỡ thành vòng tròn) + hạt sáng chạy dọc nút.
 *  • Sierpiński: tháp hologram tự lắp ráp theo bậc 0–5.
 * Hiệu ứng gắn vào nút GLB của kỳ quan (đúng vị trí + vòng xoay), toạ độ khớp script Blender.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ISLE_BY_ID, LAB_IDS, labSpot, type LabId } from "@/lib/world/impCosmos";
import { LZ_SCALE, hopfBase, hopfFiber, lorenzStart, lorenzStep, phyllotaxis, sierpinskiCells, trefoil, trefoilColoring, trefoilCrossings, type V3 } from "@/lib/world/cosmosLab";
import { useWorld } from "../store";
import { COSMOS_NODES, closeLab, useLab } from "../lab";

const glow = (color: THREE.ColorRepresentation, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

/** Làm tối tạm thời vật liệu phát sáng của một kỳ quan (trả lại màu khi dọn) */
function dimNode(node: THREE.Object3D | null, k: number) {
  if (!node) return;
  const saved: [THREE.MeshBasicMaterial, THREE.Color][] = [];
  node.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (m?.color && !saved.some((x) => x[0] === m)) {
      saved.push([m, m.color.clone()]);
      m.color.multiplyScalar(k);
    }
  });
  return () => saved.forEach(([m, c]) => m.color.copy(c));
}

/** Nhóm bám theo phép biến đổi thế giới của một nút GLB (kể cả khi nút đang xoay) */
function useFollow(node: () => THREE.Object3D | null) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const n = node();
    if (!g.current || !n) return;
    g.current.matrixAutoUpdate = false;
    g.current.matrix.copy(n.matrixWorld);
    g.current.matrixWorldNeedsUpdate = true;
  });
  return g;
}

// ───────────── Lorenz: hiệu ứng cánh bướm ─────────────
const LZ_N = 700;
const lzLocal = (p: V3, out: Float32Array, i: number) => {
  out[i] = p[0] * LZ_SCALE;
  out[i + 1] = (p[2] - 25) * LZ_SCALE;
  out[i + 2] = -p[1] * LZ_SCALE;
};
function LorenzLab() {
  const open = useLab((s) => s.id === "lorenz");
  const seed = useLab((s) => s.lorenz.seed);
  const g = useFollow(() => COSMOS_NODES.lorenz);
  const sim = useRef({ a: [0, 0, 0] as V3, b: [0, 0, 0] as V3, t: 0, n: 0, histAt: 0 });
  const parts = useMemo(() => {
    const mk = (color: string) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LZ_N * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const age = new Float32Array(LZ_N);
      for (let i = 0; i < LZ_N; i++) age[i] = i / (LZ_N - 1);
      geo.setAttribute("aAge", new THREE.BufferAttribute(age, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(color).multiplyScalar(2.6) } },
        vertexShader: "attribute float aAge; varying float vA; void main(){ vA = aAge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 uC; varying float vA; void main(){ gl_FragColor = vec4(uC, pow(1.0 - vA, 1.4)); }",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), glow(color, 4));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), glow(color, 0.6));
      head.add(halo);
      return { line, head };
    };
    const A = mk("#ffd27a");
    const B = mk("#8dffd2");
    const gap = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, toneMapped: false }));
    gap.frustumCulled = false;
    return { A, B, gap };
  }, []);
  useEffect(
    () => () => {
      for (const p of [parts.A, parts.B]) {
        p.line.geometry.dispose();
        (p.line.material as THREE.Material).dispose();
        p.head.geometry.dispose();
        (p.head.material as THREE.Material).dispose();
      }
      parts.gap.geometry.dispose();
    },
    [parts],
  );
  // làm mờ dải Lorenz có sẵn khi đang thí nghiệm → hai vệt hạt nổi bật
  useEffect(() => dimNode(open ? COSMOS_NODES.lorenz : null, 0.22), [open]);
  useEffect(() => {
    const st = sim.current;
    const eps = useLab.getState().lorenz.eps;
    st.a = lorenzStart();
    st.b = [st.a[0] + eps, st.a[1], st.a[2]];
    st.t = 0;
    st.n = 0;
    useLab.setState((s) => ({ lorenz: { ...s.lorenz, hist: [], dist: eps, t: 0 } }));
  }, [seed, open]);
  useFrame((_, rawDt) => {
    if (!g.current) return;
    g.current.visible = open;
    if (!open) return;
    const st = sim.current;
    const dt = Math.min(0.05, rawDt);
    // 1 đơn vị thời gian Lorenz ≈ 1,4 giây thật (đủ chậm để mắt theo kịp vòng xoắn)
    const steps = Math.max(1, Math.round((dt * 0.7) / 0.004));
    const pa = parts.A.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const pb = parts.B.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < steps; k++) {
      lorenzStep(st.a, 0.004);
      lorenzStep(st.b, 0.004);
      st.t += 0.004;
      // mỗi bước đẩy vệt lùi 1 ô (điểm 0 = đầu vệt)
      for (const [arr, p] of [
        [pa.array as Float32Array, st.a],
        [pb.array as Float32Array, st.b],
      ] as const) {
        arr.copyWithin(3, 0, (LZ_N - 1) * 3);
        lzLocal(p, arr, 0);
      }
      st.n = Math.min(LZ_N, st.n + 1);
    }
    pa.needsUpdate = true;
    pb.needsUpdate = true;
    parts.A.line.geometry.setDrawRange(0, st.n);
    parts.B.line.geometry.setDrawRange(0, st.n);
    parts.A.head.position.fromArray(pa.array as Float32Array, 0);
    parts.B.head.position.fromArray(pb.array as Float32Array, 0);
    const gp = parts.gap.geometry.getAttribute("position") as THREE.BufferAttribute;
    gp.setXYZ(0, parts.A.head.position.x, parts.A.head.position.y, parts.A.head.position.z);
    gp.setXYZ(1, parts.B.head.position.x, parts.B.head.position.y, parts.B.head.position.z);
    gp.needsUpdate = true;
    const now = performance.now();
    if (now - st.histAt > 125) {
      st.histAt = now;
      const d = Math.hypot(st.a[0] - st.b[0], st.a[1] - st.b[1], st.a[2] - st.b[2]);
      const L = useLab.getState().lorenz;
      useLab.setState({ lorenz: { ...L, dist: d, t: st.t, hist: [...L.hist.slice(-159), Math.log10(Math.max(d, 1e-12))] } });
    }
  });
  return (
    <group ref={g} visible={false}>
      <primitive object={parts.A.line} />
      <primitive object={parts.B.line} />
      <primitive object={parts.A.head} />
      <primitive object={parts.B.head} />
      <primitive object={parts.gap} />
    </group>
  );
}

// ───────────── Fibonacci: góc vàng ─────────────
const FIB_N = 520;
const FIB_C = 0.118;
function FibLab() {
  const open = useLab((s) => s.id === "fib");
  const spot = useMemo(() => labSpot("fib"), []);
  const g = useRef<THREE.Group>(null);
  const { seeds, frame, back } = useMemo(() => {
    const seeds = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), new THREE.MeshBasicMaterial({ toneMapped: false }), FIB_N);
    seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    seeds.setColorAt(0, new THREE.Color());
    seeds.frustumCulled = false;
    const frame = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.16, 96), glow("#ffd27a", 2.2));
    const back = new THREE.Mesh(new THREE.CircleGeometry(3.05, 64), new THREE.MeshBasicMaterial({ color: "#0b0820", transparent: true, opacity: 0.72, depthWrite: false }));
    return { seeds, frame, back };
  }, []);
  useEffect(
    () => () => {
      for (const m of [seeds, frame, back]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
    [seeds, frame, back],
  );
  const st = useRef({ born: 0, key: "", shown: -1 });
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = open;
    if (!open) return;
    const F = useLab.getState().fib;
    const key = `${F.angle}|${F.seed}|${F.fam}`;
    const now = performance.now();
    if (key !== st.current.key) {
      // đổi góc: hạt mọc lại từ tâm (thấy rõ quá trình), đổi họ xoắn: tô lại ngay
      if (!st.current.key.startsWith(`${F.angle}|${F.seed}|`)) st.current.born = now;
      st.current.key = key;
      st.current.shown = -1;
    }
    const n = Math.min(FIB_N, Math.floor(((now - st.current.born) / 1000) * 110) + 1);
    if (n === st.current.shown) return;
    st.current.shown = n;
    const P = phyllotaxis(FIB_N, F.angle, FIB_C);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let k = 0; k < FIB_N; k++) {
      const vis = k < n;
      const hi = F.fam > 0 && (k + 1) % F.fam === 0;
      const sz = vis ? (0.052 + 0.0016 * Math.sqrt(k + 1)) * (hi ? 1.35 : 1) * (k === n - 1 ? 1.8 : 1) : 0;
      m.makeScale(sz, sz, sz).setPosition(P[k][0], P[k][1], 0.02);
      seeds.setMatrixAt(k, m);
      const u = Math.sqrt((k + 1) / FIB_N);
      if (hi) c.set("#ffd27a").multiplyScalar(2.4);
      else c.setHSL(0.78 - u * 0.25, 0.75, 0.42 + u * 0.18).multiplyScalar(1.4);
      seeds.setColorAt(k, c);
    }
    seeds.instanceMatrix.needsUpdate = true;
    if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
  });
  return (
    <group ref={g} position={spot.holo} rotation-y={spot.face} visible={false}>
      <primitive object={back} />
      <primitive object={frame} />
      <primitive object={seeds} />
    </group>
  );
}

// ───────────── Hopf: điểm ↔ vòng tròn ─────────────
const hopfLocal = (v: V3): THREE.Vector3 => new THREE.Vector3(v[0] * 2.2, v[2] * 2.2, -v[1] * 2.2);
class LoopCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private pts: THREE.Vector3[]) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const n = this.pts.length;
    const f = (((u % 1) + 1) % 1) * n;
    const i = Math.floor(f);
    return target.copy(this.pts[i % n]).lerp(this.pts[(i + 1) % n], f - i);
  }
}
function HopfLab() {
  const open = useLab((s) => s.id === "hopf");
  const spot = useMemo(() => labSpot("hopf"), []);
  const g = useFollow(() => COSMOS_NODES.hopf);
  const globe = useRef<THREE.Group>(null);
  const mats = useMemo(() => ({ a: glow("#ffd27a", 3), b: glow("#7fe3ff", 3), line: new THREE.LineBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.2), transparent: true, opacity: 0.85, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }) }), []);
  const tubes = useRef<THREE.Mesh[]>([]);
  const lines = useRef<THREE.LineSegments | null>(null);
  const holder = useRef<THREE.Group>(null);
  const sphere = useMemo(() => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: "#9fe6ff", wireframe: true, transparent: true, opacity: 0.22, toneMapped: false, depthWrite: false }));
    const dotA = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glow("#ffd27a", 4));
    const dotB = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), glow("#7fe3ff", 4));
    const lat = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * Math.PI * 2), 0, Math.sin((i / 64) * Math.PI * 2)))), new THREE.LineBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2), toneMapped: false }));
    return { s, dotA, dotB, lat };
  }, []);
  // làm mờ các thớ có sẵn khi đang thí nghiệm → vòng được chọn nổi bật
  useEffect(() => dimNode(open ? COSMOS_NODES.hopf : null, 0.18), [open]);
  useEffect(
    () => () => {
      tubes.current.forEach((t) => t.geometry.dispose());
      lines.current?.geometry.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );
  const last = useRef("");
  const live = useRef({ eta: 1.2, phi: 0, sync: 0 });
  useFrame((_, dt) => {
    if (!g.current || !globe.current) return;
    g.current.visible = open;
    globe.current.visible = open;
    if (!open) return;
    globe.current.rotation.y += dt * 0.2;
    const H = useLab.getState().hopf;
    const L = live.current;
    if (H.auto) {
      // tự chạy: điểm đi vòng quanh quả cầu (giữ trong ref, đồng bộ thanh trượt ~7 lần/giây)
      L.phi = (L.phi + dt * 0.6) % (Math.PI * 2);
      L.eta = 1.25 + 0.55 * Math.sin(performance.now() / 2600);
      if (performance.now() - L.sync > 150) {
        L.sync = performance.now();
        useLab.setState({ hopf: { ...H, phi: L.phi, eta: L.eta } });
      }
    } else {
      L.eta = H.eta;
      L.phi = H.phi;
    }
    const { mode } = H;
    const { eta, phi } = L;
    // điểm trên S²: cực bắc = trục y của quả cầu
    const b = hopfBase(eta, phi);
    sphere.dotA.position.set(b[0], b[2], -b[1]);
    const b2 = hopfBase(Math.PI - eta * 0.8, phi + Math.PI * 0.6);
    sphere.dotB.position.set(b2[0], b2[2], -b2[1]);
    sphere.dotB.visible = mode === "two";
    sphere.dotA.visible = mode !== "circle";
    sphere.lat.visible = mode === "circle";
    sphere.lat.position.y = Math.cos(eta);
    sphere.lat.scale.setScalar(Math.sin(eta));
    const key = `${mode}|${eta.toFixed(3)}|${phi.toFixed(3)}`;
    if (key === last.current || !holder.current) return;
    last.current = key;
    tubes.current.forEach((t) => (holder.current!.remove(t), t.geometry.dispose()));
    tubes.current = [];
    if (lines.current) {
      holder.current.remove(lines.current);
      lines.current.geometry.dispose();
      lines.current = null;
    }
    const tube = (e: number, p: number, mat: THREE.Material) => {
      const pts = hopfFiber(e, p, 120).map(hopfLocal);
      const m = new THREE.Mesh(new THREE.TubeGeometry(new LoopCurve(pts), 160, 0.1, 8, true), mat);
      holder.current!.add(m);
      tubes.current.push(m);
    };
    if (mode === "point") tube(eta, phi, mats.a);
    else if (mode === "two") {
      tube(eta, phi, mats.a);
      tube(Math.PI - eta * 0.8, phi + Math.PI * 0.6, mats.b);
    } else {
      // cả vĩ tuyến: 30 vòng tròn → phủ kín một mặt xuyến (mỗi vòng móc qua mọi vòng khác)
      const seg: THREE.Vector3[] = [];
      for (let k = 0; k < 30; k++) {
        const pts = hopfFiber(eta, phi + (k / 30) * Math.PI * 2, 72).map(hopfLocal);
        for (let i = 0; i < pts.length; i++) seg.push(pts[i], pts[(i + 1) % pts.length]);
      }
      lines.current = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), mats.line);
      lines.current.frustumCulled = false;
      holder.current.add(lines.current);
    }
  });
  return (
    <>
      <group ref={g} visible={false}>
        <group ref={holder} />
      </group>
      <group ref={globe} position={spot.holo} visible={false}>
        <primitive object={sphere.s} />
        <primitive object={sphere.dotA} />
        <primitive object={sphere.dotB} />
        <primitive object={sphere.lat} />
      </group>
    </>
  );
}

// ───────────── Nút ba lá: tô 3 màu + hạt chạy ─────────────
const KNOT = ISLE_BY_ID.knot;
const KNOT_TH = -Math.atan2(-KNOT.z, -KNOT.x) + Math.PI / 2;
/** Toạ độ cục bộ của nút (khớp Blender: (x, 1,2·z, y)·2,1 xoay quanh trục đứng, rồi Blender → glTF) */
function knotLocal(t: number, out = new THREE.Vector3()) {
  const [x, y, z] = trefoil(t);
  const a = x * 2.1;
  const b = z * 1.2 * 2.1;
  const c = y * 2.1;
  const bx = a * Math.cos(KNOT_TH) - b * Math.sin(KNOT_TH);
  const by = a * Math.sin(KNOT_TH) + b * Math.cos(KNOT_TH);
  return out.set(bx, c, -by);
}
class KnotCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    return knotLocal(u * Math.PI * 2, target);
  }
}
function KnotLab() {
  const open = useLab((s) => s.id === "knot");
  const g = useFollow(() => COSMOS_NODES.knot);
  const { mesh, mat, bead, marks } = useMemo(() => {
    const curve = new KnotCurve();
    const SEG = 480;
    const RAD = 10;
    const geo = new THREE.TubeGeometry(curve, SEG, 0.86, RAD, true);
    const { cuts } = trefoilColoring();
    const tAttr = new Float32Array((SEG + 1) * (RAD + 1));
    for (let i = 0; i <= SEG; i++) {
      const t = curve.getUtoTmapping(i / SEG, 0) * Math.PI * 2;
      for (let j = 0; j <= RAD; j++) tAttr[i * (RAD + 1) + j] = t;
    }
    geo.setAttribute("aT", new THREE.BufferAttribute(tAttr, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCuts: { value: new THREE.Vector3(...cuts) }, uReveal: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `attribute float aT; varying float vT; varying vec3 vN; varying vec3 vV;
        void main(){ vT = aT; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCuts; uniform float uReveal; uniform float uTime; varying float vT; varying vec3 vN; varying vec3 vV;
        void main(){
          float k = vT < uCuts.x ? 0.0 : vT < uCuts.y ? 1.0 : vT < uCuts.z ? 2.0 : 0.0;
          vec3 c = k < 0.5 ? vec3(1.0, 0.18, 0.3) : k < 1.5 ? vec3(0.2, 0.95, 0.42) : vec3(0.22, 0.5, 1.0);
          float front = smoothstep(0.0, 0.25, uReveal * 6.2832 - vT);
          float edge = exp(-pow((uReveal * 6.2832 - vT) * 6.0, 2.0));
          float rim = pow(1.0 - abs(dot(vN, vV)), 2.0);
          vec3 col = c * (0.9 + rim * 1.6) + vec3(1.0) * edge * 2.5;
          gl_FragColor = vec4(col * 1.8, (0.93 + rim * 0.07) * max(front, edge));
          if (gl_FragColor.a < 0.02) discard;
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), glow("#fff3c4", 4));
    bead.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), glow("#ffd27a", 0.6)));
    // đánh dấu 3 điểm giao (vòng sáng nhấp nháy quanh nhánh trên)
    const marks = trefoilCrossings().map((c) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.06, 6, 40), glow("#ffffff", 2));
      knotLocal(c.over, m.position);
      return m;
    });
    return { mesh, mat, bead, marks };
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mat.dispose();
      bead.geometry.dispose();
      marks.forEach((m) => m.geometry.dispose());
    },
    [mesh, mat, bead, marks],
  );
  const st = useRef({ key: "", at: 0 });
  useFrame((state) => {
    if (!g.current) return;
    g.current.visible = open;
    if (!open) return;
    const K = useLab.getState().knot;
    const now = performance.now();
    const key = `${K.tricolor}|${K.seed}`;
    if (key !== st.current.key) {
      st.current.key = key;
      st.current.at = now;
    }
    mat.uniforms.uReveal.value = K.tricolor ? Math.min(1.02, (now - st.current.at) / 3500) : 0;
    mat.uniforms.uTime.value = now / 1000;
    mesh.visible = K.tricolor;
    bead.visible = K.bead;
    knotLocal((now / 1000) * 0.55, bead.position);
    const cam = state.camera;
    for (const m of marks) {
      m.visible = K.tricolor && mat.uniforms.uReveal.value > 1;
      m.lookAt(cam.position);
      m.scale.setScalar(1 + 0.12 * Math.sin(now / 180));
    }
  });
  return (
    <group ref={g} visible={false}>
      <primitive object={mesh} />
      <primitive object={bead} />
      {marks.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

// ───────────── Sierpiński: tự lắp ráp theo bậc ─────────────
const SP_MAX = 5;
function SierpLab() {
  const open = useLab((s) => s.id === "sierp");
  const spot = useMemo(() => labSpot("sierp"), []);
  const g = useRef<THREE.Group>(null);
  const mesh = useMemo(() => {
    // tứ diện đều cạnh 1, đặt tâm ở gốc, cùng hướng với sierpinskiCells
    const E = 1;
    const h = E * Math.sqrt(2 / 3);
    const R = E / Math.sqrt(3);
    const v = [
      [R, 0, 0],
      [R * Math.cos((2 * Math.PI) / 3), 0, R * Math.sin((2 * Math.PI) / 3)],
      [R * Math.cos((4 * Math.PI) / 3), 0, R * Math.sin((4 * Math.PI) / 3)],
      [0, h, 0],
    ].map((p) => new THREE.Vector3(p[0], p[1] - h / 4, p[2]));
    const geo = new THREE.BufferGeometry().setFromPoints([v[0], v[2], v[1], v[0], v[1], v[3], v[1], v[2], v[3], v[2], v[0], v[3]]);
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), vV)), 2.0); float l = 0.35 + 0.65 * max(dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.3))), 0.0);
          vec3 c = mix(vec3(0.45, 0.85, 1.0), vec3(0.75, 0.55, 1.0), fract(vY * 0.4)) * l + vec3(1.0, 0.9, 0.7) * rim * 1.4;
          gl_FragColor = vec4(c * 1.4, 0.85); }`,
      transparent: true,
      toneMapped: false,
    });
    const m = new THREE.InstancedMesh(geo, mat, 4 ** SP_MAX);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );
  const st = useRef({ level: -1, at: 0, cells: [] as { c: V3; e: number }[] });
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.visible = open;
    if (!open) return;
    g.current.rotation.y += dt * 0.25;
    const lv = useLab.getState().sierp.level;
    const now = performance.now();
    if (lv !== st.current.level) {
      st.current.level = lv;
      st.current.at = now;
      st.current.cells = sierpinskiCells(lv, 2.6);
      mesh.count = st.current.cells.length;
    }
    // lắp ráp: khối con bay vào chỗ, lệch pha theo thứ tự (gợi "chia đôi cạnh, bỏ lõi giữa")
    const age = (now - st.current.at) / 1000;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const n = st.current.cells.length;
    st.current.cells.forEach((cell, i) => {
      const k = Math.min(1, Math.max(0, (age - (i / Math.max(1, n)) * 0.9) / 0.5));
      const e = cell.e * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3)));
      const lift = (1 - k) * 1.5;
      m.compose(new THREE.Vector3(cell.c[0], cell.c[1] + lift, cell.c[2]), q, new THREE.Vector3(e * 0.97, e * 0.97, e * 0.97));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={g} position={spot.holo} visible={false}>
      <primitive object={mesh} />
    </group>
  );
}

/** Đi / bay xa trạm đang mở quá 35 m → tự đóng */
function LabWatcher() {
  useFrame(() => {
    const id = useLab.getState().id;
    if (!id) return;
    const s = labSpot(id);
    const p = useWorld.getState().player;
    if (Math.hypot(p.x - s.x, p.z - s.z, p.y - s.h) > 35) closeLab();
  });
  useEffect(() => () => closeLab(), []);
  return null;
}

export function CosmosLab() {
  return (
    <>
      <LabWatcher />
      <LorenzLab />
      <FibLab />
      <HopfLab />
      <KnotLab />
      <SierpLab />
    </>
  );
}

export const LAB_TITLES: Record<LabId, { vi: string; en: string }> = {
  knot: { vi: "Thí nghiệm: tô ba màu nút", en: "Experiment: three-colour the knot" },
  sierp: { vi: "Thí nghiệm: chia tháp mãi mãi", en: "Experiment: subdivide forever" },
  lorenz: { vi: "Thí nghiệm: hiệu ứng cánh bướm", en: "Experiment: the butterfly effect" },
  fib: { vi: "Thí nghiệm: góc vàng", en: "Experiment: the golden angle" },
  hopf: { vi: "Thí nghiệm: điểm ↔ vòng tròn", en: "Experiment: point ↔ circle" },
};
export { LAB_IDS };
