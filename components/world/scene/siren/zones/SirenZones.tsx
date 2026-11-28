"use client";
/**
 * Đồ thị khu của Mê cung Hoạ âm (giai đoạn 2 — docs/ai-reviews/siren-witch/PHASE2_PLAN.md). Gắn trong Siren.tsx SAU
 * PortalDriver (chạy sau Player + cổng của hub mỗi khung). Logic thuần: lib/world/zoneGraph.ts (+ lib/world/zones/*).
 *  - ZoneDriver: suy khu từ vị trí; qua cửa (cùng một bước: khu + vị trí + va chạm + máy quay; giữ đà); khoá / chờ tải;
 *    rơi khỏi khu → về chỗ đứng an toàn; streaming (tải trước khu sau cửa đang nhìn, cache LRU); sương theo khu.
 *  - HubOnly: nhóm hình của mê cung hub — ẩn khi ở khu khác (0 lệnh vẽ).
 *  - DoorSet: khung cửa (hình cắt giấy) + lỗ cửa nhìn trời khu đích + dấu "n bạn ở bên kia".
 *  - Veil: vành vé / nếp rèm / cửa chớp đồng che lúc đổi khu. ZoneSkyDome: trời thủ tục theo khu.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { HARMONIC } from "@/lib/world/harmonicState";
import { t as tt, type Lang } from "@/lib/world/i18n";
import { BODY } from "@/lib/world/sirenMaze";
import {
  DOOR_BY_ID,
  ZONE_DEFS,
  ZONE_DOORS,
  ZONE_FLAGS,
  doorCrossing,
  doorInView,
  doorLocal,
  doorPeerCounts,
  doorTraverse,
  inDoor,
  streamPlan,
  zoneAtWorld,
  zoneIndex,
  zoneSurfAt,
  type Door,
  type V3,
  type ZoneId,
} from "@/lib/world/zoneGraph";
import { CUT } from "@/lib/world/zones/cutAtlas";
import { useWorld } from "../../../store";
import { CAM, motion } from "../../../combat/combat";
import { Label3D } from "../../../ui/Labels";
import { netPeers, samplePeer, setNetZone, setNetZoneFlags } from "../../../net";
import { carryHorizontal } from "../SirenPortals";
import { reduceMotion } from "../SirenGravity";
import { SIREN_FOG } from "../SirenSky";
import { synth } from "../sirenSynth";
import { CutoutBatch, ZONE_CODE, createCutoutMat, createHoleMat, createVeilMat, createZoneSkyMat, type CutItem } from "./zoneMats";
import { HUB_KEEP_MS, ZONE_RT, teleportLocal, useZones, zoneHint } from "./zoneRuntime";
import { CUT_TEX, useCutTex, useZoneGroup } from "./zoneHooks";
import { ZoneHud } from "./ZoneHud";
import { ZoneWait, waitLocal, waitNearby, waitShared } from "./ZoneWait";
import { ZoneKeys, keysLocal, keysNearby, keysShared } from "./ZoneKeys";
import { ZoneDesert, DESERT_SKY, desertLocal, desertNearby, desertShared } from "./ZoneDesert";

useTexture.preload(CUT_TEX);
const lang = (): Lang => (useWorld.getState().lang === "vi" ? "vi" : "en");

/** Sương theo khu (màu, gần, xa) — hub giữ giá trị của SirenFog */
const FOG: Record<ZoneId, [string, number, number]> = {
  hub: [SIREN_FOG, 55, 210],
  keys: ["#2a1a3a", 40, 230],
  wait: ["#f2b08f", 45, 240],
  desert: ["#f0cf98", 50, 260],
};

/** Phần hub cần GIỮ gắn (trạng thái câu đố, quái, trọng lực, cổng, thân boss…): ẩn khi ở khu khác; useFrame của chúng tự
 * trả về sớm bằng offHub() (zoneRuntime). */
export function HubOnly({ children }: { children: ReactNode }) {
  const ref = useZoneGroup("hub");
  return <group ref={ref}>{children}</group>;
}

/**
 * Phần THUẦN HÌNH của hub (trời, đĩa than, rối giấy, sàn đấu trường, nhãn…): rời hub > HUB_KEEP_MS thì GỠ HẲN — 0 useFrame,
 * 0 cập nhật ma trận, 0 nhãn DOM khi đang ở khu khác. Quay về: gắn lại ngay (texture / chương trình shader đã có trong cache;
 * màn che của cửa phủ khung đầu). Suspense riêng → một phần còn tải không chặn cả cảnh.
 */
export function HubVisual({ children }: { children: ReactNode }) {
  const away = useZones((s) => s.hubAway && s.zone !== "hub");
  return away ? null : <Suspense fallback={null}>{children}</Suspense>;
}

/** Tương tác (phím F) trong khu mới — Siren.tsx gọi trước playNearby */
export function zoneNearby(p: THREE.Vector3): { kind: "action"; id: string; label: string } | null {
  const id = ZONE_RT.id;
  if (id === "hub") return null;
  const o = ZONE_DEFS[id].origin;
  const l: V3 = [p.x - o[0], p.y - o[1], p.z - o[2]];
  if (id === "wait") return waitNearby(l, lang());
  if (id === "keys") return keysNearby(l, lang());
  return desertNearby(l, lang());
}

// ───────────── Bộ điều khiển (sau Player + cổng) ─────────────
const PREV = new THREE.Vector3();
const CUR: V3 = [0, 0, 0];
const PRV: V3 = [0, 0, 0];
const LOC: V3 = [0, 0, 0];
const FWD = new THREE.Vector3();
const SHIFT = new THREE.Vector3();

function setZone(id: ZoneId) {
  ZONE_RT.id = id;
  ZONE_RT.visited.add(id);
  const s = useZones.getState();
  ZONE_RT.leftHubAt = id === "hub" ? -1 : ZONE_RT.leftHubAt < 0 ? performance.now() : ZONE_RT.leftHubAt;
  useZones.setState({ zone: id, visited: [...ZONE_RT.visited], mount: s.mount.includes(id) || id === "hub" ? s.mount : [id, ...s.mount], hubAway: id === "hub" ? false : s.hubAway });
}

function ZoneDriver() {
  const scene = useThree((s) => s.scene);
  const st = useRef({ init: false, lastStream: 0, cache: [] as ZoneId[], fogZone: "" as ZoneId | "", lockHintAt: 0 });
  useEffect(() => {
    setNetZone(() => ZONE_RT.id);
    // co-op: cờ câu đố dùng chung của phòng (đê / vé / mode sa mạc) — net.ts tin "zf"; server cũ bỏ qua → chỉ cục bộ như trước
    setNetZoneFlags({
      apply: (f) => {
        if (f.dike === 1) keysShared();
        if (f.ticket === 1) waitShared();
        if (typeof f.desert === "number") desertShared(f.desert);
      },
      local: () => ({ ...keysLocal(), ...waitLocal(), ...desertLocal() }),
    });
    // DEV: window.__zone("desert") → tới điểm hồi sinh của khu (đo / chụp); __zone("desert", [x, y, z]) → điểm cục bộ
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __zone: unknown }).__zone = (id: ZoneId, at?: [number, number, number]) => {
        if (!ZONE_DEFS[id]) return 0;
        teleportLocal(id, at ?? ZONE_DEFS[id].spawn, "curtain");
        return 1;
      };
    return () => {
      setNetZone(null);
      setNetZoneFlags(null);
      ZONE_RT.id = "hub";
      ZONE_RT.lock = "";
      ZONE_RT.leftHubAt = -1;
      useZones.setState({ zone: "hub", mount: [], hubAway: false });
    };
  }, []);
  useFrame((three, rawDt) => {
    const S = st.current;
    const w = useWorld.getState();
    const p = w.player;
    const now = performance.now();
    const dt = Math.max(1e-3, Math.min(0.05, rawDt));
    let id = zoneAtWorld(p.x, p.z);
    if (id !== ZONE_RT.id) {
      // dịch chuyển không qua cửa (hồi sinh, lệnh dev…)
      setZone(id);
      S.init = false;
    }
    // sương theo khu
    if (S.fogZone !== id) {
      const f = scene.fog as THREE.Fog | null;
      if (f && (f as THREE.Fog).isFog) {
        const [c, n, fa] = FOG[id];
        f.color.set(c);
        f.near = n;
        f.far = fa;
      }
      S.fogZone = id;
    }
    let o = ZONE_DEFS[id].origin;
    CUR[0] = p.x - o[0];
    CUR[1] = p.y + BODY - o[1];
    CUR[2] = p.z - o[2];
    if (!S.init) {
      S.init = true;
      PRV[0] = CUR[0];
      PRV[1] = CUR[1];
      PRV[2] = CUR[2];
      return;
    }
    // ── nhả khoá cửa vừa ra khi đã rời mặt cửa
    if (ZONE_RT.lock) {
      const ld = DOOR_BY_ID[ZONE_RT.lock];
      const l = doorLocal(ld, CUR[0], CUR[1], CUR[2], LOC);
      if (ld.zone !== id || l[2] > 1.6 || l[2] < -1.6 || !inDoor(ld, l[0], l[1], 1.6) || now - ZONE_RT.lockAt > 3000) ZONE_RT.lock = "";
    }
    // ── cửa
    for (const d of ZONE_DOORS[id]) {
      if (d.id === ZONE_RT.lock) continue;
      const hit = doorCrossing(d, PRV, CUR);
      if (!hit) continue;
      const dst = DOOR_BY_ID[d.to];
      const locked = !!d.lock && !ZONE_FLAGS[d.lock];
      const notReady = !ZONE_RT.ready.has(dst.zone);
      if (locked || notReady) {
        // đẩy lùi về phía trước mặt cửa
        const s = Math.sin(d.yaw);
        const c = Math.cos(d.yaw);
        p.x = PRV[0] + s * 0.25 + o[0];
        p.z = PRV[2] + c * 0.25 + o[2];
        CUR[0] = p.x - o[0];
        CUR[2] = p.z - o[2];
        if (now - S.lockHintAt > 1500) {
          S.lockHintAt = now;
          zoneHint(tt(lang(), locked ? (d.lock === "dike" ? "znLockDike" : "znLockTicket") : "znLoading"));
          if (locked) synth.dissonant(196, 0.4, 0.25);
        }
        if (notReady) setZone(id); // bảo đảm khu đích được gắn (setZone giữ mount; streaming bên dưới thêm đích)
        break;
      }
      const v: V3 = [(CUR[0] - PRV[0]) / dt, motion.vy, (CUR[2] - PRV[2]) / dt];
      const r = doorTraverse(d, dst, CUR, v);
      const o2 = ZONE_DEFS[dst.zone].origin;
      const nx = r.pos[0] + o2[0];
      const ny = r.pos[1] - BODY + o2[1];
      const nz = r.pos[2] + o2[2];
      SHIFT.set(nx - p.x, ny - p.y, nz - p.z);
      p.set(nx, ny, nz);
      CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(SHIFT);
      motion.vy = r.vel[1];
      if (Math.abs(r.dYaw) > 1e-6) {
        useWorld.setState({ camYaw: w.camYaw + r.dYaw, playerYaw: w.playerYaw + r.dYaw });
        carryHorizontal(r.vel[0], r.vel[2]);
      }
      ZONE_RT.lock = dst.id;
      ZONE_RT.lockAt = now;
      ZONE_RT.veilAt = now;
      ZONE_RT.veilStyle = d.style;
      // đuôi âm nối hai khu: vút giấy + chất liệu vật che
      synth.whoosh(300, 520, 0.55, 0.45);
      synth.impact(d.style === "bronze" ? "metal" : d.style === "door" ? "wood" : "paper", 6);
      id = dst.zone;
      setZone(id);
      o = o2;
      CUR[0] = r.pos[0];
      CUR[1] = r.pos[1];
      CUR[2] = r.pos[2];
      S.lastStream = 0;
      break;
    }
    // ── rơi khỏi khu / chỗ đứng an toàn
    if (id !== "hub") {
      const def = ZONE_DEFS[id];
      const feetY = CUR[1] - BODY;
      if (motion.grounded) {
        const s = zoneSurfAt(zoneIndex(id), CUR[0], CUR[2], feetY);
        if (s && s.tag !== "plate") {
          const sf = (ZONE_RT.safe[id] ??= [0, 0, 0]);
          sf[0] = CUR[0];
          sf[1] = s.y;
          sf[2] = CUR[2];
        }
      }
      if (feetY < def.killY) {
        teleportLocal(id, ZONE_RT.safe[id] ?? def.spawn, "curtain");
        zoneHint(tt(lang(), id === "keys" ? "znSea" : "znFell"));
        synth.impact("paper", 5);
        CUR[0] = p.x - o[0];
        CUR[1] = p.y + BODY - o[1];
        CUR[2] = p.z - o[2];
      }
    }
    PRV[0] = CUR[0];
    PRV[1] = CUR[1];
    PRV[2] = CUR[2];
    // ── streaming (3 lần / giây)
    if (now - S.lastStream > 330) {
      S.lastStream = now;
      // rời hub đủ lâu → gỡ phần thuần hình của hub (HubVisual)
      if (id !== "hub" && ZONE_RT.leftHubAt > 0 && now - ZONE_RT.leftHubAt > HUB_KEEP_MS && !useZones.getState().hubAway) useZones.setState({ hubAway: true });
      const cam = three.camera;
      cam.getWorldDirection(FWD);
      const seen: { to: ZoneId; inView: boolean }[] = [];
      for (const d of ZONE_DOORS[id]) {
        const r = doorInView([cam.position.x - o[0], cam.position.y - o[1], cam.position.z - o[2]], [FWD.x, FWD.y, FWD.z], [d.x, d.y + 1.6, d.z]);
        seen.push({ to: DOOR_BY_ID[d.to].zone, inView: r.inView });
      }
      const plan = streamPlan(id, seen, S.cache, 2);
      S.cache = plan.cache;
      const cur = useZones.getState().mount;
      if (cur.length !== plan.mount.length || cur.some((z, i) => z !== plan.mount[i])) useZones.setState({ mount: plan.mount });
    }
  }, 0.25);
  return null;
}

// ───────────── Khung cửa ─────────────
/** hình cắt giấy của một cửa (toạ độ cục bộ khu) */
function doorItems(d: Door): CutItem[] {
  const s = Math.sin(d.yaw);
  const c = Math.cos(d.yaw);
  // right = (c, −s), n = (s, c)
  const at = (lr: number, y: number, ln = 0.05): [number, number, number] => [d.x + lr * c + ln * s, y, d.z - lr * s + ln * c];
  if (d.style === "ticket") {
    const W = (2 * (d.r ?? 1.7)) / 0.222;
    const H = W / CUT.ticket.aspect;
    return [{ cut: "ticket", at: at(0, d.y + (d.cy ?? 1.7) - 0.486 * H), w: W, h: H, yaw: d.yaw }];
  }
  if (d.style === "curtain") {
    return [
      { cut: "curtain", at: at(-(d.w / 2 + 0.85), d.y - 0.05), w: 2.3, yaw: d.yaw, sway: 0.05 },
      { cut: "curtain", at: at(d.w / 2 + 0.85, d.y - 0.05), w: 2.3, yaw: d.yaw + Math.PI, sway: 0.05 },
      { cut: "curtain", at: at(0, d.y + d.h - 0.2, 0.1), w: d.w + 3.8, h: 1.6, yaw: d.yaw, sway: 0.02 },
    ];
  }
  // khung cửa phòng chờ (cửa gỗ) / cửa đồng: lỗ cửa trong ảnh ở x ≈ 0,362 W, rộng 0,239 W
  const W = d.w / 0.239;
  return [{ cut: "door", at: at(0.138 * W, d.y - 0.12), w: W, yaw: d.yaw, tint: d.style === "bronze" ? [1.05, 0.72, 0.42] : undefined }];
}

function DoorSet({ zone }: { zone: ZoneId }) {
  const tex = useCutTex();
  const g = useZoneGroup(zone);
  const doors = ZONE_DOORS[zone];
  const o = ZONE_DEFS[zone].origin;
  const { batch, mat, holes } = useMemo(() => {
    const mat = createCutoutMat(tex);
    const batch = new CutoutBatch(doors.flatMap(doorItems), mat);
    const holes = doors.map((d) => {
      const m = createHoleMat(ZONE_CODE[DOOR_BY_ID[d.to].zone]);
      m.uniforms.uCircle.value = d.shape === "circle" ? 1 : 0;
      const geo = d.shape === "circle" ? new THREE.CircleGeometry((d.r ?? 1.7) * 1.03, 48) : new THREE.PlaneGeometry(d.w + 0.1, d.h).translate(0, d.h / 2, 0);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(d.x, d.y + (d.shape === "circle" ? (d.cy ?? 1.7) : 0), d.z);
      mesh.rotation.y = d.yaw;
      mesh.name = `perf:door:${d.id}`;
      return mesh;
    });
    return { batch, mat, holes };
  }, [tex, doors]);
  useEffect(
    () => () => {
      batch.dispose();
      mat.dispose();
      holes.forEach((h) => {
        h.geometry.dispose();
        (h.material as THREE.Material).dispose();
      });
    },
    [batch, mat, holes],
  );
  const [peers, setPeers] = useState<Record<string, number>>({});
  const last = useRef(0);
  const rm = useMemo(() => reduceMotion(), []);
  useFrame(() => {
    if (ZONE_RT.id !== zone) return;
    mat.uniforms.uTime.value = HARMONIC.time;
    mat.uniforms.uCollage.value = HARMONIC.collageTime;
    mat.uniforms.uBoil.value = rm ? 0 : 1;
    holes.forEach((h, i) => {
      const u = (h.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = HARMONIC.time;
      u.uCalm.value = rm ? 1 : 0;
      const d = doors[i];
      u.uLocked.value = d.lock && !ZONE_FLAGS[d.lock] ? 1 : 0;
      if (DOOR_BY_ID[d.to].zone === "desert") (u.uMode.value as THREE.Vector2).set(DESERT_SKY.m, DESERT_SKY.n);
    });
    const now = performance.now();
    if (now - last.current > 600) {
      last.current = now;
      const zs: (string | null | undefined)[] = [];
      for (const pe of netPeers().values()) zs.push(samplePeer(pe, now)?.zone);
      const c = doorPeerCounts(zone, zs);
      if (doors.some((d) => (c[d.id] ?? 0) !== (peers[d.id] ?? 0))) setPeers(c);
    }
  });
  const lg = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  return (
    <group ref={g} position={o} name={`doors:${zone}`}>
      <primitive object={batch.mesh} />
      {holes.map((h) => (
        <primitive key={h.uuid} object={h} />
      ))}
      {doors.map((d) => (
        <Label3D key={d.id} text={`${d.name[lg]}${peers[d.id] ? ` · ${tt(lg, "znPeers", { n: peers[d.id] })}` : ""}`} position={[d.x, d.y + (d.shape === "circle" ? (d.cy ?? 1.7) + (d.r ?? 1.7) + 1.2 : Math.min(d.h, 4) + 0.9), d.z]} maxDist={45} />
      ))}
    </group>
  );
}

// ───────────── Trời + màn che ─────────────
function ZoneSkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => createZoneSkyMat(1), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.onBeforeRender = (_r, _s, cam) => {
      m.position.copy(cam.position);
      m.updateMatrixWorld();
    };
  }, []);
  const rm = useMemo(() => reduceMotion(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    m.visible = ZONE_RT.id !== "hub";
    if (!m.visible) return;
    const u = mat.uniforms;
    u.uTime.value = HARMONIC.time;
    u.uZoneSky.value = ZONE_CODE[ZONE_RT.id];
    u.uCalm.value = rm ? 1 : 0;
    (u.uMode.value as THREE.Vector2).set(DESERT_SKY.m, DESERT_SKY.n);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={1} frustumCulled={false} visible={false} name="perf:zoneSky">
      <sphereGeometry args={[400, 40, 20]} />
    </mesh>
  );
}

function Veil() {
  const tex = useCutTex();
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => createVeilMat(tex), [tex]);
  useEffect(() => () => mat.dispose(), [mat]);
  const size = useThree((s) => s.size);
  const rm = useMemo(() => reduceMotion(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const dur = rm ? 220 : 480;
    const k = (performance.now() - ZONE_RT.veilAt) / dur;
    m.visible = k < 1;
    if (!m.visible) return;
    const u = mat.uniforms;
    u.uK.value = k;
    u.uAspect.value = size.width / Math.max(1, size.height);
    u.uStyle.value = ZONE_RT.veilStyle === "ticket" ? 0 : ZONE_RT.veilStyle === "curtain" ? 1 : 2;
    u.uRM.value = rm ? 1 : 0;
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={10000} frustumCulled={false} visible={false} name="perf:veil">
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

// ───────────── Gắn khu (streaming) ─────────────
function ReadyMark({ id }: { id: ZoneId }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    // biên dịch trước shader của khu (đang ẩn) → bước qua cửa không khựng
    const g = scene.getObjectByName(`zone:${id}`);
    if (g) {
      const vis: THREE.Object3D[] = [];
      g.traverse((o) => {
        if (!o.visible) {
          vis.push(o);
          o.visible = true;
        }
      });
      try {
        gl.compile(g, camera, scene);
      } catch {}
      vis.forEach((o) => (o.visible = false));
    }
    ZONE_RT.ready.add(id);
    return () => {
      ZONE_RT.ready.delete(id);
    };
  }, [id, gl, camera, scene]);
  return null;
}

class Guard extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("[siren zones] lỗi khu, bỏ qua:", e);
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}

function ZoneMount({ id }: { id: Exclude<ZoneId, "hub"> }) {
  return (
    <Guard>
      <Suspense fallback={null}>
        <group name={`zone:${id}`}>
          {id === "wait" ? <ZoneWait /> : id === "keys" ? <ZoneKeys /> : <ZoneDesert />}
          <DoorSet zone={id} />
        </group>
        <ReadyMark id={id} />
      </Suspense>
    </Guard>
  );
}

export function SirenZones() {
  const mount = useZones((s) => s.mount);
  return (
    <>
      <ZoneDriver />
      <ZoneSkyDome />
      <Suspense fallback={null}>
        <DoorSet zone="hub" />
        <Veil />
      </Suspense>
      {mount.map((id) => (id === "hub" ? null : <ZoneMount key={id} id={id} />))}
      <ZoneHud />
    </>
  );
}
