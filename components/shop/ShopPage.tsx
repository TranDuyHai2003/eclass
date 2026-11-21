"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Backpack, Home, Loader2, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelRedemption, redeemReward, setGoalReward } from "@/actions/points";
import { buyItem, saveAvatar } from "@/actions/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import type { HomeTodoItem } from "@/lib/home/student-home";
import { getLevel } from "@/lib/points/levels";
import { rarityOf } from "@/lib/points/rarity";
import { ITEMS, ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import { CHESTS } from "@/lib/game/gacha-shared";
import { buildNpcLines } from "@/lib/game/npc";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { SoundToggle } from "@/components/game/SoundToggle";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductCard } from "./ProductCard";
import { ScratchCodeModal } from "./ScratchCodeModal";
import { TasksModal } from "./TasksModal";
import { InventoryModal } from "./InventoryModal";
import { LeaderboardModal, type BoardData } from "./LeaderboardModal";
import { HistoryModal } from "./HistoryModal";

type Reward = StudentPointsPageData["rewards"][number];
type Cat = "all" | "physical" | "voucher" | "deco" | "pet" | "box";

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
  boards: BoardData[];
}

/** Tiệm Quà Học Đường — bố cục theo mockup Gemini Canvas; logic xu/ngọc/quà/đồ/rương giữ nguyên (lib/points, lib/game) */
export function ShopPage({ data, user, todo, todoTotal, boards }: ShopPageProps) {
  const router = useRouter();
  const [cat, setCat] = useState<Cat>("all");
  const [modal, setModal] = useState<null | "tasks" | "bag" | "scratch" | "board" | "history">(null);
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
        if (item.slot === "pet" || item.slot === "frame" || item.slot === "background" || item.slot === "title") setAvatar((a) => ({ ...a, [item.slot]: item.id }));
        toast.success(res.message);
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

  // ---------- Sản phẩm theo danh mục
  const rewards = data.rewards.filter((r) => (cat === "all" ? true : cat === "physical" ? r.kind === "PHYSICAL" : cat === "voucher" ? r.kind === "VIRTUAL" : false));
  const cosmetics = cat === "all" || cat === "deco" ? ITEMS.filter((i) => !i.free && i.slot !== "pet" && (i.price || i.gachaOnly)) : [];
  const pets = cat === "all" || cat === "pet" ? ITEMS.filter((i) => i.slot === "pet") : [];
  const showBoxes = cat === "all" || cat === "box";
  const count = rewards.length + cosmetics.length + pets.length + (showBoxes ? 2 : 0);
  const slotLabel = (s: Item["slot"]) => SLOTS.find((x) => x.key === s)?.label ?? s;
  const priceLabel = (p: Item["price"]) => (p && "xu" in p ? `🪙 ${p.xu.toLocaleString("vi-VN")} Xu` : p ? `💎 ${p.gem} Kim Cương` : "");
  const affordable = (p: Item["price"]) => (p && "xu" in p ? wallet.balance >= p.xu : p ? wallet.gems >= p.gem : false);

  return (
    <div className="shop-font -mx-4 -my-5 min-h-[calc(100vh-4rem)] sm:-mx-6 sm:-my-6 lg:-mx-8" data-celebrated={celebrated}>
      <Confetti burst={celebrated} />
      <CoinBurst burst={burst} />

      {/* ===== Thanh gỗ ===== */}
      <div className="shop-wood sticky top-[60px] z-30 px-3 py-2 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2">
          <Link href="/" title="Trang chủ" className="btn-pill btn-pill-blue h-9 w-9 shrink-0 px-0" aria-label="Trang chủ"><Home className="h-4 w-4" /></Link>
          <button type="button" title="Túi đồ" data-testid="bag-open" onClick={() => { play("click"); setModal("bag"); }} className="btn-pill btn-pill-brown relative h-9 w-9 shrink-0 px-0" aria-label="Túi đồ">
            <Backpack className="h-4 w-4" />
            {bagCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#5b3d1e] bg-[#ef5a3c] px-1 text-[10px] font-black text-white">{bagCount}</span>}
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-black text-[#3b2a14] sm:text-xl" data-testid="shop-title">Tiệm Quà Học Đường 🐾</h1>
          <span className="btn-pill hidden h-9 px-2.5 text-xs sm:inline-flex" data-testid="hud-balance">🪙 {wallet.balance.toLocaleString("vi-VN")} <span className="text-[10px] text-[#9a7a4a]">Xu</span></span>
          <span className="btn-pill hidden h-9 px-2.5 text-xs sm:inline-flex" data-testid="hud-gems">💎 {wallet.gems} <span className="text-[10px] text-[#9a7a4a]">KC</span></span>
          <SoundToggle className="hidden sm:inline-flex" />
          <button type="button" data-testid="tasks-open" onClick={() => { play("click"); setModal("tasks"); }} className="btn-pill btn-pill-yellow btn-shine relative h-9 shrink-0 px-3 text-xs">
            <span aria-hidden className="sparkle -left-1 -top-1" /><span aria-hidden className="sparkle sparkle-2 -right-1 top-1" />
            📝 Nộp Bài +{todoTotal > 0 && <span className="ml-1 rounded-full bg-[#5b3d1e] px-1.5 text-[10px] text-white">{todoTotal}</span>}
          </button>
        </div>
      </div>

      <div className="shop-stripes px-3 py-4 sm:px-6">
        <div className="mx-auto max-w-[1200px] space-y-4">
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
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border-[2px] border-[#5b3d1e] bg-gradient-to-b from-[#ffd84d] to-[#f5b61e] px-2.5 py-0.5 text-[11px] font-black text-[#3b2a14] shadow-[0_2px_0_0_#5b3d1e]">
                  {level.icon} {level.name} (Lv.{level.level})
                </span>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
            {/* ===== Danh mục ===== */}
            <aside className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1 md:flex-col md:overflow-visible md:whitespace-normal md:pb-0" role="tablist" aria-label="Danh mục">
              {CATS.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} data-testid={`cat-${c.key}`} onClick={() => { play("tick"); setCat(c.key); }} className={cn("btn-pill shrink-0 px-3 py-2 text-xs md:w-full", cat === c.key && "btn-pill-yellow")}>
                  <span aria-hidden>{c.icon}</span> {c.label}
                </button>
              ))}
              <span className="hidden border-t border-dashed border-[#5b3d1e]/40 md:my-1.5 md:block" />
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
              {count === 0 ? (
                <div className="shop-card p-8 text-center">
                  <p className="animate-float text-5xl">🎁</p>
                  <p className="mt-2 font-black text-[#3b2a14]">Thầy đang chuẩn bị quà</p>
                  <p className="text-sm text-[#7a5a35]">Cứ chăm học tích xu, quà sẽ sớm có ở đây!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
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
                        art={<span className="text-5xl drop-shadow-sm sm:text-6xl">{r.emoji || "🎁"}</span>}
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
                        art={<Chibi config={{ ...avatar, [item.slot]: item.id }} size={84} />}
                        action={
                          own
                            ? on
                              ? { label: "Đang chọn 🐾", tone: "green", disabled: true }
                              : equipable
                                ? { label: "Dùng ngay", tone: "green", onClick: () => equip(item), disabled: pending, testId: `equip-${item.id}` }
                                : { label: "Đã có · mặc ở Tuỳ chỉnh", tone: "brown", href: "/profile/avatar" }
                            : item.gachaOnly
                              ? { label: "🔒 Chỉ từ hộp bí ẩn", tone: "muted", href: "/rewards/gacha" }
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
                              ? { label: "🔒 Chỉ từ hộp bí ẩn", tone: "muted", href: "/rewards/gacha" }
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
                          title={id === "xu" ? "??? Hộp Quà Mèo (Xu)" : "??? VIP Hộp Kim Cương"}
                          rarity={id === "xu" ? "common" : "legendary"}
                          meta={c.dailyLimit ? `${c.dailyLimit} lượt/ngày` : "Không trần"}
                          art={<span className="animate-float text-6xl drop-shadow">{id === "xu" ? "🎁" : "💎"}</span>}
                          action={{ label: "xu" in c.cost ? `🪙 ${c.cost.xu} Xu · Mở` : `💎 ${c.cost.gem} Kim Cương · Mở`, tone: id === "xu" ? "yellow" : "blue", href: `/rewards/gacha?chest=${id}` }}
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
      <TasksModal open={modal === "tasks"} onOpenChange={(o) => setModal(o ? "tasks" : null)} todo={todo} todoTotal={todoTotal} />
      <InventoryModal open={modal === "bag"} onOpenChange={(o) => setModal(o ? "bag" : null)} redemptions={data.redemptions} owned={[...owned]} avatar={avatar} pending={pending} onEquip={equip} onCancel={(id) => run(() => cancelRedemption(id))} />
      <ScratchCodeModal open={modal === "scratch"} onOpenChange={(o) => setModal(o ? "scratch" : null)} canEarn={data.canEarn} />
      <LeaderboardModal open={modal === "board"} onOpenChange={(o) => setModal(o ? "board" : null)} boards={boards} myGrade={user.grade} currentUserId={user.id} />
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
