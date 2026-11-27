"use client";
/**
 * Môi trường anime: bầu trời gradient (hoặc panorama vẽ tay nếu có), mây, đảo nổi, cỏ lay gió, pha lê, đèn.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Clouds, Cloud, Sparkles, Float, Outlines } from "@react-three/drei";
import * as THREE from "three";
import { grassShader, groundShader, skyShader, toonMaterial } from "../fx/shaders";
import { useWorld } from "../store";
import { worldAsset } from "@/lib/world/avatars";

export const PLAZA_R = 15;

export function Sky({ panorama }: { panorama?: string }) {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ ...skyShader, uniforms: THREE.UniformsUtils.clone(skyShader.uniforms), side: THREE.BackSide, depthWrite: false }),
    [],
  );
  // Panorama: một vật liệu cố định, gán map khi tải xong (đổi vùng = đổi ảnh, không gắn lại lưới).
  // fog: false — mặt cầu ở 400 m, xa hơn tầm sương (≤ 175 m) nên nếu nhận sương sẽ chỉ còn một màu phẳng.
  const pano = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false }), []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!panorama) return;
    let alive = true;
    new THREE.TextureLoader().loadAsync(panorama).then(
      (t) => {
        if (!alive) return t.dispose();
        t.colorSpace = THREE.SRGBColorSpace;
        t.mapping = THREE.EquirectangularReflectionMapping;
        const old = pano.map;
        pano.map = t;
        pano.needsUpdate = true;
        old?.dispose();
        setReady(true);
      },
      () => setReady(false),
    );
    return () => {
      alive = false;
    };
  }, [panorama, pano]);
  useEffect(() => () => [mat, pano].forEach((m) => m.dispose()), [mat, pano]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  if (ready) {
    return (
      <mesh scale={[-1, 1, 1]} material={pano}>
        <sphereGeometry args={[400, 48, 24]} />
      </mesh>
    );
  }
  return (
    <mesh material={mat}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

export function SkyClouds() {
  return (
    <Clouds material={THREE.MeshLambertMaterial} limit={200}>
      <Cloud seed={1} segments={30} bounds={[30, 4, 8]} volume={14} color="#ffffff" position={[0, -14, -70]} fade={80} />
      <Cloud seed={2} segments={24} bounds={[26, 4, 8]} volume={12} color="#fff1f6" position={[-60, -8, -20]} fade={80} />
      <Cloud seed={3} segments={24} bounds={[26, 4, 8]} volume={12} color="#eef7ff" position={[60, -10, 10]} fade={80} />
      <Cloud seed={4} segments={20} bounds={[20, 3, 6]} volume={10} color="#ffffff" position={[10, 18, -90]} opacity={0.7} fade={100} />
      <Cloud seed={5} segments={30} bounds={[60, 3, 60]} volume={20} color="#ffffff" position={[0, -22, 0]} fade={120} />
    </Clouds>
  );
}

/** fog=false khi cảnh tự đặt sương mù riêng — hai thẻ <fog> cùng gắn thì cái mount sau thắng (đổi theo Suspense / HMR) */
export function Lights({ fog = true, sun = [12, 20, 8], warm = false }: { fog?: boolean; sun?: [number, number, number]; warm?: boolean }) {
  return (
    <>
      {/* Ánh dội: trời xanh nhạt, đất tím hồng → bóng kiểu anime */}
      <hemisphereLight name="hemi" args={warm ? ["#a9c6ff", "#e8b898", 1.05] : ["#bcd6ff", "#a08cb8", 1.1]} />
      <directionalLight
        name="sunKey"
        position={sun}
        intensity={warm ? 2.6 : 2.4}
        color={warm ? "#ffd2a6" : "#fff0dc"}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />
      {/* Đèn ngược sáng: viền lạnh tách nhân vật khỏi nền */}
      <directionalLight position={[-9, 9, -14]} intensity={0.3} color="#b9d3ff" />
      {fog && <fog attach="fog" args={["#d4e3f8", 45, 170]} />}
    </>
  );
}

/** Đảo nổi: mặt cỏ tròn, vành đá, rễ treo, pha lê bay quanh */
export function FloatingIsland({ radius = PLAZA_R }: { radius?: number }) {
  const mats = useMemo(
    () => ({
      ground: new THREE.ShaderMaterial({ ...groundShader, uniforms: THREE.UniformsUtils.clone(groundShader.uniforms) }),
      rock: toonMaterial("#9c8a76", { rim: "#f3dcc0" }),
      rockDark: toonMaterial("#6b5a4d"),
      crystal: toonMaterial("#7fd3f5", { rim: "#e8fbff", emissive: "#1f6f95" }),
    }),
    [],
  );
  // Vách đá vẽ tay cho thân đảo
  useEffect(() => {
    new THREE.TextureLoader().loadAsync(worldAsset("art/tex_cliff.webp")).then(
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(12, 1);
        t.colorSpace = THREE.SRGBColorSpace;
        for (const m of [mats.rock, mats.rockDark]) {
          m.map = t;
          m.color.set("#cdbfb6");
          m.needsUpdate = true;
        }
      },
      () => {},
    );
  }, [mats]);
  const crystals = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const r = radius + 4 + (i % 3) * 2;
        return { pos: [Math.cos(a) * r, 2 + (i % 4) * 1.6, Math.sin(a) * r] as [number, number, number], s: 0.6 + (i % 3) * 0.35 };
      }),
    [radius],
  );
  return (
    <group>
      {/* Mặt đảo: shader tranh vẽ (cỏ loang, lối lát đá, bóng mờ dưới nhân vật) */}
      <GroundMesh material={mats.ground} radius={radius} />
      {/* Vành + thân đảo (nón ngược) */}
      <mesh position={[0, -0.63, 0]} material={mats.rock}>
        <cylinderGeometry args={[radius + 0.3, radius, 1.2, 64]} />
        <Outlines thickness={0.05} color="#4b3d33" />
      </mesh>
      <mesh position={[0, -6.2, 0]} material={mats.rockDark} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius, 10, 9]} />
      </mesh>
      {/* Pha lê bay */}
      {crystals.map((c, i) => (
        <Float key={i} speed={1.5 + (i % 3) * 0.3} rotationIntensity={0.8} floatIntensity={1.5} position={c.pos}>
          <mesh material={mats.crystal} scale={c.s}>
            <octahedronGeometry args={[0.8, 0]} />
            <Outlines thickness={0.03} color="#1b5d7a" />
          </mesh>
        </Float>
      ))}
      <Sparkles count={40} scale={[radius * 2, 6, radius * 2]} position={[0, 3, 0]} size={3} speed={0.3} color="#fff6c8" />
      <Grass radius={radius - 0.6} />
    </group>
  );
}

function GroundMesh({ material, radius }: { material: THREE.ShaderMaterial; radius: number }) {
  // Texture vẽ tay (nếu có) — không có thì shader dùng màu procedural
  useEffect(() => {
    const load = (url: string) =>
      new THREE.TextureLoader().loadAsync(url).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
      });
    Promise.all([load(worldAsset("art/tex_grass.webp")), load(worldAsset("art/tex_path.webp"))])
      .then(([g, p]) => {
        material.uniforms.uGrassTex.value = g;
        material.uniforms.uPathTex.value = p;
        material.uniforms.uUseTex.value = 1;
      })
      .catch(() => {});
  }, [material]);
  useFrame(() => {
    material.uniforms.uRadius.value = radius;
    material.uniforms.uPlayer.value.copy(useWorld.getState().player);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <circleGeometry args={[radius, 72]} />
    </mesh>
  );
}

/** Cỏ instanced, lay theo gió và rạp quanh nhân vật */
function Grass({ radius, count = 5000 }: { radius: number; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { gl } = useThree();
  const quality = useWorld((s) => s.quality);
  const base = quality === "low" ? 2500 : quality === "mid" ? 5500 : 8000;
  const n = gl.capabilities.isWebGL2 ? base : Math.floor(base / 3);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.075, 0.3, 1, 3);
    g.translate(0, 0.15, 0);
    // Thu nhọn ngọn
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      // sau translate, hàng đáy có thể là −1e-17 → pow(số âm, 1,6) = NaN (toàn bộ khối cầu bao NaN)
      const y = Math.max(0, p.getY(i));
      p.setX(i, p.getX(i) * (1 - Math.pow(y / 0.33, 1.6)));
    }
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ ...grassShader, uniforms: THREE.UniformsUtils.clone(grassShader.uniforms), side: THREE.DoubleSide, depthWrite: false }),
    [],
  );
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let k = 0;
    while (k < n) {
      const x = (Math.random() * 2 - 1) * radius;
      const z = (Math.random() * 2 - 1) * radius;
      const r = Math.hypot(x, z);
      if (r > radius) continue;
      // Chừa lối đi + vòng giữa
      if (Math.abs(x) < 1.35 && z < 1.2 && z > -9.2) continue;
      if (r > 3.1 && r < 4.3) continue;
      o.position.set(x, 0, z);
      o.rotation.y = Math.random() * Math.PI;
      const s = 0.6 + Math.random() * 0.9;
      o.scale.set(s, s, s);
      o.updateMatrix();
      m.setMatrixAt(k++, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [n, radius]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uPlayer.value.copy(useWorld.getState().player);
  });
  // Cỏ vẽ SAU mọi vật đặc và không ghi độ sâu → lượt viền mực (Ink) không kẻ nhiễu từng ngọn cỏ
  return <instancedMesh ref={ref} args={[geo, mat, n]} frustumCulled={false} renderOrder={5} />;
}

/** Cây / đá trang trí từ bộ Quaternius (nếu có), toon hoá vật liệu */
export function useToonGLTF(url: string | undefined) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) =>
      new GLTFLoader().loadAsync(url).then(
        (g) => {
          g.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const src = m.material as THREE.MeshStandardMaterial;
            const toon = toonMaterial(src.color ?? "#ffffff", { rim: "#fff4dc", rimPower: 3.5 });
            if (src.map) {
              src.map.colorSpace = THREE.SRGBColorSpace;
              toon.map = src.map;
            }
            // Lá cây dùng alpha mask: giữ cắt alpha, vẽ hai mặt
            if (src.alphaTest > 0 || src.transparent || /leaf|leaves|flower|petal|grass/i.test(src.name)) {
              toon.alphaTest = Math.max(src.alphaTest, 0.45);
              toon.side = THREE.DoubleSide;
            }
            toon.name = src.name;
            m.material = toon;
          });
          if (alive) setScene(g.scene);
        },
        () => {},
      ),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return scene;
}
