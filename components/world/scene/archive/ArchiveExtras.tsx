"use client";
/**
 * Thư khố — phần "là một nơi chốn chứ không phải bản demo":
 *  • ArchivePages: 5 trang "Hồi âm" (ghi chép toán rách) nằm trên sàn hành lang; nhặt (F) → đọc trang; đủ 5 → mở Ghi chép
 *    thực địa "archivegraph" (đồ thị liên thông + bất biến + ngưỡng thấm). Lưu localStorage.
 *  • ArchivePresence: "người thủ thư" — một bóng người cao, không mặt, đứng trong vùng tối. CHỈ di chuyển khi không bị nhìn
 *    (ngoài khung hình hoặc bị tường che); không bao giờ lại gần hơn 3 ô, không tấn công. Rọi đèn pin thẳng vào nó một lúc →
 *    đèn chập, nó biến mất rồi xuất hiện lại sau lưng lúc khác (an toàn cho học sinh: rờn rợn, không máu me, không doạ giật).
 *  • Tiếng động xa ngẫu nhiên (tủ thép đóng, bước chân trên trần, ống nước).
 * Logic thuần + test: lib/world/archiveLayout.ts (PAGES, pageNear, presenceStep, presenceRespawn).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useWorld } from "../../store";
import { t as tt } from "@/lib/world/i18n";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../../actions";
import { unlockNote } from "../../story/quest";
import { cameraReach, CELL, hash3, PAGES, pageNear, pagePos, presenceRespawn, presenceStep, type EpochFn } from "@/lib/world/archiveLayout";
import { loadPages, PAGE_TEXT, pageCount, savePages } from "@/lib/world/archivePages";

/** trạng thái trang: mặt nạ đã nhặt + trang đang mở đọc (−1 = không) */
export const useArchivePages = create<{ got: number; open: number }>(() => ({ got: typeof window === "undefined" ? 0 : loadPages(), open: -1 }));

export function ArchivePages() {
  const lang = useWorld((s) => s.lang);
  const got = useArchivePages((s) => s.got);
  const open = useArchivePages((s) => s.open);
  // giấy: tấm mỏng màu ngà, hơi tự phát sáng để đèn pin "bắt" được từ xa
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BoxGeometry(0.21, 0.003, 0.297);
    const m = new THREE.MeshStandardMaterial({ color: "#d9d0bb", roughness: 0.85, emissive: new THREE.Color("#fff1cf"), emissiveIntensity: 0.06 });
    return { geo: g, mat: m };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  // nhặt trang gần nhất (F)
  useEffect(
    () =>
      registerAction("archive-page", () => {
        const p = useWorld.getState().player;
        const st = useArchivePages.getState();
        const k = pageNear(p.x, p.z, st.got);
        if (k < 0) return;
        const g = st.got | (1 << k);
        savePages(g);
        useArchivePages.setState({ got: g, open: k });
        sfx.pickup(pageCount(g) === PAGES.length);
        if (pageCount(g) === PAGES.length) unlockNote("archivegraph");
      }),
    [],
  );
  // thẻ trang (DOM thường gắn vào body — trong cây R3F không dùng được react-dom; drei Html ẩn khi gốc nằm sau máy quay)
  useEffect(() => {
    if (open < 0) return;
    const n = pageCount(useArchivePages.getState().got);
    const back = document.createElement("div");
    back.setAttribute("role", "dialog");
    Object.assign(back.style, { position: "fixed", inset: "0", zIndex: "60", display: "grid", placeItems: "center", background: "rgba(4,4,6,0.55)", cursor: "pointer" });
    const card = document.createElement("div");
    Object.assign(card.style, {
      width: "min(520px, calc(100vw - 32px))",
      padding: "28px 30px 22px",
      background: "linear-gradient(180deg, #e9e0c9, #d8ccb0)",
      color: "#2b2418",
      borderRadius: "3px",
      boxShadow: "0 18px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(120,90,40,0.25)",
      fontFamily: "'Noto Serif', 'Times New Roman', Times, serif", // Georgia thiếu dấu tiếng Việt
      transform: `rotate(${open % 2 ? -1.2 : 0.9}deg)`,
    });
    const head = document.createElement("div");
    Object.assign(head.style, { fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", opacity: "0.7", marginBottom: "12px" });
    head.textContent = tt(lang, "archivePageTitle", { n: open + 1 });
    const body = document.createElement("div");
    Object.assign(body.style, { fontSize: "17px", lineHeight: "1.6", fontStyle: "italic" });
    body.textContent = PAGE_TEXT[open][lang];
    const foot = document.createElement("div");
    Object.assign(foot.style, { marginTop: "18px", fontSize: "12px", opacity: "0.65", display: "flex", justifyContent: "space-between", gap: "12px" });
    const a = document.createElement("span");
    a.textContent = n === PAGES.length ? tt(lang, "archivePagesDone") : `${n}/${PAGES.length}`;
    const b = document.createElement("span");
    b.textContent = tt(lang, "archivePageClose");
    foot.append(a, b);
    card.append(head, body, foot);
    back.append(card);
    back.addEventListener("click", () => useArchivePages.setState({ open: -1 }));
    document.body.append(back);
    return () => back.remove();
  }, [open, lang]);
  // đóng trang: F / Esc / nhấp
  useEffect(() => {
    if (open < 0) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F" || e.key === "Escape") {
        e.stopPropagation();
        useArchivePages.setState({ open: -1 });
      }
    };
    const id = setTimeout(() => window.addEventListener("keydown", close, true), 250);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", close, true);
    };
  }, [open]);
  return (
    <group name="perf:ar_pages">
      {PAGES.map((pg, k) =>
        got & (1 << k) ? null : (
          <mesh key={k} geometry={geo} material={mat} position={[pagePos(k).x, 0.006, pagePos(k).z]} rotation={[0, pg.rot, 0]} receiveShadow />
        ),
      )}
    </group>
  );
}

/** hình bóng người thủ thư: áo choàng dài (tiện tròn) + đầu, một lưới, rất tối (chỉ hiện viền khi bị đèn pin rọi) */
function figureGeometry() {
  const prof: THREE.Vector2[] = [
    [0.001, 0],
    [0.34, 0],
    [0.3, 0.3],
    [0.25, 0.9],
    [0.22, 1.35],
    [0.26, 1.55],
    [0.2, 1.68],
    [0.07, 1.74],
    [0.001, 1.75],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(prof, 14);
  const head = new THREE.SphereGeometry(0.13, 12, 10);
  head.scale(0.9, 1.15, 0.95);
  head.translate(0, 1.9, 0.02);
  const g = mergeGeometries([robe.toNonIndexed(), head.toNonIndexed()]);
  robe.dispose();
  head.dispose();
  g.scale(1, 1.06, 0.7);
  g.computeVertexNormals();
  return g;
}

/** chỗ đứng trong ô: lệch tất định ±1 m khỏi tâm (sát tường / cột, không đứng giữa lối như hình nộm) */
const standOff = (i: number, j: number, k: number) => (hash3(i, j, 301 + k) - 0.5) * 2;
const P = new THREE.Vector3();
const TD = new THREE.Vector3();

export function ArchivePresence({ epochOf, power }: { epochOf: EpochFn; power: { v: number } }) {
  const { camera } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const { geo, mat } = useMemo(() => ({ geo: figureGeometry(), mat: new THREE.MeshStandardMaterial({ color: "#060606", roughness: 0.95, metalness: 0 }) }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const st = useMemo(() => ({ i: 0, j: 0, on: false, nextSpawn: 0, step: 0, tick: 0, seen: false, seenT: 0, glare: 0, kill: 0, x: 0, z: 0, nextSound: 0, t0: -1 }), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __presence: unknown }).__presence = st;
  }, [st]);

  useFrame((state, dt) => {
    // thời gian từ lúc vào cảnh (đồng hồ của Canvas chạy từ khi mở game)
    if (st.t0 < 0) {
      st.t0 = state.clock.elapsedTime;
      st.nextSpawn = 20;
      st.nextSound = 12;
    }
    const t = state.clock.elapsedTime - st.t0;
    const s = useWorld.getState();
    const p = s.player;
    const pi = Math.round(p.x / CELL);
    const pj = Math.round(p.z / CELL);
    const m = mesh.current;
    // tiếng động xa
    if (t > st.nextSound) {
      st.nextSound = t + 18 + Math.random() * 24;
      sfx.distant(Math.floor(Math.random() * 3), 0.25 + Math.random() * 0.3);
    }
    // đèn pin phục hồi sau khi chập
    power.v += (1 - power.v) * Math.min(1, dt * 2.5);
    if (st.kill > 0) {
      st.kill -= dt;
      power.v = Math.sin(t * 57) > 0 ? 0.12 : 0.5;
    }
    if (!m) return;
    if (!st.on) {
      m.visible = false;
      if (t < st.nextSpawn) return;
      const fx = -Math.sin(s.camYaw);
      const fz = -Math.cos(s.camYaw);
      const r = presenceRespawn(pi, pj, fx, fz, ++st.tick, epochOf);
      if (!r) {
        st.nextSpawn = t + 3;
        return;
      }
      [st.i, st.j] = r;
      st.on = true;
      st.x = st.i * CELL + standOff(st.i, st.j, 0);
      st.z = st.j * CELL + standOff(st.i, st.j, 1);
    }
    // có đang bị nhìn thấy không: trong khung hình + không bị tường che (theo hàm va chạm thuần)
    P.set(st.x, 1.3, st.z).project(camera);
    const inView = P.z < 1 && Math.abs(P.x) < 1.1 && Math.abs(P.y) < 1.1;
    const los = inView && cameraReach(camera.position.x, camera.position.z, st.x, st.z, epochOf, 0.05) > 0.97;
    const dist = Math.hypot(st.x - p.x, st.z - p.z);
    const seen = los && dist < 26;
    if (seen && !st.seen && dist < 16) sfx.distant(0, 0.35);
    st.seen = seen;
    // chỉ di chuyển khi không bị nhìn (≈ 0,8 s một ô)
    st.step += dt;
    if (!seen && st.step > 0.8) {
      st.step = 0;
      [st.i, st.j] = presenceStep(st.i, st.j, pi, pj, false, ++st.tick, epochOf);
      st.x = st.i * CELL + standOff(st.i, st.j, 0);
      st.z = st.j * CELL + standOff(st.i, st.j, 1);
    }
    // bị rọi đèn thẳng mặt ở gần → chập đèn, biến mất
    TD.set(st.x - p.x, 0, st.z - p.z).normalize();
    const lit = seen && dist < 9 && TD.x * -Math.sin(s.camYaw) + TD.z * -Math.cos(s.camYaw) > 0.93;
    st.glare = lit ? st.glare + dt : Math.max(0, st.glare - dt);
    if (st.glare > 0.9) {
      st.glare = 0;
      st.on = false;
      st.kill = 0.7;
      st.nextSpawn = t + 25 + Math.random() * 25;
      sfx.zap(1);
      sfx.distant(0, 0.5);
      s.addShake(0.08);
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.set(st.x, 0, st.z);
    m.rotation.y = Math.atan2(p.x - st.x, p.z - st.z);
  });
  return <mesh ref={mesh} name="perf:ar_presence" geometry={geo} material={mat} castShadow visible={false} />;
}
