"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Backpack, Eye, History, Info, Loader2, Menu as MenuIcon, Pin, PinOff, Plus, Ticket, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { buyItem, saveAvatar } from "@/actions/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { getLevel } from "@/lib/points/levels";
import { rarityOf, type Rarity } from "@/lib/points/rarity";
import { ITEMS, ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import { CHESTS, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { buildNpcLines } from "@/lib/game/npc";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RAR_STYLE } from "@/components/studio/rarity";
import { ScratchCodeModal } from "./ScratchCodeModal";
import { TasksModal, type RecentDone } from "./TasksModal";
import { InventoryModal } from "./InventoryModal";
import { LeaderboardModal, type BoardData } from "./LeaderboardModal";
import { HistoryModal } from "./HistoryModal";
import { TitlesModal } from "./TitlesModal";
import { ShopMenuModal, type MenuAction } from "./ShopMenuModal";
import { GachaPanel } from "./GachaPanel";
import { GiftBoxSvg } from "./GiftBoxSvg";
import { RewardArt } from "./RewardArt";
import { WeatherLayer, useWeather } from "./Weather";

// Hộp thoại cầu nguyện (hoạt ảnh + gọi server) chỉ tải khi mở
const GachaModal = dynamic(() => import("./GachaModal").then((m) => m.GachaModal), { ssr: false });

type Reward = StudentPointsPageData["rewards"][number];
type Cat = "all" | "physical" | "voucher" | "deco" | "pet" | "box";
type DecoSlot = "all" | Item["slot"];
type RarFilter = "all" | Rarity;
type Sort = "pop" | "asc" | "desc";
/** Ô có đồ bán/rương — chip lọc trong danh mục Trang trí */
const DECO_SLOTS = SLOTS.filter((sl) => sl.key !== "pet" && ITEMS.some((i) => i.slot === sl.key && !i.free));
/** "Tất cả" chỉ trưng đồ trang trí hồ sơ (khung, nền, phụ kiện, danh hiệu); tóc/mắt/trang phục xem ở Trang trí */
const ALL_SLOTS: Item["slot"][] = ["frame", "background", "accessory", "title"];
/** Ô mặc được ngay từ tiệm (không cần trình tuỳ chỉnh) */
const QUICK_EQUIP: Item["slot"][] = ["frame", "background", "title", "accessory", "pet", "effect"];
const GEM_XU = 1500; // quy đổi chỉ để sắp xếp theo giá

const CATS: { key: Cat; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "physical", label: "Quà hiện vật" },
  { key: "voucher", label: "Thẻ đặc quyền" },
  { key: "deco", label: "Trang trí" },
  { key: "pet", label: "Thú cưng" },
  { key: "box", label: "Hộp bí ẩn" },
];

/** Một ô trong lưới: quà của thầy, đồ trang trí/thú cưng, hoặc rương */
type Entry =
  | { key: string; kind: "reward"; rarity: Rarity; name: string; price: { xu: number }; r: Reward }
  | { key: string; kind: "item"; rarity: Rarity; name: string; price: Item["price"] | null; it: Item }
  | { key: string; kind: "chest"; rarity: Rarity; name: string; price: { xu: number } | { gem: number }; chest: ChestId };

export interface ShopPageProps {
  data: StudentPointsPageData;
  user: { id: string; name: string | null; className: string | null; grade: number | null };
  todo: HomeTodoItem[];
  todoTotal: number;
  recent?: RecentDone[];
  boards: BoardData[];
  /** Banner thử thách tuần ở hộp Bảng Vàng (dữ liệu thật của ví) */
  event?: { title: string; text: string; badge: string } | null;
  /** null khi rương đang tắt (GACHA_ENABLED=off) */
  gacha?: { pullsToday: number } | null;
}

const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Tiệm quà — bố cục theo artifact thiết kế GĐ9 (ví + mục tiêu + lọc + lưới + bảng chi tiết); logic xu/ngọc/quà/đồ/rương giữ nguyên */
export function ShopPage({ data, user, todo, todoTotal, recent = [], boards, event = null, gacha = null }: ShopPageProps) {
  const router = useRouter();
  const [cat, setCat] = useState<Cat>("all");
  const [modal, setModal] = useState<null | "tasks" | "bag" | "scratch" | "board" | "history" | "menu" | "titles">(null);
  const [decoSlot, setDecoSlot] = useState<DecoSlot>("all");
  const [rar, setRar] = useState<RarFilter>("all");
  const [affordOnly, setAffordOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("pop");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [gachaOpen, setGachaOpen] = useState<{ chest: ChestId; rates: boolean } | null>(null);
  const [weather, setWeather] = useWeather();
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [pending, start] = useTransition();
  const [celebrated, setCelebrated] = useState(0);
  const [burst, setBurst] = useState(0);
  const [petPets, setPetPets] = useState(0);
  const [avatar, setAvatar] = useState(data.avatar);
  const [owned, setOwned] = useState(() => new Set(data.ownedItems));
  const { wallet, goal } = data;
  const level = getLevel(wallet.lifetimeEarned);
  const pet = avatar.pet ? ITEM_BY_ID[avatar.pet] : null;
  const bagCount = data.redemptions.filter((r) => r.status === "PENDING").length + owned.size;

  const lines = useMemo(
    () =>
      buildNpcLines({
        name: user.name,
        canEarn: data.canEarn,
        todoCount: todoTotal,
        weekActivities: wallet.weekActivities,
        weekTarget: wallet.weekTarget,
        thisWeekCounted: wallet.thisWeekCounted,
        lifetimeEarned: wallet.lifetimeEarned,
        nextLevel: level.next ? { name: level.next.name, toNext: level.toNext } : null,
        balance: wallet.balance,
        gems: wallet.gems,
        goal: goal ? { title: goal.title, price: goal.price } : null,
      }).map((l) => l.replace(/Mình là Lucky Boy, bấm vào mình để nghe tiếp nhé 😉/, "Meo~ vuốt ve tớ đi, tớ kể tiếp cho nghe 🐾")),
    [user.name, data.canEarn, todoTotal, wallet, level, goal],
  );
  const [lineIdx, setLineIdx] = useState(0);

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) {
        if (res.message) toast.success(res.message);
        after?.();
        router.refresh();
      } else {
        play("error");
        toast.error(res.error || "Có lỗi xảy ra");
      }
    });

  const equip = (item: Item) =>
    start(async () => {
      const next = { ...avatar, [item.slot]: item.id };
      const res = await saveAvatar(next);
      if (res.success) {
        play("success");
        setAvatar(res.config ?? next);
        toast.success(`Đang dùng "${item.name}"`);
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const purchase = (item: Item) =>
    start(async () => {
      const res = await buyItem(item.id);
      if (res.success) {
        play("coin");
        setTimeout(() => play("success"), 200);
        setBurst((n) => n + 1);
        setOwned((o) => new Set([...o, item.id]));
        toast.success(res.message);
        // Mua đồ mặc nhanh thì dùng luôn — phải LƯU lên server (buyItem chỉ thêm vào túi) (review Gemini GĐ6)
        if (QUICK_EQUIP.includes(item.slot) && item.slot !== "accessory") {
          const saved = await saveAvatar({ ...avatar, [item.slot]: item.id });
          if (saved.success && saved.config) setAvatar(saved.config);
        }
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const petTouch = () => {
    play("tick");
    setPetPets((n) => n + 1);
    setLineIdx((i) => i + 1);
  };

  const openGacha = (chest: ChestId, rates = false) => {
    if (!gacha) return;
    play("click");
    setSheet(false);
    setGachaOpen({ chest, rates });
  };
  const onGachaDone = ({ outcome }: { outcome: Outcome }) => {
    if (outcome.kind === "item" && !outcome.duplicate) setOwned((o) => new Set([...o, outcome.itemId]));
  };
  const menuAction = (a: MenuAction) => {
    setModal(null);
    if (a === "shop") setCat("all");
    else if (a === "box") setCat("box");
    else setTimeout(() => setModal(a), 120);
  };

  // ---------- Danh sách theo danh mục
  const entriesFor = (c: Cat): Entry[] => {
    const rewards: Entry[] = data.rewards
      .filter((r) => (c === "all" ? true : c === "physical" ? r.kind === "PHYSICAL" : c === "voucher" ? r.kind === "VIRTUAL" : false))
      .map((r) => ({ key: `r:${r.id}`, kind: "reward", rarity: rarityOf(r.price).key, name: r.title, price: { xu: r.price }, r }));
    const cosmetics =
      c === "deco"
        ? ITEMS.filter((i) => !i.free && i.slot !== "pet" && (i.price || i.gachaOnly) && (decoSlot === "all" || i.slot === decoSlot))
        : c === "all"
          ? ITEMS.filter((i) => !i.free && !i.gachaOnly && !i.studio && i.price && ALL_SLOTS.includes(i.slot))
          : [];
    const pets = c === "all" || c === "pet" ? ITEMS.filter((i) => i.slot === "pet" && (c === "pet" || !i.studio)) : [];
    const items: Entry[] = [...cosmetics, ...pets].map((it) => ({ key: `i:${it.id}`, kind: "item", rarity: it.rarity, name: it.name, price: it.price ?? null, it }));
    const chests: Entry[] = gacha && c === "all"
      ? (["xu", "gem"] as const).map((id) => ({ key: `c:${id}`, kind: "chest", rarity: id === "xu" ? "epic" : "legendary", name: id === "xu" ? "Hộp Sao Mèo" : "Hộp Tinh Tú VIP", price: CHESTS[id].cost, chest: id }))
      : [];
    return [...rewards, ...items, ...chests];
  };
  const counts = Object.fromEntries(CATS.map((c) => [c.key, c.key === "box" ? (gacha ? 2 : 0) : entriesFor(c.key).length])) as Record<Cat, number>;
  const ownsEntry = (e: Entry) => e.kind === "item" && (!!e.it.free || owned.has(e.it.id));
  const costOf = (p: Entry["price"]) => (!p ? 0 : "xu" in p ? p.xu : p.gem * GEM_XU);
  const haveFor = (p: Entry["price"]) => (!p ? 0 : "xu" in p ? wallet.balance : wallet.gems);
  const enough = (p: Entry["price"]) => !!p && haveFor(p) >= ("xu" in p ? p.xu : p.gem);

  let list = entriesFor(cat).filter((e) => (rar === "all" || e.rarity === rar) && (!affordOnly || ownsEntry(e) || enough(e.price)));
  if (sort === "asc") list = [...list].sort((a, b) => costOf(a.price) - costOf(b.price));
  if (sort === "desc") list = [...list].sort((a, b) => costOf(b.price) - costOf(a.price));
  const sel = list.find((e) => e.key === selKey) ?? list[0] ?? null;
  const pick = (e: Entry) => {
    play("tick");
    setSelKey(e.key);
    // Điện thoại/máy tính bảng: chi tiết mở dạng sheet đáy
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) setSheet(true);
  };

  const showPanel = cat === "box";

  return (
    <div className="studio flex flex-col gap-5" data-testid="shop-frame" data-celebrated={celebrated} data-weather={weather}>
      <Confetti burst={celebrated} />
      <CoinBurst burst={burst} />
      <WeatherLayer weather={weather} />

      {/* ===== Đầu trang + ví ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-extrabold tracking-tight" data-testid="shop-title">Tiệm quà</h1>
          <p className="text-[#5F5B73]">Đổi xu và kim cương lấy quà thật, thẻ đặc quyền và đồ trang trí.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-stretch rounded-2xl border border-[#ECE9F5] bg-white shadow-[0_1px_2px_rgba(30,27,46,0.04)]">
          <div className="flex items-center gap-2.5 px-4 py-2.5" data-testid="hud-balance">
            <Coin className="h-7 w-7 border-[3px]" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold leading-tight text-[#7A4E00] tabular-nums">{fmt(wallet.balance)}</span>
              <span className="text-xs text-[#5F5B73]">Xu</span>
            </div>
          </div>
          <div className="w-px bg-[#ECE9F5]" />
          <div className="flex items-center gap-2.5 px-4 py-2.5" data-testid="hud-gems">
            <Gem className="h-[26px] w-[26px]" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold leading-tight text-[#1D4ED8] tabular-nums">{wallet.gems}</span>
              <span className="text-xs text-[#5F5B73]">Kim cương</span>
            </div>
          </div>
          <div className="w-px bg-[#ECE9F5]" />
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <button type="button" data-testid="scratch-open" onClick={() => { play("click"); setModal("scratch"); }} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-[#F3F0FF] px-3 text-[13px] font-bold text-[#4319A8]">
              <Ticket className="h-4 w-4" aria-hidden /> Nhập code
            </button>
            <button type="button" data-testid="history-open" onClick={() => { play("click"); setModal("history"); }} className="flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold text-[#3B3650] hover:bg-[#F6F5FB]">
              <History className="h-4 w-4" aria-hidden /> Lịch sử
            </button>
            <button type="button" data-testid="bag-open" onClick={() => { play("click"); setModal("bag"); }} aria-label="Túi đồ" title="Túi đồ" className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#3B3650] hover:bg-[#F6F5FB]">
              <Backpack className="h-[18px] w-[18px]" aria-hidden />
              {bagCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5B2BD6] px-1 text-[10px] font-bold text-white">{bagCount}</span>}
            </button>
            <button type="button" data-testid="menu-open" onClick={() => { play("click"); setModal("menu"); }} aria-label="Menu Tiệm Quà" title="Menu Tiệm Quà" className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[#3B3650] hover:bg-[#F6F5FB]">
              <MenuIcon className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* ===== Dải mục tiêu: mèo nhắc + xu tích luỹ ===== */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[18px] border border-[#ECE9F5] bg-white px-5 py-3.5" data-testid="shop-hud">
        <button type="button" data-testid="pet-card" onClick={petTouch} title="Chạm để vuốt ve" className="group flex min-w-0 flex-[1_1_340px] items-center gap-3.5 text-left">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FFF6DB]">
            {pet ? <PetSvg key={petPets} itemId={pet.id} size={52} className={cn(petPets > 0 && "pet-bounce")} /> : <span className="text-2xl">🐾</span>}
            {petPets > 0 && <span key={`h${petPets}`} className="heart-up text-base">💗</span>}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-bold text-[#6B6680]">{pet ? pet.name : "Thú cưng"} nhắc bạn <span className="font-medium text-[#5B2BD6] group-hover:underline">· vuốt ve</span></span>
            <span className="text-[15px] font-bold" data-testid="pet-line">{lines[lineIdx % lines.length]}</span>
          </span>
        </button>
        <div className="flex flex-[1_1_260px] flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-[#5F5B73]">
            <button type="button" data-testid="titles-open" onClick={() => { play("click"); setModal("titles"); }} title="Xem hệ thống danh hiệu" className="rounded-full bg-[#F3E3C3] px-2.5 py-0.5 font-bold text-[#6B4512] hover:brightness-95">
              {level.icon} {level.name} · Lv.{level.level}
            </button>
            <span className="font-bold text-[#3B3650]">{fmt(wallet.lifetimeEarned)}{level.next ? ` / ${fmt(level.next.min)}` : ""} xu tích luỹ</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F1EEF8]" role="progressbar" aria-label="Xu tích luỹ đến cấp sau" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#F5B82E]" style={{ width: `${Math.max(2, level.progress)}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" data-testid="board-open" onClick={() => { play("click"); setModal("board"); }} className="flex h-11 items-center gap-2 rounded-xl border border-[#E4E0F0] bg-white px-3.5 font-bold text-[#3B3650] hover:bg-[#F6F5FB]">
            <Trophy className="h-4 w-4 text-[#D8961B]" aria-hidden /> Bảng Vàng
          </button>
          <button type="button" data-testid="tasks-open" onClick={() => { play("click"); setModal("tasks"); }} className="flex h-11 items-center gap-2 rounded-xl bg-[#5B2BD6] px-4 font-bold text-white hover:bg-[#4C22BC]">
            <Plus className="h-4 w-4" aria-hidden /> Nộp bài kiếm xu
            {todoTotal > 0 && <span className="rounded-full bg-white/25 px-1.5 text-[11px]">{todoTotal}</span>}
          </button>
        </div>
      </section>

      {!data.canEarn && (
        <p className="rounded-2xl border border-[#F3DC8E] bg-[#FFF6DB] px-4 py-2.5 text-sm font-semibold text-[#7A4E00]">Tài khoản cần được thầy duyệt để bắt đầu nhận xu và đổi quà.</p>
      )}

      {/* ===== Danh mục ===== */}
      <div role="tablist" aria-label="Danh mục quà" className="flex gap-1 overflow-x-auto border-b border-[#E4E0F0] [scrollbar-width:none]">
        {CATS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={cat === c.key}
            data-testid={`cat-${c.key}`}
            onClick={() => { play("tick"); setCat(c.key); setSelKey(null); }}
            className={cn("flex shrink-0 items-center gap-2 px-3.5 py-3 text-[15px]", cat === c.key ? "font-bold text-[#4319A8] shadow-[inset_0_-3px_0_#5B2BD6]" : "font-semibold text-[#5F5B73] hover:text-[#2A1F5C]")}
          >
            {c.label}
            <span className="rounded-full bg-[#F3F1FA] px-1.5 py-0.5 text-[11px] font-bold text-[#4B4566]">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {showPanel ? (
        gacha ? (
          <GachaPanel pity={wallet.gachaPity} pullsToday={gacha.pullsToday} onOpen={(c) => openGacha(c)} onRates={() => openGacha("xu", true)} />
        ) : (
          <div className="studio-card p-8 text-center font-semibold text-[#5F5B73]">Hộp bí ẩn đang tạm đóng. Quay lại sau nhé!</div>
        )
      ) : (
        <>
          {/* ===== Thanh lọc ===== */}
          <div className="flex flex-wrap items-center gap-2.5">
            {([["all", "Mọi độ hiếm", "#A8A3BA"], ...(["common", "rare", "epic", "legendary"] as Rarity[]).map((k) => [k, RAR_STYLE[k].label, RAR_STYLE[k].dot])] as [RarFilter, string, string][]).map(([k, label, dot]) => (
              <button key={k} type="button" aria-pressed={rar === k} data-testid={`rar-${k}`} onClick={() => { play("tick"); setRar(k); }} className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold", rar === k ? "border-[#2A1F5C] bg-[#2A1F5C] text-white" : "border-[#E4E0F0] bg-white text-[#3B3650]")}>
                <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden /> {label}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-3.5">
              <button type="button" role="switch" aria-checked={affordOnly} data-testid="afford-only" onClick={() => { play("tick"); setAffordOnly((v) => !v); }} className="flex items-center gap-2 py-2 text-[13px] font-semibold text-[#3B3650]">
                <span className={cn("relative h-5 w-9 rounded-full transition-colors", affordOnly ? "bg-[#5B2BD6]" : "bg-[#D6D1E6]")}>
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", affordOnly ? "left-[18px]" : "left-0.5")} />
                </span>
                Chỉ món đủ tiền
              </button>
              <label className="flex items-center gap-2 text-[13px] text-[#5F5B73]">
                Sắp xếp
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="shop-sort" className="h-9 rounded-[10px] border border-[#E4E0F0] bg-white px-2.5 font-semibold text-[#1E1B2E]">
                  <option value="pop">Nổi bật</option>
                  <option value="asc">Giá thấp → cao</option>
                  <option value="desc">Giá cao → thấp</option>
                </select>
              </label>
            </div>
          </div>
          {cat === "deco" && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Lọc theo ô trang trí" data-testid="deco-slots">
              {([{ key: "all", label: "Tất cả", icon: "" }, ...DECO_SLOTS] as { key: DecoSlot; label: string; icon: string }[]).map((sl) => (
                <button key={sl.key} type="button" role="tab" aria-selected={decoSlot === sl.key} data-testid={`deco-${sl.key}`} onClick={() => { play("tick"); setDecoSlot(sl.key); setSelKey(null); }} className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold", decoSlot === sl.key ? "border-[#5B2BD6] bg-[#F3F0FF] text-[#4319A8]" : "border-[#E4E0F0] bg-white text-[#3B3650]")}>
                  {sl.label}
                </button>
              ))}
            </div>
          )}
          {!data.isOffline && (cat === "all" || cat === "physical") && !data.rewards.some((r) => r.kind === "PHYSICAL") && (
            <p className="text-xs text-[#5F5B73]">Quà hiện vật được trao tại lớp học offline, vì vậy bạn chỉ thấy các quà dành cho mọi học sinh.</p>
          )}

          {/* ===== Lưới + chi tiết ===== */}
          <div className="flex items-start gap-6">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {list.map((e) => (
                <ShopCard key={e.key} e={e} selected={sel?.key === e.key} avatar={avatar} owned={ownsEntry(e)} using={e.kind === "item" && avatar[e.it.slot] === e.it.id} enough={enough(e.price)} have={haveFor(e.price)} onPick={() => pick(e)} />
              ))}
              {list.length === 0 && (
                <div className="col-span-full rounded-[18px] border border-dashed border-[#E4E0F0] bg-white px-4 py-12 text-center text-[#5F5B73]">
                  {affordOnly ? "Chưa có món nào vừa túi tiền. Nộp thêm bài để kiếm xu nhé." : "Thầy đang chuẩn bị quà — cứ chăm học tích xu nhé!"}
                </div>
              )}
            </div>
            {sel && (
              <aside aria-label="Chi tiết món quà" className="studio-card sticky top-24 hidden w-[340px] shrink-0 flex-col gap-3.5 p-4 lg:flex" data-testid="shop-detail">
                {renderDetail(sel)}
              </aside>
            )}
          </div>
        </>
      )}

      {/* Chi tiết dạng sheet đáy (điện thoại/máy tính bảng) */}
      <Dialog open={sheet && !!sel} onOpenChange={setSheet}>
        <DialogContent showCloseButton={false} className="studio fixed bottom-0 left-0 right-0 top-auto flex max-h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-3.5 overflow-y-auto rounded-b-none rounded-t-3xl border-0 p-5 pt-2.5 sm:max-w-none lg:hidden" data-testid="shop-sheet">
          <span className="mx-auto h-1 w-10 rounded-full bg-[#D6D1E6]" aria-hidden />
          <DialogTitle className="sr-only">{sel?.name ?? "Chi tiết"}</DialogTitle>
          <DialogDescription className="sr-only">Chi tiết món quà</DialogDescription>
          {sel && renderDetail(sel)}
        </DialogContent>
      </Dialog>

      {/* ===== Hộp thoại ===== */}
      <TasksModal open={modal === "tasks"} onOpenChange={(o) => setModal(o ? "tasks" : null)} todo={todo} todoTotal={todoTotal} recent={recent} />
      <InventoryModal open={modal === "bag"} onOpenChange={(o) => setModal(o ? "bag" : null)} redemptions={data.redemptions} owned={[...owned]} avatar={avatar} pending={pending} onEquip={equip} onCancel={(id) => run(() => cancelRedemption(id))} />
      <ScratchCodeModal open={modal === "scratch"} onOpenChange={(o) => setModal(o ? "scratch" : null)} canEarn={data.canEarn} />
      <LeaderboardModal open={modal === "board"} onOpenChange={(o) => setModal(o ? "board" : null)} boards={boards} myGrade={user.grade} currentUserId={user.id} event={event} />
      <TitlesModal open={modal === "titles"} onOpenChange={(o) => setModal(o ? "titles" : null)} lifetimeEarned={wallet.lifetimeEarned} />
      <ShopMenuModal open={modal === "menu"} onOpenChange={(o) => setModal(o ? "menu" : null)} weather={weather} onWeather={setWeather} onAction={menuAction} showBox={!!gacha} />
      {gachaOpen && gacha && (
        <GachaModal
          open
          onOpenChange={(o) => !o && setGachaOpen(null)}
          initialChest={gachaOpen.chest}
          initialRates={gachaOpen.rates}
          wallet={{ balance: wallet.balance, gems: wallet.gems }}
          pity={wallet.gachaPity}
          pullsToday={gacha.pullsToday}
          owned={[...owned]}
          avatar={avatar}
          canEarn={data.canEarn}
          onDone={onGachaDone}
        />
      )}
      <HistoryModal open={modal === "history"} onOpenChange={(o) => setModal(o ? "history" : null)} ledger={data.ledger} levelIndex={level.level - 1} />
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="studio rounded-[20px] border-[#ECE9F5] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Đổi {confirm?.title}?</DialogTitle>
            <DialogDescription className="text-[#5F5B73]">{confirm?.kind === "PHYSICAL" ? "Trao trực tiếp tại lớp học offline. Thầy sẽ xác nhận khi bạn nhận quà." : "Thẻ được cất vào túi đồ, bạn dùng khi cần."}</DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="flex flex-col gap-2 rounded-xl bg-[#F6F5FB] px-3.5 py-3 text-sm">
              <div className="flex justify-between"><span className="text-[#5F5B73]">Giá</span><b>{fmt(confirm.price)} xu</b></div>
              <div className="flex justify-between"><span className="text-[#5F5B73]">Số dư sau khi đổi</span><b>{fmt(wallet.balance - confirm.price)} xu</b></div>
            </div>
          )}
          <DialogFooter className="gap-2.5 sm:gap-2.5">
            <button type="button" onClick={() => setConfirm(null)} className="h-12 flex-1 rounded-xl border border-[#E4E0F0] bg-white font-bold text-[#3B3650]">Để sau</button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirm &&
                run(
                  () => redeemReward(confirm.id),
                  () => {
                    setConfirm(null);
                    setCelebrated((n) => n + 1);
                    play("success");
                  },
                )
              }
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#5B2BD6] font-extrabold text-white disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận đổi
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  /** Bảng chi tiết (dùng chung cho cột phải và sheet đáy) */
  function renderDetail(e: Entry) {
    const st = RAR_STYLE[e.rarity];
    const ownIt = ownsEntry(e);
    const ok = enough(e.price);
    const have = haveFor(e.price);
    const need = e.price ? ("xu" in e.price ? e.price.xu : e.price.gem) : 0;
    const unit = e.price && "gem" in e.price ? "kim cương" : "xu";
    const pct = need ? Math.max(3, Math.min(100, Math.round((have / need) * 100))) : 100;
    let how = "";
    let catLabel = "";
    let art: React.ReactNode;
    if (e.kind === "reward") {
      how = e.r.kind === "PHYSICAL" ? "Trao trực tiếp tại lớp học offline. Thầy sẽ xác nhận khi bạn nhận quà." : "Thẻ được cất vào túi đồ, bạn dùng khi cần.";
      catLabel = e.r.kind === "PHYSICAL" ? "Quà hiện vật" : "Thẻ đặc quyền";
      art = <span className="studio-art scale-[1.6]"><RewardArt title={e.r.title} emoji={e.r.emoji} /></span>;
    } else if (e.kind === "chest") {
      how = "Mở ra ngẫu nhiên một món theo tỉ lệ rơi của rương. Kết quả do máy chủ quyết định.";
      catLabel = "Hộp bí ẩn";
      art = <GiftBoxSvg tone={e.chest === "xu" ? "red" : "blue"} size={150} className="animate-float" />;
    } else {
      const it = e.it;
      catLabel = it.slot === "pet" ? "Thú cưng" : SLOTS.find((s) => s.key === it.slot)?.label ?? "Trang trí";
      how = it.slot === "pet" ? "Thú cưng đi cùng nhân vật trên hồ sơ. Đây là bản xem thử trên nhân vật của bạn." : "Dùng ngay trên hồ sơ. Đây là bản xem thử trên nhân vật của bạn.";
      art =
        it.slot === "pet" ? (
          <span className="flex items-end gap-1"><Chibi config={{ ...avatar, background: null, frame: null }} size={110} /><PetSvg itemId={it.id} size={92} className="studio-art" /></span>
        ) : (
          <Chibi config={{ ...avatar, [it.slot]: it.id }} size={150} className="studio-art" />
        );
    }
    const isGoal = e.kind === "reward" && goal?.id === e.r.id;
    return (
      <>
        <div className={cn("flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px]", st.tile, e.rarity === "legendary" && "shimmer")} data-testid="detail-art">{art}</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", st.tag)}>{st.label}</span>
            <span className="text-xs text-[#6B6680]">{catLabel}</span>
          </div>
          <h2 className="text-xl font-extrabold" data-testid="detail-name">{e.name}</h2>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-[#F6F5FB] px-3 py-2.5 text-[13px] text-[#3B3650]">
          <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
          <span>{how}</span>
        </div>
        {e.price && !ownIt && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-[#5F5B73]">Giá</span>
              <PriceTag price={e.price} big />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F1EEF8]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ok ? "#22A05A" : unit === "xu" ? "#F5B82E" : "#60A5FA" }} /></div>
            <p className={cn("text-xs", ok ? "font-semibold text-[#17603A]" : "text-[#5F5B73]")} data-testid="detail-note">
              {ok ? `Bạn đủ ${unit} để đổi món này.` : `Còn thiếu ${fmt(need - have)} ${unit} — nộp thêm bài để nhận nhé!`}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {e.kind === "reward" && renderRewardActions(e.r)}
          {e.kind === "chest" && (
            <>
              <button type="button" data-testid={`chest-open-${e.chest}`} onClick={() => openGacha(e.chest)} className="h-12 rounded-xl bg-[#5B2BD6] text-[15px] font-extrabold text-white hover:bg-[#4C22BC]">
                Mở ngay · {"xu" in e.price ? `${fmt(e.price.xu)} xu` : `${e.price.gem} kim cương`}
              </button>
              <button type="button" onClick={() => openGacha(e.chest, true)} className="h-11 rounded-xl border border-[#E4E0F0] bg-white font-bold text-[#3B3650]">Xem tỉ lệ rơi</button>
            </>
          )}
          {e.kind === "item" && renderItemActions(e.it)}
          {e.kind === "reward" && (
            <button type="button" data-testid="pin" disabled={pending} aria-pressed={isGoal} onClick={() => run(() => setGoalReward(isGoal ? null : e.r.id))} className="flex h-10 items-center justify-center gap-2 rounded-xl font-semibold text-[#5F5B73] hover:bg-[#F6F5FB]">
              {isGoal ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />} {isGoal ? "Bỏ ghim quà mục tiêu" : "Ghim làm quà mục tiêu"}
            </button>
          )}
        </div>
      </>
    );
  }

  function renderRewardActions(r: Reward) {
    const soldOut = r.stock !== null && r.stock <= 0;
    const limitReached = r.perStudentMonthlyLimit !== null && r.usedThisMonth >= r.perStudentMonthlyLimit;
    const ok = wallet.balance >= r.price;
    const can = ok && !soldOut && !limitReached && data.canEarn;
    const label = soldOut ? "Hết hàng" : limitReached ? "Hết lượt tháng này" : !data.canEarn ? "Chờ thầy duyệt tài khoản" : ok ? `Đổi quà · ${fmt(r.price)} xu` : "Chưa đủ xu";
    return (
      <>
        {(r.stock !== null || r.perStudentMonthlyLimit !== null) && (
          <p className="text-xs text-[#6B6680]">{r.stock !== null ? `Còn ${r.stock} món` : ""}{r.stock !== null && r.perStudentMonthlyLimit !== null ? " · " : ""}{r.perStudentMonthlyLimit !== null ? `Đã đổi ${r.usedThisMonth}/${r.perStudentMonthlyLimit} tháng này` : ""}</p>
        )}
        <button type="button" data-testid="redeem" disabled={!can || pending} onClick={() => { play("click"); setSheet(false); setConfirm(r); }} className={cn("h-12 rounded-xl text-[15px] font-extrabold", can ? "bg-[#5B2BD6] text-white hover:bg-[#4C22BC]" : "cursor-not-allowed bg-[#ECE9F5] text-[#6B6680]")}>
          {label}
        </button>
      </>
    );
  }

  function renderItemActions(it: Item) {
    const own = !!it.free || owned.has(it.id);
    const on = avatar[it.slot] === it.id;
    const quick = QUICK_EQUIP.includes(it.slot);
    const ok = enough(it.price ?? null);
    const tryLink = (
      <Link href={`/profile?try=${it.id}`} data-testid={`try-${it.id}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E4E0F0] bg-white font-bold text-[#3B3650] hover:bg-[#F6F5FB]">
        <Eye className="h-4 w-4" aria-hidden /> {own ? "Mặc trên hồ sơ" : "Thử trên hồ sơ"}
      </Link>
    );
    if (own) {
      return on ? (
        <button type="button" disabled className="h-12 rounded-xl bg-[#E7F7EE] text-[15px] font-extrabold text-[#17703F]">Đang dùng ✓</button>
      ) : quick ? (
        <button type="button" data-testid={`equip-${it.id}`} disabled={pending} onClick={() => equip(it)} className="h-12 rounded-xl bg-[#22A05A] text-[15px] font-extrabold text-white hover:bg-[#1C8A4D]">Dùng ngay</button>
      ) : (
        tryLink
      );
    }
    if (!it.price) {
      return (
        <>
          <button type="button" disabled={!gacha} onClick={() => openGacha("xu")} className="h-12 rounded-xl bg-[#2A1F5C] text-[15px] font-extrabold text-white disabled:opacity-50">Chỉ có trong Hộp bí ẩn · Mở rương</button>
          {tryLink}
        </>
      );
    }
    return (
      <>
        <button
          type="button"
          data-testid={`shop-buy-${it.id}`}
          disabled={pending || !ok || !data.canEarn}
          onClick={() => purchase(it)}
          title={!data.canEarn ? "Tài khoản cần được thầy duyệt" : !ok ? "Chưa đủ tiền" : "Mua"}
          className={cn("h-12 rounded-xl text-[15px] font-extrabold", ok && data.canEarn ? "bg-[#5B2BD6] text-white hover:bg-[#4C22BC]" : "cursor-not-allowed bg-[#ECE9F5] text-[#6B6680]")}
        >
          {!data.canEarn ? "Chờ thầy duyệt tài khoản" : ok ? `Mua · ${"xu" in it.price ? `${fmt(it.price.xu)} xu` : `${it.price.gem} kim cương`}` : `Chưa đủ ${"xu" in it.price ? "xu" : "kim cương"}`}
        </button>
        {tryLink}
      </>
    );
  }
}

/* ============================== Thẻ trong lưới ============================== */

function ShopCard({ e, selected, avatar, owned, using, enough, have, onPick }: {
  e: Entry; selected: boolean; avatar: StudentPointsPageData["avatar"]; owned: boolean; using: boolean; enough: boolean; have: number; onPick: () => void;
}) {
  const st = RAR_STYLE[e.rarity];
  const need = e.price ? ("xu" in e.price ? e.price.xu : e.price.gem) : 0;
  const pct = owned ? 100 : need ? Math.max(3, Math.min(100, Math.round((have / need) * 100))) : 0;
  const isGem = !!e.price && "gem" in e.price;
  const tryable = e.kind === "item";
  let art: React.ReactNode;
  let catLabel: string;
  const extra: Record<string, string> = {};
  if (e.kind === "reward") {
    art = <span className="studio-art scale-125"><RewardArt title={e.r.title} emoji={e.r.emoji} /></span>;
    catLabel = e.r.kind === "PHYSICAL" ? "Quà hiện vật" : "Thẻ đặc quyền";
    extra["data-title"] = e.r.title;
    extra["data-rarity"] = e.rarity;
  } else if (e.kind === "chest") {
    art = <GiftBoxSvg tone={e.chest === "xu" ? "red" : "blue"} size={96} className="studio-art" />;
    catLabel = "Hộp bí ẩn";
    extra["data-chest"] = e.chest;
  } else {
    const it = e.it;
    art = it.slot === "pet" ? <PetSvg itemId={it.id} size={100} className="studio-art" /> : <Chibi config={{ ...avatar, [it.slot]: it.id }} size={110} className="studio-art h-[118px] w-auto" />;
    catLabel = it.slot === "pet" ? "Thú cưng" : SLOTS.find((s) => s.key === it.slot)?.label ?? "Trang trí";
    extra["data-item"] = it.id;
  }
  const status = e.kind === "item" && owned ? (using ? "Đang dùng" : "Đã có") : null;
  const tip = !owned && e.price && !enough ? `Còn thiếu ${fmt(need - have)} ${isGem ? "kim cương" : "xu"} — nộp thêm bài để nhận nhé!` : undefined;
  return (
    <div className="relative" title={tip}>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        aria-label={`${e.name}, ${st.label}${e.price && !owned ? `, ${fmt(need)} ${isGem ? "kim cương" : "xu"}` : status ? `, ${status}` : ""}`}
        data-testid={e.kind === "reward" ? "reward-card" : e.kind === "chest" ? "chest-card" : "item-card"}
        {...extra}
        className={cn(
          "studio-item flex w-full flex-col gap-2.5 rounded-[18px] border-2 bg-white p-2 pb-3 text-left",
          selected ? "border-[#5B2BD6] shadow-[0_8px_22px_rgba(91,43,214,0.16)]" : "border-transparent shadow-[0_1px_2px_rgba(30,27,46,0.05)] hover:shadow-[0_8px_22px_rgba(42,31,92,0.1)]",
        )}
      >
        <span className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl", st.tile, e.rarity === "legendary" && "shimmer")}>
          <span className="absolute inset-[18%] rounded-full opacity-60 blur-2xl" style={{ background: st.dot }} aria-hidden />
          <span className="relative">{art}</span>
          <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold", st.tag)}>{st.label}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-1.5 px-1">
          <span className="truncate text-sm font-bold">{e.name}</span>
          <span className="flex items-center justify-between gap-1.5">
            {status ? (
              <span className={cn("text-[13px] font-bold", using ? "text-[#5B2BD6]" : "text-[#17703F]")}>{status}</span>
            ) : e.price ? (
              <PriceTag price={e.price} dim={!enough} />
            ) : (
              <span className="text-xs font-semibold text-[#8A3B12]">Chỉ từ Hộp bí ẩn</span>
            )}
            <span className="truncate text-[11px] text-[#6B6680]">{catLabel}</span>
          </span>
          <span className="h-1 overflow-hidden rounded-full bg-[#F1EEF8]" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: owned || enough ? "#22A05A" : isGem ? "#60A5FA" : "#F5B82E" }} />
          </span>
        </span>
      </button>
      {tryable && (
        <button type="button" onClick={onPick} aria-label={`Thử đồ: ${e.name}`} title="Thử đồ" data-testid="try-on" className="absolute right-4 top-4 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/90 text-[#3B3650] shadow-sm hover:bg-white">
          <Eye className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function Coin({ className }: { className?: string }) {
  return <span className={cn("inline-block shrink-0 rounded-full border-2 border-[#D8961B] bg-[#F5B82E]", className)} aria-hidden />;
}
function Gem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      <path d="M6 3h12l4 6-10 12L2 9z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 9h20M9 3l3 18M15 3l-3 18" stroke="#1D4ED8" strokeWidth="1" fill="none" />
    </svg>
  );
}
function PriceTag({ price, big, dim }: { price: { xu: number } | { gem: number }; big?: boolean; dim?: boolean }) {
  const xu = "xu" in price;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-extrabold", big ? "text-xl" : "text-[13px]", xu ? "text-[#7A4E00]" : "text-[#1D4ED8]", dim && "opacity-70")}>
      {xu ? <Coin className={big ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} /> : <Gem className={big ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} />}
      {xu ? `${fmt(price.xu)} xu` : `${price.gem} KC`}
    </span>
  );
}
