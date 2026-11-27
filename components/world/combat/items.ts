"use client";
/**
 * Items: math/physics weapons (each one embodies a real idea), crafting materials, the player's bag
 * (persisted per browser), monster drops and the pickup feed.
 */
import * as THREE from "three";
import { create } from "zustand";

export type WeaponId = "blade" | "bow" | "staff" | "lever" | "pendulum" | "coil" | "spiral" | "prism";
export type MatId = "pi" | "prime" | "mobius" | "fractal" | "golden";
export type Rarity = 3 | 4 | 5;
type L = { en: string; vi: string };

export interface WeaponDef {
  id: WeaponId;
  name: L;
  rarity: Rarity;
  color: string;
  atk: number;
  cd: number;
  /** Ý tưởng toán / lý mà vũ khí thể hiện */
  idea: L;
  /** Cách đánh */
  move: L;
  /** Kích thước hiển thị (m, chiều dài lớn nhất) */
  size: number;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  blade: {
    id: "blade", rarity: 3, color: "#8fe6ff", atk: 15, cd: 340, size: 1.05,
    name: { en: "Vector Blade", vi: "Kiếm Vectơ" },
    idea: { en: "A vector is a direction plus a length. Every slash points where you face; the third hit of the combo is longer.", vi: "Vectơ = hướng + độ dài. Nhát chém luôn theo hướng bạn nhìn; đòn thứ ba của chuỗi dài hơn." },
    move: { en: "3-hit slash combo", vi: "Chuỗi 3 nhát chém" },
  },
  bow: {
    id: "bow", rarity: 4, color: "#ffd27a", atk: 17, cd: 420, size: 1.0,
    name: { en: "Parabola Bow", vi: "Cung Parabol" },
    idea: { en: "With constant gravity, y = v·t − ½·g·t². Every arrow traces a parabola; the bow solves for the launch speed that lands on the target.", vi: "Trọng lực không đổi: y = v·t − ½·g·t². Mũi tên bay theo parabol; cung tự giải vận tốc ném để trúng đích." },
    move: { en: "Auto-aimed ballistic arrows", vi: "Bắn tên ném xiên tự ngắm" },
  },
  staff: {
    id: "staff", rarity: 4, color: "#ff9ecb", atk: 13, cd: 620, size: 1.25,
    name: { en: "Fourier Staff", vi: "Trượng Fourier" },
    idea: { en: "Any periodic wave is a sum of sines. The ring ripples with 12 harmonics and hits everything inside the disc.", vi: "Mọi sóng tuần hoàn là tổng các hình sin. Vòng sóng gợn 12 hoạ âm, đánh trúng mọi thứ trong đĩa tròn." },
    move: { en: "Ring wave in front", vi: "Vòng sóng phía trước" },
  },
  lever: {
    id: "lever", rarity: 4, color: "#6ff2d0", atk: 10, cd: 760, size: 1.15,
    name: { en: "Archimedes Lever", vi: "Đòn bẩy Archimedes" },
    idea: { en: "Torque = force × arm length. Enemies farther along the lever take more damage and are thrown harder. Give me a place to stand…", vi: "Mô-men = lực × cánh tay đòn. Quái càng xa điểm tựa càng chịu sát thương lớn và bị hất mạnh. Hãy cho tôi một điểm tựa…" },
    move: { en: "Wide sweep, stronger at the tip", vi: "Quét rộng, đầu đòn mạnh nhất" },
  },
  pendulum: {
    id: "pendulum", rarity: 4, color: "#c8a6ff", atk: 9, cd: 900, size: 0.95,
    name: { en: "Pendulum Flail", vi: "Chuỳ Con lắc" },
    idea: { en: "A pendulum's period T = 2π√(L/g) does not depend on its mass. The bob orbits you with a steady rhythm and hits on every pass.", vi: "Chu kỳ con lắc T = 2π√(L/g) không phụ thuộc khối lượng. Quả lắc quay quanh bạn đều nhịp, mỗi vòng đánh một lần." },
    move: { en: "Orbiting bob, multi-hit", vi: "Quả lắc quay quanh, đánh nhiều lần" },
  },
  coil: {
    id: "coil", rarity: 5, color: "#9ec8ff", atk: 24, cd: 700, size: 0.6,
    name: { en: "Coulomb Coil", vi: "Cuộn Coulomb" },
    idea: { en: "Electric force falls off as 1/r². Lightning jumps to the nearest enemy, then the next nearest, weaker at each hop.", vi: "Lực điện giảm theo 1/r². Tia sét nhảy sang quái gần nhất, rồi quái gần kế tiếp, yếu dần sau mỗi bước." },
    move: { en: "Chain lightning (4 hops)", vi: "Sét lan chuỗi (4 bước)" },
  },
  spiral: {
    id: "spiral", rarity: 5, color: "#7cf0a0", atk: 12, cd: 1100, size: 0.6,
    name: { en: "Golden Spiral Disc", vi: "Đĩa Xoắn Vàng" },
    idea: { en: "r = a·φ^(2θ/π): each quarter turn grows by the golden ratio φ ≈ 1.618. The disc flies out on the spiral and comes back.", vi: "r = a·φ^(2θ/π): mỗi phần tư vòng nở ra φ ≈ 1,618 lần. Đĩa bay theo xoắn ốc vàng rồi quay về." },
    move: { en: "Boomerang on a golden spiral", vi: "Bay vòng theo xoắn ốc vàng" },
  },
  prism: {
    id: "prism", rarity: 5, color: "#f4f0ff", atk: 14, cd: 640, size: 0.5,
    name: { en: "Snell Prism", vi: "Lăng kính Snell" },
    idea: { en: "n₁·sin θ₁ = n₂·sin θ₂: light bends when it changes medium. One ray splits into three piercing beams.", vi: "n₁·sin θ₁ = n₂·sin θ₂: ánh sáng bẻ cong khi đổi môi trường. Một tia tách thành ba chùm xuyên thấu." },
    move: { en: "Three refracted beams", vi: "Ba chùm khúc xạ" },
  },
};
export const WEAPON_ORDER: WeaponId[] = ["blade", "bow", "staff", "lever", "pendulum", "coil", "spiral", "prism"];

export const MAT_DEFS: Record<MatId, { name: L; rarity: Rarity; color: string; lore: L }> = {
  pi: { name: { en: "π Crystal", vi: "Tinh thể π" }, rarity: 3, color: "#7fc8ff", lore: { en: "Its facets never repeat — like the digits of π.", vi: "Các mặt cắt không bao giờ lặp lại — như chữ số của π." } },
  prime: { name: { en: "Prime Shard", vi: "Mảnh Nguyên tố" }, rarity: 3, color: "#ffc35a", lore: { en: "Cannot be split into smaller equal pieces.", vi: "Không thể chia thành các phần bằng nhau nhỏ hơn." } },
  mobius: { name: { en: "Möbius Thread", vi: "Sợi Möbius" }, rarity: 4, color: "#c8a6ff", lore: { en: "A ribbon with only one side and one edge.", vi: "Dải ruy băng chỉ có một mặt và một mép." } },
  fractal: { name: { en: "Fractal Dust", vi: "Bụi Phân hình" }, rarity: 4, color: "#ff9a5a", lore: { en: "Zoom in and it looks the same, forever.", vi: "Phóng to bao nhiêu cũng thấy hình dạng như cũ." } },
  golden: { name: { en: "Golden Seed", vi: "Hạt Vàng" }, rarity: 5, color: "#ffe066", lore: { en: "Its spirals count 21 one way and 34 the other — Fibonacci.", vi: "Xoắn một chiều 21, chiều kia 34 — dãy Fibonacci." } },
};
export const MAT_ORDER: MatId[] = ["pi", "prime", "mobius", "fractal", "golden"];

export const RARITY_COLOR: Record<Rarity, string> = { 3: "#6fb6ff", 4: "#c08bff", 5: "#ffc94a" };

// ───────────── Hành trang (lưu trong trình duyệt) ─────────────

interface Bag {
  owned: WeaponId[];
  loadout: [WeaponId, WeaponId | null, WeaponId | null];
  mats: Partial<Record<MatId, number>>;
  /** Món mới nhận chưa xem (chấm đỏ) */
  fresh: string[];
}
const KEY = "world.bag.v1";
const START: Bag = { owned: ["blade", "bow", "staff"], loadout: ["blade", "bow", "staff"], mats: {}, fresh: [] };

function load(): Bag {
  if (typeof window === "undefined") return START;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return START;
    const b = JSON.parse(raw) as Bag;
    const owned = b.owned.filter((w) => w in WEAPON_DEFS);
    if (!owned.length) return START;
    const loadout = b.loadout.map((w) => (w && owned.includes(w) ? w : null)) as Bag["loadout"];
    if (!loadout[0]) loadout[0] = owned[0];
    return { owned, loadout, mats: b.mats ?? {}, fresh: b.fresh ?? [] };
  } catch {
    return START;
  }
}

export const useBag = create<Bag>(() => START);
let loaded = false;
export function initBag() {
  if (loaded) return;
  loaded = true;
  useBag.setState(load());
  useBag.subscribe((b) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(b));
    } catch {}
  });
}

export function grantWeapon(id: WeaponId): boolean {
  const b = useBag.getState();
  if (b.owned.includes(id)) return false;
  const loadout = [...b.loadout] as Bag["loadout"];
  const empty = loadout.indexOf(null);
  if (empty > 0) loadout[empty] = id;
  useBag.setState({ owned: [...b.owned, id], loadout, fresh: [...b.fresh, `w:${id}`] });
  return true;
}
export function addMat(id: MatId, n = 1) {
  const b = useBag.getState();
  useBag.setState({ mats: { ...b.mats, [id]: (b.mats[id] ?? 0) + n }, fresh: b.fresh.includes(`m:${id}`) ? b.fresh : [...b.fresh, `m:${id}`] });
}
export function equip(slot: 0 | 1 | 2, id: WeaponId | null) {
  const b = useBag.getState();
  const loadout = b.loadout.map((w) => (w === id ? null : w)) as Bag["loadout"];
  (loadout as (WeaponId | null)[])[slot] = id;
  if (!loadout[0]) loadout[0] = (loadout.find(Boolean) as WeaponId | undefined) ?? b.owned[0];
  useBag.setState({ loadout });
}
export function markSeen(key: string) {
  const b = useBag.getState();
  if (b.fresh.includes(key)) useBag.setState({ fresh: b.fresh.filter((k) => k !== key) });
}
export function loadoutList(): WeaponId[] {
  return useBag.getState().loadout.filter(Boolean) as WeaponId[];
}

// ───────────── Rơi đồ ─────────────

export type DropItem = { kind: "mat"; id: MatId; n: number } | { kind: "weapon"; id: WeaponId };
export interface Drop {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  item: DropItem;
  rarity: Rarity;
  born: number;
  taken: boolean;
}
export const drops: Drop[] = [];
let dropId = 1;

const KIND_MATS: Record<string, MatId[]> = { slime: ["pi", "prime"], wisp: ["mobius", "pi"], mite: ["fractal", "prime"] };

/** Tung đồ ra khi quái gục: 1–2 nguyên liệu, đôi khi Hạt Vàng, hiếm khi một vũ khí chưa có */
export function rollDrops(kind: string, at: THREE.Vector3) {
  const items: DropItem[] = [];
  const pool = KIND_MATS[kind] ?? ["pi"];
  items.push({ kind: "mat", id: pool[0], n: 1 + (Math.random() < 0.4 ? 1 : 0) });
  if (Math.random() < 0.5) items.push({ kind: "mat", id: pool[1], n: 1 });
  if (Math.random() < 0.06) items.push({ kind: "mat", id: "golden", n: 1 });
  const missing = WEAPON_ORDER.filter((w) => !useBag.getState().owned.includes(w) && !drops.some((d) => !d.taken && d.item.kind === "weapon" && d.item.id === w));
  // Lần đầu hạ quái luôn rơi một vũ khí mới (khơi tò mò), sau đó 14%
  const firstKill = useBag.getState().owned.length <= 3 && !drops.some((d) => d.item.kind === "weapon");
  if (missing.length && (firstKill || Math.random() < 0.14)) {
    const weighted = missing.flatMap((w) => Array(WEAPON_DEFS[w].rarity === 5 ? 1 : 3).fill(w) as WeaponId[]);
    items.push({ kind: "weapon", id: weighted[Math.floor(Math.random() * weighted.length)] });
  }
  const now = performance.now();
  items.forEach((item, i) => {
    const a = (i / items.length) * Math.PI * 2 + Math.random();
    const rarity = item.kind === "weapon" ? WEAPON_DEFS[item.id].rarity : MAT_DEFS[item.id].rarity;
    drops.push({ id: dropId++, pos: at.clone().setY(at.y + 0.6), vel: new THREE.Vector3(Math.cos(a) * 2.2, 4.5, Math.sin(a) * 2.2), item, rarity, born: now, taken: false });
  });
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].taken && now - drops[i].born > 2000) drops.splice(i, 1);
  if (drops.length > 40) drops.splice(0, drops.length - 40);
}

// ───────────── Dòng nhặt đồ (HUD) ─────────────

export interface Pickup {
  id: number;
  item: DropItem;
  at: number;
}
export const usePickups = create<{ list: Pickup[]; reveal: WeaponId | null }>(() => ({ list: [], reveal: null }));
let pickId = 1;
export function pushPickup(item: DropItem) {
  const now = performance.now();
  usePickups.setState((s) => ({ list: [...s.list.filter((p) => now - p.at < 4000), { id: pickId++, item, at: now }].slice(-5) }));
}
