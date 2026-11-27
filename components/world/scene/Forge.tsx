"use client";
/**
 * Matrix Forge in the voxel Expanse: build a shape on the 7×7 anvil plate, open the forge (F), pick a matrix card.
 * Each card shows its 3×3 matrix and determinant; applying it transforms the build v' = M·(v − c) + c and reports the
 * block count before → after (|det| multiplies volume). Applying two cards in a row shows AB ≠ BA.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import * as THREE from "three";
import { useWorld } from "../store";
import { B, blockAt, setBlock } from "@/lib/world/voxels";
import { blockTop } from "@/lib/world/terrain";
import { CARDS, det3, transformCells, type Cell } from "@/lib/world/matrixForge";
import { MagicCircle } from "../fx/Effects";
import { sfx } from "@/lib/world/sfx";

export const FORGE = { x: -10, z: 9 };
const SIZE = 7;
export function forgeBase() {
  return blockTop(FORGE.x + 3, FORGE.z + 3);
}

/** Đế rèn: khung vàng + vòng phép quanh vùng 7×7 */
export function ForgeAnvil() {
  const y = forgeBase();
  const c = new THREE.Vector3(FORGE.x + SIZE / 2, y + 0.04, FORGE.z + SIZE / 2);
  return (
    <group>
      <MagicCircle radius={SIZE * 0.72} position={[c.x, c.y, c.z]} color="#ffd27a" color2="#9fe6ff" intensity={0.55} spin={0.2} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[c.x + (i % 2 ? 0 : (i === 0 ? -1 : 1) * SIZE / 2), y + 0.1, c.z + (i % 2 ? (i === 1 ? -1 : 1) * SIZE / 2 : 0)]} rotation-y={i % 2 ? 0 : Math.PI / 2}>
          <boxGeometry args={[SIZE, 0.18, 0.18]} />
          <meshToonMaterial color="#f2c46b" emissive="#5a3a08" />
        </mesh>
      ))}
    </group>
  );
}

function collect(): Cell[] {
  const y0 = forgeBase();
  const out: Cell[] = [];
  for (let x = FORGE.x; x < FORGE.x + SIZE; x++)
    for (let z = FORGE.z; z < FORGE.z + SIZE; z++)
      for (let y = y0; y < y0 + 9; y++) {
        const id = blockAt(x, y, z);
        if (id !== B.air) out.push({ x, y, z, id });
      }
  return out;
}

export function ForgeOverlay({ onClose }: { onClose: () => void }) {
  const lang = useWorld((s) => (s.lang === "vi" ? "vi" : "en"));
  const [log, setLog] = useState<string[]>([]);
  const [last, setLast] = useState<{ before: number; after: number; det: number } | null>(null);
  const apply = (i: number) => {
    const card = CARDS[i];
    const cells = collect();
    if (!cells.length) {
      setLast({ before: 0, after: 0, det: det3(card.m) });
      return;
    }
    const y0 = forgeBase();
    const pivot = { x: FORGE.x + SIZE / 2, y: y0, z: FORGE.z + SIZE / 2 };
    const out = transformCells(cells, card.m, pivot);
    for (const c of cells) setBlock(c.x, c.y, c.z, B.air);
    for (const c of out) if (c.y >= y0 - 2 && c.y < y0 + 40) setBlock(c.x, c.y, c.z, c.id);
    setLast({ before: cells.length, after: out.length, det: det3(card.m) });
    setLog((l) => [...l.slice(-4), card.name[lang]]);
    useWorld.getState().burst([pivot.x, y0 + 2, pivot.z], "#ffd27a", 40);
    sfx.chime(2);
  };
  return (
    <motion.div className="w-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-bag w-forge" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <header className="w-bag__head">
          <span className="w-bag__title">{lang === "vi" ? "Lò rèn Ma trận" : "Matrix Forge"}</span>
          <span className="w-forge__hint">{lang === "vi" ? "Xây hình trên đế vàng 7×7 rồi chọn một ma trận" : "Build on the 7×7 golden plate, then choose a matrix"}</span>
          <button type="button" className="w-round w-round--sm" onClick={onClose} aria-label="Close">
            <X strokeWidth={2.4} />
          </button>
        </header>
        <div className="w-forge__grid">
          {CARDS.map((c, i) => (
            <button key={c.id} type="button" className="w-forge__card" onClick={() => apply(i)}>
              <b>{c.name[lang]}</b>
              <span className="w-forge__mat">
                {c.m.map((v, k) => (
                  <i key={k}>{v}</i>
                ))}
              </span>
              <span className="w-forge__det">det = {det3(c.m)}</span>
              <small>{c.idea[lang]}</small>
            </button>
          ))}
        </div>
        <footer className="w-forge__foot">
          {last ? (
            <span>
              {lang === "vi" ? "Số khối" : "Blocks"}: <b>{last.before}</b> → <b>{last.after}</b> · det = {last.det}
              {last.before === 0 && (lang === "vi" ? " — hãy đặt vài khối lên đế trước" : " — place some blocks on the plate first")}
            </span>
          ) : (
            <span>{lang === "vi" ? "Mẹo: áp dụng Quay rồi Trượt, so với Trượt rồi Quay — AB ≠ BA." : "Tip: apply Rotate then Shear, and compare with Shear then Rotate — AB ≠ BA."}</span>
          )}
          {log.length > 0 && <span className="w-forge__log">{log.join(" → ")}</span>}
        </footer>
      </motion.div>
    </motion.div>
  );
}

// DEV: móc kiểm thử trình duyệt (cùng thể hiện module với game) — không có ở bản production
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __forge: unknown }).__forge = { setBlock, B, forgeBase, FORGE };
}
