"use client";
/**
 * Thiên văn đồ — phòng tròn cuối hành lang đông của phòng Siêu khối (lib/world/orrery.ts, TESSERACT_BOOTH §4.4 mục 2, §13 A6).
 * Máy mô hình Hệ Mặt Trời bằng đồng Ø6: 6 hành tinh với số liệu thật (J2000), mỗi khung giải phương trình Kepler M = E − e·sin E;
 * quỹ đạo elip đúng tâm sai (bán kính nén căn bậc hai để vừa máy). "Hành tinh học trò" có tâm sai chỉnh được + 12 quạt sáng
 * diện tích bằng nhau (định luật 2). Bảng số T² / a³ ≈ 1 (định luật 3). Cần gạt thời gian ×1 … ×10⁶ (F); ×1 = đúng vị trí
 * hôm nay. Vòm sao: shader bản đồ sao + lưới xích kinh / xích vĩ + dải hoàng đạo.
 * Mô hình Blender `props/orrery_room.glb` (GI nướng vào màu đỉnh; script: scratchpad orrery_build.py + room_bake.py): vỏ phòng,
 * bệ máy + Mặt Trời + lan can hoàng đạo (tĩnh); thanh / trụ / hành tinh / cần gạt / núm (động, đặt bằng code).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { daysSinceJ2000, ECC_STEPS, equalAreaWedges, heliocentric, keplerRatio, nextEcc, nextTimeStep, orbitXY, PLANETS, simDays, solveKepler, STUDENT, studentPeriodDays, TIME_STEPS, visScale, YEAR_DAYS } from "@/lib/world/orrery";
import { ORR } from "@/lib/world/tessRoom";
import { worldAsset } from "@/lib/world/avatars";
import { useGLTF } from "@react-three/drei";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { ROOM_U } from "./roomUniforms";
import { useRoomProps } from "./roomProps";

const GLB = worldAsset("props/orrery_room.glb");
useGLTF.preload(GLB);

const RAD = Math.PI / 180;
/** mặt phẳng quỹ đạo (độ cao tâm hành tinh), độ cao trục giữa */
const PLANE_Y = 1.8;
const STUDENT_Y = 1.88;
/** bán trục lớn hiển thị của hành tinh học trò (viễn nhật 1,6·1,9 ≈ 3,0 m khi e = 0,9) */
const STUDENT_VIS = 1.6;
/** tay hành tinh i ở độ cao ARM_Y0 + i·ARM_DY (khớp cổ trục trong orr_base) */
const ARM_Y0 = 1.12;
const ARM_DY = 0.06;

/** đồng hồ mô phỏng (ngoài React): ngày kể từ J2000, hệ số thời gian, tâm sai hành tinh học trò */
export const ORS = { days: daysSinceJ2000(Date.now()), mult: 1e6 as number, e: 0.6 as number, pull: -1, turn: -1 };

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const fmtMult = (m: number) => (m < 10 ? "×1" : `×10${String(Math.round(Math.log10(m))).split("").map((d) => SUP[+d]).join("")}`);
const num = (v: number, d: number, vi: boolean) => (vi ? v.toFixed(d).replace(".", ",") : v.toFixed(d));

/** Nhãn gợi ý (F) cho Impossible.impNearby */
export function orreryHint(kind: "lever" | "dial", vi: boolean): string {
  if (kind === "lever") return vi ? `Cần gạt thời gian: ${fmtMult(ORS.mult)} → ${fmtMult(nextTimeStep(ORS.mult))}` : `Time lever: ${fmtMult(ORS.mult)} → ${fmtMult(nextTimeStep(ORS.mult))}`;
  return vi ? `Núm tâm sai hành tinh học trò: e = ${num(ORS.e, 1, vi)} → ${num(nextEcc(ORS.e), 1, vi)}` : `Student planet eccentricity: e = ${ORS.e.toFixed(1)} → ${nextEcc(ORS.e).toFixed(1)}`;
}

/** Vòm bản đồ sao: sao (băm theo ô kinh–vĩ), lưới xích kinh / xích vĩ màu đồng, dải hoàng đạo, quay chậm */
function domeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: ROOM_U.uT, uExposure: ROOM_U.uExposure },
    side: THREE.BackSide,
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uT; uniform float uExposure; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float lon = atan(d.z, d.x) + uT * 0.01;
        float lat = asin(clamp(d.y, -1.0, 1.0));
        vec2 uv = vec2(lon / 6.28318 + 0.5, lat / 1.5708);
        vec3 c = mix(vec3(0.02, 0.03, 0.09), vec3(0.06, 0.05, 0.16), uv.y);
        // sao: 3 lớp ô, mỗi ô tối đa một sao, độ sáng + màu theo băm
        for (int k = 0; k < 3; k++) {
          float sc = 60.0 + float(k) * 70.0;
          vec2 g = vec2(uv.x * sc * 2.0, uv.y * sc * 0.6);
          vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          float r = h(id + float(k) * 7.3);
          if (r > 0.82) {
            vec2 o = vec2(h(id + 1.7), h(id + 4.1)) - 0.5;
            float s = smoothstep(0.16, 0.0, length(f - o * 0.6)) * (r - 0.82) * 6.0;
            float tw = 0.75 + 0.25 * sin(uT * (1.0 + r * 3.0) + r * 40.0);
            c += mix(vec3(1.0, 0.85, 0.7), vec3(0.7, 0.85, 1.0), h(id + 9.0)) * s * tw;
          }
        }
        // lưới đồng: 24 kinh tuyến, 6 vĩ tuyến
        float gl = 1.0 - smoothstep(0.0, 0.004, abs(fract(uv.x * 24.0 + 0.5) - 0.5) / 24.0 * cos(lat));
        float gb = 1.0 - smoothstep(0.0, 0.003, abs(fract(uv.y * 6.0 + 0.5) - 0.5) / 6.0);
        c += vec3(0.85, 0.62, 0.3) * max(gl, gb) * 0.35;
        // dải hoàng đạo (nghiêng 23,44°)
        float ecl = abs(d.y * cos(0.409) - sin(lon) * sqrt(max(0.0, 1.0 - d.y * d.y)) * sin(0.409));
        c += vec3(1.0, 0.75, 0.35) * smoothstep(0.03, 0.0, ecl) * 0.5;
        gl_FragColor = vec4(c * uExposure, 1.0);
      }`,
  });
}

/** Quạt diện tích bằng nhau của hành tinh học trò (toạ độ máy, mặt phẳng y = 0), thuộc tính aK = chỉ số quạt */
function wedgeGeometry(e: number) {
  const w = equalAreaWedges(1, e, 12, 16);
  const pos: number[] = [];
  const kk: number[] = [];
  const c = Math.cos(STUDENT.varpi * RAD);
  const s = Math.sin(STUDENT.varpi * RAD);
  const P = (x: number, y: number) => {
    const X = (x * c - y * s) * STUDENT_VIS;
    const Y = (x * s + y * c) * STUDENT_VIS;
    return [X, 0, -Y];
  };
  w.forEach((poly, k) => {
    for (let j = 1; j < poly.length - 1; j++) {
      pos.push(...P(0, 0), ...P(poly[j][0], poly[j][1]), ...P(poly[j + 1][0], poly[j + 1][1]));
      kk.push(k, k, k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aK", new THREE.Float32BufferAttribute(kk, 1));
  return g;
}
function wedgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uCur: { value: 0 } },
    vertexShader: "attribute float aK; varying float vK; void main(){ vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uCur; varying float vK;
      void main(){
        float alt = mod(vK, 2.0);
        vec3 c = mix(vec3(1.0, 0.3, 0.75), vec3(0.35, 0.8, 1.0), alt) * 0.22;
        float cur = 1.0 - step(0.5, abs(vK - uCur));
        gl_FragColor = vec4(c + cur * vec3(1.0, 0.85, 0.5) * 0.45, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
/** Đường elip quỹ đạo (toạ độ máy) */
function orbitLine(a: number, e: number, varpi: number, scale: number, y: number, color: string, opacity: number) {
  const pts: THREE.Vector3[] = [];
  const c = Math.cos(varpi * RAD);
  const s = Math.sin(varpi * RAD);
  for (let i = 0; i < 128; i++) {
    const [x, yy] = orbitXY(a, e, (i / 128) * Math.PI * 2);
    pts.push(new THREE.Vector3((x * c - yy * s) * scale, y, -(x * s + yy * c) * scale));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity, toneMapped: false }));
}

export function OrreryRoom() {
  const vi = useWorld((s) => s.lang === "vi");
  const root = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const student = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const needle = useRef<THREE.Group>(null);
  const readout = useRef<HTMLDivElement | null>(null);

  const props = useRoomProps(GLB);
  const res = useMemo(() => {
    const part = (n: string) => props.clone(n);
    const orbits = PLANETS.map((p) => orbitLine(p.a, p.e, p.varpi, visScale(p.a), PLANE_Y, p.color, 0.45));
    const dome = new THREE.SphereGeometry(ORR.r - 0.02, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = domeMaterial();
    return {
      shell: part("orr_shell"),
      base: part("orr_base"),
      planets: PLANETS.map((p) => ({ bar: part("orr_bar"), rod: part("orr_rod"), ball: part(`orr_planet_${p.id}`) })),
      student: part("orr_student"),
      lever: part("orr_lever"),
      leverArm: part("orr_lever_arm"),
      dial: part("orr_dial"),
      needle: part("orr_dial_needle"),
      orbits,
      dome,
      domeMat,
    };
  }, [props]);

  // hình học phụ thuộc tâm sai: quạt + quỹ đạo hành tinh học trò
  const ecc = useRef(-1);
  const studentFx = useMemo(() => ({ wedges: new THREE.Mesh(new THREE.BufferGeometry(), wedgeMaterial()), orbit: new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color("#ff5fd2").multiplyScalar(1.5), toneMapped: false })) }), []);
  useEffect(
    () => () => {
      [res.dome, studentFx.wedges.geometry, studentFx.orbit.geometry].forEach((g) => g.dispose());
      res.orbits.forEach((l) => (l.geometry.dispose(), (l.material as THREE.Material).dispose()));
      [res.domeMat, studentFx.wedges.material as THREE.Material, studentFx.orbit.material as THREE.Material].forEach((m) => m.dispose());
    },
    [res, studentFx],
  );

  useEffect(() => {
    const a = registerAction("orrery-time", () => {
      ORS.mult = nextTimeStep(ORS.mult);
      ORS.pull = performance.now();
      sfx.click();
      if (ORS.mult === TIME_STEPS[TIME_STEPS.length - 1]) sfx.chime(3);
    });
    const b = registerAction("orrery-ecc", () => {
      ORS.e = nextEcc(ORS.e);
      ORS.turn = performance.now();
      sfx.click();
      sfx.chime(2);
    });
    return () => {
      a();
      b();
    };
  }, []);

  const lastRead = useRef(0);
  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    let on = true;
    for (let o: THREE.Object3D | null = g.parent; o; o = o.parent) if (!o.visible) on = false;
    const pl = useWorld.getState().player;
    const lx = pl.x - (g.parent ? g.parent.position.x : 0);
    // chỉ vẽ khi đứng ở nửa đông phòng điều khiển / hành lang / trong phòng (nhìn qua hành lang thấy phòng)
    // trong Phòng Lăng kính (tầng trên, sau vòm 90°) thì không thấy Thiên văn đồ → khỏi vẽ
    g.visible = on && lx > -2 && !(pl.y > 4 && lx > 13.4);
    if (!g.visible) return;
    ORS.days += simDays(Math.min(dt, 0.1), ORS.mult);
    PLANETS.forEach((p, i) => {
      const arm = arms.current[i];
      if (!arm) return;
      const h = heliocentric(p, ORS.days);
      const s = visScale(p.a);
      const r = h.r * s;
      arm.rotation.y = Math.atan2(h.y, h.x);
      const bar = arm.children[0];
      const rod = arm.children[1];
      const ball = arm.children[2];
      bar.scale.x = r;
      rod.position.x = r;
      ball.position.x = r;
    });
    // hành tinh học trò
    if (ecc.current !== ORS.e) {
      ecc.current = ORS.e;
      studentFx.wedges.geometry.dispose();
      studentFx.wedges.geometry = wedgeGeometry(ORS.e);
      studentFx.orbit.geometry.dispose();
      const o = orbitLine(1, ORS.e, STUDENT.varpi, STUDENT_VIS, 0, "#ff5fd2", 1);
      studentFx.orbit.geometry = o.geometry;
      (o.material as THREE.Material).dispose();
    }
    const T = studentPeriodDays();
    const M = (2 * Math.PI * ORS.days) / T;
    const E = solveKepler(M, ORS.e);
    const [sx, sy] = orbitXY(1, ORS.e, E);
    const c = Math.cos(STUDENT.varpi * RAD);
    const sn = Math.sin(STUDENT.varpi * RAD);
    if (student.current) student.current.position.set((sx * c - sy * sn) * STUDENT_VIS, STUDENT_Y, -(sx * sn + sy * c) * STUDENT_VIS);
    const frac = (((M / (2 * Math.PI)) % 1) + 1) % 1;
    (studentFx.wedges.material as THREE.ShaderMaterial).uniforms.uCur.value = Math.floor(frac * 12);
    // cần gạt: nghiêng theo nấc; núm: kim chỉ tâm sai
    const step = TIME_STEPS.indexOf(ORS.mult as (typeof TIME_STEPS)[number]);
    if (lever.current) {
      const target = (-0.9 + (1.8 * step) / (TIME_STEPS.length - 1));
      lever.current.rotation.x += (target - lever.current.rotation.x) * Math.min(1, dt * 8);
    }
    if (needle.current) {
      const target = -((ECC_STEPS.indexOf(ORS.e as (typeof ECC_STEPS)[number]) + 0.5) / ECC_STEPS.length) * Math.PI * 1.6 + 0.8 * Math.PI;
      needle.current.rotation.y += (target - needle.current.rotation.y) * Math.min(1, dt * 8);
    }
    // bảng số (4 lần / giây)
    const now = performance.now();
    if (readout.current && now - lastRead.current > 250) {
      lastRead.current = now;
      const date = new Date(Date.UTC(2000, 0, 1, 12) + ORS.days * 86400000);
      const ds = date.getUTCFullYear() > 9999 ? "…" : `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
      const perSec = simDays(1, ORS.mult);
      const rate = perSec >= 1 ? `${num(perSec, 1, vi)} ${vi ? "ngày" : "days"}` : perSec * 24 >= 1 ? `${num(perSec * 24, 1, vi)} ${vi ? "giờ" : "h"}` : `${num(perSec * 86400, 0, vi)} s`;
      const head = vi ? `Kepler III:  T² / a³ = hằng số\n${"".padEnd(9)}  a (AU)   T (năm)   T²/a³` : `Kepler III:  T² / a³ = constant\n${"".padEnd(9)}  a (AU)   T (yr)    T²/a³`;
      const rows = PLANETS.map((p) => `${(vi ? p.vi : p.en).padEnd(9)}  ${num(p.a, 3, vi).padStart(6)}  ${num(p.T / YEAR_DAYS, 3, vi).padStart(7)}   ${num(keplerRatio(p), 3, vi)}`);
      const foot = vi
        ? `Ngày mô phỏng: ${ds}   ${fmtMult(ORS.mult)} (1 s = ${rate})\nHọc trò: e = ${num(ORS.e, 1, vi)} · 12 quạt cùng thời gian ⇒ cùng diện tích`
        : `Simulated date: ${ds}   ${fmtMult(ORS.mult)} (1 s = ${rate})\nStudent: e = ${ORS.e.toFixed(1)} · 12 equal-time wedges ⇒ equal areas`;
      readout.current.textContent = `${head}\n${rows.join("\n")}\n${foot}`;
    }
  });

  const [lvx, lvz] = ORR.lever;
  const [dlx, dlz] = ORR.dial;
  return (
    <group ref={root} visible={false}>
      <group position={[ORR.cx, 0, 0]}>
        <primitive object={res.shell} />
        <mesh name="orr_dome" geometry={res.dome} material={res.domeMat} position-y={ORR.wallH} scale={[1, ORR.dome / ORR.r, 1]} />
      </group>
      <group name="orr_orrery" position={[ORR.cx, 0, 0]}>
        <primitive object={res.base} />
        {res.orbits.map((l, i) => (
          <primitive key={i} object={l} />
        ))}
        {PLANETS.map((p, i) => {
          const armY = ARM_Y0 + i * ARM_DY;
          const q = res.planets[i];
          return (
            <group key={p.id} name={`orr_arm_${p.id}`} ref={(el) => void (arms.current[i] = el)} position-y={armY}>
              <primitive object={q.bar} />
              <primitive object={q.rod} scale={[1, PLANE_Y - armY, 1]} />
              <group>
                <primitive object={q.ball} position-y={PLANE_Y - armY} />
              </group>
            </group>
          );
        })}
        <primitive object={studentFx.wedges} position-y={STUDENT_Y - 0.02} />
        <primitive object={studentFx.orbit} position-y={STUDENT_Y} />
        <group ref={student}>
          <primitive object={res.student} />
        </group>
        <Label3D text={vi ? "Thiên văn đồ · 3 định luật Kepler" : "The Orrery · Kepler's three laws"} position={[0, 3.6, 0]} variant="small" maxDist={18} />
      </group>
      {/* cần gạt thời gian */}
      <group name="orr_lever" position={[ORR.cx + lvx, 0, lvz]}>
        <primitive object={res.lever} />
        <group ref={lever} position-y={1.06}>
          <primitive object={res.leverArm} />
        </group>
        <Label3D text={vi ? "Cần gạt thời gian ×1 … ×10⁶ (F)" : "Time lever ×1 … ×10⁶ (F)"} position={[0, 2.0, 0]} variant="small" maxDist={9} />
      </group>
      {/* núm tâm sai */}
      <group name="orr_dial" position={[ORR.cx + dlx, 0, dlz]}>
        <primitive object={res.dial} />
        <group ref={needle} position-y={1.12}>
          <primitive object={res.needle} />
        </group>
        <Label3D text={vi ? "Núm tâm sai e (F)" : "Eccentricity dial e (F)"} position={[0, 1.7, 0]} variant="small" maxDist={9} />
      </group>
      {/* bảng số T²/a³ trên tường đông */}
      <group position={[ORR.cx + ORR.r - 0.6, 2.7, 0]}>
        <Label3D
          variant="math"
          maxDist={20}
          onEl={(el) => {
            readout.current = el;
            el.style.whiteSpace = "pre";
            el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
            el.style.fontSize = "11px";
            el.style.lineHeight = "1.35";
            el.style.borderRadius = "10px";
            el.style.background = "rgba(18,14,44,0.82)";
            el.style.border = "1px solid rgba(232,192,112,0.6)";
          }}
        />
      </group>
    </group>
  );
}
