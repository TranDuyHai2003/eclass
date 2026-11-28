"use client";
/**
 * Chiếu nghỉ Escher — cầu thang Penrose sau vòm tầng lửng 270° của phòng Siêu khối (lib/world/penroseStair.ts, TESSERACT_BOOTH §13 H3).
 * - Hành lang chiếu nghỉ (sàn y 5) từ vòm tới cửa giếng thang; giếng vuông 4 chiếu nghỉ + 4 đợt × 9 bậc, leo theo chiều kim đồng hồ.
 * - Một vòng thang (bậc + tường + lan can + cửa) là MỘT hình học, vẽ 7 bản chồng nhau (InstancedMesh, cách nhau LAP_H) → không
 *   bao giờ thấy đầu / mối nối; shader làm tối dần theo khoảng cách độ cao tới người chơi.
 * - Leo quá một vòng → dời người chơi xuống đúng LAP_H (CAM.shift dời máy quay cùng lượng, như Thư viện Babel) → leo mãi.
 * - Bộ đếm "Số tầng đã leo: N · Độ cao tăng: 0 m"; âm Shepard theo độ cao mở; cửa chỉ mở khi đi XUỐNG tới chiếu nghỉ cửa.
 * Mô hình Blender `props/escher_stair.glb` (GI nướng vào màu đỉnh, nướng cùng bản sao vòng trên / dưới để bóng khớp mối nối;
 * script: scratchpad escher_build.py + room_bake.py): esc_lap (một vòng, y tương đối) + esc_passage (toạ độ tuyệt đối).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { doorOpen, ESC, escherStart, escherStep, floorsClimbed, heightGained, inShaft, landingIndex, LAP_H, lapShift, unwrappedHeight } from "@/lib/world/penroseStair";
import { onEscherPassage, roomGround, roomNav, TR } from "@/lib/world/tessRoom";
import { setShepardStair } from "../audio/shepardStair";
import { CAM } from "../combat/combat";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { ROOM_U } from "./roomUniforms";
import { useRoomProps } from "./roomProps";

const GLB = worldAsset("props/escher_stair.glb");
useGLTF.preload(GLB);

/** số bản vòng chồng nhau: −3 … +3 */
const LAPS = [-3, -2, -1, 0, 1, 2, 3];
/** trạng thái (ngoài React): bộ đếm, số vòng đã quấn, cửa */
export const ESCHER = { s: escherStart(), laps: 0, active: false, sealedK: 0 };

/** Uniform mờ dần theo độ cao (dùng chung cho mọi vật liệu của chồng vòng thang) */
const FADE_U = { uPY: { value: 0 }, uFade: { value: 11 }, uFadeCol: { value: new THREE.Color("#0d0a1c") } };

/**
 * Bọc vật liệu nướng (bakedMaterial / glow MeshBasic của useRoomProps) thêm mờ dần theo khoảng cách độ cao tới người chơi:
 * giữ nguyên onBeforeCompile gốc rồi chèn biến y thế giới (có instanceMatrix) + trộn về màu tối ở cuối shader.
 */
function fadeMaterial(src: THREE.Material): THREE.Material {
  const b = src as THREE.MeshBasicMaterial;
  const m = new THREE.MeshBasicMaterial({ color: b.color.clone(), vertexColors: b.vertexColors, toneMapped: b.toneMapped });
  m.name = b.name;
  const base = src.onBeforeCompile.bind(src);
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.uniforms.uPY = FADE_U.uPY;
    sh.uniforms.uFade = FADE_U.uFade;
    sh.uniforms.uFadeCol = FADE_U.uFadeCol;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vFadeY;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 fadeW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fadeW = instanceMatrix * fadeW;
      #endif
      vFadeY = (modelMatrix * fadeW).y;`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFadeY; uniform float uPY; uniform float uFade; uniform vec3 uFadeCol;")
      .replace(
        "#include <dithering_fragment>",
        `float fadeD = abs(vFadeY - uPY) / uFade;
        gl_FragColor.rgb = mix(uFadeCol, gl_FragColor.rgb, exp(-fadeD * fadeD));
        #include <dithering_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `escFade|${b.vertexColors ? "baked" : "glow"}`;
  return m;
}

/** Màn cửa: lưới gạch Escher (tam giác Penrose / khối isometric) trôi lên; uSealed → đặc như tường */
function veilMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: ROOM_U.uT, uSealed: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: `uniform float uT; uniform float uSealed; varying vec2 vUv;
      void main(){
        // lưới khối lập phương isometric (gạch "Reptiles"/"Ascending and Descending" giản lược) trôi lên
        vec2 p = vUv * vec2(4.0, 6.0) + vec2(0.0, -uT * 0.35);
        vec2 r = vec2(1.0, 1.732); vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        float ang = atan(g.y, g.x);
        float face = floor(mod((ang + 3.14159) / 2.0944, 3.0));
        float edge = smoothstep(0.40, 0.46, max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y)));
        vec3 open = mix(vec3(1.0, 0.28, 0.75), vec3(0.55, 0.25, 1.0), face * 0.5) * (0.55 + 0.25 * face) + vec3(1.0, 0.85, 1.0) * edge;
        float frame = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(1.0, 0.95, vUv.y);
        vec3 sealed = vec3(0.36, 0.31, 0.46) * (0.8 + 0.2 * face) + vec3(0.9, 0.3, 0.7) * edge * 0.15;
        gl_FragColor = vec4(mix(open * (0.6 + 0.6 * frame), sealed, uSealed), 1.0);
      }`,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

export function EscherStair({ cx, cz }: { cx: number; cz: number }) {
  const vi = useWorld((s) => s.lang === "vi");
  const root = useRef<THREE.Group>(null);
  const label = useRef<THREE.Group>(null);
  const labelEl = useRef<HTMLDivElement | null>(null);
  const props = useRoomProps(GLB);
  const res = useMemo(() => {
    // một vòng thang: mỗi vật liệu một InstancedMesh × 7 bản (cách nhau LAP_H)
    const lap = props.meshesOf("esc_lap").map(({ geo, mat }) => new THREE.InstancedMesh(geo, fadeMaterial(mat), LAPS.length));
    const veilGeo = new THREE.PlaneGeometry(ESC.DOOR, ESC.DOOR_H);
    veilGeo.rotateY(-Math.PI / 2);
    veilGeo.translate(ESC.X1 + 0.06, ESC.DOOR_H / 2, 0);
    const veilMat = veilMaterial();
    const veil = new THREE.InstancedMesh(veilGeo, veilMat, LAPS.length);
    const all = [...lap, veil];
    const o = new THREE.Object3D();
    LAPS.forEach((k, i) => {
      o.position.set(0, ESC.y0 + k * LAP_H, 0);
      o.updateMatrix();
      all.forEach((im) => im.setMatrixAt(i, o.matrix));
    });
    all.forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
    lap.forEach((im) => (im.name = "esc_lap"));
    veil.name = "esc_door_veil";
    const passage = props.clone("esc_passage");
    // nắp tối ở hai đầu chồng vòng (dưới vòng −3, trên vòng +3)
    const capGeo = new THREE.PlaneGeometry(ESC.X1 - ESC.X0, ESC.Z1 - ESC.Z0);
    capGeo.rotateX(-Math.PI / 2);
    const capMat = new THREE.MeshBasicMaterial({ color: "#0d0a1c", side: THREE.DoubleSide });
    return { lap, veil, veilMat, passage, capGeo, capMat };
  }, [props]);
  useEffect(
    () => () => {
      res.lap.forEach((im) => {
        im.geometry.dispose();
        (im.material as THREE.Material).dispose();
        im.dispose();
      });
      res.veil.geometry.dispose();
      res.veilMat.dispose();
      res.veil.dispose();
      res.capGeo.dispose();
      res.capMat.dispose();
      setShepardStair(0, 0);
      roomNav.escherSealed = false;
      ESCHER.active = false;
    },
    [res],
  );

  const shift = useMemo(() => new THREE.Vector3(), []);
  const lastText = useRef("");
  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    // chỉ chạy khi phòng điều khiển đang hiện (đang ở trong bốt)
    let on = true;
    for (let o: THREE.Object3D | null = g.parent; o; o = o.parent) if (!o.visible) on = false;
    const p = useWorld.getState().player;
    const lx = p.x - cx;
    const lz = p.z - cz;
    const inS = on && inShaft(lx, lz) && p.y > ESC.y0 - 1.2;
    const inP = on && onEscherPassage(lx, lz) && p.y > ESC.y0 - 0.6;
    g.visible = on && lx < -(TR.R - 1.5) && p.y > ESC.y0 - 1.5;
    if (inP && lx > ESC.X1 + 0.5) {
      // ra tới hành lang: đặt lại bộ đếm (vào lại là bắt đầu từ đầu)
      ESCHER.s = escherStart();
      ESCHER.laps = 0;
    }
    if (inS) {
      const sh = lapShift(p.y);
      if (sh !== 0) {
        p.y += sh;
        CAM.shift = shift.set(0, sh, 0).clone();
        ESCHER.laps -= Math.round(sh / LAP_H);
      }
      // đứng trên chiếu nghỉ → cập nhật bộ đếm
      if (Math.abs(roomGround(lx, lz, p.y) - p.y) < 0.06) {
        const li = landingIndex(lx, lz, p.y, ESCHER.laps);
        if (li !== null) ESCHER.s = escherStep(ESCHER.s, li);
      }
    }
    ESCHER.active = inS || inP;
    roomNav.escherSealed = inS && !doorOpen(ESCHER.s);
    // cửa: tan / đặc dần
    const sealT = roomNav.escherSealed ? 1 : 0;
    ESCHER.sealedK += (sealT - ESCHER.sealedK) * Math.min(1, dt * 5);
    (res.veilMat.uniforms.uSealed as { value: number }).value = ESCHER.sealedK;
    FADE_U.uPY.value = p.y;
    // âm Shepard: trong giếng to dần, ở hành lang nhỏ
    const level = inS ? 1 : inP ? Math.max(0, Math.min(1, (ESC.PX1 - lx) / 8)) * 0.5 : 0;
    setShepardStair(level, unwrappedHeight(p.y, ESCHER.laps) / LAP_H);
    // bộ đếm nổi giữa giếng, ngang tầm mắt
    if (label.current) label.current.position.set((ESC.X0 + ESC.X1) / 2, p.y + 2.3, (ESC.Z0 + ESC.Z1) / 2);
    if (labelEl.current && inS) {
      const n = floorsClimbed(ESCHER.s);
      const hg = heightGained();
      const hint = roomNav.escherSealed ? (vi ? "\nCửa đã biến mất… lối ra ở phía DƯỚI" : "\nThe door is gone… the way out is DOWN") : "";
      const txt = vi ? `Số tầng đã leo: ${n} · Độ cao tăng thêm: ${hg} m${hint}` : `Floors climbed: ${n} · Height gained: ${hg} m${hint}`;
      if (txt !== lastText.current) {
        lastText.current = txt;
        labelEl.current.textContent = txt;
      }
    }
    if (labelEl.current) labelEl.current.style.visibility = inS ? "visible" : "hidden";
  });
  const capY = ESC.y0 + LAPS[0] * LAP_H - ESC.SLAB - 0.01;
  const capTop = ESC.y0 + (LAPS[LAPS.length - 1] + 1) * LAP_H - ESC.SLAB + 0.01;
  const mid: [number, number] = [(ESC.X0 + ESC.X1) / 2, (ESC.Z0 + ESC.Z1) / 2];
  return (
    <group ref={root} visible={false}>
      {res.lap.map((im) => (
        <primitive key={im.uuid} object={im} />
      ))}
      <primitive object={res.veil} />
      <primitive object={res.passage} />
      <mesh geometry={res.capGeo} material={res.capMat} position={[mid[0], capY, mid[1]]} />
      <mesh geometry={res.capGeo} material={res.capMat} position={[mid[0], capTop, mid[1]]} />
      <group position={[ESC.X1 + 1.2, ESC.y0 + ESC.PH - 0.2, 0]}>
        <Label3D text={vi ? "Chiếu nghỉ Escher · Cầu thang Penrose" : "Escher landing · The Penrose stairs"} variant="small" maxDist={9} />
      </group>
      <group ref={label}>
        <Label3D
          variant="math"
          maxDist={12}
          onEl={(el) => {
            labelEl.current = el;
            el.style.whiteSpace = "pre";
            el.style.textAlign = "center";
            el.style.background = "rgba(40,16,60,0.72)";
          }}
        />
      </group>
    </group>
  );
}
