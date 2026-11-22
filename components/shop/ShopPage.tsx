"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coin, GemSmall, IconEye, IconHeart, IconHistory, IconInfo, IconMenu } from "@/components/studio/icons";
import { ShopArt, SHOP_CHEST, Sprite, frameSpriteStyle, hasSprite, rewardArtIndex, shopItemIndex } from "@/components/studio/Sprite";
import { FrameRing } from "@/components/profile/FrameRing";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { buyItem, saveAvatar } from "@/actions/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { LEVELS, getLevel } from "@/lib/points/levels";
import { rarityOf, type Rarity } from "@/lib/points/rarity";
import { ITEMS, ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import { CHESTS, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { buildNpcLines } from "@/lib/game/npc";
import { buzz, isSoundOn, onSoundChange, play, setSoundOn } from "@/lib/sound";
import { LevelUpDialog, Mascot, OfflineBanner, useOnline, useTweenNumber } from "@/components/studio/effects";
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
import { WeatherLayer, useWeather } from "./Weather";

// Hộp thoại cầu nguyện (hoạt ảnh + gọi server) chỉ tải khi mở
const GachaModal = dynamic(() => import("./GachaModal").then((m) => m.GachaModal), { ssr: false });

type Reward = StudentPointsPageData["rewards"][number];
type Cat = "all" | "physical" | "voucher" | "deco" | "pet" | "box";
type Sec = "shop" | "earn" | "gacha" | "gold" | "bag";
const SECS: { key: Sec; label: string }[] = [
  { key: "shop", label: "Cửa hàng" },
  { key: "earn", label: "Kiếm xu" },
  { key: "gacha", label: "Hộp bí ẩn" },
  { key: "gold", label: "Bảng Vàng" },
  { key: "bag", label: "Túi đồ" },
];
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
  // Các mục của "Tiệm quà v2" (canvas thiết kế): Cửa hàng · Kiếm xu · Hộp bí ẩn · Bảng Vàng · Túi đồ
  const [sec, setSec] = useState<Sec>("shop");
  const [lvUp, setLvUp] = useState<number | null>(null);
  const [soundOn, setSoundState] = useState(true);
  const online = useOnline();
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
  const xuShown = useTweenNumber(wallet.balance);
  // Âm thanh: đọc/ghi localStorage trong effect (HTML server/client khớp)
  useEffect(() => {
    setSoundState(isSoundOn());
    return onSoundChange(setSoundState);
  }, []);
  // Lên cấp: so với cấp đã thấy lần trước trong trình duyệt này
  useEffect(() => {
    try {
      const k = `last-level:${user.id}`;
      const prev = Number(localStorage.getItem(k) || 0);
      if (prev && level.level > prev) setLvUp(level.level);
      localStorage.setItem(k, String(level.level));
    } catch {
      /* bỏ qua */
    }
  }, [level.level, user.id]);
  const goSec = (k: Sec) => {
    play("click");
    setSec(k);
  };

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
        buzz(25);
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
    if (a === "shop") { setSec("shop"); setCat("all"); }
    else if (a === "box") setSec("gacha");
    else if (a === "tasks" || a === "scratch") setSec("earn");
    else if (a === "board") setSec("gold");
    else if (a === "bag") setSec("bag");
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
    const chests: Entry[] = gacha && (c === "all" || c === "box")
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

      {/* ===== Đầu trang (canvas "Tiệm quà v2") ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold tracking-tight" data-testid="shop-title">Tiệm Quà Học Đường</h1>
          <p className="text-[#5F5B73]">Chăm làm bài, đổi quà xinh. Xu tiêu thoải mái, cấp độ không tụt.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" data-testid="history-open" onClick={() => { play("click"); setModal("history"); }} className="flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold text-[#3B3650] hover:bg-white"><IconHistory /> Lịch sử</button>
          <button type="button" data-testid="menu-open" onClick={() => { play("click"); setModal("menu"); }} aria-label="Menu Tiệm Quà" title="Menu Tiệm Quà" className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[#3B3650] hover:bg-white"><IconMenu /></button>
        </div>
      </div>

      {!online && <OfflineBanner onRetry={() => router.refresh()} />}

      {/* ===== Cấp độ + ví ===== */}
      <section className="flex flex-wrap gap-[18px]" data-testid="shop-hud">
        <div className="flex flex-[999_1_520px] flex-wrap items-center gap-[18px] rounded-[20px] border border-[#ECE9F5] bg-white p-[18px]">
          <Link href="/profile" title="Tùy chỉnh hồ sơ" className="relative h-24 w-24 shrink-0 rounded-full" style={avatar.frame ? frameSpriteStyle(avatar.frame, 96) : undefined}>
            <span className="absolute inset-5 overflow-hidden rounded-full bg-[#EDE7FD]"><Chibi config={{ ...avatar, background: null, frame: null, effect: null }} size={56} className="h-full w-full" /></span>
            {avatar.frame && !frameSpriteStyle(avatar.frame, 96) && <FrameRing frameId={avatar.frame} className="absolute inset-0 h-full w-full" />}
          </Link>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
            <div className="relative flex min-h-14 items-center overflow-hidden rounded-[14px] bg-gradient-to-r from-[#EDE7FD] via-[#F6F1FF] to-[#FCE7F3] px-3.5 py-2.5">
              <div className="relative flex flex-col text-[#2A1F5C]">
                <span className="text-[17px] font-extrabold">{user.name || "Học sinh"}</span>
                <span className="text-xs">{user.grade ? `Khối ${user.grade} · ` : ""}{level.name}</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2.5 text-[13px]">
              <button type="button" data-testid="titles-open" onClick={() => { play("click"); setModal("titles"); }} title="Xem hệ thống danh hiệu" className="text-left hover:underline">
                <b>Lv.{level.level}</b> <span className="text-[#5F5B73]">{level.name}</span>
              </button>
              <span className="text-[#5F5B73]"><b className="text-[#1E1B2E]">{fmt(wallet.lifetimeEarned)}</b> xu tích lũy</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F1EEF8]" role="progressbar" aria-label="Xu tích luỹ đến cấp sau" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[#5B2BD6]" style={{ width: `${Math.max(2, level.progress)}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex-[1_1_240px] text-xs text-[#5F5B73]">{level.next ? `Còn ${fmt(level.toNext)} xu nữa để lên Lv.${level.level + 1} · ${level.next.name}` : "Bạn đã đạt cấp cao nhất 👑"}</span>
              <Link href="/profile" className="flex h-9 items-center rounded-[10px] border border-[#E4E0F0] bg-white px-3 text-[13px] font-bold text-[#2A1F5C]">Tùy chỉnh hồ sơ</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-[20px] bg-[#1E1745] p-[18px] text-white">
          <div className="flex gap-6">
            <div data-testid="hud-balance">
              <div className="text-xs text-[#C9BEFF]">Xu tiêu được</div>
              <div className="flex items-center gap-2 text-[26px] font-extrabold"><Coin size={18} /><span key={xuShown.bump} className={cn(xuShown.bump > 0 && "v2-bump")}>{fmt(xuShown.shown)}</span></div>
            </div>
            <div data-testid="hud-gems">
              <div className="text-xs text-[#C9BEFF]">Kim cương</div>
              <div className="flex items-center gap-2 text-[26px] font-extrabold"><GemSmall size={14} />{wallet.gems}</div>
            </div>
          </div>
          <p className="text-xs leading-normal text-[#D9D3F5]">Tiêu xu không làm giảm cấp độ. Cấp độ tính theo tổng xu tích lũy.</p>
          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => goSec("earn")} className="h-11 rounded-xl bg-white px-4 font-bold text-[#2A1F5C]">+ Kiếm xu</button>
            <button type="button" data-testid="bag-open" onClick={() => goSec("bag")} className="relative h-11 rounded-xl bg-white/[0.12] px-4 font-bold">
              Túi đồ{bagCount > 0 && <span className="ml-1.5 rounded-full bg-[#5B2BD6] px-1.5 text-[11px]">{bagCount}</span>}
            </button>
            <button type="button" role="switch" aria-checked={soundOn} aria-label="Âm thanh hiệu ứng" onClick={() => setSoundOn(!soundOn)} className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-white/[0.12] px-3.5 font-bold">
              {soundOn ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></svg>
              )}
              {soundOn ? "Âm thanh: Bật" : "Âm thanh: Tắt"}
            </button>
          </div>
        </div>
      </section>

      {!data.canEarn && (
        <p className="rounded-2xl border border-[#F3DC8E] bg-[#FFF6DB] px-4 py-2.5 text-sm font-semibold text-[#7A4E00]">Tài khoản cần được thầy duyệt để bắt đầu nhận xu và đổi quà.</p>
      )}

      {/* ===== Các mục ===== */}
      <div role="tablist" aria-label="Tiệm quà" className="flex flex-wrap border-b border-[#E4E0F0]">
        {SECS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={sec === t.key}
            data-testid={t.key === "earn" ? "tasks-open" : t.key === "gold" ? "board-open" : `sec-${t.key}`}
            onClick={() => goSec(t.key)}
            className={cn("mr-[22px] px-1 py-3 text-[15px]", sec === t.key ? "font-bold text-[#5B2BD6] shadow-[inset_0_-3px_0_#5B2BD6]" : "font-semibold text-[#5F5B73]")}
          >
            {t.label}
            {t.key === "earn" && todoTotal > 0 && <span className="ml-1.5 rounded-full bg-[#5B2BD6] px-1.5 text-[11px] text-white">{todoTotal}</span>}
          </button>
        ))}
      </div>

      {sec === "shop" && (
        <>
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

      {showPanel && !gacha ? (
        <div className="studio-card p-8 text-center font-semibold text-[#5F5B73]">Hộp bí ẩn đang tạm đóng. Quay lại sau nhé!</div>
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

        </>
      )}

      {/* ===== Kiếm xu: nộp bài + thẻ cào & GiftCode + thang cấp độ ===== */}
      {sec === "earn" && (
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-start gap-[18px]">
            <div className="min-w-0 flex-[999_1_520px]">
              <TasksModal inline open onOpenChange={() => setSec("shop")} todo={todo} todoTotal={todoTotal} recent={recent} />
            </div>
            <div className="min-w-0 flex-[1_1_320px]" data-testid="scratch-open">
              <ScratchCodeModal inline open onOpenChange={() => setSec("shop")} canEarn={data.canEarn} />
            </div>
          </div>
          <div className="studio-card flex flex-col gap-3.5 p-5">
            <h2 className="text-lg font-extrabold">Cấp độ &amp; danh hiệu</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
              {LEVELS.map((l, i) => {
                const on = i + 1 === level.level;
                const reached = wallet.lifetimeEarned >= l.min;
                return (
                  <div key={l.name} className={cn("flex flex-col gap-1.5 rounded-[14px] p-3.5", on ? "bg-[#EDE7FD] ring-2 ring-[#5B2BD6]" : reached ? "bg-[#F6F5FB]" : "border border-dashed border-[#E4E0F0] bg-white")}>
                    <div className={cn("flex justify-between text-xs font-extrabold", on ? "text-[#4319A8]" : "text-[#5F5B73]")}><span>Lv.{i + 1}</span><span>{fmt(l.min)} xu</span></div>
                    <div className="font-extrabold">{l.icon} {l.name}</div>
                    <div className="text-xs leading-snug text-[#5F5B73]">{on ? "Cấp hiện tại của bạn" : reached ? "Đã đạt" : `Còn ${fmt(l.min - wallet.lifetimeEarned)} xu`}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Hộp bí ẩn: 2 rương + thanh tỉ lệ + sao bảo hiểm ===== */}
      {sec === "gacha" && (
        gacha ? (
          <div className="flex flex-col gap-[18px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[18px]">
              {(["xu", "gem"] as const).map((id) => {
                const c = CHESTS[id];
                const dark = id === "gem";
                return (
                  <div key={id} className={cn("flex flex-col gap-3.5 rounded-[20px] p-[22px]", dark ? "bg-[#1E1745] text-white" : "border border-[#ECE9F5] bg-white")} data-testid="chest-card" data-chest={id}>
                    <div className="flex items-center justify-between"><h2 className="text-[19px] font-extrabold">{id === "xu" ? "Hộp Sao Mèo" : "Hộp Tinh Tú VIP"}</h2><span className="font-extrabold">{"xu" in c.cost ? `${fmt(c.cost.xu)} xu` : `${c.cost.gem} KC`}</span></div>
                    <div className="relative flex h-[170px] items-center justify-center">
                      <span aria-hidden className="absolute h-[190px] w-[190px] rounded-full" style={{ background: dark ? "radial-gradient(circle, rgba(253,230,138,0.35), transparent 65%)" : "radial-gradient(circle, rgba(91,43,214,0.16), transparent 65%)" }} />
                      <span aria-hidden className="absolute bottom-1.5 h-[18px] w-[150px] rounded-full" style={{ background: dark ? "rgba(0,0,0,0.35)" : "rgba(30,27,46,0.09)" }} />
                      <ShopArt index={SHOP_CHEST[id]} className="v2-float relative h-40 w-40" />
                    </div>
                    {(["common", "rare", "epic", "legendary"] as Rarity[]).filter((r) => (c.rates[r] ?? 0) > 0).map((r) => (
                      <div key={r} className="grid grid-cols-[100px_1fr_40px] items-center gap-2.5 text-[13px]">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: RAR_STYLE[r].dot }} />{RAR_STYLE[r].label}</span>
                        <div className={cn("h-2 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-[#F1EEF8]")}><div className="h-full rounded-full" style={{ width: `${c.rates[r]}%`, background: RAR_STYLE[r].dot }} /></div>
                        <b className="text-right">{c.rates[r]}%</b>
                      </div>
                    ))}
                    <button type="button" data-testid={`chest-open-${id}`} onClick={() => openGacha(id)} className={cn("h-[46px] rounded-xl font-extrabold", dark ? "bg-[#FDE68A] text-[#2A1F5C]" : "bg-[#5B2BD6] text-white")}>
                      Mở hộp · {"xu" in c.cost ? `${fmt(c.cost.xu)} xu` : `${c.cost.gem} KC`}{id === "xu" && c.dailyLimit ? ` (còn ${Math.max(0, c.dailyLimit - gacha.pullsToday)}/${c.dailyLimit} hôm nay)` : ""}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-[#ECE9F5] bg-white px-5 py-[18px]" data-testid="pity">
              <div className="flex-[1_1_300px]">
                <div className="font-extrabold">Bảo hiểm nhân phẩm ({wallet.gachaPity}/{CHESTS.xu.pity})</div>
                <div className="text-[13px] text-[#5F5B73]">Mở thêm {Math.max(0, (CHESTS.xu.pity ?? 5) - wallet.gachaPity)} lượt Hộp Sao Mèo chưa ra Sử thi thì lượt tiếp chắc chắn Sử thi trở lên.</div>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: CHESTS.xu.pity ?? 5 }, (_, i) => (
                  <span key={i} className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-full font-extrabold", i < wallet.gachaPity ? "bg-[#FDE68A] text-[#7A4300]" : "bg-[#F1EEF8] text-[#C9C4DA]")}>★</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="studio-card p-8 text-center font-semibold text-[#5F5B73]">Hộp bí ẩn đang tạm đóng. Quay lại sau nhé!</div>
        )
      )}

      {sec === "gold" && <LeaderboardModal inline open onOpenChange={() => setSec("shop")} boards={boards} myGrade={user.grade} currentUserId={user.id} event={event} />}
      {sec === "bag" && <InventoryModal inline open onOpenChange={() => setSec("shop")} redemptions={data.redemptions} owned={[...owned]} avatar={avatar} pending={pending} onEquip={equip} onCancel={(id) => run(() => cancelRedemption(id))} />}

      {/* Chi tiết dạng sheet đáy (điện thoại/máy tính bảng) */}
      <Dialog open={sheet && !!sel} onOpenChange={setSheet}>
        <DialogContent showCloseButton={false} className="studio fixed bottom-0 left-0 right-0 top-auto flex max-h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-3.5 overflow-y-auto rounded-b-none rounded-t-3xl border-0 p-5 pt-2.5 sm:max-w-none lg:hidden" data-testid="shop-sheet">
          <span className="mx-auto h-1 w-10 rounded-full bg-[#D6D1E6]" aria-hidden />
          <DialogTitle className="sr-only">{sel?.name ?? "Chi tiết"}</DialogTitle>
          <DialogDescription className="sr-only">Chi tiết món quà</DialogDescription>
          {sel && renderDetail(sel)}
        </DialogContent>
      </Dialog>

      {/* Mèo linh vật (canvas v2): trôi góc trái, bấm vuốt ve → tim + meo + lời nhắc tiếp */}
      <Mascot
        name={pet ? pet.name : "Mèo Mướp Bi"}
        tips={lines}
        art={pet && pet.id !== "pet-bi" ? <ItemArt it={pet} avatar={avatar} /> : undefined}
      />
      {lvUp && (
        <LevelUpDialog
          level={lvUp}
          title={level.name}
          note={level.next ? `Còn ${fmt(level.toNext)} xu nữa để lên ${level.next.name}. Đồ trang trí mới đang chờ bạn ở Cửa hàng!` : "Bạn đã đạt cấp cao nhất 👑"}
          onClose={() => setLvUp(null)}
          onSee={() => { setLvUp(null); setSec("shop"); setCat("deco"); }}
        />
      )}

      {/* ===== Hộp thoại ===== */}
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
              {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />} Xác nhận đổi
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
    if (e.kind === "reward") {
      how = e.r.kind === "PHYSICAL" ? "Trao trực tiếp tại lớp học offline. Thầy sẽ xác nhận khi bạn nhận quà." : "Thẻ được cất vào túi đồ, bạn dùng khi cần.";
      catLabel = e.r.kind === "PHYSICAL" ? "Quà hiện vật" : "Thẻ đặc quyền";
    } else if (e.kind === "chest") {
      how = "Mở ra ngẫu nhiên một món theo tỉ lệ rơi của rương.";
      catLabel = "Hộp bí ẩn";
    } else {
      const it = e.it;
      catLabel = it.slot === "pet" ? "Thú cưng" : "Trang trí";
      how = it.slot === "pet" ? "Thú cưng đi cùng nhân vật trên hồ sơ. Có thể thử trước khi đổi." : "Dùng ngay trên hồ sơ. Có thể thử trước khi đổi.";
    }
    const isGoal = e.kind === "reward" && goal?.id === e.r.id;
    return (
      <>
        <div className={cn("flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px]", st.tile)} data-testid="detail-art">
          <span className="flex aspect-square h-[92%] items-center justify-center"><EntryArt e={e} avatar={avatar} /></span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", st.tag)}>{st.label}</span>
            <span className="text-xs text-[#6B6680]">{catLabel}</span>
          </div>
          <h2 className="text-xl font-extrabold" data-testid="detail-name">{e.name}</h2>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-[#F6F5FB] px-3 py-2.5 text-[13px] text-[#3B3650]">
          <IconInfo className="mt-px shrink-0" />
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
              {ok ? `Bạn đủ ${unit} để đổi món này.` : `Bạn có ${fmt(have)} ${unit === "xu" ? "xu" : "KC"}, còn thiếu ${fmt(need - have)} ${unit === "xu" ? "xu" : "KC"}.`}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {e.kind === "reward" && renderRewardActions(e.r)}
          {e.kind === "chest" && (
            <>
              <button type="button" data-testid={`chest-open-${e.chest}`} onClick={() => openGacha(e.chest)} className="h-12 rounded-xl bg-[#5B2BD6] text-[15px] font-extrabold text-white hover:bg-[#4C22BC]">
                Mở ngay · {"xu" in e.price ? `${fmt(e.price.xu)} xu` : `${e.price.gem} KC`}
              </button>
              <button type="button" onClick={() => openGacha(e.chest, true)} className="h-11 rounded-xl border border-[#E4E0F0] bg-white font-bold text-[#3B3650]">Xem tỉ lệ rơi</button>
            </>
          )}
          {e.kind === "item" && renderItemActions(e.it)}
          {e.kind === "reward" && (
            <button type="button" data-testid="pin" disabled={pending} aria-pressed={isGoal} onClick={() => run(() => setGoalReward(isGoal ? null : e.r.id))} className="flex h-10 items-center justify-center gap-2 rounded-xl font-semibold text-[#5F5B73]">
              <IconHeart filled={isGoal} /> {isGoal ? "Đã thêm vào danh sách mong muốn" : "Thêm vào danh sách mong muốn"}
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
        <IconEye /> {own ? "Mặc trên hồ sơ" : "Thử trên hồ sơ"}
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
  let catLabel: string;
  const extra: Record<string, string> = {};
  if (e.kind === "reward") {
    catLabel = e.r.kind === "PHYSICAL" ? "Quà hiện vật" : "Thẻ đặc quyền";
    extra["data-title"] = e.r.title;
    extra["data-rarity"] = e.rarity;
  } else if (e.kind === "chest") {
    catLabel = "Hộp bí ẩn";
    extra["data-chest"] = e.chest;
  } else {
    catLabel = e.it.slot === "pet" ? "Thú cưng" : "Trang trí";
    extra["data-item"] = e.it.id;
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
        <span className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl", st.tile)}>
          <span className="studio-art flex aspect-square w-[84%] items-center justify-center"><EntryArt e={e} avatar={avatar} /></span>
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
          <IconEye size={14} />
        </button>
      )}
    </div>
  );
}

function PriceTag({ price, big, dim }: { price: { xu: number } | { gem: number }; big?: boolean; dim?: boolean }) {
  const xu = "xu" in price;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-extrabold", big ? "text-xl" : "text-[13px]", xu ? "text-[#7A4E00]" : "text-[#1D4ED8]", dim && "opacity-70")}>
      {xu ? <Coin size={big ? 18 : 14} /> : <GemSmall size={big ? 18 : 14} />}
      {xu ? `${fmt(price.xu)} xu` : `${price.gem} KC`}
    </span>
  );
}

/** Ảnh thật của một món trang trí: ảnh tiệm → ảnh hồ sơ → hình vẽ đúng của món (khung/danh hiệu/nhân vật mặc thử) */
function ItemArt({ it, avatar }: { it: Item; avatar: StudentPointsPageData["avatar"] }) {
  const idx = shopItemIndex(it.id);
  if (idx !== undefined) return <ShopArt index={idx} className="h-full w-full" />;
  if (hasSprite(it.id)) return <Sprite id={it.id} className="w-full rounded-lg" />;
  if (it.slot === "pet") return <PetSvg itemId={it.id} size={120} className="h-full w-full" />;
  if (it.slot === "frame")
    return (
      <span className="relative block h-[86%] w-[86%]">
        <span className="absolute inset-[15%] rounded-full bg-white/70" />
        <FrameRing frameId={it.id} className="absolute inset-0 h-full w-full" />
      </span>
    );
  if (it.slot === "title") return <span className="rounded-full bg-[#2A1F5C] px-3 py-1.5 text-center text-xs font-extrabold text-[#FDE68A]">{it.name}</span>;
  return <Chibi config={{ ...avatar, background: null, effect: null, [it.slot]: it.id }} size={120} className="h-full w-auto" />;
}

function EntryArt({ e, avatar }: { e: Entry; avatar: StudentPointsPageData["avatar"] }) {
  if (e.kind === "reward") return <ShopArt index={rewardArtIndex(e.r.title, e.r.kind)} className="h-full w-full" />;
  if (e.kind === "chest") return <ShopArt index={SHOP_CHEST[e.chest]} className="h-full w-full" />;
  return <ItemArt it={e.it} avatar={avatar} />;
}
