"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Backpack, Home, Loader2, Pin, PinOff, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { buyItem, saveAvatar } from "@/actions/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { getLevel } from "@/lib/points/levels";
import { rarityOf } from "@/lib/points/rarity";
import { ITEMS, ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import { CHESTS, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { buildNpcLines } from "@/lib/game/npc";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductCard } from "./ProductCard";
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
/** Ô có đồ bán/rương — chip lọc trong danh mục Trang trí */
const DECO_SLOTS = SLOTS.filter((sl) => sl.key !== "pet" && ITEMS.some((i) => i.slot === sl.key && !i.free));
/** "Tất cả" chỉ trưng đồ trang trí hồ sơ (khung, nền, phụ kiện, danh hiệu); tóc/mắt/trang phục xem ở Trang trí */
const ALL_SLOTS: Item["slot"][] = ["frame", "background", "accessory", "title"];

const CATS: { key: Cat; label: string; icon: string }[] = [
  { key: "all", label: "Tất cả", icon: "✨" },
  { key: "physical", label: "Quà hiện vật", icon: "🎁" },
  { key: "voucher", label: "Thẻ đặc quyền", icon: "🎫" },
  { key: "deco", label: "Trang trí", icon: "🎨" },
  { key: "pet", label: "Mèo Cún", icon: "🐾" },
  { key: "box", label: "Hộp bí ẩn", icon: "📦" },
];
const CAT_TITLE: Record<Cat, string> = {
  all: "Tất Cả Sản Phẩm",
  physical: "Quà Hiện Vật Nhận Tại Lớp",
  voucher: "Thẻ Đặc Quyền",
  deco: "Trang Trí Khung Hồ Sơ",
  pet: "Mèo Cún Đồng Hành",
  box: "Hộp Quà Mèo Bí Ẩn",
};

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

/** Tiệm Quà Học Đường — bố cục theo mockup Gemini Canvas; logic xu/ngọc/quà/đồ/rương giữ nguyên (lib/points, lib/game) */
export function ShopPage({ data, user, todo, todoTotal, recent = [], boards, event = null, gacha = null }: ShopPageProps) {
  const router = useRouter();
  const [cat, setCat] = useState<Cat>("all");
  const [modal, setModal] = useState<null | "tasks" | "bag" | "scratch" | "board" | "history" | "menu" | "titles">(null);
  const [decoSlot, setDecoSlot] = useState<DecoSlot>("all");
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
        // Mua mèo / khung / nền / danh hiệu thì dùng luôn — phải LƯU lên server (buyItem chỉ thêm vào túi), không chỉ đổi ở client (review Gemini GĐ6)
        if (item.slot === "pet" || item.slot === "frame" || item.slot === "background" || item.slot === "title") {
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

  // ---------- Sản phẩm theo danh mục
  const rewards = data.rewards.filter((r) => (cat === "all" ? true : cat === "physical" ? r.kind === "PHYSICAL" : cat === "voucher" ? r.kind === "VIRTUAL" : false));
  const cosmetics =
    cat === "deco"
      ? ITEMS.filter((i) => !i.free && i.slot !== "pet" && (i.price || i.gachaOnly) && (decoSlot === "all" || i.slot === decoSlot))
      : cat === "all"
        ? ITEMS.filter((i) => !i.free && !i.gachaOnly && i.price && ALL_SLOTS.includes(i.slot))
        : [];
  const pets = cat === "all" || cat === "pet" ? ITEMS.filter((i) => i.slot === "pet") : [];
  const showBoxes = !!gacha && cat === "all";
  const showPanel = !!gacha && cat === "box";
  const count = rewards.length + cosmetics.length + pets.length + (showBoxes ? 2 : 0) + (showPanel ? 2 : 0);
  const slotLabel = (s: Item["slot"]) => SLOTS.find((x) => x.key === s)?.label ?? s;
  const priceLabel = (p: Item["price"]) => (p && "xu" in p ? `🪙 ${p.xu.toLocaleString("vi-VN")} Xu` : p ? `💎 ${p.gem} Kim Cương` : "");
  const affordable = (p: Item["price"]) => (p && "xu" in p ? wallet.balance >= p.xu : p ? wallet.gems >= p.gem : false);

  return (
    <div className="shop-font shop-frame flex min-h-[calc(100vh-3.5rem)] flex-col sm:min-h-[calc(100vh-4rem)]" data-testid="shop-frame" data-celebrated={celebrated} data-weather={weather}>
      <Confetti burst={celebrated} />
      <CoinBurst burst={burst} />
      <WeatherLayer weather={weather} />

      {/* ===== Thanh gỗ ===== */}
      <div className="shop-wood sticky top-14 z-30 px-3 py-2 sm:top-16 sm:px-5">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2">
          <button type="button" title="Menu Tiệm Quà" data-testid="menu-open" onClick={() => { play("click"); setModal("menu"); }} className="btn-pill btn-pill-blue h-9 w-9 shrink-0 px-0" aria-label="Menu Tiệm Quà"><Store className="h-4 w-4" /></button>
          <Link href="/" title="Về trang chủ" aria-label="Về trang chủ" data-testid="shop-home" className="btn-pill btn-pill-green hidden h-9 w-9 shrink-0 px-0 md:inline-flex"><Home className="h-4 w-4" /></Link>
          <button type="button" title="Túi đồ" data-testid="bag-open" onClick={() => { play("click"); setModal("bag"); }} className="btn-pill btn-pill-brown relative h-9 w-9 shrink-0 px-0" aria-label="Túi đồ">
            <Backpack className="h-4 w-4" />
            {bagCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#5b3d1e] bg-[#ef5a3c] px-1 text-[10px] font-black text-white">{bagCount}</span>}
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-black text-[#3b2a14] sm:text-xl" data-testid="shop-title">Tiệm Quà Học Đường 🐾</h1>
          <span className="btn-pill hidden h-9 px-2.5 text-xs sm:inline-flex" data-testid="hud-balance">🪙 {wallet.balance.toLocaleString("vi-VN")} <span className="text-[10px] text-[#9a7a4a]">Xu</span></span>
          <span className="btn-pill hidden h-9 px-2.5 text-xs sm:inline-flex" data-testid="hud-gems">💎 {wallet.gems} <span className="text-[10px] text-[#9a7a4a]">KC</span></span>
          <button type="button" data-testid="tasks-open" onClick={() => { play("click"); setModal("tasks"); }} className="btn-pill btn-pill-yellow btn-shine relative h-9 shrink-0 px-3 text-xs">
            <span aria-hidden className="sparkle -left-1 -top-1" /><span aria-hidden className="sparkle sparkle-2 -right-1 top-1" />
            📝 Nộp Bài +{todoTotal > 0 && <span className="ml-1 rounded-full bg-[#5b3d1e] px-1.5 text-[10px] text-white">{todoTotal}</span>}
          </button>
        </div>
      </div>

      <div className="shop-stripes relative flex-1 px-3 pb-5 pt-8 sm:px-5 sm:pt-9">
        {/* Mái hiên sọc nối biển gỗ với gian hàng */}
        <div aria-hidden className="shop-awning" />
        <div className="mx-auto max-w-[1440px] space-y-4">
          {/* ===== Hồ sơ + mèo ===== */}
          <section className="shop-card grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="shop-hud">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/profile/avatar" title="Tuỳ chỉnh nhân vật" className="relative shrink-0 rounded-full border-[2.5px] border-[#5b3d1e] bg-[#cfe6fb] p-1 shadow-[0_3px_0_0_#5b3d1e] transition-transform hover:scale-105">
                <Chibi config={avatar} size={64} className="h-16 w-16" title={user.name ?? undefined} />
                <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#5b3d1e] bg-white px-1 text-[10px] font-black">✏️</span>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-base font-black text-[#3b2a14] sm:text-lg">{user.name || "Học sinh"}</p>
                  {user.grade && <span className="rounded-md border border-[#5b3d1e]/50 bg-[#fff1c2] px-1.5 py-0.5 text-[10px] font-black text-[#5b3d1e]">Khối {user.grade}</span>}
                  {user.className && <span className="rounded-md border border-[#5b3d1e]/50 bg-white px-1.5 py-0.5 text-[10px] font-black text-[#5b3d1e]">{user.className}</span>}
                </div>
                <button type="button" data-testid="titles-open" title="Xem hệ thống danh hiệu" onClick={() => { play("click"); setModal("titles"); }} className="btn-shine relative mt-1 inline-flex items-center gap-1 rounded-full border-[2px] border-[#5b3d1e] bg-gradient-to-b from-[#ffd84d] to-[#f5b61e] px-2.5 py-0.5 text-[11px] font-black text-[#3b2a14] shadow-[0_2px_0_0_#5b3d1e] transition-transform hover:-translate-y-px">
                  {level.icon} {level.name} (Lv.{level.level})
                  <span aria-hidden className="sparkle -right-1.5 -top-1.5" />
                </button>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-[#7a5a35]">
                  <span>Cấp độ {level.level}</span>
                  <span>{wallet.lifetimeEarned.toLocaleString("vi-VN")}{level.next ? ` / ${level.next.min.toLocaleString("vi-VN")}` : ""} Xu Tích Luỹ</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border-2 border-[#5b3d1e] bg-white" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ef5a3c] to-[#ffd84d]" style={{ width: `${Math.max(4, level.progress)}%` }} />
                </div>
                <div className="mt-1.5 flex gap-1.5 sm:hidden">
                  <span className="rounded-full bg-[#fff1c2] px-2 py-0.5 text-[11px] font-black text-[#7c4a03]">🪙 {wallet.balance.toLocaleString("vi-VN")}</span>
                  <span className="rounded-full bg-[#e9f4fe] px-2 py-0.5 text-[11px] font-black text-[#0f4c81]">💎 {wallet.gems}</span>
                  <span className="rounded-full bg-[#ffe4e6] px-2 py-0.5 text-[11px] font-black text-[#9f1239]">🔥 {wallet.weekStreak} tuần</span>
                </div>
              </div>
            </div>
            {/* Mèo cưng */}
            <button type="button" data-testid="pet-card" onClick={petTouch} className="group flex items-center gap-2 rounded-2xl border-[2.5px] border-[#5b3d1e] bg-white p-2 text-left shadow-[0_3px_0_0_#5b3d1e] transition-transform active:translate-y-[2px]">
              <span className="relative shrink-0">
                {pet ? <PetSvg key={petPets} itemId={pet.id} size={72} className={cn(petPets > 0 && "pet-bounce")} /> : <span className="flex h-[72px] w-[72px] items-center justify-center text-4xl">🐾</span>}
                {petPets > 0 && <span key={`h${petPets}`} className="heart-up text-lg">💗</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] font-black text-[#b4531a]">{pet ? pet.name : "Chưa có mèo cưng"}</span>
                  <span className="shrink-0 text-[10px] font-black text-[#ef5a3c] group-hover:underline">Chạm vuốt ve 🐾</span>
                </span>
                <span className="mt-0.5 block text-[12px] font-bold leading-snug text-[#3b2a14]" data-testid="pet-line">&quot;{lines[lineIdx % lines.length]}&quot;</span>
              </span>
            </button>
          </section>

          {!data.canEarn && (
            <p className="rounded-2xl border-2 border-[#f5b61e] bg-[#fff1c2] px-4 py-2 text-sm font-bold text-[#7c4a03]">Tài khoản cần được thầy duyệt để bắt đầu nhận xu và đổi quà.</p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            {/* ===== Danh mục ===== */}
            <aside className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1 md:flex-col md:overflow-visible md:whitespace-normal md:pb-0" aria-label="Danh mục và tiện ích">
              <div className="contents" role="tablist" aria-label="Danh mục">
              {CATS.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} data-testid={`cat-${c.key}`} onClick={() => { play("tick"); setCat(c.key); }} className={cn("btn-pill shrink-0 px-3 py-2 text-xs md:w-full", cat === c.key && "btn-pill-yellow")}>
                  <span aria-hidden>{c.icon}</span> {c.label}
                </button>
              ))}
              </div>
              <span aria-hidden className="hidden border-t border-dashed border-[#5b3d1e]/40 md:my-1.5 md:block" />
              <button type="button" data-testid="scratch-open" onClick={() => { play("click"); setModal("scratch"); }} className="btn-pill btn-pill-red shrink-0 px-3 py-2 text-xs md:w-full">🎟️ Thẻ cào & Code</button>
              <button type="button" data-testid="board-open" onClick={() => { play("click"); setModal("board"); }} className="btn-pill btn-pill-yellow shrink-0 px-3 py-2 text-xs md:w-full">🏆 Bảng Vàng Khối</button>
              <button type="button" data-testid="history-open" onClick={() => { play("click"); setModal("history"); }} className="btn-pill btn-pill-brown shrink-0 px-3 py-2 text-xs md:w-full">📒 Lịch sử xu</button>
            </aside>

            {/* ===== Lưới sản phẩm ===== */}
            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-black text-[#3b2a14] sm:text-xl">
                  {CAT_TITLE[cat]} <span className="rounded-full border border-[#5b3d1e]/50 bg-white px-2 py-0.5 text-[11px] font-bold">{count} món</span>
                </h2>
                <p className="text-[11px] font-bold text-[#7a5a35]">Đổi bằng <span className="text-[#b4531a]">Xu</span> &amp; <span className="text-[#0f4c81]">Kim Cương</span></p>
              </div>
              {!data.isOffline && (cat === "all" || cat === "physical") && data.rewards.some((r) => r.kind === "PHYSICAL") === false && (
                <p className="text-[11px] font-semibold text-[#7a5a35]">Quà hiện vật được trao tại lớp học offline, vì vậy bạn chỉ thấy các quà dành cho mọi học sinh.</p>
              )}
              {cat === "deco" && (
                <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Lọc theo ô trang trí" data-testid="deco-slots">
                  {([{ key: "all", label: "Tất cả", icon: "✨" }, ...DECO_SLOTS] as { key: DecoSlot; label: string; icon: string }[]).map((sl) => (
                    <button key={sl.key} type="button" role="tab" aria-selected={decoSlot === sl.key} data-testid={`deco-${sl.key}`} onClick={() => { play("tick"); setDecoSlot(sl.key); }} className={cn("btn-pill shrink-0 px-2.5 py-1 text-[11px]", decoSlot === sl.key && "btn-pill-yellow")}>
                      {sl.icon} {sl.label}
                    </button>
                  ))}
                </div>
              )}
              {cat === "box" && !gacha && (
                <div className="shop-card p-6 text-center text-sm font-bold text-[#7a5a35]">📦 Hộp bí ẩn đang tạm đóng. Quay lại sau nhé!</div>
              )}
              {showPanel && gacha && <GachaPanel pity={wallet.gachaPity} pullsToday={gacha.pullsToday} onOpen={(c) => openGacha(c)} onRates={() => openGacha("xu", true)} />}
              {showPanel || (cat === "box" && !gacha) ? null : count === 0 ? (
                <div className="shop-card p-8 text-center">
                  <p className="animate-float text-5xl">🎁</p>
                  <p className="mt-2 font-black text-[#3b2a14]">Thầy đang chuẩn bị quà</p>
                  <p className="text-sm text-[#7a5a35]">Cứ chăm học tích xu, quà sẽ sớm có ở đây!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {rewards.map((r) => {
                    const rar = rarityOf(r.price);
                    const soldOut = r.stock !== null && r.stock <= 0;
                    const limitReached = r.perStudentMonthlyLimit !== null && r.usedThisMonth >= r.perStudentMonthlyLimit;
                    const enough = wallet.balance >= r.price;
                    const can = enough && !soldOut && !limitReached && data.canEarn;
                    const isGoal = goal?.id === r.id;
                    return (
                      <ProductCard
                        key={r.id}
                        testId="reward-card"
                        dataTitle={r.title}
                        dataRarity={rar.key}
                        title={r.title}
                        rarity={rar.key}
                        meta={soldOut ? "Hết" : r.stock !== null ? `Còn ${r.stock}` : r.perStudentMonthlyLimit !== null ? `${r.usedThisMonth}/${r.perStudentMonthlyLimit} tháng` : r.kind === "PHYSICAL" ? "Tại lớp" : "Đặc quyền"}
                        art={<RewardArt title={r.title} emoji={r.emoji} />}
                        corner={
                          <button type="button" data-testid="pin" disabled={pending} aria-pressed={isGoal} title={isGoal ? "Bỏ ghim mục tiêu" : "Ghim làm quà mục tiêu"} onClick={() => run(() => setGoalReward(isGoal ? null : r.id))} className={cn("rounded-lg border border-[#5b3d1e]/50 p-1", isGoal ? "bg-[#2e8fe0] text-white" : "bg-white/80 text-[#9a7a4a]")}>
                            {isGoal ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                        }
                        action={{
                          label: soldOut ? "Hết hàng" : limitReached ? "Hết lượt tháng này" : enough ? `🪙 ${r.price.toLocaleString("vi-VN")} Xu` : `Còn thiếu ${(r.price - wallet.balance).toLocaleString("vi-VN")} xu`,
                          tone: can ? "yellow" : "muted",
                          disabled: !can || pending,
                          testId: "redeem",
                          onClick: () => { play("click"); setConfirm(r); },
                        }}
                      />
                    );
                  })}
                  {cosmetics.map((item) => {
                    const own = owned.has(item.id);
                    const on = avatar[item.slot] === item.id;
                    const equipable = item.slot === "frame" || item.slot === "background" || item.slot === "title" || item.slot === "accessory";
                    return (
                      <ProductCard
                        key={item.id}
                        testId="item-card"
                        extra={{ "data-item": item.id }}
                        title={item.name}
                        rarity={item.rarity}
                        meta={`${slotLabel(item.slot)} · Vĩnh viễn`}
                        selected={on}
                        art={<Chibi config={{ ...avatar, [item.slot]: item.id }} size={120} className="h-24 w-auto sm:h-32 xl:h-36" />}
                        action={
                          own
                            ? on
                              ? { label: "Đang chọn 🐾", tone: "green", disabled: true }
                              : equipable
                                ? { label: "Dùng ngay", tone: "green", onClick: () => equip(item), disabled: pending, testId: `equip-${item.id}` }
                                : { label: "Đã có · mặc ở Tuỳ chỉnh", tone: "brown", href: "/profile/avatar" }
                            : item.gachaOnly
                              ? { label: "🔒 Chỉ từ hộp bí ẩn", tone: "muted", onClick: () => openGacha("xu"), disabled: !gacha, title: "Có trong Hộp bí ẩn" }
                              : { label: priceLabel(item.price), tone: item.price && "gem" in item.price ? "blue" : "yellow", onClick: () => purchase(item), disabled: pending || !affordable(item.price) || !data.canEarn, testId: `shop-buy-${item.id}`, title: !data.canEarn ? "Tài khoản cần được thầy duyệt" : !affordable(item.price) ? "Chưa đủ tiền" : "Mua" }
                        }
                      />
                    );
                  })}
                  {pets.map((item) => {
                    const own = item.free || owned.has(item.id);
                    const on = avatar.pet === item.id;
                    return (
                      <ProductCard
                        key={item.id}
                        testId="item-card"
                        extra={{ "data-item": item.id }}
                        title={item.name}
                        rarity={item.rarity}
                        meta="Vĩnh viễn"
                        selected={on}
                        art={<PetSvg itemId={item.id} size={96} />}
                        action={
                          own
                            ? on
                              ? { label: "Đang chọn 🐾", tone: "green", disabled: true }
                              : { label: "Nuôi bé này", tone: "green", onClick: () => equip(item), disabled: pending, testId: `equip-${item.id}` }
                            : item.gachaOnly
                              ? { label: "🔒 Chỉ từ hộp bí ẩn", tone: "muted", onClick: () => openGacha("xu"), disabled: !gacha, title: "Có trong Hộp bí ẩn" }
                              : { label: priceLabel(item.price), tone: item.price && "gem" in item.price ? "blue" : "yellow", onClick: () => purchase(item), disabled: pending || !affordable(item.price) || !data.canEarn, testId: `shop-buy-${item.id}` }
                        }
                      />
                    );
                  })}
                  {showBoxes &&
                    (["xu", "gem"] as const).map((id) => {
                      const c = CHESTS[id];
                      return (
                        <ProductCard
                          key={id}
                          testId="chest-card"
                          extra={{ "data-chest": id }}
                          title={id === "xu" ? "??? Hộp Sao Mèo" : "??? Hộp Tinh Tú VIP"}
                          rarity={id === "xu" ? "epic" : "legendary"}
                          meta={c.dailyLimit ? `${c.dailyLimit} lượt/ngày` : "Không trần"}
                          art={<GiftBoxSvg tone={id === "xu" ? "red" : "blue"} size={104} className="animate-float" />}
                          action={{ label: "xu" in c.cost ? `🌠 Cầu nguyện · 🪙 ${c.cost.xu} Xu` : `✨ Cầu nguyện · 💎 ${c.cost.gem} KC`, tone: id === "xu" ? "yellow" : "blue", onClick: () => openGacha(id) }}
                        />
                      );
                    })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

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
        <DialogContent className="shop-font rounded-[1.5rem] border-[3px] border-[#5b3d1e] bg-[#fffaf0] shadow-[0_8px_0_0_#5b3d1e] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#3b2a14]">Đổi quà</DialogTitle>
            <DialogDescription className="text-[#7a5a35]">
              {confirm && (
                <>
                  Dùng <b>{confirm.price.toLocaleString("vi-VN")} xu</b> để đổi <b>{confirm.title}</b>. Còn lại {(wallet.balance - confirm.price).toLocaleString("vi-VN")} xu.
                  {confirm.kind === "PHYSICAL" ? " Thầy sẽ trao ở buổi học tới." : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirm(null)} className="btn-pill px-4 py-2 text-sm">Để sau</button>
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
              className="btn-pill btn-pill-yellow btn-shine px-5 py-2 text-sm"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Đổi quà
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
