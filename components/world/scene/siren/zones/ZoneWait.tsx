"use client";
/**
 * Khu "Phòng Chờ Đến Hôm Qua" (lib/world/zones/waitHall.ts): sảnh terrazzo trôi giữa trời hoàng hôn bạc hà – cam (vạn vật
 * quen thuộc nhưng sai chỗ: trần đèn huỳnh quang treo trên trời, ghế gập cao quá cỡ, tháp ghế chồng ngược làm bệ chuông,
 * bảng số lơ lửng đếm LÙI những lượt đã qua, máy phát số lùi xa khi em lại gần).
 * Câu đố BCNN trên dải thời gian 24 ô; màn diễn khoá nhịp HARMONIC (96 BPM). Ba vòng đúng → bấm lỗ tấm vé khổng lồ (cửa tắt).
 * Lệnh vẽ: sàn 1 · trụ 1 · ô phách 1 · dải số 1 · bảng số 1 · hình cắt giấy 1 (+ cửa: DoorSet).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { create } from "zustand";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { t as tt, type Lang } from "@/lib/world/i18n";
import { ZONE_DEFS, ZONE_FLAGS, type V3 } from "@/lib/world/zoneGraph";
import { BELL, BOARD, CHAIRS, LCM_ROUNDS, MACHINE, PILLARS, TIMELINE, WAIT_HALF, bellAt, demoAt, lcm, machineTarget, stampAt, tileAt, tileX } from "@/lib/world/zones/waitHall";
import { useWorld } from "../../../store";
import { registerAction } from "../../../actions";
import { rollDrops } from "../../../combat/items";
import { floatText, Label3D } from "../../../ui/Labels";
import { reduceMotion } from "../SirenGravity";
import { synth } from "../sirenSynth";
import { CutoutBatch, createCutoutMat, type CutItem } from "./zoneMats";
import { useCutTex, useRepTex, useZoneGroup } from "./zoneHooks";
import { ZONE_RT, zoneHint } from "./zoneRuntime";

const O = ZONE_DEFS.wait.origin;
/** trạng thái câu đố (giữ khi gắn lại khu; mất khi rời cảnh) */
const WT = { round: 0, mark: -1, start: -1, lastTile: -2, done: false };
const useWaitUi = create<{ round: number; done: boolean }>(() => ({ round: 0, done: false }));

export function waitNearby(l: V3, lang: Lang) {
  if (WT.done || WT.start >= 0) return WT.start >= 0 && tileAt(l[0], l[2]) >= 0 ? { kind: "action" as const, id: "zone:wait:busy", label: tt(lang, "wtBusy") } : null;
  const i = tileAt(l[0], l[2]);
  if (i < 0 || Math.abs(l[1] - 0.06) > 0.6) return null;
  return { kind: "action" as const, id: "zone:wait:mark", label: tt(lang, "wtMark", { i }) };
}

const C_BASE = new THREE.Color(0.93, 0.87, 0.76);
const C_BELL = new THREE.Color(0.5, 0.9, 0.74);
const C_STAMP = new THREE.Color(0.97, 0.55, 0.48);
const C_BOTH = new THREE.Color(1.15, 0.86, 0.3);
const C_CUR = new THREE.Color(1.3, 1.3, 1.2);
const C_MARK = new THREE.Color(0.62, 0.45, 1.0);
const C_HERE = new THREE.Color(1.05, 1.0, 0.9);
const C_TMP = new THREE.Color();

/** dải số 0…23 nằm dưới sàn cạnh các ô (canvas một lần) */
function numberStrip(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#20172c";
  g.fillRect(0, 0, c.width, c.height);
  g.font = "bold 40px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < TIMELINE.n; i++) {
    g.fillStyle = i % 3 === 0 && i % 4 === 0 ? "#ffd27a" : "#f3e6cf";
    g.fillText(String(i), ((i + 0.5) / TIMELINE.n) * c.width, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function ZoneWait() {
  const g = useZoneGroup("wait");
  const tex = useCutTex();
  const floorTex = useRepTex("terrazzo", WAIT_HALF.x / 2, WAIT_HALF.z / 2);
  const pillarTex = useRepTex("terrazzo", 2, 4);
  const rm = useMemo(() => reduceMotion(), []);
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const ui = useWaitUi();

  // ── hình cắt giấy (một lệnh vẽ)
  const { batch, mat, idx } = useMemo(() => {
    const items: CutItem[] = [];
    const idx = { board: 0, machine: 1, chairs: 2 };
    items.push({ cut: "board", at: [BOARD.x, BOARD.y0, BOARD.z], w: BOARD.w, yaw: 0 });
    items.push({ cut: "ticket_machine", at: [MACHINE.x, 0, MACHINE.z], w: 2.4, bill: 1 });
    for (const [x, z] of CHAIRS) items.push({ cut: "chair", at: [x, 0, z], w: 1.15, yaw: 0.08 * Math.sin(x * 3.1 + z) });
    // tháp ghế chồng ngược làm bệ chuông
    items.push({ cut: "chair", at: [BELL.x, 0, BELL.z], w: 1.5, yaw: 0.5 });
    items.push({ cut: "chair", at: [BELL.x + 0.15, 4.2, BELL.z], w: 1.5, h: -2.3, yaw: -0.7 });
    items.push({ cut: "chair", at: [BELL.x - 0.1, 4.2, BELL.z + 0.1], w: 1.3, yaw: 1.6, tint: [1, 0.85, 0.85] });
    // rèm bốn phía (nếp gấp chạy chậm)
    const step = 4.3;
    for (let x = -WAIT_HALF.x + 2; x <= WAIT_HALF.x - 1; x += step) {
      items.push({ cut: "curtain", at: [x, -0.3, -WAIT_HALF.z - 0.2], w: 4.8, yaw: 0, sway: 0.035 });
      items.push({ cut: "curtain", at: [x + 1.2, -0.3, WAIT_HALF.z + 0.2], w: 4.8, yaw: Math.PI, sway: 0.035 });
    }
    for (let z = -WAIT_HALF.z + 2; z <= WAIT_HALF.z - 1; z += step) {
      items.push({ cut: "curtain", at: [-WAIT_HALF.x - 0.2, -0.3, z], w: 4.8, yaw: Math.PI / 2, sway: 0.035 });
      items.push({ cut: "curtain", at: [WAIT_HALF.x + 0.2, -0.3, z + 1.1], w: 4.8, yaw: -Math.PI / 2, sway: 0.035 });
    }
    // bóng xa của các khu khác ở chân trời (sương nuốt thành hình cắt)
    items.push({ cut: "tower", at: [-150, -10, -170], w: 26, yaw: 0.6, sil: 0.72 });
    items.push({ cut: "crab_a", at: [170, -8, -120], w: 46, yaw: -0.9, sil: 0.72 });
    items.push({ cut: "door", at: [60, -5, 190], w: 30, yaw: Math.PI + 0.3, sil: 0.6 });
    const mat = createCutoutMat(tex, "#8a5a6a");
    return { batch: new CutoutBatch(items, mat), mat, idx };
  }, [tex]);

  // ── ô phách (instancing, màu theo trạng thái)
  const tiles = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(TIMELINE.w - 0.1, 0.14, TIMELINE.d), new THREE.MeshLambertMaterial({ color: "#ffffff" }), TIMELINE.n);
    const M = new THREE.Matrix4();
    for (let i = 0; i < TIMELINE.n; i++) {
      M.makeTranslation(tileX(i), 0.0, TIMELINE.z);
      m.setMatrixAt(i, M);
      m.setColorAt(i, C_BASE);
    }
    m.frustumCulled = false;
    return m;
  }, []);
  const strip = useMemo(() => numberStrip(), []);
  // ── bảng số (canvas nhỏ, vẽ lại khi số đổi)
  const board = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 112;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, g: c.getContext("2d")!, t, last: "" };
  }, []);
  const pillars = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.25, 15, 20, 1, true), new THREE.MeshLambertMaterial({ map: pillarTex }), PILLARS.length);
    const M = new THREE.Matrix4();
    PILLARS.forEach(([x, z], i) => m.setMatrixAt(i, M.makeTranslation(x, 7.5 - 1, z)));
    m.frustumCulled = false;
    return m;
  }, [pillarTex]);
  useEffect(
    () => () => {
      batch.dispose();
      mat.dispose();
      tiles.geometry.dispose();
      (tiles.material as THREE.Material).dispose();
      tiles.dispose();
      strip.dispose();
      board.t.dispose();
      pillars.geometry.dispose();
      (pillars.material as THREE.Material).dispose();
      pillars.dispose();
    },
    [batch, mat, tiles, strip, board, pillars],
  );

  // ── hành động: đặt dấu
  useEffect(() => {
    const off = registerAction("zone:wait:mark", () => {
      if (WT.done || WT.start >= 0) return;
      const p = useWorld.getState().player;
      const i = tileAt(p.x - O[0], p.z - O[2]);
      if (i < 0) return;
      WT.mark = i;
      WT.start = Math.floor(HARMONIC.beat) + 1;
      WT.lastTile = -2;
      synth.impact("paper", 5);
      synth.pluck(392, 0.4, 1);
    });
    const off2 = registerAction("zone:wait:busy", () => {});
    return () => {
      off();
      off2();
    };
  }, []);

  const mach = useRef({ x: { x: MACHINE.x, v: 0 } as Spring, z: { x: MACHINE.z, v: 0 } as Spring, out: [0, 0] as [number, number], beat: -1, introAt: -1e9 });
  useFrame((_, rawDt) => {
    if (ZONE_RT.id !== "wait") return;
    const dt = Math.min(0.05, rawDt);
    const w = useWorld.getState();
    const lx = w.player.x - O[0];
    const lz = w.player.z - O[2];
    mat.uniforms.uTime.value = rm ? 0 : HARMONIC.time;
    mat.uniforms.uCollage.value = HARMONIC.collageTime;
    mat.uniforms.uBoil.value = rm ? 0 : 1;
    // máy phát số đổi ý: lùi xa (lò xo), nhún theo ô nhịp như đang in vé rồi cuộn về
    const M = mach.current;
    machineTarget(lx, lz, M.out);
    springStep(M.x, M.out[0], 5, 0.9, dt);
    springStep(M.z, M.out[1], 5, 0.9, dt);
    const bump = rm ? 0 : Math.max(0, Math.sin(HARMONIC.beatPhase * Math.PI)) * (HARMONIC.bar % 2 ? 0.08 : 0.03);
    batch.place(idx.machine, M.x.x, 0, M.z.x, 0, 2.4, 2.4 / 0.4056 + bump, false);
    batch.needs();
    // lời dẫn khi vào khu
    if (performance.now() - M.introAt > 60000 && Math.hypot(lx - TIMELINE.x0, lz - TIMELINE.z) < 14 && !WT.done) {
      M.introAt = performance.now();
      const [a, b] = LCM_ROUNDS[WT.round];
      zoneHint(tt(w.lang === "vi" ? "vi" : "en", "wtIntro", { a, b }));
    }
    // ── dải thời gian
    const [a, b] = LCM_ROUNDS[Math.min(WT.round, LCM_ROUNDS.length - 1)];
    const here = tileAt(lx, lz);
    let cur = -1;
    let boardNum = 99 - (Math.floor(HARMONIC.beat / 2) % 90);
    let flash = 0;
    if (WT.start >= 0) {
      const d = demoAt(WT.start, HARMONIC.beat, a, b, WT.mark);
      cur = d.tile;
      if (cur !== WT.lastTile && cur >= 0) {
        WT.lastTile = cur;
        const be = bellAt(cur, a);
        const st = stampAt(cur, b);
        if (be && st) synth.chord(523.25, [1, 5 / 4, 3 / 2, 2], cur === 0 ? 0.25 : 0.5);
        else if (be) synth.bell(1046.5, 0.45, 1.8);
        else if (st) synth.impact("wood", 9);
        else synth.impact("paper", 1.5);
      }
      if (cur >= 0 && stampAt(cur, b)) boardNum = cur;
      flash = cur >= 0 && bellAt(cur, a) ? 1 - HARMONIC.beatPhase : 0;
      if (d.done) {
        const lg = w.lang === "vi" ? "vi" : "en";
        const at = new THREE.Vector3(tileX(WT.mark) + O[0], 1.6, TIMELINE.z + O[2]);
        if (d.correct) {
          floatText(at, tt(lg, "wtRight", { l: lcm(a, b), a, b }), "crit");
          WT.round++;
          if (WT.round >= LCM_ROUNDS.length) {
            WT.done = true;
            ZONE_FLAGS.ticket = true;
            zoneHint(tt(lg, "wtDone"));
            synth.resolve(392);
            for (let i = 0; i < 3; i++) rollDrops("mite", at.clone().add(new THREE.Vector3(i - 1, 0, 1)));
            w.burst([at.x, 2, at.z], "#ffd27a", 70);
          } else {
            const [na, nb] = LCM_ROUNDS[WT.round];
            setTimeout(() => zoneHint(tt(lg, "wtIntro", { a: na, b: nb })), 1800);
          }
          useWaitUi.setState({ round: WT.round, done: WT.done });
        } else {
          floatText(at, tt(lg, "wtWrong", { l: lcm(a, b), a, b, i: WT.mark }), "info");
          synth.dissonant(233, 0.5, 0.3);
        }
        WT.start = -1;
        WT.mark = -1;
      }
    }
    for (let i = 0; i < TIMELINE.n; i++) {
      // hé lộ trước vài bội đầu (gợi ý cách liệt kê bội); màn diễn hé lộ dần tới con trỏ
      const shown = (cur >= 0 && i <= cur) || (i < 7 && WT.start < 0) || WT.done;
      const be = bellAt(i, a);
      const st = stampAt(i, b);
      C_TMP.copy(C_BASE);
      if (shown && (be || st)) C_TMP.copy(be && st ? C_BOTH : be ? C_BELL : C_STAMP);
      if (!shown && WT.start < 0 && i >= 7) C_TMP.multiplyScalar(0.9);
      if (i === WT.mark) C_TMP.lerp(C_MARK, 0.65);
      if (i === here && WT.start < 0) C_TMP.lerp(C_HERE, 0.5);
      if (i === cur) C_TMP.copy(C_CUR);
      tiles.setColorAt(i, C_TMP);
    }
    tiles.instanceColor!.needsUpdate = true;
    // bảng: chuông trên nóc loé khi chuông gọi
    batch.tint(idx.board, 1 + flash * 0.6, 1 + flash * 0.5, 1 + flash * 0.2, 0);
    const label = WT.done ? "∞" : String(Math.max(0, boardNum)).padStart(2, "0");
    if (label !== board.last) {
      board.last = label;
      const gg = board.g;
      gg.fillStyle = "#0b0710";
      gg.fillRect(0, 0, 256, 112);
      gg.font = "bold 92px 'Courier New', monospace";
      gg.textAlign = "center";
      gg.textBaseline = "middle";
      gg.fillStyle = cur >= 0 && stampAt(cur, b) ? "#ffd27a" : "#ff8f6b";
      gg.shadowColor = "#ff6b4a";
      gg.shadowBlur = 16;
      gg.fillText(label, 128, 60);
      board.t.needsUpdate = true;
    }
    // âm nền phòng chờ: hợp âm thang máy mỗi 2 ô nhịp (tắt khi đang diễn để nghe rõ hai lịch)
    const bi = Math.floor(HARMONIC.beat);
    if (bi !== M.beat) {
      M.beat = bi;
      if (WT.start < 0 && bi % 8 === 0) synth.chord(196, [1, 5 / 4, 3 / 2, 15 / 8], 0.09);
      if (WT.start < 0 && bi % 4 === 2) synth.impact("paper", 1.2);
    }
  });

  const [ra, rb] = LCM_ROUNDS[Math.min(ui.round, LCM_ROUNDS.length - 1)];
  return (
    <group ref={g} position={O}>
      <mesh rotation-x={-Math.PI / 2} position-y={0} name="perf:wait:floor">
        <planeGeometry args={[WAIT_HALF.x * 2 + 1, WAIT_HALF.z * 2 + 1]} />
        <meshLambertMaterial map={floorTex} />
      </mesh>
      <primitive object={pillars} />
      <primitive object={tiles} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, TIMELINE.z + TIMELINE.d / 2 + 0.5]}>
        <planeGeometry args={[TIMELINE.n * TIMELINE.w, 0.75]} />
        <meshBasicMaterial map={strip} toneMapped={false} />
      </mesh>
      <mesh position={[BOARD.x, BOARD.y0 + 0.49 * (BOARD.w / 1.0873), BOARD.z + 0.06]}>
        <planeGeometry args={[BOARD.w * 0.74, BOARD.w * 0.33]} />
        <meshBasicMaterial map={board.t} toneMapped={false} />
      </mesh>
      <primitive object={batch.mesh} />
      <Label3D text={ui.done ? tt(lang, "wtDone") : tt(lang, "wtRound", { r: ui.round + 1, a: ra, b: rb })} position={[BELL.x, 5, BELL.z]} maxDist={40} />
      <Label3D text={tt(lang, "wtBoard")} position={[BOARD.x, BOARD.y0 + 12.4, BOARD.z]} maxDist={70} />
    </group>
  );
}
