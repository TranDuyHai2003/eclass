"use client";
/**
 * Sổ Mưa — lớp vẽ + nối với combat (logic thuần ở lib/world/rainLedger.ts).
 * Model Blender `boss/ledger.glb` (bảng ở docs/ai-reviews/voxel-world/BOSSES.md; nạp nền, hình khối tạm khi chưa nạp): trống mưa + vành + vỏ niêm fresnel (+ xích, ổ khoá),
 * vòng hạt (InstancedMesh, màu theo làn), bến 4 làn + mọi báo trước trên MỘT lưới sàn (floorCue.ts),
 * mưa = 96 vệt (một InstancedBufferGeometry, rơi hoàn toàn trong vertex shader — CPU chỉ đổi vài uniform).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRADIENT } from "../fx/shaders";
import { ENV, enemies, playerHurt, spawnEnemy, useCombat, type Enemy } from "../combat/combat";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { bumpCombat } from "../audio/combatLayer";
import { impact, shockwave } from "../fx/Lensing";
import { emitBurst } from "../fx/Sparks";
import { Label3D, floatText } from "../ui/Labels";
import { fmtNum, t as tt } from "@/lib/world/i18n";
import { spawnDrop } from "../craft/invStore";
import { LANE_NAMES, RL, bestLane, drawTimes, expectedGain, hitLedger, laneCenter, laneOf, laneState, ledgerHurt, ledgerMul, newLedger, spillFront, sum, tickLedger } from "@/lib/world/rainLedger";
import { ArenaGround, cellGeometry, fresnelMaterial, ledgerFloorMaterial, ledgerFloorUniforms, updateCellHeights } from "./floorCue";
import { loadProgress, saveProgress, toast, useBossUi, type Fight } from "./bossStore";
import { applyLedger, packLedger, type LgPack } from "@/lib/world/bossNet";
import { encEnd, encHit, encPeers, encRole, encSend, encSlot, encTakeHits, shiftNow } from "./encounterNet";
import { enableVertexColors, useBossGlb } from "./bossGlb";
import { worldAsset } from "@/lib/world/avatars";

const RL_GLB = worldAsset("boss/ledger.glb");

const LANE_HEX = ["#ff8c8c", "#ffd16b", "#8deb9e", "#8cb8ff"];
const LANE_COL = LANE_HEX.map((c) => new THREE.Color(c));
const RAIN_N = 96;
const LEAVE_MS = 6000;
const LEAVE_R = 30;
const MAX_DOWNS = 3;
const DUMMY = new THREE.Object3D();
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();

export function LedgerFight({ fight, onEnd }: { fight: Fight; onEnd: (r: "win" | "retreat") => void }) {
  const { cx, cz, y: refY, seed, rot } = fight;
  // hướng dọc bến A (về phía trống), ngang bến U = bên PHẢI khi nhìn về trống (làn A bên trái) — khớp shader: u = dot(w, (−A.z, A.x))
  const ax = Math.round(Math.sin((rot * Math.PI) / 2));
  const az = Math.round(Math.cos((rot * Math.PI) / 2));
  const ux = -az;
  const uz = ax;
  const S = useMemo(() => {
    const now = performance.now();
    return {
      seed,
      sim: newLedger(seed, now),
      ground: new ArenaGround(cx, cz, 15, 15, refY),
      e: null as Enemy | null,
      row: 0,
      hudAt: 0,
      bumpAt: 0,
      infoAt: 0,
      awayMs: 0,
      downs: 0,
      wasDown: false,
      endAt: 0,
      ended: false,
      drumY: 0,
      drumV: RL.DRUM_V,
      rise: 0,
      /** cửa xả: 1 = nâng (đang xả lũ), 0 = đóng trên đất, −1 = chìm (trống hạ xuống lộ ra ngay đó) */
      gate: 0,
      last: "",
      lastAt: 0,
      revealed: 0,
      rainOn: [0, 0],
      round: -1,
      /** nhiều người (xem Surveyor.tsx): gói đã áp, lần gửi, vị trí người khác (toạ độ bến), sự kiện suy ra ở khách */
      ver: -1,
      sentAt: 0,
      peers: [] as number[],
      others: [] as number[],
      seenT0: 0,
      seenMode: "intro" as string,
      seenPhase: 1,
      seenSettled: false,
    };
  }, [cx, cz, refY, seed]);
  const W = (u: number, v: number, out: THREE.Vector3) => out.set(cx + ux * u + ax * v, 0, cz + uz * u + az * v);
  const at = (x: number, z: number) => (Math.abs(x - cx) <= 15 && Math.abs(z - cz) <= 15 ? S.ground.at(x, z) : ENV.ground(x, z));

  useEffect(() => {
    W(0, RL.DRUM_V, V1);
    const e = spawnEnemy("ledger", new THREE.Vector3(V1.x, refY + RL.DRUM_Y, V1.z));
    S.e = e;
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __ledger: S });
    e.ext = {
      boss: (en, amount) => {
        const now = performance.now();
        const m = ledgerMul(S.sim);
        const guest = encRole(S.seed) === "guest";
        if (guest && m > 0) encHit(S.seed, "b", amount);
        const dealt = guest ? Math.round(amount * m) : hitLedger(S.sim, amount);
        V1.set(en.pos.x, en.pos.y + 1.6, en.pos.z);
        if (m <= 0) return;
        floatText(V1, String(dealt), m > 1 ? "crit" : "dmg");
        if (m < 0.5 && now - S.infoAt > 1200) {
          S.infoAt = now;
          floatText(V1.setY(V1.y + 0.5), useWorld.getState().lang === "vi" ? "niêm" : "sealed", "info");
          sfx.shield();
        }
      },
    };
    return () => {
      const i = enemies.indexOf(e);
      if (i >= 0) enemies.splice(i, 1);
      S.e = null;
      useBossUi.setState({ on: false, ledger: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S, refY]);

  const R = useMemo(() => {
    const U = ledgerFloorUniforms();
    U.uOrigin.value.set(cx, cz);
    U.uAxis.value.set(ax, az);
    U.uLaneW.value = RL.LANE_W;
    U.uHalfLen.value = RL.HALF_LEN;
    U.uDrumV.value = RL.DRUM_V;
    const floorGeo = cellGeometry(S.ground);
    const floorMat = ledgerFloorMaterial(U);
    const toon = (c: string, em = "#000000", k = 0) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT, emissive: em, emissiveIntensity: k });
    const drumGeo = new THREE.CylinderGeometry(1.3, 1.3, 1.4, 28);
    const drumMat = toon("#dfe9ff", "#4a6cff", 0.12);
    const rimGeo = new THREE.TorusGeometry(1.33, 0.1, 8, 32);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = toon("#ffcf6b", "#ff9d00", 0.4);
    const sealGeo = new THREE.IcosahedronGeometry(2.0, 2);
    const sealMat = fresnelMaterial("#8fb8ff", 2.2, 1.3);
    const beadGeo = new THREE.SphereGeometry(0.22, 14, 10);
    const beadMat = toon("#ffffff", "#ffffff", 0.25);
    // mưa: vệt dọc hướng máy quay, vị trí + rơi tính trong vertex shader
    const rainGeo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(0.045, 0.85);
    rainGeo.index = quad.index;
    rainGeo.setAttribute("position", quad.getAttribute("position"));
    const off = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) off.set([Math.random(), Math.random(), Math.random()], i * 3);
    rainGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
    rainGeo.instanceCount = RAIN_N;
    const RU = {
      uTime: { value: 0 },
      uOrigin: { value: new THREE.Vector2(cx, cz) },
      uAxis: { value: new THREE.Vector2(ax, az) },
      uLanes: { value: new THREE.Vector2(-1, -1) },
      uOn: { value: new THREE.Vector2(0, 0) },
      uBaseY: { value: refY },
    };
    const rainMat = new THREE.ShaderMaterial({
      uniforms: RU,
      vertexShader: /* glsl */ `
        attribute vec3 aOff;
        uniform float uTime, uBaseY;
        uniform vec2 uOrigin, uAxis, uLanes, uOn;
        varying float vA;
        void main() {
          float slot = gl_InstanceID < ${RAIN_N / 2} ? 0.0 : 1.0;
          float lane = slot < 0.5 ? uLanes.x : uLanes.y;
          float on = slot < 0.5 ? uOn.x : uOn.y;
          vA = on;
          if (on < 0.01 || lane < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float u = -8.0 + ${RL.LANE_W.toFixed(1)} * (lane + 0.5) + (aOff.x - 0.5) * ${(RL.LANE_W * 0.9).toFixed(2)};
          float v = (aOff.y - 0.5) * ${(RL.HALF_LEN * 2).toFixed(1)};
          vec2 xz = uOrigin + uAxis * v + vec2(-uAxis.y, uAxis.x) * u;
          float y = uBaseY + 0.4 + 9.0 - mod(uTime * 16.0 + aOff.z * 9.0, 9.0);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 wp = vec3(xz.x, y, xz.y) + right * position.x + vec3(0.0, position.y, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * 1.6, 0.75 * vA); }`,
      transparent: true,
      depthWrite: false,
    });
    return { U, RU, floorGeo, floorMat, drumGeo, drumMat, rimGeo, rimMat, sealGeo, sealMat, beadGeo, beadMat, rainGeo, rainMat, quad };
  }, [S, cx, cz, ax, az, refY]);
  useEffect(
    () => () => {
      for (const v of Object.values(R)) if (v && typeof (v as { dispose?: () => void }).dispose === "function") (v as { dispose: () => void }).dispose();
    },
    [R],
  );

  const drum = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Mesh>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  const drumMesh = useRef<THREE.Mesh>(null);
  const rimA = useRef<THREE.Mesh>(null);
  const rimB = useRef<THREE.Mesh>(null);
  const chains = useRef<THREE.Mesh>(null);
  // 4 cửa xả (model rl_sluice, một InstancedMesh): đầu bến phía trống, mỗi làn một cửa — nâng lên khi Xả lũ
  const sluices = useRef<THREE.InstancedMesh>(null);
  const sluiceMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: GRADIENT, vertexColors: true }), []);
  useEffect(() => () => sluiceMat.dispose(), [sluiceMat]);
  // model Blender: trống (vành, 4 vòi, mặt sổ) + hạt + xích / ổ khoá (con của vỏ niêm → ẩn cùng lúc lộ); màu ở màu đỉnh
  const glb = useBossGlb(RL_GLB);
  useEffect(() => {
    if (!glb) return;
    const iron = new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: GRADIENT, vertexColors: true });
    enableVertexColors(R.drumMat, R.beadMat);
    if (drumMesh.current && glb.rl_drum) {
      drumMesh.current.geometry = glb.rl_drum;
      if (rimA.current) rimA.current.visible = false;
      if (rimB.current) rimB.current.visible = false;
    }
    if (beads.current && glb.rl_bead) beads.current.geometry = glb.rl_bead;
    if (sluices.current && glb.rl_sluice) {
      sluices.current.geometry = glb.rl_sluice;
      sluices.current.visible = true;
    }
    if (chains.current && glb.rl_chains) {
      chains.current.geometry = glb.rl_chains;
      chains.current.material = iron;
      chains.current.visible = true;
    }
    return () => iron.dispose();
  }, [glb, R]);
  const [bag, setBag] = useState<{ w: number[]; pay: number[] }>({ w: [1, 1, 1, 1], pay: [1, 1, 1, 1] });
  useEffect(() => {
    const m = beads.current;
    if (m) for (let i = 0; i < 10; i++) m.setColorAt(i, LANE_COL[0]);
  }, []);

  useFrame((st, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const time = st.clock.elapsedTime;
    const sim = S.sim;
    const w = useWorld.getState();
    const p = w.player;
    const dx = p.x - cx;
    const dz = p.z - cz;
    const pu = dx * ux + dz * uz;
    const pv = dx * ax + dz * az;
    const g = S.ground;
    for (let i = 0; i < g.nx; i++) g.h[S.row * g.nx + i] = ENV.ground(g.x0 + i + 0.5, g.z0 + S.row + 0.5, g.refY + 4);
    S.row = (S.row + 1) % g.nz;
    if (S.row === 0) updateCellHeights(R.floorGeo, g);

    const role = encRole(S.seed);
    let ev: string | null = null;
    if (!S.ended && role === "guest") {
      const sl = encSlot(S.seed);
      if (sl && sl.state && sl.ver !== S.ver) {
        S.ver = sl.ver;
        applyLedger(sim, sl.state as LgPack, shiftNow());
      }
      ev = ledgerGuestEvent(now, pu, pv);
    } else if (!S.ended) {
      encPeers(cx, cz, 30, S.peers);
      S.others.length = 0;
      for (let k = 0; k < S.peers.length; k += 2) {
        const ex = S.peers[k] - cx;
        const ez = S.peers[k + 1] - cz;
        S.others.push(ex * ux + ez * uz, ex * ax + ez * az);
      }
      ev = tickLedger(sim, now, pu, pv, S.others.length ? S.others : undefined);
      if (role === "host") {
        const hits = encTakeHits(S.seed);
        if (hits) for (const h of hits) if (h.k === "b") hitLedger(sim, h.d);
        if (now - S.sentAt > 125) {
          S.sentAt = now;
          encSend(S.seed, packLedger(sim, shiftNow()));
        }
      }
    }
    const lang = w.lang;
    if (ev === "shake") {
      sfx.drumroll(0.9);
      S.revealed = 0;
    } else if (ev === "commit") {
      const d = sim.draw!;
      if (d.bet < 0) note(tt(lang, "bxNoBet"));
    } else if (ev === "tally" || ev === "bust") {
      const d = sim.draw!;
      const L = LANE_NAMES[d.bet];
      if (ev === "tally") {
        const best = bestLane(sim.bag.w, sim.bag.pay, d.k);
        note(`${tt(lang, "bxBetWin", { lane: L, n: d.gain })} · ${tt(lang, "bxBest", { lane: L, e: fmtNum(expectedGain(sim.bag.w, sim.bag.pay, d.bet, d.k), lang), best: LANE_NAMES[best], be: fmtNum(expectedGain(sim.bag.w, sim.bag.pay, best, d.k), lang) })}`);
        sfx.chime(2);
      } else note(tt(lang, "bxBetBust", { lane: L }));
    } else if (ev === "spill") {
      sfx.waveCrest(1.4, true);
      toast(tt(lang, "bxSpill"), "warn");
    } else if (ev === "exposed") {
      sfx.impact(1.3);
      impact(0.7);
      w.addShake(0.35);
    } else if (ev === "phase2") {
      toast(tt(lang, "bxLedgerP2"), "warn");
      impact(0.6);
    } else if (ev === "dead") {
      S.endAt = now;
      sfx.fanfare();
      impact(1.1);
      w.addShake(0.6);
      W(0, S.drumV, V1).setY(at(V1.x, V1.z) + 1.2);
      shockwave(V1, 1.3);
      emitBurst(V1.x, V1.y + 0.6, V1.z, "#bfe1ff", 60, 8);
      const n = 4 + Math.floor(Math.random() * 3);
      spawnDrop("chance_amber", n, V1.x, V1.y + 0.5, V1.z);
      const pr = loadProgress();
      if (pr.ledger === 0 || Math.random() < 0.35) spawnDrop("observatory_seal", 1, V1.x, V1.y + 0.8, V1.z);
      pr.ledger++;
      saveProgress(pr);
      toast(`${tt(lang, "bxLedgerWin")} ${tt(lang, "bxReward", { items: `${lang === "vi" ? "Hổ phách May rủi" : "Chance Amber"} ×${n}` })}`, "win");
    }
    if (sim.round !== S.round) {
      S.round = sim.round;
      setBag({ w: sim.bag.w.slice(), pay: sim.bag.pay.slice() });
    }
    if (sim.mode === "dead" && !S.ended && now - S.endAt > 3500) {
      S.ended = true;
      if (role === "host") encSend(S.seed, packLedger(sim, shiftNow()));
      encEnd(S.seed, "win");
      onEnd("win");
      return;
    }
    const slot = role === "solo" ? encSlot(S.seed) : null;
    if (!S.ended && slot?.ended && slot.ended !== "win") {
      S.ended = true;
      toast(tt(lang, "bxRetreat"), "warn");
      onEnd("retreat");
      return;
    }
    // đòn trúng người chơi
    if (!S.ended && sim.mode !== "dead") {
      const gy = at(p.x, p.z);
      if (p.y - gy < 2.5 && p.y - gy > -3) {
        const dmg = ledgerHurt(sim, now, pu, pv);
        if (dmg > 0) playerHurt(dmg, W(0, S.drumV, V1).setY(gy));
      }
      const company = role !== "guest" && S.others.length > 0;
      S.awayMs = Math.hypot(pu, pv) > LEAVE_R && !company ? S.awayMs + dt * 1000 : 0;
      const down = useCombat.getState().hp <= 0;
      if (down && !S.wasDown) S.downs++;
      S.wasDown = down;
      if (S.awayMs > LEAVE_MS || (S.downs >= MAX_DOWNS && role === "solo")) {
        S.ended = true;
        toast(tt(lang, role === "guest" ? "bxLeftFight" : "bxRetreat"), "warn");
        encEnd(S.seed, "retreat");
        onEnd("retreat");
        return;
      }
      if (now - S.bumpAt > 1500 && Math.hypot(pu, pv) < 32) {
        S.bumpAt = now;
        bumpCombat(sim.phase === 2 ? 0.42 : 0.3);
      }
    }

    // ── trống: lơ lửng cuối bến; lộ ra → hạ xuống đầu bến xa ──
    S.rise = Math.min(1, S.rise + dt / 2);
    const exposed = sim.mode === "exposed";
    const targetV = exposed ? RL.DRUM_V - 2.5 : RL.DRUM_V;
    S.drumV += (targetV - S.drumV) * Math.min(1, dt * 3);
    W(0, S.drumV, V1);
    const gy = at(V1.x, V1.z);
    const targetY = gy + (exposed ? 1.2 : RL.DRUM_Y + 0.25 * Math.sin(time * 1.3));
    S.drumY += (targetY - S.drumY) * Math.min(1, dt * (exposed ? 6 : 2));
    const dg = drum.current;
    const d = sim.draw;
    const T = d ? drawTimes(d.k) : null;
    const tIn = d ? now - d.t0 : 0;
    if (dg) {
      const dead = sim.mode === "dead" ? Math.max(0.001, 1 - (now - S.endAt) / 2500) : 1;
      dg.position.set(V1.x, S.drumY - (1 - S.rise) * 6, V1.z);
      const shake = d && T && tIn < T.commit ? Math.sin(tIn * 0.06) * 0.12 * (1 - tIn / T.commit) : 0;
      dg.rotation.set(shake, time * 0.4, shake * 0.6);
      dg.scale.setScalar(dead);
    }
    // cửa xả: nâng khi xả lũ (nước chui dưới cửa), chìm khi trống hạ xuống lộ ra ngay đầu bến, còn lại đóng
    const gateTo = sim.mode === "spill" ? 1 : exposed || sim.mode === "dead" ? -1 : 0;
    S.gate += (gateTo - S.gate) * Math.min(1, dt * (gateTo === 1 ? 4 : 2));
    const sl = sluices.current;
    if (sl && sl.visible) {
      const yaw = Math.atan2(-uz, ux);
      for (let i = 0; i < RL.LANES; i++) {
        W(laneCenter(i), RL.HALF_LEN + 0.7, V2);
        const y = at(V2.x, V2.z) + (S.gate > 0 ? S.gate * 1.2 : S.gate * 2.3) - (1 - S.rise) * 3;
        DUMMY.position.set(V2.x, y, V2.z);
        DUMMY.rotation.set(0, yaw, 0);
        DUMMY.scale.setScalar(1);
        DUMMY.updateMatrix();
        sl.setMatrixAt(i, DUMMY.matrix);
      }
      sl.instanceMatrix.needsUpdate = true;
    }
    if (seal.current) {
      seal.current.visible = !exposed && sim.mode !== "dead";
      (R.sealMat.uniforms.uTime as { value: number }).value = time;
    }
    if (S.e) {
      S.e.pos.set(V1.x, S.drumY - 0.5, V1.z);
      if (sim.mode === "dead") S.e.deadAt = S.e.deadAt || now;
    }

    // ── vòng hạt: mỗi làn w hạt (tổng ≤ 8), hạt vừa rút bay về làn ──
    const bm = beads.current;
    if (bm) {
      const tot = sum(sim.bag.w);
      let k = 0;
      for (let ln = 0; ln < 4; ln++)
        for (let j = 0; j < sim.bag.w[ln] && k < 8; j++, k++) {
          const ang = (k / tot) * Math.PI * 2 + time * 0.9;
          DUMMY.position.set(V1.x + Math.cos(ang) * 2.1, S.drumY + 0.3 * Math.sin(ang * 2 + time), V1.z + Math.sin(ang) * 2.1);
          DUMMY.scale.setScalar(1);
          DUMMY.updateMatrix();
          bm.setMatrixAt(k, DUMMY.matrix);
          bm.setColorAt(k, LANE_COL[ln]);
        }
      let n = k;
      if (d && T)
        for (let i = 0; i < d.k; i++) {
          const f = (tIn - T.reveal(i)) / 500;
          if (f < 0 || tIn > T.rain(i) + RL.RAIN_MS) continue;
          const ff = Math.min(1, f);
          W(laneCenter(d.lanes[i]), 0, DUMMY.position);
          const tx = DUMMY.position.x;
          const tz = DUMMY.position.z;
          DUMMY.position.set(V1.x + (tx - V1.x) * ff, S.drumY + (at(tx, tz) + 6 - S.drumY) * ff + Math.sin(ff * Math.PI) * 2.5, V1.z + (tz - V1.z) * ff);
          DUMMY.scale.setScalar(1.8);
          DUMMY.updateMatrix();
          bm.setMatrixAt(n, DUMMY.matrix);
          bm.setColorAt(n, LANE_COL[d.lanes[i]]);
          n++;
          if (f >= 0 && S.revealed <= i) {
            S.revealed = i + 1;
            sfx.telegraph(2);
          }
        }
      bm.count = n;
      bm.instanceMatrix.needsUpdate = true;
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    }

    // ── sàn + mưa ──
    const U = R.U;
    U.uTime.value = time;
    U.uFade.value = Math.min(1, U.uFade.value + dt) * (sim.mode === "dead" ? Math.max(0, 1 - (now - S.endAt) / 3000) : 1);
    const ls = U.uLane.value;
    const lt = U.uLaneT.value;
    for (let ln = 0; ln < 4; ln++) {
      const s = laneState(sim, now, ln);
      let prog = 0;
      if (s === 1 && d && T) for (let i = 0; i < d.k; i++) if (d.lanes[i] === ln) prog = Math.max(prog, Math.min(1, (tIn - T.reveal(i)) / (T.rain(i) - T.reveal(i))));
      ls.setComponent(ln, s);
      lt.setComponent(ln, prog);
    }
    U.uBet.value = d && d.committed ? d.bet : laneOf(pu, pv);
    const front = spillFront(sim, now);
    U.uSpill.value.set(sim.mode === "spill" ? sim.spill[0] : -1, sim.mode === "spill" ? sim.spill[1] : -1, front ?? -99, sim.mode === "spill" && front === null ? 1 : 0);
    U.uExposed.value = exposed ? 1 : 0;
    const RU = R.RU;
    RU.uTime.value = time;
    RU.uBaseY.value = at(cx, cz);
    for (let i = 0; i < 2; i++) {
      let on = 0;
      if (d && T && i < d.k) {
        const tr = tIn - T.rain(i);
        // mưa lất phất từ lúc lộ, xối xả khi tới giờ
        if (tIn >= T.reveal(i) && tr < RL.RAIN_MS) on = tr >= 0 ? 1 : 0.25;
        if (tr >= 0 && tr < 60 && S.rainOn[i] === 0) sfx.impact(0.5);
        S.rainOn[i] = tr >= 0 && tr < RL.RAIN_MS ? 1 : 0;
      }
      RU.uLanes.value.setComponent(i, d && i < d.k ? d.lanes[i] : -1);
      RU.uOn.value.setComponent(i, on);
    }

    // ── HUD ──
    if (now - S.hudAt > 125) {
      S.hudAt = now;
      useBossUi.setState({
        on: true,
        id: "ledger",
        hp: sim.hp,
        maxHp: sim.maxHp,
        phase: sim.phase,
        mode: sim.mode,
        atk: d ? (T && tIn < T.commit ? "shake" : "draw") : null,
        seal: null,
        pu: Math.round(pu),
        pv: Math.round(pv),
        ledger: {
          w: sim.bag.w,
          pay: sim.bag.pay,
          k: sim.phase === 2 ? 2 : 1,
          points: sim.points,
          need: sim.need,
          bet: d && d.committed ? d.bet : laneOf(pu, pv),
          counts: sim.counts,
          expect: sim.expect,
          last: now - S.lastAt < 4500 ? S.last : "",
        },
      });
    }
  });

  /** khách: suy sự kiện từ trạng thái đã đồng bộ; cược của chính mình chốt cục bộ (cùng mốc thời gian với chủ) */
  function ledgerGuestEvent(now: number, pu: number, pv: number): string | null {
    const sim = S.sim;
    const d = sim.draw;
    let ev: string | null = null;
    if (sim.mode === "dead" && S.seenMode !== "dead") ev = "dead";
    else if (sim.mode === "spill" && S.seenMode !== "spill") ev = "spill";
    else if (sim.mode === "exposed" && S.seenMode !== "exposed") ev = "exposed";
    else if (sim.phase === 2 && S.seenPhase === 1) ev = "phase2";
    else if (d && d.t0 !== S.seenT0) {
      S.seenT0 = d.t0;
      S.seenSettled = false;
      d.bet = -1;
      ev = "shake";
    } else if (d && d.bet === -1 && !S.seenSettled && now - d.t0 >= drawTimes(d.k).commit && !d.committed) {
      // (đợi gói "đã chốt" của chủ)
    } else if (d && d.committed && d.bet === -1 && !S.seenSettled && now - d.t0 >= drawTimes(d.k).commit) {
      d.bet = laneOf(pu, pv);
      if (d.bet < 0) d.bet = -2;
      ev = "commit";
    } else if (d && d.settled && !S.seenSettled) {
      S.seenSettled = true;
      if (d.bet >= 0) {
        d.gain = d.lanes.includes(d.bet) ? 0 : sim.bag.pay[d.bet];
        ev = d.gain > 0 ? "tally" : "bust";
      }
    }
    S.seenMode = sim.mode;
    S.seenPhase = sim.phase;
    return ev;
  }

  function note(s: string) {
    S.last = s;
    S.lastAt = performance.now();
  }

  // nhãn làn (đổi khi đổi túi): tên · xác suất · điểm
  const tot = sum(bag.w);
  return (
    <group>
      <mesh geometry={R.floorGeo} material={R.floorMat} renderOrder={3} frustumCulled={false} />
      <mesh geometry={R.rainGeo} material={R.rainMat} frustumCulled={false} renderOrder={6} />
      <instancedMesh ref={beads} args={[R.beadGeo, R.beadMat, 10]} frustumCulled={false} />
      <instancedMesh ref={sluices} args={[undefined, sluiceMat, RL.LANES]} visible={false} frustumCulled={false} />
      <group ref={drum}>
        <mesh ref={drumMesh} geometry={R.drumGeo} material={R.drumMat} />
        <mesh ref={rimA} geometry={R.rimGeo} material={R.rimMat} position={[0, 0.7, 0]} />
        <mesh ref={rimB} geometry={R.rimGeo} material={R.rimMat} position={[0, -0.7, 0]} />
        <mesh ref={seal} geometry={R.sealGeo} material={R.sealMat} renderOrder={5}>
          {/* xích + ổ khoá quanh vỏ niêm (model Blender; ẩn tới khi nạp) — rơi đi cùng vỏ khi lộ */}
          <mesh ref={chains} visible={false} renderOrder={0} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((ln) => {
        const u = laneCenter(ln);
        const v = -RL.HALF_LEN - 1.4;
        const x = cx + ux * u + ax * v;
        const z = cz + uz * u + az * v;
        return (
          <Label3D
            key={`${ln}-${bag.w.join()}-${bag.pay.join()}`}
            text={`${LANE_NAMES[ln]} · ${bag.w[ln]}/${tot}${bag.pay[ln] !== 1 || bag.pay.some((q) => q !== 1) ? ` · +${bag.pay[ln]}` : ""}`}
            position={[x, S.ground.at(x, z) + 1.4, z]}
            variant="small"
            maxDist={50}
          />
        );
      })}
    </group>
  );
}
