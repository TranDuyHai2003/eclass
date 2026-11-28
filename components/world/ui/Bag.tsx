"use client";
/**
 * Bag (inventory) + loot UI: anime-game item cards by rarity (3★ blue, 4★ violet, 5★ gold), a detail pane with the
 * math/physics idea behind each weapon and 3 equip slots; pickup feed (left) and a reveal card for new weapons.
 * Item art: hand-painted anime icons generated for this game (public/world/items).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Backpack, Star, X } from "lucide-react";
import { useWorld } from "../store";
import { useCombat } from "../combat/combat";
import { MAT_DEFS, MAT_ORDER, RARITY_COLOR, WEAPON_DEFS, WEAPON_ORDER, equip, initBag, markSeen, useBag, usePickups, type MatId, type Rarity, type WeaponId } from "../combat/items";
import { worldAsset } from "@/lib/world/avatars";

type L = { en: string; vi: string };
const TX = {
  bag: { en: "Bag", vi: "Hành trang" },
  weapons: { en: "Weapons", vi: "Vũ khí" },
  materials: { en: "Materials", vi: "Nguyên liệu" },
  atk: { en: "ATK", vi: "Công" },
  idea: { en: "The idea inside", vi: "Ý tưởng ẩn bên trong" },
  equip: { en: "Equip to slot", vi: "Trang bị vào ô" },
  locked: { en: "Not found yet — defeat monsters to discover it.", vi: "Chưa tìm thấy — hạ quái để khám phá." },
  newWeapon: { en: "New weapon discovered", vi: "Phát hiện vũ khí mới" },
  tapClose: { en: "Tap to continue", vi: "Chạm để tiếp tục" },
  owned: { en: "Owned", vi: "Đang có" },
  close: { en: "Close", vi: "Đóng" },
} satisfies Record<string, L>;

function useTx() {
  const lang = useWorld((s) => s.lang);
  return (k: keyof typeof TX | L) => (typeof k === "string" ? TX[k] : k)[lang === "vi" ? "vi" : "en"];
}

const art = (kind: "w" | "m", id: string) => worldAsset(`items/${kind}_${id}.webp`);

function Stars({ n, size = 12 }: { n: Rarity; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} size={size} fill="#ffd66b" color="#ffd66b" strokeWidth={1} />
      ))}
    </span>
  );
}

export function BagButton({ onOpen }: { onOpen: () => void }) {
  const tx = useTx();
  const fresh = useBag((s) => s.fresh.length);
  useEffect(() => initBag(), []);
  return (
    <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onOpen} className="w-round relative" aria-label={tx("bag")} title={tx("bag")}>
      <Backpack strokeWidth={2.2} />
      {fresh > 0 && <span className="w-dot" />}
    </motion.button>
  );
}

export function BagOverlay({ onClose }: { onClose: () => void }) {
  const tx = useTx();
  const [tab, setTab] = useState<"w" | "m">("w");
  const owned = useBag((s) => s.owned);
  const mats = useBag((s) => s.mats);
  const fresh = useBag((s) => s.fresh);
  const loadout = useBag((s) => s.loadout);
  const [sel, setSel] = useState<string>("blade");
  useEffect(() => markSeen(`${tab}:${sel}`), [tab, sel]);
  return (
    <motion.div className="w-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="w-bag"
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="w-bag__head">
          <span className="w-bag__title">
            <Backpack size={18} /> {tx("bag")}
          </span>
          <nav className="w-tabs">
            {(["w", "m"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={tab === k ? "is-on" : ""}
                onClick={() => {
                  setTab(k);
                  setSel(k === "w" ? "blade" : (MAT_ORDER.find((m) => mats[m]) ?? "pi"));
                }}
              >
                {tx(k === "w" ? "weapons" : "materials")}
              </button>
            ))}
          </nav>
          <button type="button" className="w-round w-round--sm" onClick={onClose} aria-label={tx("close")}>
            <X strokeWidth={2.4} />
          </button>
        </header>
        <div className="w-bag__body">
          <div className="w-bag__grid">
            {tab === "w"
              ? WEAPON_ORDER.map((id) => {
                  const d = WEAPON_DEFS[id];
                  const has = owned.includes(id);
                  const slot = loadout.indexOf(id);
                  return (
                    <button key={id} type="button" className={`w-card ${sel === id ? "is-sel" : ""} ${has ? "" : "is-locked"}`} onClick={() => setSel(id)}>
                      <span className={`w-card__bg w-rar-${d.rarity}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art("w", id)} alt="" draggable={false} className="w-card__art" />
                      <span className="w-card__foot">
                        <Stars n={d.rarity} size={9} />
                      </span>
                      {slot >= 0 && <span className="w-card__slot">{slot + 1}</span>}
                      {fresh.includes(`w:${id}`) && <span className="w-dot" />}
                    </button>
                  );
                })
              : MAT_ORDER.map((id) => {
                  const d = MAT_DEFS[id];
                  const n = mats[id] ?? 0;
                  return (
                    <button key={id} type="button" className={`w-card ${sel === id ? "is-sel" : ""} ${n ? "" : "is-locked"}`} onClick={() => setSel(id)}>
                      <span className={`w-card__bg w-rar-${d.rarity}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art("m", id)} alt="" draggable={false} className="w-card__art" />
                      <span className="w-card__foot">{n}</span>
                      {fresh.includes(`m:${id}`) && <span className="w-dot" />}
                    </button>
                  );
                })}
          </div>
          <AnimatePresence mode="wait">
            <motion.aside key={`${tab}:${sel}`} className="w-bag__detail" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {tab === "w" ? (
                <WeaponDetail id={sel as WeaponId} />
              ) : (
                <>
                  <div className={`w-detail__hero w-rar-${MAT_DEFS[sel as MatId].rarity}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={art("m", sel)} alt="" draggable={false} />
                  </div>
                  <h3 className="w-detail__name">{tx(MAT_DEFS[sel as MatId].name)}</h3>
                  <Stars n={MAT_DEFS[sel as MatId].rarity} />
                  <p className="w-detail__text">{tx(MAT_DEFS[sel as MatId].lore)}</p>
                  <p className="w-detail__meta">
                    {tx("owned")}: {mats[sel as MatId] ?? 0}
                  </p>
                </>
              )}
            </motion.aside>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WeaponDetail({ id }: { id: WeaponId }) {
  const tx = useTx();
  const d = WEAPON_DEFS[id];
  const owned = useBag((s) => s.owned.includes(id));
  const loadout = useBag((s) => s.loadout);
  return (
    <>
      <div className={`w-detail__hero w-rar-${d.rarity}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art("w", id)} alt="" draggable={false} className={owned ? "" : "w-img--locked"} />
      </div>
      <h3 className="w-detail__name">{tx(d.name)}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Stars n={d.rarity} />
        <span className="w-detail__meta">
          {tx("atk")} {d.atk} · {tx(d.move)}
        </span>
      </div>
      {owned ? (
        <>
          <p className="w-detail__label">{tx("idea")}</p>
          <p className="w-detail__text">{tx(d.idea)}</p>
          <p className="w-detail__label">{tx("equip")}</p>
          <div className="flex gap-2">
            {([0, 1, 2] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                className={`w-slot ${loadout[slot] === id ? "is-on" : ""}`}
                onClick={() => {
                  equip(slot, loadout[slot] === id && slot > 0 ? null : id);
                  useCombat.setState({ weapon: 0 });
                }}
              >
                {slot + 1}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="w-detail__text opacity-70">{tx("locked")}</p>
      )}
    </>
  );
}

/** Dòng nhặt đồ bên trái: ảnh + tên + số lượng, tự trôi đi */
export function PickupFeed() {
  const tx = useTx();
  const list = usePickups((s) => s.list);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 400);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="w-feed">
      <AnimatePresence initial={false}>
        {list
          .filter((p) => !now || now - p.at < 3800)
          .map((p) => {
            const def = p.item.kind === "weapon" ? WEAPON_DEFS[p.item.id] : MAT_DEFS[p.item.id];
            return (
              <motion.div key={p.id} layout initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="w-feed__row" style={{ ["--rc" as string]: RARITY_COLOR[def.rarity] }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={art(p.item.kind === "weapon" ? "w" : "m", p.item.id)} alt="" />
                <span className="truncate">{tx(def.name)}</span>
                {p.item.kind === "mat" && <span className="w-feed__n">×{p.item.n}</span>}
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
}

/** Thẻ khoe vũ khí mới: tia sáng theo độ hiếm, sao, ý tưởng toán học */
export function WeaponReveal() {
  const tx = useTx();
  const id = usePickups((s) => s.reveal);
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => usePickups.setState({ reveal: null }), 7000);
    return () => window.clearTimeout(t);
  }, [id]);
  const d = id ? WEAPON_DEFS[id] : null;
  return (
    <AnimatePresence>
      {d && id && (
        <motion.div className="w-reveal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => usePickups.setState({ reveal: null })} style={{ ["--rc" as string]: RARITY_COLOR[d.rarity] }}>
          <motion.div className="w-reveal__rays" initial={{ scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
          <motion.div className="w-reveal__card" initial={{ y: 30, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}>
            <p className="w-reveal__kicker">{tx("newWeapon")}</p>
            <motion.img src={art("w", id)} alt="" draggable={false} initial={{ rotate: -12, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.3 }} />
            <h3>{tx(d.name)}</h3>
            <Stars n={d.rarity} size={16} />
            <p className="w-reveal__idea">{tx(d.idea)}</p>
            <p className="w-reveal__hint">{tx("tapClose")}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
