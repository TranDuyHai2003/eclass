"use client";
/**
 * G4 — Giao diện Vùng Kỳ quan: tâm ngắm + vòng tiến độ đào + toạ độ khối đang nhắm, thanh nhanh 9 ô (số lượng, dụng cụ),
 * dòng nhặt đồ; bảng Túi đồ & Chế tạo (overlay "craft"): công thức kèm TỈ LỆ, ×k và "tối đa = min ⌊có / cần⌋".
 * Vòng đào / toạ độ cập nhật bằng rAF trực tiếp vào DOM (không setState mỗi khung).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Gem, Hammer, Lock, Pickaxe, Sparkles, X } from "lucide-react";
import { useWorld, useT } from "../store";
import { tr, type L, type Lang } from "@/lib/world/i18n";
import { B, blockAt } from "@/lib/world/voxels";
import { BLOCKS } from "@/lib/world/blocks";
import { ITEMS, ITEM_IDS, ITEM_OF_BLOCK, type ItemDef } from "@/lib/world/itemDefs";
import { HOTBAR, INV_SIZE, countItem, type Slot } from "@/lib/world/inventory";
import { RECIPES, maxCraft, recipeAvailable, type Recipe } from "@/lib/world/recipes";
import { sfx } from "@/lib/world/sfx";
import { MINE, openCraft } from "./BlockInteractor";
import { craftRecipe, creativeSet, moveSlot, quickMoveSlot, setMode, throwStack, useInv, usePickFeed } from "./invStore";
import { startWorldSave } from "./worldSave";
import { worldAsset } from "@/lib/world/avatars";

if (typeof window !== "undefined") startWorldSave();

const TXT = {
  craft: { vi: "Túi đồ & Chế tạo", en: "Inventory & Crafting" },
  hand: { vi: "Tay không", en: "Bare hands" },
  bench: { vi: "Bàn Dã chiến", en: "Field Bench" },
  press: { vi: "Bàn + Máy Ép Hoa văn", en: "Bench + Pattern Press" },
  needPress: { vi: "Cần Máy Ép Hoa văn trong túi và đứng cạnh Bàn Dã chiến", en: "Needs a Pattern Press in your bag, standing by a Field Bench" },
  survival: { vi: "Sinh tồn", en: "Survival" },
  creative: { vi: "Sáng tạo", en: "Creative" },
  recipes: { vi: "Công thức", en: "Recipes" },
  bag: { vi: "Túi", en: "Bag" },
  hotbar: { vi: "Thanh nhanh", en: "Hotbar" },
  make: { vi: "Chế tạo", en: "Craft" },
  needBench: { vi: "Cần Bàn Dã chiến — đặt bàn rồi chuột phải vào nó", en: "Needs a Field Bench — place one and right-click it" },
  max: { vi: "Tối đa", en: "At most" },
  full: { vi: "Túi đầy — dọn bớt chỗ", en: "Bag full — make some room" },
  missing: { vi: "Thiếu nguyên liệu", en: "Missing ingredients" },
  drop: { vi: "Vứt ra", en: "Drop" },
  palette: { vi: "Kho sáng tạo — bấm để đặt vào ô thanh nhanh đang chọn", en: "Creative palette — click to fill the selected hotbar slot" },
  slotHelp: { vi: "Bấm một ô rồi bấm ô khác để chuyển · Shift + bấm: chuyển nhanh túi ↔ thanh nhanh", en: "Click a slot, then another to move · Shift-click: quick move bag ↔ hotbar" },
  needTool: { vi: "Cần Cuốc Trục mới lấy được", en: "Needs an Axis Pick to collect" },
  tier: { vi: "Cấp đào", en: "Mining tier" },
  coords: { vi: "Toạ độ", en: "Coords" },
  open: { vi: "Túi đồ & Chế tạo (C)", en: "Inventory & Crafting (C)" },
} satisfies Record<string, L>;

const blockName = (id: number, lang: Lang) => {
  const it = ITEM_OF_BLOCK[id];
  if (it) return tr(lang, ITEMS[it].name);
  if (id === B.intcrystal) return lang === "vi" ? "Mỏ Tinh thể Số nguyên" : "Integer Crystal ore";
  if (id === B.copper) return lang === "vi" ? "Mỏ Đồng Tỉ lệ" : "Ratio Copper ore";
  return BLOCKS[id] ?? "?";
};

/** Có Bàn Dã chiến trong bán kính 4 khối quanh người chơi? (chỉ gọi khi bấm phím) */
function benchNearby(): boolean {
  const p = useWorld.getState().player;
  const x0 = Math.floor(p.x);
  const y0 = Math.floor(p.y);
  const z0 = Math.floor(p.z);
  for (let y = y0 - 2; y <= y0 + 3; y++) for (let z = z0 - 4; z <= z0 + 4; z++) for (let x = x0 - 4; x <= x0 + 4; x++) if (blockAt(x, y, z) === B.bench) return true;
  return false;
}

// ───────────── Biểu tượng vật phẩm ─────────────

/** ảnh icon: khối → khối isometric dựng từ hoạ tiết (scripts/voxel-icons.py); vật phẩm khác → tranh anime (Codex) */
const iconSrc = (def: ItemDef) => worldAsset(`items/vox/${def.kind === "block" && def.block !== undefined ? BLOCKS[def.block] : def.id}.png`);

export function ItemIcon({ def, n, size = 40 }: { def: ItemDef; n?: number; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = iconSrc(def);
  const img = broken !== src;
  const Icon = img ? null : def.kind === "tool" ? Pickaxe : def.kind === "material" ? Gem : null;
  return (
    <span
      className="relative grid place-items-center rounded-md"
      style={{
        width: size,
        height: size,
        background: img
          ? undefined
          : def.kind === "block"
            ? `linear-gradient(155deg, ${def.color} 0 46%, color-mix(in srgb, ${def.color} 72%, #000) 46% 100%)`
            : `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${def.color} 60%, #fff), ${def.color} 55%, color-mix(in srgb, ${def.color} 55%, #000))`,
        boxShadow: img ? undefined : "inset 0 0 0 1px rgba(255,255,255,.25), inset 0 -3px 0 rgba(0,0,0,.25)",
      }}
    >
      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- icon nhỏ tĩnh, pixel-art (không cần tối ưu ảnh của Next)
        <img src={src} alt="" width={size} height={size} draggable={false} onError={() => setBroken(src)} className="pointer-events-none select-none drop-shadow-[0_2px_2px_rgba(0,0,0,.45)]" style={{ imageRendering: def.kind === "block" ? "pixelated" : "auto" }} />
      )}
      {Icon && <Icon size={size * 0.55} strokeWidth={2.4} className="text-white drop-shadow" />}
      {n !== undefined && n > 1 && <span className="absolute bottom-0 right-0.5 text-[11px] font-black leading-none text-white [text-shadow:0_1px_2px_#000,0_0_2px_#000]">{n}</span>}
    </span>
  );
}

// ───────────── HUD trong thế giới ─────────────

export function VoxelHud() {
  const t = useT();
  const lang = useWorld((s) => s.lang);
  const hotbar = useWorld((s) => s.hotbar);
  const slots = useInv((s) => s.slots);
  const mode = useInv((s) => s.mode);
  const feed = usePickFeed((s) => s.list);
  const [touch, setTouch] = useState(false);
  const ring = useRef<SVGCircleElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const warn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= HOTBAR) useWorld.setState({ hotbar: n - 1 });
      if ((e.key === "c" || e.key === "C") && !e.repeat && !useWorld.getState().overlay) openCraft(benchNearby() ? "bench" : "hand");
    };
    const wheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      useWorld.setState((s) => ({ hotbar: (s.hotbar + (e.deltaY > 0 ? 1 : HOTBAR - 1)) % HOTBAR }));
    };
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", wheel);
    };
  }, []);

  // vòng đào + toạ độ: rAF, chỉ ghi DOM khi giá trị đổi
  useEffect(() => {
    let raf = 0;
    let lastFrac = -1;
    let lastKey = "";
    let lastWarn = false;
    const C = 2 * Math.PI * 15;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const f = Math.round(MINE.frac * 100) / 100;
      if (f !== lastFrac && ring.current) {
        lastFrac = f;
        ring.current.style.strokeDashoffset = String(C * (1 - f));
        ring.current.parentElement!.style.opacity = f > 0 ? "1" : "0";
      }
      const k = MINE.has ? `${MINE.x}|${MINE.y}|${MINE.z}|${MINE.id}` : "";
      if (k !== lastKey && info.current) {
        lastKey = k;
        const lg = useWorld.getState().lang;
        info.current.textContent = MINE.has ? `${blockName(MINE.id, lg)} · (${MINE.x}, ${MINE.y}, ${MINE.z})` : "";
        info.current.style.opacity = MINE.has ? "1" : "0";
      }
      const w = MINE.has && !MINE.harvest && MINE.mining;
      if (w !== lastWarn && warn.current) {
        lastWarn = w;
        warn.current.style.opacity = w ? "1" : "0";
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sel = slots[hotbar];
  return (
    <>
      {/* tâm ngắm + vòng tiến độ đào */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/90 shadow" />
        <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/90 shadow" />
        <svg viewBox="0 0 36 36" className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 -rotate-90 opacity-0 transition-opacity">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="4" />
          <circle ref={ring} cx="18" cy="18" r="15" fill="none" stroke="#ecd7a9" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15} />
        </svg>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[calc(50%+30px)] z-20 flex -translate-x-1/2 flex-col items-center gap-1">
        <div ref={info} className="whitespace-nowrap rounded-full bg-[#12162b]/60 px-2.5 py-0.5 font-mono text-[11px] text-white/90 opacity-0 transition-opacity" title={tr(lang, TXT.coords)} />
        <div ref={warn} className="whitespace-nowrap rounded-full bg-[#7a2330]/80 px-2.5 py-0.5 text-[11px] font-bold text-white opacity-0 transition-opacity">
          {tr(lang, TXT.needTool)}
        </div>
      </div>

      {/* dòng nhặt đồ */}
      <div className="pointer-events-none absolute bottom-[calc(var(--u,1)*150px)] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
        <AnimatePresence>
          {feed.map((p) => (
            <motion.div key={p.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 rounded-full bg-[#12162b]/70 py-0.5 pl-1 pr-2.5 text-xs font-bold text-white ring-1 ring-white/15">
              <ItemIcon def={ITEMS[p.id]} size={18} />+{p.n} {tr(lang, ITEMS[p.id].name)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* thanh nhanh 9 ô */}
      <div className="w-hotbar pointer-events-auto absolute left-1/2 z-20 flex -translate-x-1/2 items-end gap-1.5">
        <div className="flex gap-1 rounded-xl bg-[#12162b]/70 p-1.5 ring-1 ring-[#ecd7a9]/50 backdrop-blur">
          {slots.slice(0, HOTBAR).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => useWorld.setState({ hotbar: i })}
              className={`relative grid h-[calc(var(--u,1)*42px)] w-[calc(var(--u,1)*42px)] place-items-center rounded-lg bg-black/25 transition ${i === hotbar ? "scale-110 ring-2 ring-[#ecd7a9]" : "ring-1 ring-white/15"}`}
              aria-label={s ? `${tr(lang, ITEMS[s.id].name)} ×${s.n}` : t("blockSlot", { n: i + 1 })}
              title={s ? tr(lang, ITEMS[s.id].name) : undefined}
            >
              {s && <ItemIcon def={ITEMS[s.id]} n={mode === "creative" ? undefined : s.n} size={34} />}
              <span className="absolute left-1 top-0.5 text-[9px] font-black text-white/70 drop-shadow">{i + 1}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openCraft(benchNearby() ? "bench" : "hand")}
          className="grid h-[calc(var(--u,1)*48px)] w-[calc(var(--u,1)*48px)] place-items-center rounded-xl bg-[#12162b]/75 text-[#ecd7a9] ring-1 ring-[#ecd7a9]/60 backdrop-blur transition hover:bg-[#1d2346]"
          aria-label={tr(lang, TXT.open)}
          title={tr(lang, TXT.open)}
        >
          <Hammer size={22} />
          {!touch && <span className="absolute -top-1.5 right-0.5 rounded bg-[#ecd7a9] px-1 text-[9px] font-black text-[#12162b]">C</span>}
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-[calc(var(--u,1)*104px)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${mode === "creative" ? "bg-[#8be0ff] text-[#12162b]" : "bg-[#ecd7a9] text-[#12162b]"}`}>{tr(lang, TXT[mode])}</span>
        {sel && <span className="rounded-full bg-[#12162b]/60 px-2.5 py-0.5 text-[11px] font-bold text-white/90">{tr(lang, ITEMS[sel.id].name)}</span>}
        {!touch && <span className="rounded-full bg-[#12162b]/55 px-3 py-0.5 text-[11px] text-white/85">{t("blockHint")}</span>}
      </div>
    </>
  );
}

// ───────────── Bảng Túi đồ & Chế tạo ─────────────

export function CraftPanel() {
  const lang = useWorld((s) => s.lang);
  const hotbar = useWorld((s) => s.hotbar);
  const slots = useInv((s) => s.slots);
  const mode = useInv((s) => s.mode);
  const station = useInv((s) => s.station);
  const pick = useInv((s) => s.pick);
  const close = () => useWorld.setState({ overlay: null });
  useEffect(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    const k = (e: KeyboardEvent) => {
      if ((e.key === "c" || e.key === "C") && !e.repeat) close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const recipes = useMemo(() => [...RECIPES].sort((a, b) => Number(recipeAvailable(b, station)) - Number(recipeAvailable(a, station))), [station]);
  const clickSlot = (i: number, shift: boolean) => {
    if (shift) {
      quickMoveSlot(i);
      useInv.setState({ pick: null });
      return;
    }
    if (pick === null) {
      if (slots[i]) useInv.setState({ pick: i });
      if (i < HOTBAR) useWorld.setState({ hotbar: i });
      return;
    }
    if (pick !== i) moveSlot(pick, i);
    useInv.setState({ pick: null });
  };
  const picked = pick !== null ? slots[pick] : null;
  return (
    <motion.div className="w-modal pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-[min(980px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#12162b]/95 text-white shadow-2xl ring-1 ring-[#ecd7a9]/50"
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <Hammer size={18} className="text-[#ecd7a9]" />
          <span className="text-base font-black">{tr(lang, TXT.craft)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${station !== "hand" ? "bg-[#ecd7a9] text-[#12162b]" : "bg-white/10 text-white/80"}`}>{tr(lang, TXT[station])}</span>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-black/30 p-0.5 text-[11px] font-bold">
            {(["survival", "creative"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 transition ${mode === m ? (m === "creative" ? "bg-[#8be0ff] text-[#12162b]" : "bg-[#ecd7a9] text-[#12162b]") : "text-white/70 hover:text-white"}`}>
                {tr(lang, TXT[m])}
              </button>
            ))}
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 md:grid-cols-[1.1fr_1fr] md:overflow-hidden">
          {/* công thức */}
          <section className="flex min-h-0 flex-col gap-2 md:overflow-y-auto md:pr-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#ecd7a9]/80">{tr(lang, TXT.recipes)}</h3>
            {recipes.map((r) => (
              <RecipeCard key={r.id} r={r} slots={slots} lang={lang} locked={!recipeAvailable(r, station)} />
            ))}
          </section>
          {/* túi đồ */}
          <section className="flex min-h-0 flex-col gap-2 md:overflow-y-auto">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#ecd7a9]/80">{tr(lang, TXT.bag)}</h3>
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: INV_SIZE - HOTBAR }, (_, k) => k + HOTBAR).map((i) => (
                <SlotBtn key={i} s={slots[i]} active={pick === i} onClick={(sh) => clickSlot(i, sh)} lang={lang} />
              ))}
            </div>
            <h3 className="mt-1 text-xs font-black uppercase tracking-wider text-[#ecd7a9]/80">{tr(lang, TXT.hotbar)}</h3>
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: HOTBAR }, (_, i) => (
                <SlotBtn key={i} s={slots[i]} active={pick === i} sel={hotbar === i} onClick={(sh) => clickSlot(i, sh)} lang={lang} label={i + 1} />
              ))}
            </div>
            <p className="text-[11px] text-white/55">{tr(lang, TXT.slotHelp)}</p>
            {picked && (
              <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10">
                <ItemIcon def={ITEMS[picked.id]} n={picked.n} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{tr(lang, ITEMS[picked.id].name)}</div>
                  {ITEMS[picked.id].note && <div className="text-xs text-white/70">{tr(lang, ITEMS[picked.id].note!)}</div>}
                  {ITEMS[picked.id].tool && (
                    <div className="text-xs text-[#ecd7a9]">
                      {tr(lang, TXT.tier)}: {ITEMS[picked.id].tool!.tier}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const w = useWorld.getState();
                    throwStack(pick!, w.player.x + Math.sin(w.playerYaw) * 0.6, w.player.y + 1.3, w.player.z + Math.cos(w.playerYaw) * 0.6, w.playerYaw);
                    useInv.setState({ pick: null });
                  }}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"
                >
                  {tr(lang, TXT.drop)}
                </button>
              </div>
            )}
            {mode === "creative" && (
              <>
                <h3 className="mt-1 flex items-center gap-1 text-xs font-black uppercase tracking-wider text-[#8be0ff]">
                  <Sparkles size={12} /> {tr(lang, TXT.palette)}
                </h3>
                <div className="grid grid-cols-9 gap-1">
                  {ITEM_IDS.map((id) => (
                    <button key={id} type="button" onClick={() => creativeSet(hotbar, id)} className="grid aspect-square place-items-center rounded-md bg-black/30 ring-1 ring-white/10 hover:ring-[#8be0ff]" title={tr(lang, ITEMS[id].name)}>
                      <ItemIcon def={ITEMS[id]} size={30} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SlotBtn({ s, active, sel, onClick, lang, label }: { s: Slot; active: boolean; sel?: boolean; onClick: (shift: boolean) => void; lang: Lang; label?: number }) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.shiftKey)}
      className={`relative grid aspect-square place-items-center rounded-md bg-black/30 transition ${active ? "ring-2 ring-[#8be0ff]" : sel ? "ring-2 ring-[#ecd7a9]" : "ring-1 ring-white/10 hover:ring-white/40"}`}
      title={s ? `${tr(lang, ITEMS[s.id].name)} ×${s.n}` : undefined}
    >
      {s ? <ItemIcon def={ITEMS[s.id]} n={s.n} size={30} /> : <Box size={14} className="text-white/10" />}
      {label !== undefined && <span className="absolute left-0.5 top-0 text-[8px] font-black text-white/50">{label}</span>}
    </button>
  );
}

function RecipeCard({ r, slots, lang, locked }: { r: Recipe; slots: Slot[]; lang: Lang; locked: boolean }) {
  const [times, setTimes] = useState(1);
  const [msg, setMsg] = useState<"" | "full" | "missing">("");
  const max = maxCraft(slots, r);
  const k = Math.max(1, Math.min(times, Math.max(1, max)));
  const out = ITEMS[r.out[0]];
  const can = !locked && max >= k;
  // móc toán: tối đa = min(⌊có/cần⌋, …)
  const formula = `min(${r.in.map(([id, n]) => `⌊${countItem(slots, id)}/${n}⌋`).join(", ")}) = ${max}`;
  return (
    <div className={`rounded-xl p-2.5 ring-1 transition ${locked ? "bg-white/[.03] opacity-60 ring-white/5" : "bg-white/[.06] ring-white/10"}`}>
      <div className="flex items-center gap-2.5">
        <ItemIcon def={out} n={r.out[1] * k} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-bold">
            {tr(lang, out.name)} <span className="text-white/60">×{r.out[1] * k}</span>
            {locked && <Lock size={12} className="text-white/60" />}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {r.in.map(([id, n]) => {
              const have = countItem(slots, id);
              const need = n * k;
              return (
                <span key={id} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-bold ${have >= need ? "bg-[#2f6b4a]/60 text-[#c9f5d8]" : "bg-[#7a2330]/50 text-[#ffd0d6]"}`}>
                  <ItemIcon def={ITEMS[id]} size={16} />
                  {have}/{need} {tr(lang, ITEMS[id].name)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-[11.5px] text-[#ecd7a9]">{tr(lang, r.idea)}</div>
      {locked ? (
        <div className="mt-1 text-[11px] text-white/60">{tr(lang, r.station === "press" ? TXT.needPress : TXT.needBench)}</div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-black/30 text-sm font-bold">
            <button type="button" className="px-2 py-0.5 hover:text-[#ecd7a9]" onClick={() => setTimes(Math.max(1, k - 1))}>
              −
            </button>
            <span className="min-w-8 text-center">×{k}</span>
            <button type="button" className="px-2 py-0.5 hover:text-[#ecd7a9]" onClick={() => setTimes(Math.min(Math.max(1, max), k + 1))}>
              +
            </button>
          </div>
          <span className="font-mono text-[11px] text-white/60" title={tr(lang, TXT.max)}>
            {tr(lang, TXT.max)}: {formula}
          </span>
          <button
            type="button"
            disabled={!can}
            onClick={() => {
              const res = craftRecipe(r, k);
              if (res.ok) {
                sfx.chime(1);
                setMsg("");
                setTimes(1);
              } else {
                sfx.miss();
                setMsg(res.reason === "full" ? "full" : "missing");
              }
            }}
            className={`ml-auto rounded-lg px-3 py-1 text-xs font-black transition ${can ? "bg-[#ecd7a9] text-[#12162b] hover:brightness-110" : "cursor-not-allowed bg-white/10 text-white/40"}`}
          >
            {tr(lang, TXT.make)}
          </button>
          {msg && <span className="w-full text-[11px] text-[#ffb3bd]">{tr(lang, TXT[msg])}</span>}
        </div>
      )}
    </div>
  );
}
