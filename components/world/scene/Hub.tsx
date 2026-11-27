"use client";
import { RemotePlayers } from "./RemotePlayers";
/**
 * Sảnh: đảo nổi, cổng vào Thung lũng Hàm số, Bảo tàng Khám phá, Gương chọn nhân vật, NPC, Sinh vật Hồi âm.
 * Nhân vật đi bằng WASD / joystick; kéo chuột / vuốt để xoay máy quay.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Label3D } from "../ui/Labels";
import { SelfName } from "../ui/NameField";
import { CAM, addFx, air, attackLocked, cancelRecovery, chargeLevel, curWeapon, motion, plungeImpact, rhythmGold, tickCombat, trailActive, updrafts, useCombat } from "../combat/combat";
import { WeaponTrail } from "../fx/WeaponTrail";
import { SCOPE, useScope, zoomBy } from "../scope";
import { FLIGHT, useFlight } from "../flight";
import { FLY, soarVertical } from "@/lib/world/impCosmos";
import { nearestFree } from "@/lib/world/collide";
import { setWind } from "@/lib/world/sfx";
import { WingTrails } from "../fx/WingTrails";
const RAY = new THREE.Raycaster();
const SD_P = new THREE.Vector3();
const SD_S = new THREE.Sphere();
/**
 * Khoảng cách tới vật ở tâm ống nhòm — RẺ: bước dọc tia trên hàm độ cao mặt đất (bước 0,5 → 6 m) + giao với hình cầu bao
 * của các lưới đang hiện (không thử từng tam giác: raycast cả model Quảng trường hàng trăm nghìn tam giác gây khựng mỗi lần đo).
 */
function scopeDistance(ray: THREE.Ray, scene: THREE.Scene, ground?: (x: number, z: number, y?: number) => number): number | null {
  let best = Infinity;
  if (ground) {
    let t = 0.5;
    while (t < 460) {
      ray.at(t, SD_P);
      if (SD_P.y < ground(SD_P.x, SD_P.z, SD_P.y + 0.5)) {
        best = t;
        break;
      }
      t += Math.min(6, 0.5 + t * 0.04);
    }
  }
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || g.boundingSphere.radius > 60) return;
    // bỏ hiệu ứng trong suốt (khiên, vòng phép, hạt…) — không phải "vật" để đo
    const mat = m.material as THREE.Material;
    if (!mat || (mat.transparent && !mat.depthWrite)) return;
    SD_S.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
    // hình cầu bao chứa chính mắt nhìn (vật bao quanh người xem) → bỏ
    if (SD_S.containsPoint(ray.origin)) return;
    const hit = ray.intersectSphere(SD_S, SD_P);
    if (!hit) return;
    const d = SD_P.distanceTo(ray.origin);
    if (d > 0.8 && d < best) best = d;
  });
  return best < 460 ? best : null;
}
const CENTER = new THREE.Vector2(0, 0);
import { GliderModel, Updrafts } from "./Props";
import { WEAPON_DEFS, useBag, type WeaponId } from "../combat/items";
import type { Held } from "../player/Avatar";

/** Vũ khí cầm tay (kiếm, đòn bẩy, trượng tay phải; cung tay trái) — còn lại là pháp khí bay cạnh người */
export const HELD_W: Partial<Record<WeaponId, { hand: "right" | "left"; grip: number }>> = {
  blade: { hand: "right", grip: 0.11 },
  lever: { hand: "right", grip: 0.22 },
  staff: { hand: "right", grip: 0.45 },
  bow: { hand: "left", grip: 0 },
};
import { CombatFx, Enemies, WeaponFamiliar, useWeaponModel } from "../combat/CombatScene";
import { Ouroboros } from "./Props";
import { MathCreature } from "./MathCreatures";
import * as THREE from "three";
import { useWorld, timeScale, useT, type ActClip } from "../store";
import { t as tt } from "@/lib/world/i18n";
import { Avatar, type Pose } from "../player/Avatar";
import { MagicCircle, Shield } from "../fx/Effects";
import { BlobShadow, useArchMaterials } from "./Architecture";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";
import { DUMMIES, GARDEN, GATES, GATE_BY_ID, HUB_WALK_R, INTERACT, MUSEUM, NPC, PAVILION, UPDRAFT, YARD, creatureSpot, hubBlocked as layoutBlocked, hubGround, type GateId } from "@/lib/world/hubLayout";
import { HubPlaza } from "./HubPlaza";
import { TITLES } from "../ui/AreaTitle";
import type { CreatureView } from "@/lib/world/service";

/** Cổng phó bản boss (bệ nam) — giữ tên cũ cho các nơi khác dùng */
export const SIREN_GATE = new THREE.Vector3(GATE_BY_ID.siren.x, 0, GATE_BY_ID.siren.z);
const V3 = (p: { x: number; z: number }) => new THREE.Vector3(p.x, 0, p.z);
export const SPOTS = {
  portal: V3(INTERACT.valley),
  gate: V3(INTERACT.expanse),
  gate2: V3(INTERACT.impossible),
  museum: V3(INTERACT.museum),
  mirror: V3(INTERACT.mirror),
  guide: V3(NPC.guide),
};
const INTERACT_R = 2.6;
// Vector tạm dùng lại mỗi khung hình (tránh rác bộ nhớ)
const TMP_DIR = new THREE.Vector3();
const FREE = new THREE.Vector3();
let SHADOW_TEX: THREE.Texture | null = null;
/** vệt bóng tròn mềm (gradient xuyên tâm, alpha) — dùng chung */
function contactShadowTexture(): THREE.Texture {
  if (SHADOW_TEX) return SHADOW_TEX;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.95)");
  gr.addColorStop(0.45, "rgba(255,255,255,0.6)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  SHADOW_TEX = new THREE.CanvasTexture(c);
  return SHADOW_TEX;
}

const TMP_T = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

export function Hub() {
  const creatures = useWorld((s) => s.state.creatures);
  const avatar = useWorld((s) => s.avatar);
  const quality = useWorld((s) => s.quality);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const t = useT();
  const gateName: Record<GateId, string> = { impossible: TITLES.impossible.name[lang], valley: TITLES.valley.name[lang], expanse: TITLES.expanse.name[lang], siren: TITLES.siren.name[lang] };
  return (
    <group>
      <HubPlaza />
      {/* NPC VRM ~20 MB mỗi model: bỏ trên máy yếu / điện thoại */}
      {quality !== "low" && (
        <>
          <Npc file="avatars/cute-girl.vrm" position={V3(NPC.guide)} label={t("npcGuide")} rotationY={0.86} />
          <Npc file="avatars/virdira.vrm" position={V3(NPC.curator)} label={t("npcCurator")} rotationY={1.72} />
        </>
      )}
      {creatures.map((c, i) => (
        <Creature key={c.kc} c={c} index={i} />
      ))}
      <RemotePlayers />
      <Player armed avatarFile={AVATAR_BY_ID[avatar]?.file} clampR={HUB_WALK_R} ground={hubGround} blocked={(x, z) => layoutBlocked(x, z)} findNearby={(p) => nearest(p, useWorld.getState().state.creatures)} />
      {/* Bãi tập (đông nam): vài quái toán học để thử vũ khí; thế giới mở có nhiều hơn */}
      <Enemies
        aggro={5}
        ground={hubGround}
        clampR={HUB_WALK_R}
        spawner={{ kind: "fixed", points: [{ kind: "slime", at: [DUMMIES[0][0], 0, DUMMIES[0][1]] }, { kind: "mite", at: [DUMMIES[1][0], 0, DUMMIES[1][1]] }, { kind: "wisp", at: [DUMMIES[2][0], 0, DUMMIES[2][1]] }] }}
      />
      <CombatFx />
      {/* Kỳ quan ∞ lơ lửng ngoài khơi phía bắc, sau cổng Penrose */}
      <Ouroboros position={[0, 10, -46]} scale={2.4} />
      <Updrafts list={[UPDRAFT]} />
      {GATES.map((g) => (
        <Label3D key={g.id} text={gateName[g.id]} position={[g.gx, 8.4, g.gz]} maxDist={70} />
      ))}
      <Label3D text={t("museum")} position={[MUSEUM.x, 10.2, MUSEUM.z]} maxDist={70} />
      <Label3D text={t("mirror")} position={[PAVILION.x, 7.6, PAVILION.z]} maxDist={70} />
      <Label3D text={lang === "vi" ? "Bãi tập" : "Training yard"} position={[YARD.x, 3.6, YARD.z]} maxDist={45} />
      <Label3D text={lang === "vi" ? "Vườn Hồi âm" : "Echo Garden"} position={[GARDEN.x, 2.6, GARDEN.z]} maxDist={45} />
    </group>
  );
}

export type Nearby = NonNullable<ReturnType<typeof useWorld.getState>["nearby"]>;

/**
 * Trọng lực tuỳ biến cho Player (Mê cung Hoạ âm). Không truyền → hành vi cũ ở mọi cảnh.
 *  gravity: hệ số trọng lực tại vị trí (vùng trọng lực yếu)
 *  steer:   bẻ hướng đi bộ (thế giới, mặt xz) — có thể rút ngắn / triệt tiêu
 *  drive:   cảnh tự di chuyển người chơi khung này (hành tinh, tường thành sàn…) → Player bỏ qua đi / rơi / mặt đất
 *  frame:   quaternion đưa trục y thế giới về hướng "lên" hiện tại (đã làm mượt) — xoay nhân vật + máy quay; null = thường
 *  camFrame: (tuỳ chọn) hệ quy chiếu riêng cho máy quay — vd. "giảm chuyển động": máy quay giữ chân trời, chỉ nhân vật xoay
 */
export interface PlayerField {
  gravity?: (p: THREE.Vector3) => number;
  steer?: (dir: THREE.Vector3, p: THREE.Vector3) => void;
  drive?: (dt: number) => boolean;
  frame?: () => THREE.Quaternion | null;
  camFrame?: () => THREE.Quaternion | null;
}
const Y_UP = new THREE.Vector3(0, 1, 0);

// ───────────── Nhân vật + điều khiển ─────────────

/** Nhân vật + máy quay góc ba, dùng chung cho mọi thế giới */
export function Player({
  avatarFile,
  ground,
  clampR,
  blocked,
  findNearby,
  armed,
  camClamp,
  field,
}: {
  /** Trọng lực tuỳ biến (xem PlayerField) */
  field?: PlayerField;
  /** Kẹp vị trí camera (vd. giữ trong phòng tròn) — sửa trực tiếp vectơ */
  camClamp?: (pos: THREE.Vector3, target: THREE.Vector3) => void;
  /** Có vũ khí + chiến đấu ở cảnh này */
  armed?: boolean;
  avatarFile?: string;
  ground?: (x: number, z: number, y?: number) => number;
  clampR?: number;
  /** Va chạm: true nếu vị trí (x, z) bị chặn */
  blocked?: (x: number, z: number, y: number) => boolean;
  findNearby: (p: THREE.Vector3) => Nearby | null;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();
  const poseRef = useRef<Pose>("idle");
  const drag = useRef<{ x: number; active: boolean }>({ x: 0, active: false });
  const camPos = useRef(new THREE.Vector3(0, 4, 14));
  const camTarget = useRef(new THREE.Vector3(0, 1.35, 3));

  // Camera góc ba kiểu game nhập vai: desktop khoá chuột (rê để xoay 2 trục, lăn để zoom);
  // điện thoại vuốt nửa phải màn hình để xoay, chụm 2 ngón để zoom.
  useEffect(() => {
    const el = gl.domElement;
    // ống nhòm: độ nhạy giảm theo độ phóng, cho phép ngước nhìn trời (góc âm sâu hơn)
    const rotate = (dx: number, dy: number, k: number) =>
      useWorld.setState((st) => {
        const sc = useScope.getState().on;
        const kk = sc ? k / Math.max(1, SCOPE.zoom) : k;
        const soar = FLIGHT.enabled && motion.gliding;
        return { camYaw: st.camYaw - dx * kk, camPitch: Math.min(sc ? 1.2 : soar ? 1.3 : 1.15, Math.max(sc ? -1.3 : soar ? -0.9 : -0.15, st.camPitch + dy * kk)) };
      });
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        if (!document.pointerLockElement && !useWorld.getState().overlay) el.requestPointerLock?.()?.catch?.(() => {});
        return;
      }
      if (e.clientX > window.innerWidth * 0.4) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        if (document.pointerLockElement === el) rotate(e.movementX, e.movementY, 0.0028);
        return;
      }
      const t = touches.get(e.pointerId);
      if (!t) return;
      if (touches.size >= 2) {
        const pts = [...touches.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinch) useWorld.setState((st) => ({ camDist: Math.min(10, Math.max(1.6, st.camDist * (pinch / Math.max(1, d)))) }));
        pinch = d;
      } else rotate(e.clientX - t.x, e.clientY - t.y, 0.006);
      t.x = e.clientX;
      t.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (useScope.getState().on) return zoomBy(e.deltaY > 0 ? 1 / 1.18 : 1.18);
      useWorld.setState((st) => ({ camDist: Math.min(10, Math.max(1.6, st.camDist * (1 + Math.sign(e.deltaY) * 0.1))) }));
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: true });
    // Mở bảng / lớp phủ → nhả chuột
    const unsub = useWorld.subscribe((st, prev) => {
      if (st.overlay && !prev.overlay && document.pointerLockElement) document.exitPointerLock();
    });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      unsub();
    };
  }, [gl]);

  const [pose, setPoseState] = useState<Pose>("idle");
  const [actId, setActId] = useState(0);
  const [actClip, setActClip] = useState<ActClip | null>(null);
  const scopeHid = useRef(false);
  const scopeRay = useRef(0);
  const glider = useRef<THREE.Group>(null);
  const flyHud = useRef(0);
  const stuck = useRef({ t: 0, at: 0, ok: false });
  /** vận tốc ngang khi đi bộ (có gia tốc / giảm tốc — không bật tắt tức thời theo phím) */
  const gvel = useRef(new THREE.Vector3());
  // bóng tiếp xúc mềm dưới chân (thay vòng phép): nằm trên mặt đất, nhạt + loe ra khi nhảy / bay cao
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: contactShadowTexture(), color: "#1a1430", transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false }), []);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);
  const camK = useRef(1);
  const aimK = useRef(0);
  const actRef = useRef(0);
  const weaponIdx = useCombat((st) => st.weapon);
  const loadout = useBag((st) => st.loadout);
  const wid = ((loadout.filter(Boolean) as WeaponId[])[weaponIdx % Math.max(1, loadout.filter(Boolean).length)] ?? "blade") as WeaponId;
  const wModel = useWeaponModel(wid);
  const held: Held = useMemo(() => (armed && HELD_W[wid] && wModel ? { obj: wModel, hand: HELD_W[wid]!.hand, grip: HELD_W[wid]!.grip } : null), [armed, wid, wModel]);
  // Mép vệt chém: vũ khí cầm tay → mốc chuôi / mũi gắn trên chính mô hình; vũ khí bay → theo nắm tay phải (cẳng tay → quá đầu ngón 0,5 m)
  const trailEdge = useMemo(() => {
    if (held && wid !== "bow") {
      const obj = held.obj;
      let tip = obj.getObjectByName("__tip");
      let base = obj.getObjectByName("__base");
      if (!tip || !base) {
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj).applyMatrix4(new THREE.Matrix4().copy(obj.matrixWorld).invert());
        const c = box.getCenter(new THREE.Vector3());
        tip = new THREE.Object3D();
        tip.name = "__tip";
        // mũi vệt vượt quá mũi vũ khí 15% (lưỡi "năng lượng" như Genshin)
        tip.position.set(c.x, box.max.y + (box.max.y - box.min.y) * 0.15, c.z);
        base = new THREE.Object3D();
        base.name = "__base";
        base.position.set(c.x, box.min.y + (box.max.y - box.min.y) * 0.22, c.z);
        obj.add(tip, base);
      }
      const t0 = tip;
      const b0 = base;
      return (b: THREE.Vector3, t: THREE.Vector3) => (b0.getWorldPosition(b), t0.getWorldPosition(t), true);
    }
    let hand: THREE.Object3D | null = null;
    let lower: THREE.Object3D | null = null;
    return (b: THREE.Vector3, t: THREE.Vector3) => {
      if (!hand || !lower) {
        group.current?.traverse((o) => {
          if (!hand && /(R_Hand|RightHand|hand_r)$/i.test(o.name)) hand = o;
          if (!lower && /(R_LowerArm|RightLowerArm|lowerarm_r)$/i.test(o.name)) lower = o;
        });
        if (!hand || !lower) return false;
      }
      (hand as THREE.Object3D).getWorldPosition(b);
      (lower as THREE.Object3D).getWorldPosition(t);
      t.sub(b).multiplyScalar(-1).normalize().multiplyScalar(0.55).add(b);
      b.lerp(t, -0.15);
      return true;
    };
  }, [held, wid]);
  const emote = useWorld((st) => st.emote);
  const expression = useWorld((st) => st.expression);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt) * timeScale();
    const s = useWorld.getState();
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const down = now < useCombat.getState().downUntil;
    // Thế võ: bước chuỗi đòn / tụ lực / thể lực; đang vào đòn thì đứng tấn (di chuyển trong pha thu thế = huỷ đòn)
    if (armed) tickCombat(dt);
    const striking = armed && attackLocked();
    const locked = s.overlay === "battle" || s.overlay === "characters" || down || striking || useScope.getState().on;
    const { x, y, run } = locked ? { x: 0, y: 0, run: false } : s.input;
    if (armed && Math.hypot(x, y) > 0.3) cancelRecovery();
    const mag = Math.min(1, Math.hypot(x, y));
    const soaring = FLIGHT.enabled && motion.gliding && !motion.grounded;
    // trọng lực kỳ dị: cảnh tự lái khung này
    const driven = !!field?.drive?.(dt);
    // Đang nằm TRONG vật cản → không chặn bước (để thoát ra) + tự đẩy ra điểm trống gần nhất (bên dưới)
    const inside = !!blocked && blocked(s.player.x, s.player.z, s.player.y);
    const blk = inside ? undefined : blocked;
    // lội nước: chậm lại (cảnh đặt motion.wade)
    const speed = (motion.gliding ? 7.5 : run ? 7 : 4) * mag * motion.wade;
    // Lướt (kỹ năng): đi nhanh theo hướng đã chọn, vẫn có va chạm
    if (!driven && now < motion.dashUntil) {
      const nx = s.player.x + motion.dashDir.x * motion.dashSpeed * dt;
      const nz = s.player.z + motion.dashDir.z * motion.dashSpeed * dt;
      if (!blk || !blk(nx, nz, s.player.y)) {
        s.player.x = nx;
        s.player.z = nz;
      }
    }
    if (driven) {
      // cảnh đã di chuyển người chơi (trọng lực kỳ dị)
    } else if (soaring) {
      // Bay: vận tốc ngang đuổi theo hướng điều khiển (quán tính ~0,45 s); buông tay thì trôi chậm dần về phía trước
      const yaw = s.camYaw;
      const boosting = run || now < FLIGHT.boostUntil;
      const [, hk] = soarVertical(s.camPitch, mag > 0.05);
      const top = (boosting ? FLY.boost : FLY.cruise) * hk * (now < FLIGHT.boostUntil ? 1.35 : 1);
      if (mag > 0.05) {
        const dir = TMP_DIR.set(-Math.sin(yaw) * y + Math.cos(yaw) * x, 0, -Math.cos(yaw) * y - Math.sin(yaw) * x).normalize();
        TMP_T.copy(dir).multiplyScalar(top * mag);
      } else TMP_T.copy(FLIGHT.vel).multiplyScalar(0.35);
      FLIGHT.vel.lerp(TMP_T, 1 - Math.exp(-dt * 2.2));
      const nx = s.player.x + FLIGHT.vel.x * dt;
      const nz = s.player.z + FLIGHT.vel.z * dt;
      if (!blk || !blk(nx, nz, s.player.y)) {
        s.player.x = nx;
        s.player.z = nz;
      } else if (!blk(nx, s.player.z, s.player.y)) s.player.x = nx;
      else if (!blk(s.player.x, nz, s.player.y)) s.player.z = nz;
      else FLIGHT.vel.multiplyScalar(0.5);
      const hs = Math.hypot(FLIGHT.vel.x, FLIGHT.vel.z);
      if (hs > 0.5) {
        let d = Math.atan2(FLIGHT.vel.x, FLIGHT.vel.z) - s.playerYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.playerYaw += d * Math.min(1, dt * 5);
        // nghiêng cánh theo tốc độ rẽ
        FLIGHT.bank += (Math.max(-0.6, Math.min(0.6, -d * 1.6)) - FLIGHT.bank) * Math.min(1, dt * 4);
      } else FLIGHT.bank *= 1 - Math.min(1, dt * 4);
    } else {
      // Đi bộ có GIA TỐC (kiểu Genshin): đạt tốc độ trong ~0,12 s, dừng trong ~0,09 s — không bật / tắt tức thời theo phím
      const gv = gvel.current;
      const moving = mag > 0.05;
      if (moving) {
        const yaw = s.camYaw;
        const dir = TMP_DIR.set(-Math.sin(yaw) * y + Math.cos(yaw) * x, 0, -Math.cos(yaw) * y - Math.sin(yaw) * x).normalize();
        field?.steer?.(dir, s.player);
        TMP_T.copy(dir).multiplyScalar(speed);
        // xoay người theo hướng điều khiển (mượt), đổi hướng gấp thì giảm tốc một chút như dồn trọng tâm
        const targetYaw = dir.lengthSq() > 1e-6 ? Math.atan2(dir.x, dir.z) : s.playerYaw;
        let d = targetYaw - s.playerYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.playerYaw += d * (1 - Math.exp(-dt * 14));
        if (Math.abs(d) > 2.2) gv.multiplyScalar(1 - Math.min(1, dt * 6));
      } else TMP_T.set(0, 0, 0);
      gv.lerp(TMP_T, 1 - Math.exp(-dt / (moving ? 0.12 : 0.09)));
      if (gv.lengthSq() < 1e-4 && !moving) gv.set(0, 0, 0);
      if (gv.lengthSq() > 0) {
        // Di chuyển có va chạm: thử cả bước; bị chặn thì trượt theo từng trục (dọc tường)
        const nx = s.player.x + gv.x * dt;
        const nz = s.player.z + gv.z * dt;
        if (!blk || !blk(nx, nz, s.player.y)) {
          s.player.x = nx;
          s.player.z = nz;
        } else if (!blk(nx, s.player.z, s.player.y)) {
          s.player.x = nx;
          gv.z = 0;
        } else if (!blk(s.player.x, nz, s.player.y)) {
          s.player.z = nz;
          gv.x = 0;
        } else gv.set(0, 0, 0);
        if (clampR) {
          const r = Math.hypot(s.player.x, s.player.z);
          if (r > clampR) {
            s.player.x *= clampR / r;
            s.player.z *= clampR / r;
          }
        }
      }
    }
    if (!driven && inside && blocked) {
      const k = stuck.current;
      k.t += dt;
      if (k.t > 0.08 && now > k.at) {
        k.at = now + 250;
        const f = nearestFree(blocked, s.player.x, s.player.z, s.player.y);
        k.ok = !!f;
        if (f) FREE.set(f[0], 0, f[1]);
      }
      if (k.ok) {
        const f = Math.min(1, dt * 9);
        s.player.x += (FREE.x - s.player.x) * f;
        s.player.z += (FREE.z - s.player.z) * f;
      }
    } else stuck.current.t = 0;
    // Mặt đất + nhảy: trên không thì rơi theo trọng lực; chạm đất thì bám mượt theo bậc / dốc
    const gy = ground ? ground(s.player.x, s.player.z, s.player.y) : 0;
    if (!driven) air.height = s.player.y - gy;
    if (driven) {
      // mặt đất / rơi do cảnh lo
    } else if (!motion.grounded || motion.vy > 0) {
      motion.vy -= (motion.plunging ? 40 : 22) * dt * (field?.gravity?.(s.player) ?? 1);
      // Bay (cảnh cho phép): vận tốc đứng theo hướng nhìn, không trọng lực; cột gió vẫn nâng
      if (soaring) {
        motion.vy += 22 * dt;
        const [vt] = soarVertical(s.camPitch, mag > 0.05);
        let lift = false;
        for (const u of updrafts) if (Math.hypot(s.player.x - u.x, s.player.z - u.z) < u.r && s.player.y < u.top) lift = true;
        motion.vy += ((lift ? Math.max(vt, 9) : vt) - motion.vy) * (1 - Math.exp(-dt * 3));
        if (s.player.y > FLY.ceiling && motion.vy > 0) motion.vy = 0;
      } else if (motion.gliding) {
        // Lượn: rơi chậm (tối đa 1,8 m/s); trong cột gió thì được nâng lên
        let lift = false;
        for (const u of updrafts) if (Math.hypot(s.player.x - u.x, s.player.z - u.z) < u.r && s.player.y < u.top) lift = true;
        motion.vy = lift ? Math.min(7, motion.vy + 34 * dt) : Math.max(motion.vy, -1.8);
      }
      s.player.y += motion.vy * dt;
      if (s.player.y <= gy) {
        if (motion.plunging) plungeImpact(TMP_T.set(s.player.x, gy, s.player.z), motion.plungeFrom - gy);
        motion.plunging = false;
        if (motion.gliding && FLIGHT.enabled) FLIGHT.vel.multiplyScalar(0);
        motion.gliding = false;
        // Tiếp đất mạnh → vòng bụi + rung máy nhẹ
        if (motion.vy < -5) {
          addFx("ring", TMP_T.set(s.player.x, gy + 0.05, s.player.z), { color: "#fff6dc", size: 0.9 });
          s.addShake(Math.min(0.18, -motion.vy * 0.015));
        }
        s.player.y = gy;
        if (motion.vy < -3) motion.landAt = performance.now();
        motion.vy = 0;
        motion.grounded = true;
      }
    } else if (gy < s.player.y - 0.9) {
      // Bước hụt mép vực → bắt đầu rơi
      motion.grounded = false;
    } else s.player.y += (gy - s.player.y) * Math.min(1, dt * 14);
    g.position.copy(s.player);
    const fq = field?.frame?.() ?? null;
    if (shadow.current) {
      const h = Math.max(0, s.player.y - gy);
      shadow.current.visible = h < 25 && !CAM.hideSelf && !fq;
      shadow.current.position.set(s.player.x, gy + 0.025, s.player.z);
      shadow.current.scale.setScalar(1 + h * 0.06);
      shadowMat.opacity = 0.5 * Math.exp(-h * 0.22);
    }
    g.rotation.order = "YXZ";
    g.rotation.y = s.playerYaw;
    {
      const hs = soaring ? Math.hypot(FLIGHT.vel.x, FLIGHT.vel.z) : 0;
      const target = soaring ? Math.min(1.05, 0.25 + (hs / FLY.boost) * 0.65 + Math.max(0, -motion.vy) * 0.02) : 0;
      FLIGHT.lean += (target - FLIGHT.lean) * Math.min(1, dt * 4);
      if (!soaring) FLIGHT.bank *= 1 - Math.min(1, dt * 6);
      g.rotation.x = FLIGHT.lean;
      g.rotation.z = FLIGHT.bank;
      // xoay quanh ngực (1 m) thay vì gót chân
      const a = FLIGHT.lean;
      g.position.x -= Math.sin(s.playerYaw) * Math.sin(a) * 1.0;
      g.position.z -= Math.cos(s.playerYaw) * Math.sin(a) * 1.0;
      g.position.y += (1 - Math.cos(a)) * 1.0;
      // hệ quy chiếu trọng lực kỳ dị: dựng nhân vật theo hướng "lên" hiện tại (quanh gót chân)
      if (fq) g.quaternion.premultiply(fq);
      if (now - flyHud.current > 160) {
        flyHud.current = now;
        const st = useFlight.getState();
        const alt = Math.round(s.player.y);
        const spd = Math.round(Math.hypot(hs, motion.vy));
        const boost = now < FLIGHT.boostUntil;
        if (st.soaring !== soaring || st.alt !== alt || st.spd !== spd || st.boost !== boost) useFlight.setState({ soaring, alt, spd, boost });
        // gió rít theo tốc độ (to dần khi lao xuống / được luồng đẩy)
        if (FLIGHT.enabled) setWind(soaring ? Math.min(1, Math.hypot(hs, motion.vy) / 24) * (boost ? 1.2 : 1) : 0);
      }
    }
    // góc nhìn thứ nhất (vd. làm "tù nhân" trong Hang Platon): ẩn chính mình
    g.visible = !CAM.hideSelf;

    // Động tác
    const act = s.action && now < s.action.until ? s.action.pose : null;
    // Nhảy 3 pha (bật → lơ lửng → tiếp đất); sau khi đánh cận chiến giữ thế cầm kiếm 2,5 s
    const airPose: Pose | null = motion.plunging ? "slash" : !motion.grounded ? (motion.vy > 1 && !motion.gliding ? "jump" : "fall") : now - motion.landAt < 230 ? "land" : null;
    const melee = armed && HELD_W[curWeapon().id]?.hand === "right";
    const idlePose: Pose = melee && now - useCombat.getState().swingAt < 2500 ? "stance" : "idle";
    const next: Pose = down ? "hurt" : motion.plunging ? "slash" : act ?? airPose ?? (mag > 0.05 ? (run ? "run" : "walk") : idlePose);
    if (glider.current) {
      glider.current.visible = motion.gliding;
      // Nghiêng cánh theo hướng rẽ
      glider.current.rotation.z += ((x || 0) * -0.35 - glider.current.rotation.z) * Math.min(1, dt * 6);
    }
    const aid = s.action?.until ?? 0;
    if (aid !== actRef.current) {
      actRef.current = aid;
      setActClip(s.action?.clip ?? null);
      setActId(aid);
    }
    if (mag > 0.05 && s.emote) useWorld.setState({ emote: null });
    if (next !== poseRef.current) {
      poseRef.current = next;
      setPoseState(next);
    }

    // Camera cầu quanh nhân vật: mục tiêu bám nhanh, khoảng cách/góc bám mượt (cảm giác "trễ" nhẹ)
    CAM.cam = camera;
    if (CAM.shift) {
      // thế giới vừa quấn người chơi sang một ô giống hệt → dời máy quay theo, không để nó "bay" qua
      camTarget.current.add(CAM.shift);
      camPos.current.add(CAM.shift);
      CAM.shift = null;
    }
    const aiming = useCombat.getState().aiming;
    aimK.current += ((aiming ? 1 : 0) - aimK.current) * Math.min(1, rawDt * 10);
    const ak = aimK.current;
    // Ngắm: mục tiêu camera lệch sang vai phải, nhân vật quay theo hướng camera, FOV hẹp lại
    const sideX = Math.cos(s.camYaw) * 0.55 * ak;
    const sideZ = -Math.sin(s.camYaw) * 0.55 * ak;
    if (aiming) s.playerYaw = s.camYaw + Math.PI;
    const pc = camera as THREE.PerspectiveCamera;
    // ── Ống nhòm: góc nhìn thứ nhất từ mắt, FOV = 45° / zoom (làm mượt), ẩn chính mình
    const scope = useScope.getState();
    if (scope.on || SCOPE.zoom > 1.01) {
      const target = scope.on ? scope.zoom : 1;
      SCOPE.zoom += (target - SCOPE.zoom) * Math.min(1, rawDt * 7);
      if (!scope.on && SCOPE.zoom < 1.05) SCOPE.zoom = 1;
    }
    if (scope.on) {
      if (!scopeHid.current) {
        scopeHid.current = true;
        CAM.hideSelf = true;
      }
      const sfov = 45 / Math.max(1, SCOPE.zoom);
      if (Math.abs(pc.fov - sfov) > 0.01) {
        pc.fov = sfov;
        pc.updateProjectionMatrix();
      }
      const cp2 = Math.cos(s.camPitch);
      TMP_T.set(s.player.x, s.player.y + 1.55, s.player.z);
      camPos.current.copy(TMP_T);
      camera.position.copy(TMP_T);
      // hướng nhìn = ngược hướng đặt máy quay góc ba (cùng quy ước camYaw / camPitch)
      TMP_POS.set(-Math.sin(s.camYaw) * cp2, -Math.sin(s.camPitch), -Math.cos(s.camYaw) * cp2).add(TMP_T);
      camera.lookAt(TMP_POS);
      camTarget.current.copy(TMP_T).add(TMP_POS.sub(TMP_T).multiplyScalar(3));
      s.playerYaw = s.camYaw + Math.PI;
      // đo khoảng cách tới vật ở tâm ngắm (5 lần / giây)
      if (now - scopeRay.current > 200) {
        scopeRay.current = now;
        RAY.setFromCamera(CENTER, camera);
        useScope.setState({ dist: scopeDistance(RAY.ray, scene, ground) });
      }
      const near0 = findNearby(s.player);
      if (near0?.id !== s.nearby?.id) useWorld.setState({ nearby: near0 });
      return;
    }
    if (scopeHid.current) {
      scopeHid.current = false;
      CAM.hideSelf = false;
    }
    const flySpd = FLIGHT.enabled && motion.gliding ? Math.hypot(FLIGHT.vel.x, FLIGHT.vel.z, motion.vy) : 0;
    camK.current += ((FLIGHT.enabled && motion.gliding ? 1.45 : 1) - camK.current) * Math.min(1, rawDt * 2);
    const fov = 45 - 10 * ak + CAM.fovKick + Math.min(14, flySpd * 0.55);
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov = fov;
      pc.updateProjectionMatrix();
    }
    // (trọng lực kỳ dị: độ lệch mục tiêu + quỹ đạo máy quay tính trong hệ "lên" hiện tại rồi xoay ra thế giới)
    TMP_T.set(sideX, 1.3 + 0.2 * ak, sideZ);
    const cq = field?.camFrame ? field.camFrame() : fq;
    if (cq) TMP_T.applyQuaternion(cq);
    camTarget.current.lerp(TMP_T.add(s.player), Math.min(1, rawDt * 10));
    const cp = Math.cos(s.camPitch);
    TMP_POS.set(Math.sin(s.camYaw) * cp, Math.sin(s.camPitch), Math.cos(s.camYaw) * cp).multiplyScalar((s.camDist * (1 - ak) + 1.7 * ak) * CAM.dolly * camK.current);
    if (cq) TMP_POS.applyQuaternion(cq);
    TMP_POS.add(camTarget.current);
    camera.up.copy(Y_UP);
    if (cq) camera.up.applyQuaternion(cq);
    camClamp?.(TMP_POS, camTarget.current);
    const floor = (ground ? ground(TMP_POS.x, TMP_POS.z) : 0) + 0.35;
    if (TMP_POS.y < floor) TMP_POS.y = floor;
    camPos.current.lerp(TMP_POS, Math.min(1, rawDt * 8));
    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);

    // Tìm điểm tương tác gần nhất
    const near = findNearby(s.player);
    const cur = s.nearby;
    if ((near?.kind ?? null) !== (cur?.kind ?? null) || near?.id !== cur?.id || near?.label !== cur?.label) useWorld.setState({ nearby: near });
  });

  return (
    <>
      <group ref={group}>
        <Avatar url={avatarFile ? worldAsset(avatarFile) : undefined} pose={pose} speed={1} emote={emote} expression={expression} actId={actId} actClip={actClip} held={held} />
        <SelfName />
        {armed && <ChargeCircle color={WEAPON_DEFS[wid].color} />}
        {armed && <WeaponFamiliar />}
        <group ref={glider} position={[0, 1.78, 0.02]} visible={false}>
          <GliderModel />
        </group>
      </group>
      {armed && <WeaponTrail edge={trailEdge} active={trailActive} gold={rhythmGold} color={WEAPON_DEFS[wid].color} />}
      <WingTrails glider={glider} />
      <mesh ref={shadow} rotation-x={-Math.PI / 2} material={shadowMat} renderOrder={2}>
        <planeGeometry args={[1.5, 1.5]} />
      </mesh>
    </>
  );
}


function nearest(p: THREE.Vector3, creatures: CreatureView[]) {
  const lang = useWorld.getState().lang;
  const G = GATE_BY_ID;
  const cands: { kind: "portal" | "museum" | "characters" | "creature" | "wonder" | "npc"; id?: string; label: string; pos: THREE.Vector3; r?: number }[] = [
    { kind: "npc", id: "suong", label: lang === "vi" ? "Trò chuyện với Sương" : "Talk to Sương", pos: V3(NPC.guide) },
    { kind: "npc", id: "diep", label: lang === "vi" ? "Trò chuyện với Diệp" : "Talk to Diệp", pos: V3(NPC.curator) },
    { kind: "portal", id: "valley", label: tt(lang, "enterValley"), pos: V3(G.valley), r: G.valley.r - 0.4 },
    { kind: "portal", id: "expanse", label: tt(lang, "enterExpanse"), pos: V3(G.expanse), r: G.expanse.r - 0.4 },
    { kind: "portal", id: "impossible", label: tt(lang, "enterImpossible"), pos: V3(G.impossible), r: G.impossible.r - 0.4 },
    { kind: "portal", id: "study", label: tt(lang, "enterStudy"), pos: V3(INTERACT.study), r: 2 },
    { kind: "portal", id: "siren", label: lang === "vi" ? "Vào Mê cung Hoạ âm (boss tổ đội)" : "Enter the Labyrinth of Harmonics (co-op boss)", pos: V3(G.siren), r: G.siren.r - 0.4 },
    { kind: "museum", label: tt(lang, "museum"), pos: V3(INTERACT.museum), r: 3.2 },
    { kind: "characters", label: tt(lang, "mirror"), pos: V3(INTERACT.mirror), r: 2.4 },
  ];
  creatures.forEach((c, i) => {
    if (c.state === "feral") cands.push({ kind: "creature", id: c.kc, label: tt(lang, "tame", { name: c.creature }), pos: creatureHome(i) });
  });
  let best: (typeof cands)[number] | null = null;
  let bd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < (c.r ?? INTERACT_R) && d < bd) {
      bd = d;
      best = c;
    }
  }
  return best ? { kind: best.kind, id: best.id, label: best.label } : null;
}

export function creatureHome(i: number) {
  const [x, z] = creatureSpot(i);
  return new THREE.Vector3(x, 0, z);
}

function Npc({ file, position, label, rotationY = 0 }: { file: string; position: THREE.Vector3; label: string; rotationY?: number }) {
  const mats = useArchMaterials();
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Avatar url={worldAsset(file)} pose="idle" npc />
      <BlobShadow r={0.45} mats={mats} />
      <Label text={label} y={2.1} small />
    </group>
  );
}

// ───────────── Sinh vật Hồi âm ─────────────

function Creature({ c, index }: { c: CreatureView; index: number }) {
  const t = useT();
  const g = useRef<THREE.Group>(null);
  const home = useMemo(() => creatureHome(index), [index]);
  useFrame((state, rawDt) => {
    const dt = rawDt * timeScale();
    const gr = g.current;
    if (!gr) return;
    const t0 = state.clock.elapsedTime + index * 1.7;
    const p = useWorld.getState().player;
    if (c.state === "tamed" || c.state === "fading") {
      const a = t0 * 0.6 + index * 1.25;
      gr.position.lerp(TMP_T.set(p.x + Math.cos(a) * 1.8, 0, p.z + Math.sin(a) * 1.8), Math.min(1, dt * 2.5));
    } else {
      gr.position.set(home.x + Math.cos(t0 * 0.5) * 1, 0, home.z + Math.sin(t0 * 0.7) * 1);
    }
    gr.lookAt(p.x, gr.position.y, p.z);
  });
  if (c.state === "wild") return null; // chưa phát hiện → chưa xuất hiện
  const feral = c.state === "feral";
  return (
    <group ref={g}>
      <MathCreature kc={c.kc} color={c.color} feral={feral} fading={c.state === "fading"} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[feral ? 0.7 : 0.45, 24]} />
        <meshBasicMaterial color="#1b2a1b" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {feral && (
        <>
          <Shield radius={1.35} color="#ff9ec4" position={[0, 1.1, 0]} />
          <Label text={t("wildTag", { name: c.creature })} y={2.6} small warn />
        </>
      )}
    </group>
  );
}

function Label({ text, y, small, warn }: { text: string; y: number; small?: boolean; warn?: boolean }) {
  return <Label3D text={text} position={[0, y, 0]} variant={warn ? "warn" : small ? "small" : "default"} />;
}

/** Vòng tụ lực dưới chân khi đang giữ chuột: nở dần theo mức tụ, loé khi đầy */
function ChargeCircle({ color }: { color: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = chargeLevel();
    if (!g.current) return;
    g.current.visible = k > 0.12;
    g.current.scale.setScalar(0.45 + k * 0.9);
    g.current.rotation.y += 0.08 + k * 0.2;
  });
  return (
    <group ref={g} position={[0, 0.05, 0]} visible={false}>
      <MagicCircle radius={1.3} intensity={1.6} color={color} color2="#ffffff" spin={2.4} revealSpeed={4} />
    </group>
  );
}
