"use client";
import { RemotePlayers } from "./RemotePlayers";
/**
 * Impossible Halls — non-Euclidean puzzle realm (inspired by portal-based "impossible spaces").
 * 1. The Booth: a 2×2 m booth whose doorway shows (and leads into) a vast hall — bigger on the inside.
 * 2. The Loop Corridor: walking forward never reaches the end (space is glued into a loop, like a torus);
 *    the counter-intuitive way out is to walk BACKWARDS.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Universe } from "./Tesseract";
import { Kiosk, KIOSK } from "./Kiosk";
import { PenroseSculpture } from "./PenroseSculpture";
import { HilbertHotel, conciergePos } from "./HilbertHotel";
import { PlatoCave, caveBlocked, SAGE } from "./PlatoCave";
import { MontyStage, montyBlocked, montyGround, HOST } from "./MontyStage";
import { CourtRail } from "./CourtRail";
import { TheseusDocks, theseusBlocked, WRIGHT } from "./TheseusDocks";
import { TheseusCubist } from "./TheseusCubist";
import { MaxwellLab, maxwellBlocked, nearDemon } from "./MaxwellLab";
import { ChineseRoomScene, croomBlocked, croomGround, LAN } from "./ChineseRoom";
import { TessRoom } from "./TessRoom";
import { clampCamera, insideRoomVolume, nearConsole, roomBlocked, roomGround, TR, updateRoomNav } from "@/lib/world/tessRoom";
import { nearPendulumLever } from "@/lib/world/pendulumWave";
import { nearGalton } from "@/lib/world/galtonBoard";
import { nearSlit } from "@/lib/world/doubleSlit";
import { nearHarpBeam } from "@/lib/world/lissajous";
import { nearHypercube } from "@/lib/world/hypercube";
import { nearOrrery } from "@/lib/world/orrery";
import { orreryHint } from "./OrreryRoom";
import { nearColorStation } from "@/lib/world/colorTheory";
import { colorHint } from "./PrismHall";
import { useFrame, useThree } from "@react-three/fiber";
import { Outlines, Sparkles, useTexture } from "@react-three/drei";
import { Label3D } from "../ui/Labels";
import { AnamorphSculpture } from "./AnamorphSculpture";
import { PoincareFloor } from "./PoincareFloor";
import { SoftClock } from "./SoftClock";
import { SIERP_WALL, SierpPaper } from "./SierpPaper";
import { BEAST_LOOKS, BEAST_PATHS, CosmicBeast } from "../fx/CosmicBeast";
import { ANAM } from "@/lib/world/anamorph";
import * as THREE from "three";
import { useWorld, useT } from "../store";
import { MagicCircle } from "../fx/Effects";
import { toonMaterial } from "../fx/shaders";
import { Player, type Nearby } from "./Hub";
import { Armillary } from "./HubDecor";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";
import { CORRIDOR, RAIL_CLEAR, isleBlocked, isleGround, onCourt } from "@/lib/world/impCosmos";
import { ImpossibleCosmos, IMP_SUN } from "./ImpossibleCosmos";
import { ShadowRig, usePdxStyle } from "./VoidHybrid";
import { Realify } from "../fx/realify";
import { FLIGHT, useFlight } from "../flight";
import { useGfx } from "../gfx";
import { motion } from "../combat/combat";
import { setWind } from "@/lib/world/sfx";
import { LAB_IDS, labSpot, type LabId } from "@/lib/world/impCosmos";
import { LAB_TITLES } from "./CosmosLab";
import { t as tt } from "@/lib/world/i18n";

const BOOTH = { x: -6, z: -4, w: 2.2, d: 2.2 }; // tâm bốt; cửa ở mặt +z
const DOOR_W = 1.5;
const HALL = { w: 26, d: 30, h: 11 }; // đại sảnh "bên trong" bốt
const CORR = { x: 7, z0: -2, w: 3, period: 10, len: 30 }; // hành lang chạy về −z
const PENROSE = { x: -12, z: 8 }; // tượng tam giác Penrose (góc tây nam sân)
/** Cổng sang Hư Không Nghịch Lý (bắc tâm sân) */
const PGATE = { x: 2.5, z: -7.5 };

type Space = "court" | "hall";
/** Không gian hiện tại (đọc trong hàm va chạm ngoài React) */
const SPACE: { v: Space } = { v: "court" };

/** Tâm phòng điều khiển: cửa bốt nằm ở cuối tiền sảnh hẹp (bán kính 17) → bước qua cửa là vào tiền sảnh tối rồi mới bung ra đại sảnh */
const ROOM = { x: BOOTH.x, z: BOOTH.z + BOOTH.d / 2 - TR.VEST.r1 };

/** Khung cửa vòm của kiosk (rộng 1,5, cao 2,3, vồng elip 0,35) — dùng làm mặt nạ portal đúng hình cửa */
function archShape() {
  const w = DOOR_W / 2;
  const h = 2.3;
  const rise = 0.35;
  const sh = new THREE.Shape();
  sh.moveTo(-w, 0);
  sh.lineTo(w, 0);
  sh.lineTo(w, h - rise);
  for (let i = 1; i <= 20; i++) {
    const a = (Math.PI * i) / 20;
    sh.lineTo(Math.cos(a) * w, h - rise + Math.sin(a) * rise);
  }
  sh.lineTo(-w, 0);
  return new THREE.ShapeGeometry(sh);
}

/** Bốt: vỏ Hyperkiosk + cửa portal mở dần theo lá cửa (chỉ hiện ở sân) */
function BoothExterior() {
  const { x, z, d } = BOOTH;
  const geo = useMemo(() => archShape(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <Kiosk x={x} z={z} />
      {/* Nhìn qua cửa thấy tiền sảnh tối rồi đại sảnh khổng lồ (portal stencil) */}
      <StencilPortal position={[x, 0.24, z + d / 2 + 0.06]} geometry={geo} openness={() => KIOSK.open}>
        <TessRoom cx={ROOM.x} cz={ROOM.z} lite />
      </StencilPortal>
    </group>
  );
}

/** Portal stencil: vùng cửa ghi stencil = 1; trong vùng đó đặt độ sâu về xa nhất; nội dung con chỉ hiện ở stencil = 1 */
function StencilPortal({ position, geometry, openness, children }: { position: [number, number, number]; geometry: THREE.BufferGeometry; openness?: () => number; children: React.ReactNode }) {
  const maskRef = useRef<THREE.Group>(null);
  const content = useRef<THREE.Group>(null);
  const mask = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
      }),
    [],
  );
  const resetDepth = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: "void main(){ vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = vec4(p.xy, p.w, p.w); }",
        fragmentShader: "void main(){ gl_FragColor = vec4(0.0); }",
        colorWrite: false,
        depthWrite: true,
        depthFunc: THREE.AlwaysDepth,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.EqualStencilFunc,
        stencilZPass: THREE.KeepStencilOp,
      }),
    [],
  );
  // Bật kiểm tra stencil cho mọi vật liệu bên trong (bản sao riêng, không ảnh hưởng vật liệu dùng chung).
  // Nội dung có thể gắn muộn (GLB đang tải → Suspense) nên quét lại định kỳ, chỉ xử lý lưới chưa vá.
  const touched = useRef<THREE.Material[]>([]);
  const tick = useRef(0);
  useFrame(() => {
    // Cửa mở bao nhiêu thì khe nhìn vào rộng bấy nhiêu (lá cửa trượt sang hai bên)
    if (maskRef.current && openness) {
      const o = Math.max(0.001, openness());
      maskRef.current.scale.x = o;
      maskRef.current.visible = o > 0.01;
      // cửa đóng: nội dung chỉ hiện trong vùng stencil = 1 mà mặt nạ không vẽ → ẩn luôn nội dung (khỏi gửi lệnh vẽ, useFrame
      // bên trong tự bỏ phần trình diễn qua scene/shown)
      if (content.current) content.current.visible = maskRef.current.visible;
    }
    if (tick.current++ % 30 !== 0 || !content.current) return;
    content.current.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.LineSegments).isLineSegments) return;
      if (o.userData.stencilDone) return;
      o.userData.stencilDone = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((src) => {
        const c = src.clone();
        // clone() làm mất onBeforeCompile (vá shader) và chép uniforms → giữ nguyên để cùng chương trình + cùng nhịp động
        if (src.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) c.onBeforeCompile = src.onBeforeCompile;
        if ((src as THREE.ShaderMaterial).isShaderMaterial) (c as THREE.ShaderMaterial).uniforms = (src as THREE.ShaderMaterial).uniforms;
        c.stencilWrite = true;
        c.stencilRef = 1;
        c.stencilFunc = THREE.EqualStencilFunc;
        c.stencilZPass = THREE.KeepStencilOp;
        c.stencilFail = THREE.KeepStencilOp;
        touched.current.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
      o.renderOrder = 3;
    });
  });
  useEffect(() => {
    const list = touched.current;
    return () => list.forEach((c) => c.dispose());
  }, []);
  return (
    <group>
      <group ref={maskRef} position={position}>
        <mesh geometry={geometry} material={mask} renderOrder={1} />
        <mesh geometry={geometry} material={resetDepth} renderOrder={2} />
      </group>
      <group ref={content}>{children}</group>
    </group>
  );
}

export function Impossible() {
  const avatar = useWorld((s) => s.avatar);
  const real = usePdxStyle((st) => st.real);
  const shadows = useGfx((st) => st.shadows);
  const sunPos = useMemo(() => IMP_SUN.clone().multiplyScalar(120).toArray() as [number, number, number], []);
  // bay lượn: chỉ ngoài sân (trong bốt là phòng kín)
  useEffect(
    () => () => {
      FLIGHT.enabled = false;
      useFlight.setState({ soaring: false, enabled: false });
      setWind(0);
    },
    [],
  );
  const prevZ = useRef(0);
  const court = useRef<THREE.Group>(null);
  const hall = useRef<THREE.Group>(null);
  const { gl, scene, camera } = useThree();
  // Biên dịch sẵn shader của phòng trong lúc nạp cảnh (đang che bởi đường hầm) → bước qua cửa không khựng.
  // Sân và phòng luôn được gắn; qua cửa chỉ bật/tắt visible (không đổi số đèn → không biên dịch lại vật liệu).
  useLayoutEffect(() => {
    // Suy ra không gian từ vị trí (gắn lại cảnh khi đang ở trong bốt không được ném người chơi ra sân)
    const pl = useWorld.getState().player;
    SPACE.v = pl.z < BOOTH.z + BOOTH.d / 2 - 0.2 && insideRoomVolume(pl.x - ROOM.x, Math.max(1, pl.y + 1), pl.z - ROOM.z) ? "hall" : "court";
    if (process.env.NODE_ENV !== "production") (window as unknown as { __imp: unknown }).__imp = { gl, scene, SPACE };
    if (!hall.current) return;
    // Cảnh vẽ qua EffectComposer vào render target (không gian màu tuyến tính) → biên dịch với một RT đang gắn,
    // nếu không khoá chương trình (outputColorSpace / toneMapping) sẽ lệch và vẫn phải biên dịch lại khi vào.
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    // Khởi động: vẽ một khung ẩn có cả phòng (tắt cắt frustum) → tải sẵn buffer/texture lên GPU, liên kết chương trình
    const culled: THREE.Object3D[] = [];
    hall.current.traverse((o) => {
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    // compile()/render() chỉ duyệt vật thể đang hiện → tạm hiện mọi thứ ẩn bên trong (các đích đến, cửa chớp…)
    const hidden: THREE.Object3D[] = [];
    hall.current.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    hall.current.visible = true;
    gl.setRenderTarget(rt);
    gl.compile(scene, camera);
    gl.render(scene, camera);
    gl.setRenderTarget(prev);
    hall.current.visible = SPACE.v === "hall";
    culled.forEach((o) => (o.frustumCulled = true));
    hidden.forEach((o) => (o.visible = false));
    rt.dispose();
  }, [gl, scene, camera]);
  useFrame(() => {
    const p = useWorld.getState().player;
    const doorZ = BOOTH.z + BOOTH.d / 2;
    const inDoor = Math.abs(p.x - BOOTH.x) < DOOR_W / 2;
    if (inDoor && prevZ.current >= doorZ && p.z < doorZ) SPACE.v = "hall";
    if (inDoor && prevZ.current < doorZ && p.z >= doorZ) SPACE.v = "court";
    const inside = SPACE.v === "hall";
    if (inside) updateRoomNav(p.x - ROOM.x, p.z - ROOM.z, p.y);
    if (court.current) court.current.visible = !inside;
    if (FLIGHT.enabled === inside) useFlight.setState({ enabled: !inside });
    FLIGHT.enabled = !inside;
    if (inside && motion.gliding) motion.gliding = false;
    if (hall.current) hall.current.visible = inside;
    // Hành lang: qua mốc 20 m thì lùi lại đúng một chu kỳ → không bao giờ tới cuối
    prevZ.current = p.z;
  });
  return (
    <group>
      {/* Sương hoàng hôn vũ trụ: hoà vào dải chân trời hồng tím → đảo xa nhạt dần như phối cảnh khí quyển */}
      <fog attach="fog" args={["#5b3f80", 90, 430]} />
      {real ? (
        <>
          {/* siêu thực (Endfield + lý thuyết màu): MỘT mặt trời ấm xiên thấp (~16°) làm đèn chính, fill trời lạnh yếu
              → tỉ lệ sáng : tối ~3:1, mặt khối tách bạch; ánh tím dội từ vực sao làm viền lạnh phía khuất (bổ sắc với nắng cam) */}
          <hemisphereLight args={["#9cb8ee", "#2a1f3d", 0.42]} />
          <directionalLight position={sunPos} intensity={3.2} color="#ffd1a3" />
          <directionalLight position={[-60, 25, 70]} intensity={0.55} color="#8a6cff" />
        </>
      ) : (
        <>
          <ambientLight intensity={0.25} />
          {/* Sao đôi lặn (nguồn sáng chính, khớp đèn nướng) + ánh tím dội từ vực sao */}
          <directionalLight position={sunPos} intensity={0.5} color="#ffd2b0" />
          <directionalLight position={[-60, -40, 70]} intensity={0.25} color="#8a6cff" />
        </>
      )}
      {shadows && real && <ShadowRig dir={sunPos} />}
      <group ref={court}>
        <Court />
        <ImpossibleCosmos real={real} safeGround={safeGround} />
      </group>
      <Realify root={court} on={real} />
      <group ref={hall} visible={false}>
        <TessRoom cx={ROOM.x} cz={ROOM.z} />
        <Universe cx={ROOM.x} cz={ROOM.z} />
      </group>
      <RemotePlayers />
      <Player avatarFile={AVATAR_BY_ID[avatar]?.file} blocked={impBlocked} findNearby={impNearby} camClamp={clampRoomCam} ground={impGround} />
    </group>
  );
}

/** Sân ngoài: nền, tường bao, hành lang tuần hoàn, cổng về, bốt */
function Court() {
  const t = useT();
  return (
    <>
      <CourtFloor />
      {/* Lan can đá quanh sân (Blender, instancing) — chừa khe cho hành lang khách sạn ở cạnh bắc */}
      <CourtRail />
      <HilbertHotel cx={CORR.x} z0={CORR.z0} />
      <group position={[0, 0, 16]}>
        <MagicCircle vertical radius={1.8} position={[0, 2.2, 0]} color="#ffd27a" color2="#8be0ff" />
      </group>
      <group position={[PGATE.x, 0, PGATE.z]}>
        <MagicCircle vertical radius={1.6} position={[0, 2.0, 0]} color="#b58bff" color2="#ffd27a" />
        <Label3 text={t("paradoxName")} pos={[0, 4.1, 0]} />
      </group>
      <Label3 text={t("impBooth")} pos={[BOOTH.x, 4.75, BOOTH.z]} />
      <PenroseSculpture position={[PENROSE.x, 3.0, PENROSE.z]} view={[0, -0.12, 1]} />
      <PlatoCave />
      <MontyStage />
      <TheseusDocks />
      {/* Tàu Theseus lập thể: cùng con tàu từ 4 góc nhìn trong một bức collage; ván vừa thay sáng vàng ở mọi góc */}
      <TheseusCubist />
      <MaxwellLab />
      {/* Đài Phép Chiếu: mảnh vỡ lập thể chỉ ghép thành chân dung kiểu Picasso từ đúng một điểm nhìn */}
      <AnamorphSculpture />
      {/* Sàn Poincaré: lát {7,3} kiểu Escher + tam giác trắc địa có tổng góc < 180° */}
      <PoincareFloor />
      {/* rồng tím – vàng dài 170 m bay vòng quanh các đảo */}
      <CosmicBeast path={BEAST_PATHS.impossible} look={BEAST_LOOKS.dusk} bodyLen={170} radius={5.5} speed={11} sun={IMP_SUN} />
      {/* Đồng hồ mềm kiểu Dalí vắt qua mép đảo Lorenz */}
      <SoftClock />
      {/* tấm Sierpiński giấy cắt dán: bóc từng cấp */}
      <SierpPaper />
      <ChineseRoomScene />
      <BoothExterior />
    </>
  );
}

function Label3({ text, pos }: { text: string; pos: [number, number, number] }) {
  return <Label3D text={text} position={pos} />;
}

function CourtFloor() {
  const tex = useTexture(worldAsset("art/tex_impossible_floor.webp"));
  const mat = useMemo(() => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 5);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    const m = toonMaterial("#ffffff");
    m.map = t;
    // tên để chế độ siêu thực nhận ra sàn sân (đổi bảng màu + ron vàng kim loại — fx/realify.tsx)
    m.name = "imp_court";
    return m;
  }, [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[40, 40]} />
    </mesh>
  );
}

/** Chỗ đứng an toàn (để hồi về khi rơi xuống vực): mặt sân hoặc mặt đảo */
function safeGround(x: number, z: number, y: number) {
  if (SPACE.v === "hall" || !motion.grounded) return false;
  return onCourt(x, z) || isleGround(x, z, y) !== null;
}

function impGround(x: number, z: number, y = 0) {
  if (SPACE.v === "hall") return roomGround(x - ROOM.x, z - ROOM.z, y);
  // ngoài mặt sân: hành lang Hilbert vươn ra vũ trụ (sàn / mái), đảo nổi, hoặc vực
  if (!onCourt(x, z)) return isleGround(x, z, y) ?? -200;
  if (Math.abs(z) > 20 && y > 3.2) return 3.7;
  // Đế kiosk 2 bậc (bát giác 2,6 m / 2,4 m)
  const dx = Math.abs(x - BOOTH.x);
  const dz = Math.abs(z - BOOTH.z);
  const oct = (h: number, c: number) => dx < h && dz < h && dx + dz < 2 * h - c;
  if (oct(1.2, 0.22)) return 0.24;
  if (oct(1.3, 0.24)) return 0.12;
  return montyGround(x, z) ?? croomGround(x, z) ?? 0;
}

function impBlocked(x: number, z: number, y = 0) {
  const r = 0.3;
  if (SPACE.v === "hall") return roomBlocked(x - ROOM.x, z - ROOM.z, y);
  if (isleBlocked(x, z, y)) return true;
  // Sân: tường bốt (trừ cửa) + tường hành lang + biên sân
  // Hành lang khách sạn Hilbert chạy xuyên qua cạnh bắc sân (quấn vô hạn ở z < −22) → trong lòng hành lang không bị chặn bởi biên sân
  const inCorridor = Math.abs(x - CORR.x) < CORR.w / 2 - r && z < CORR.z0 + 0.5 && y < 3.3;
  if (!inCorridor && (Math.abs(x) > 19.5 || Math.abs(z) > 19.5)) {
    // ngoài mép sân: lan can chỉ chặn khi đi bộ / bay thấp; khối hành lang vươn ra vũ trụ chặn từ bên ngoài
    if (x > CORRIDOR.x0 - r && x < CORRIDOR.x1 + r && z > CORRIDOR.z0 - r && z < -19.5 && y < 3.9) return true;
    return Math.abs(x) < 20.8 && Math.abs(z) < 20.8 && y < RAIL_CLEAR;
  }
  // bay cao trên sân: không vướng công trình
  if (y > 9) return false;
  if (Math.hypot(x - PENROSE.x, z - PENROSE.z) < 1.9) return true;
  if (x > 9 && z < -6.5 && caveBlocked(x, z)) return true;
  if (montyBlocked(x, z, y)) return true;
  if (z < -10.5 && theseusBlocked(x, z)) return true;
  if (z > 10 && x < -8 && maxwellBlocked(x, z)) return true;
  if (x < -8 && Math.abs(z + 2.5) < 4 && croomBlocked(x, z)) return true;
  const bx = Math.abs(x - BOOTH.x) < BOOTH.w / 2 + r && Math.abs(z - BOOTH.z) < BOOTH.d / 2 + r;
  if (bx && !(Math.abs(x - BOOTH.x) < DOOR_W / 2 - 0.05 && z > BOOTH.z)) return true;
  const inCorrX = Math.abs(x - CORR.x) < CORR.w / 2 + 0.3 + r && Math.abs(x - CORR.x) > CORR.w / 2 - r;
  if (inCorrX && z < CORR.z0 && y < 3.9) return true;
  return false;
}

/** Máy quay trong phòng điều khiển / tiền sảnh / hành lang: không nhìn xuyên tường */
const CAM_L = { x: 0, y: 0, z: 0 };
const TGT_L = { x: 0, y: 0, z: 0 };
function clampRoomCam(pos: THREE.Vector3, target: THREE.Vector3) {
  if (SPACE.v !== "hall") return;
  CAM_L.x = pos.x - ROOM.x;
  CAM_L.y = pos.y;
  CAM_L.z = pos.z - ROOM.z;
  TGT_L.x = target.x - ROOM.x;
  TGT_L.y = target.y;
  TGT_L.z = target.z - ROOM.z;
  if (clampCamera(CAM_L, TGT_L)) pos.set(CAM_L.x + ROOM.x, CAM_L.y, CAM_L.z + ROOM.z);
}

function impNearby(p: THREE.Vector3): Nearby | null {
  const lang = useWorld.getState().lang;
  if (motion.gliding) return null;
  // trạm thí nghiệm trên các đảo kỳ quan
  if (SPACE.v === "court" && !onCourt(p.x, p.z)) {
    // tấm Sierpiński giấy (đảo Sierpiński)
    if (Math.hypot(p.x - SIERP_WALL.x, p.z - SIERP_WALL.z) < 4.5 && Math.abs(p.y - SIERP_WALL.y) < 2.5) return { kind: "action", id: "sierp-peel", label: lang === "vi" ? "Bóc tiếp tam giác giấy" : "Peel the next paper level" };
    for (const id of LAB_IDS) {
      const L = labSpot(id);
      if (Math.abs(p.y - L.h) < 2 && Math.hypot(p.x - L.x, p.z - L.z) < L.r) return { kind: "lab", id, label: LAB_TITLES[id as LabId][lang === "vi" ? "vi" : "en"] };
    }
    return null;
  }
  // ở trên cao: không gợi ý nói chuyện / cổng bên dưới
  // Phòng Lăng kính (sàn y 5, sau vòm tầng lửng 90°): bệ F của các trạm lý thuyết màu
  const ca = SPACE.v === "hall" ? nearColorStation(p.x - ROOM.x, p.z - ROOM.z, p.y) : null;
  if (ca) return { kind: "action", id: `color:${ca}`, label: colorHint(ca, lang === "vi") };
  if (p.y > 4.5) return null;
  if (Math.hypot(p.x, p.z - 16) < 2.6) return { kind: "portal", id: "hub", label: tt(lang, "returnHub") };
  if (SPACE.v === "court" && Math.hypot(p.x - ANAM.x, p.z - ANAM.z) < 1.6) return { kind: "paradox", id: "anamorph", label: lang === "vi" ? "Nhìn từ điểm chiếu" : "Look from the projection point" };
  if (SPACE.v === "court" && Math.hypot(p.x - PGATE.x, p.z - PGATE.z) < 2.2) return { kind: "portal", id: "paradox", label: lang === "vi" ? "Bước vào Hư Không Nghịch Lý" : "Enter the Paradox Void" };
  if (SPACE.v === "court") {
    if (Math.hypot(p.x - SAGE.x, p.z - SAGE.z) < 2.0) return { kind: "npc", id: "plato", label: lang === "vi" ? "Nói chuyện với Hồi âm của Hang" : "Talk to the Echo of the Cave" };
    if (Math.hypot(p.x - LAN.x, p.z - LAN.z) < 2.2) return { kind: "npc", id: "lan", label: lang === "vi" ? "Nói chuyện với Lan" : "Talk to Lan" };
    if (nearDemon(p.x, p.z)) return { kind: "npc", id: "demon", label: lang === "vi" ? "Nói chuyện với Quỷ Maxwell" : "Talk to Maxwell's Demon" };
    if (Math.hypot(p.x - WRIGHT.x, p.z - WRIGHT.z) < 2.2) return { kind: "npc", id: "shipwright", label: lang === "vi" ? "Phụ Mộc sửa tàu" : "Help Moc repair the ship" };
    if (Math.hypot(p.x - HOST.x, p.z - HOST.z) < 3.0) return { kind: "npc", id: "host", label: lang === "vi" ? "Chơi Ba Cánh Cửa với MC Lumi" : "Play the Three Doors with Lumi" };
    const c = conciergePos(CORR.x, CORR.z0);
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.0) return { kind: "npc", id: "concierge", label: lang === "vi" ? "Hỏi lễ tân Vô Cực" : "Ask Vô Cực, the concierge" };
  }
  // Bàn điều khiển giữa phòng (chỉ khi đang ở trong bốt)
  // Cuối hành lang Thư viện (phía tây phòng điều khiển) → Thư viện Babel
  if (SPACE.v === "hall" && p.x - ROOM.x < -(TR.R + TR.CORR.L - 1.6) && Math.abs(p.z - ROOM.z) < 1.4) return { kind: "portal", id: "babel", label: lang === "vi" ? "Bước vào Thư viện Babel" : "Step into the Library of Babel" };
  if (SPACE.v === "hall" && nearConsole(p.x - ROOM.x, p.z - ROOM.z, p.y)) return { kind: "console", label: lang === "vi" ? "Dùng bàn điều khiển" : "Use the console" };
  // Thiên văn đồ (cuối hành lang đông): cần gạt thời gian, núm tâm sai
  const orr = SPACE.v === "hall" ? nearOrrery(p.x - ROOM.x, p.z - ROOM.z, p.y) : null;
  if (orr) return { kind: "action", id: orr === "lever" ? "orrery-time" : "orrery-ecc", label: orreryHint(orr, lang === "vi") };
  if (SPACE.v === "hall" && nearHypercube(p.x - ROOM.x, p.z - ROOM.z, p.y)) return { kind: "action", id: "hypercube-plane", label: lang === "vi" ? "Đổi mặt phẳng quay của siêu khối" : "Change the tesseract's rotation plane" };
  const beam = SPACE.v === "hall" ? nearHarpBeam(p.x - ROOM.x, p.z - ROOM.z, p.y) : null;
  if (beam !== null) return { kind: "action", id: `harp:${beam}`, label: lang === "vi" ? `Gảy tia tần số ${beam + 1}` : `Pluck beam ${beam + 1}` };
  const slit = SPACE.v === "hall" ? nearSlit(p.x - ROOM.x, p.z - ROOM.z, p.y) : null;
  if (slit === "detector") return { kind: "action", id: "slit-detector", label: lang === "vi" ? "Bật / tắt máy dò đường đi (khe Young)" : "Toggle the which-path detector" };
  if (slit === "gap") return { kind: "action", id: "slit-gap", label: lang === "vi" ? "Đổi khoảng cách hai khe" : "Change the slit gap" };
  const gal = SPACE.v === "hall" ? nearGalton(p.x - ROOM.x, p.z - ROOM.z, p.y) : null;
  if (gal === "drop") return { kind: "action", id: "galton-drop", label: lang === "vi" ? "Thả 240 viên qua bảng Galton" : "Drop 240 balls through the Galton board" };
  if (gal === "tilt") return { kind: "action", id: "galton-tilt", label: lang === "vi" ? "Nghiêng bảng Galton (đổi p)" : "Tilt the Galton board (change p)" };
  if (SPACE.v === "hall" && nearPendulumLever(p.x - ROOM.x, p.z - ROOM.z, p.y)) return { kind: "action", id: "pendulum-release", label: lang === "vi" ? "Thả lại con lắc sóng (cùng pha)" : "Release the pendulum wave (in phase)" };
  return null;
}
