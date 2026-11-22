"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Lock, LogOut, RotateCcw, Settings, ShoppingBag } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { buyBundle, saveAvatar } from "@/actions/avatar";
import { ITEM_BY_ID, itemsOfSlot, type Item, type Slot } from "@/lib/game/items";
import { PRESETS, type Preset } from "@/lib/game/presets";
import type { AvatarConfig } from "@/lib/game/avatar";
import { RARITY } from "@/lib/points/rarity";
import { play } from "@/lib/sound";
import { Chibi, FxShape } from "@/components/avatar/Chibi";
import { PetSvg } from "@/components/avatar/PetSvg";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Confetti } from "@/components/points/Confetti";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileScene } from "./ProfileScene";
import { FrameRing } from "./FrameRing";

export interface DecorStudioProps {
  user: { id: string; name: string | null; email: string | null; image: string | null };
  config: AvatarConfig;
  owned: string[];
  wallet: { balance: number; gems: number };
  canEarn: boolean;
  isDemo: boolean;
  completedLessons: number;
  level: { icon: string; level: number; name: string } | null;
  onOpenSettings: () => void;
}

type Tab = "char" | "pet" | "frame" | "background" | "effect" | "title";
const TABS: { key: Tab; label: string }[] = [
  { key: "char", label: "Nhân vật" },
  { key: "pet", label: "Thú cưng" },
  { key: "frame", label: "Khung viền" },
  { key: "background", label: "Hình nền" },
  { key: "effect", label: "Hiệu ứng" },
  { key: "title", label: "Danh hiệu" },
];
const SLOT_KEYS: Slot[] = ["skin", "hair", "hairColor", "eyes", "outfit", "accessory", "frame", "background", "effect", "title", "pet"];
const same = (a: AvatarConfig, b: AvatarConfig) => SLOT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
const priceText = (xu: number, gem: number) => [xu ? `🪙 ${xu.toLocaleString("vi-VN")} xu` : "", gem ? `💎 ${gem} ngọc` : ""].filter(Boolean).join(" + ");

/** "Hồ sơ & Trang trí": thẻ hồ sơ (banner xem trước trực tiếp) + bảng Trang trí & Vật phẩm. Bấm món chưa có = mặc thử; mua ở chân thẻ. */
export default function DecorStudio({ user, config: initial, owned: ownedInit, wallet, canEarn, isDemo, completedLessons, level, onOpenSettings }: DecorStudioProps) {
  const router = useRouter();
  const [config, setConfig] = useState<AvatarConfig>(initial);
  const [saved, setSaved] = useState<AvatarConfig>(initial);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(ownedInit));
  const [balance, setBalance] = useState(wallet.balance);
  const [gems, setGems] = useState(wallet.gems);
  const [tab, setTab] = useState<Tab>("char");
  const [charMode, setCharMode] = useState<"preset" | "custom">("preset");
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [confetti, setConfetti] = useState(0);

  const has = (it: Item) => !!it.free || owned.has(it.id);
  // Món đang mặc thử mà chưa sở hữu
  const trying = useMemo(
    () => SLOT_KEYS.map((k) => (config[k] ? ITEM_BY_ID[config[k] as string] : undefined)).filter((it): it is Item => !!it && !it.free && !owned.has(it.id)),
    [config, owned],
  );
  const buyable = trying.filter((it) => it.price);
  const gachaLocked = trying.filter((it) => !it.price);
  const cost = buyable.reduce((s, it) => ({ xu: s.xu + (it.price && "xu" in it.price ? it.price.xu : 0), gem: s.gem + (it.price && "gem" in it.price ? it.price.gem : 0) }), { xu: 0, gem: 0 });
  const affordable = balance >= cost.xu && gems >= cost.gem;
  const dirty = !same(config, saved);

  const put = (slot: Slot, id: string | null) => {
    play("click");
    setConfig((c) => ({ ...c, [slot]: id }));
  };
  const applyPreset = (p: Preset) => {
    play("click");
    setConfig((c) => ({ ...c, ...p.items }));
  };
  const dropTrying = () => {
    play("tick");
    setConfig((c) => {
      const next = { ...c };
      for (const it of trying) next[it.slot] = saved[it.slot] ?? null;
      return next;
    });
  };

  const buyTrying = () =>
    start(async () => {
      const res = await buyBundle(buyable.map((it) => it.id));
      if (!res.success) {
        play("error");
        toast.error(res.error);
        return;
      }
      const bought = res.bought ?? [];
      play("coin");
      setTimeout(() => play("success"), 200);
      setBurst((n) => n + 1);
      setOwned((o) => new Set([...o, ...bought.map((b) => b.id), ...buyable.map((b) => b.id)]));
      setBalance((b) => b - bought.reduce((s, it) => s + (it.price && "xu" in it.price ? it.price.xu : 0), 0));
      setGems((g) => g - bought.reduce((s, it) => s + (it.price && "gem" in it.price ? it.price.gem : 0), 0));
      toast.success(res.message);
    });

  const save = () =>
    start(async () => {
      const res = await saveAvatar(config);
      if (res.success) {
        play("levelup");
        setConfetti((n) => n + 1);
        const cfg = res.config ?? config;
        setSaved(cfg);
        setConfig(cfg);
        toast.success("Đã lưu trang trí ✨");
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const medals = [
    { icon: "⭐", label: "Chăm học", hint: "Học xong 10 bài", ok: completedLessons >= 10, from: "#c084fc", to: "#7c3aed" },
    { icon: "🛡️", label: "Học bá", hint: "Học xong 50 bài", ok: completedLessons >= 50, from: "#4ade80", to: "#15803d" },
    { icon: "🌟", label: "Thăng cấp", hint: "Đạt cấp 3", ok: (level?.level ?? 1) >= 3, from: "#60a5fa", to: "#1d4ed8" },
    { icon: "🏆", label: "Nhà sưu tầm", hint: "Sở hữu 10 món", ok: owned.size >= 10, from: "#fbbf24", to: "#c2410c" },
  ];
  const card = "rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-12px_rgba(76,29,149,0.25)]";
  const titleName = config.title ? ITEM_BY_ID[config.title]?.name : null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]" data-testid="decor-studio">
      <CoinBurst burst={burst} />
      <Confetti burst={confetti} />

      {/* ===== Thẻ hồ sơ (xem trước) ===== */}
      <aside className={cn(card, "lg:sticky lg:top-24")} data-testid="profile-card">
        <ProfileBanner config={config} image={user.image} name={user.name} />
        <div className="px-5 pb-5 pt-2">
          <div className="flex min-h-[36px] items-center justify-end gap-1.5">
            {level && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                <span aria-hidden>{level.icon}</span> {level.name}
              </span>
            )}
          </div>
          <div className="mt-3 text-center">
            {titleName && <p className="mb-1 inline-block rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-0.5 text-[11px] font-black text-white" data-testid="profile-title">🏷️ {titleName}</p>}
            <p className="max-w-full truncate text-xl font-black text-slate-900">{user.name || "Học sinh"}</p>
            <p className="max-w-full truncate text-sm text-slate-500">{user.email || "Chưa có email"}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-violet-50 px-2 py-2.5">
              <p className="text-xl font-black text-violet-700 tabular-nums">{completedLessons}</p>
              <p className="text-[11px] font-bold text-violet-500">bài đã học</p>
            </div>
            <a href="/rewards" className="rounded-2xl bg-amber-50 px-2 py-2.5 transition-colors hover:bg-amber-100">
              <p className="text-xl font-black text-amber-700 tabular-nums" data-testid="decor-xu">🪙 {balance.toLocaleString("vi-VN")}</p>
              <p className="text-[11px] font-bold text-amber-600">xu{gems ? ` · 💎 ${gems} ngọc` : ""}</p>
            </a>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-2.5" aria-label="Huy hiệu thành tích">
            {medals.map((m) => (
              <div key={m.label} className={cn("flex flex-col items-center text-center", !m.ok && "opacity-40 grayscale")} title={`${m.label}: ${m.hint}${m.ok ? " ✓" : " (chưa đạt)"}`} data-testid="medal" data-ok={m.ok ? "1" : "0"}>
                <Medal icon={m.icon} from={m.from} to={m.to} />
                <span className="mt-0.5 text-[9.5px] font-black leading-tight text-slate-600">{m.label}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut({ redirect: false });
              window.location.href = "/login";
            }}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* ===== Trang trí & Vật phẩm ===== */}
      <section className={cn(card, "flex min-w-0 flex-col")} data-testid="decor-panel">
        <div className="flex items-start gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-900 sm:text-xl">Trang trí & Vật phẩm</h2>
            <p className="text-xs font-medium text-slate-500">Kho đồ của bạn — bấm để mặc thử, ưng thì lưu</p>
          </div>
          {/* Xem trước thu nhỏ cho điện thoại (thẻ hồ sơ nằm phía trên, cuộn xuống không thấy) */}
          <div className="shrink-0 rounded-2xl border border-violet-100 bg-violet-50 p-1 lg:hidden" data-testid="decor-mini-preview" aria-hidden>
            <Chibi config={config} size={52} />
          </div>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 [scrollbar-width:none] sm:px-6" role="tablist" aria-label="Loại trang trí">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              data-testid={`decor-tab-${t.key}`}
              onClick={() => { play("tick"); setTab(t.key); }}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-[3px] px-3 py-2 text-sm font-bold transition-colors",
                tab === t.key ? "border-violet-700 text-violet-800" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-none flex-1 p-4 sm:p-5 lg:max-h-[min(560px,calc(100vh-17rem))] lg:overflow-y-auto" role="tabpanel">
          {tab === "char" && (
            <div className="space-y-4">
              <div className="flex gap-2" role="radiogroup" aria-label="Kiểu chỉnh nhân vật">
                {([["preset", "Mẫu nhân vật"], ["custom", "Tuỳ chỉnh tóc & mắt"]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={charMode === k} data-testid={`char-${k}`} onClick={() => { play("tick"); setCharMode(k); }} className={cn("rounded-full px-3.5 py-1.5 text-xs font-black transition-colors", charMode === k ? "bg-violet-700 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                    {label}
                  </button>
                ))}
              </div>
              {charMode === "preset" ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {PRESETS.map((p) => {
                    const items = Object.values(p.items).filter((x): x is string => !!x).map((id) => ITEM_BY_ID[id]);
                    const missing = items.filter((it) => !has(it));
                    const xu = missing.reduce((s, it) => s + (it.price && "xu" in it.price ? it.price.xu : 0), 0);
                    const gem = missing.reduce((s, it) => s + (it.price && "gem" in it.price ? it.price.gem : 0), 0);
                    const active = (Object.keys(p.items) as Slot[]).every((k) => (config[k] ?? null) === (p.items[k] ?? null));
                    return (
                      <Tile
                        key={p.id}
                        testId={`preset-${p.id}`}
                        selected={active}
                        onClick={() => applyPreset(p)}
                        art={<Chibi config={{ ...config, ...p.items, background: null, frame: null, effect: null }} size={70} />}
                        name={p.name}
                        foot={
                          missing.length === 0 ? <Owned /> : missing.some((it) => !it.price) ? <Locked text="Có món từ rương" /> : <Price text={priceText(xu, gem)} />
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <Section n={1} title="Màu tóc">
                    <Swatches slot="hairColor" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: it.v?.startsWith("url(") ? "conic-gradient(#f43f5e,#f59e0b,#10b981,#6366f1,#f43f5e)" : it.v }} />} />
                  </Section>
                  <Section n={2} title="Kiểu tóc">
                    <ItemGrid slot="hair" config={config} has={has} put={put} art={(it) => <Chibi config={{ ...config, hair: it.id, background: null, frame: null, effect: null, accessory: null }} size={58} />} small />
                  </Section>
                  <Section n={3} title="Màu mắt">
                    <Swatches slot="eyes" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: `radial-gradient(circle at 50% 55%, #111 0 22%, ${it.v} 24% 62%, #fff 64%)` }} />} />
                  </Section>
                  <Section n={4} title="Trang phục">
                    <ItemGrid slot="outfit" config={config} has={has} put={put} art={(it) => <Chibi config={{ ...config, outfit: it.id, background: null, frame: null, effect: null }} size={58} />} small />
                  </Section>
                  <Section n={5} title="Phụ kiện">
                    <ItemGrid slot="accessory" config={config} has={has} put={put} optional art={(it) => <Chibi config={{ ...config, accessory: it.id, background: null, frame: null, effect: null }} size={58} />} small />
                  </Section>
                  <Section n={6} title="Màu da">
                    <Swatches slot="skin" config={config} has={has} put={put} render={(it) => <span className="block h-full w-full rounded-full" style={{ background: it.v }} />} />
                  </Section>
                </div>
              )}
            </div>
          )}
          {tab === "pet" && <ItemGrid slot="pet" config={config} has={has} put={put} optional art={(it) => <PetSvg itemId={it.id} size={72} />} />}
          {tab === "frame" && (
            <ItemGrid
              slot="frame"
              config={config}
              has={has}
              put={put}
              optional
              art={(it) => (
                <span className="relative block h-[76px] w-[76px]">
                  <span className="absolute inset-[13px] rounded-full bg-gradient-to-br from-violet-200 to-blue-200" />
                  <FrameRing frameId={it.id} className="absolute inset-0 h-full w-full" />
                </span>
              )}
            />
          )}
          {tab === "background" && (
            <ItemGrid slot="background" config={config} has={has} put={put} optional wide art={(it) => <ProfileScene bgId={it.id} className="h-full w-full" />} />
          )}
          {tab === "effect" && (
            <ItemGrid slot="effect" config={config} has={has} put={put} optional wide art={(it) => <EffectThumb kind={it.v ?? ""} />} />
          )}
          {tab === "title" && (
            <ItemGrid
              slot="title"
              config={config}
              has={has}
              put={put}
              optional
              art={(it) => (
                <span className={cn("rounded-full border-2 px-3 py-1 text-[11px] font-black shadow-sm", RIBBON[it.rarity])}>{it.name}</span>
              )}
            />
          )}
        </div>

        {/* Chân thẻ */}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-b-3xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1 text-[11px] font-bold text-slate-500" aria-live="polite" data-testid="decor-status">
            {trying.length > 0 ? (
              <span className="text-violet-700">
                Đang thử {trying.length} món chưa có{buyable.length ? ` · ${priceText(cost.xu, cost.gem)}` : ""}
                {gachaLocked.length ? ` · ${gachaLocked.length} món chỉ từ rương` : ""}
              </span>
            ) : dirty ? "Có thay đổi chưa lưu" : "Đã lưu ✓"}
          </div>
          <button type="button" onClick={onOpenSettings} aria-label="Cài đặt tài khoản" title="Cài đặt tài khoản" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Settings className="h-4 w-4" />
          </button>
          <button type="button" data-testid="decor-reset" disabled={!dirty || pending} onClick={() => { play("tick"); setConfig(saved); }} aria-label="Hoàn tác về bản đã lưu" title="Hoàn tác về bản đã lưu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />
          </button>
          {trying.length > 0 ? (
            buyable.length > 0 && gachaLocked.length === 0 ? (
              <button
                type="button"
                data-testid="decor-buy"
                disabled={pending || !canEarn || isDemo || !affordable}
                onClick={buyTrying}
                title={isDemo ? "Tài khoản demo chỉ xem" : !canEarn ? "Tài khoản cần được thầy duyệt" : !affordable ? "Chưa đủ xu/ngọc" : "Mua các món đang thử"}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 text-sm font-black text-amber-950 shadow-[0_3px_0_0_#b45309] disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />} Mua {buyable.length} món
              </button>
            ) : (
              <button type="button" data-testid="decor-drop" onClick={dropTrying} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-black text-violet-700">
                <Lock className="h-4 w-4" /> Bỏ món chưa có
              </button>
            )
          ) : (
            <button
              type="button"
              data-testid="decor-save"
              disabled={pending || !dirty || isDemo}
              onClick={save}
              title={isDemo ? "Tài khoản demo chỉ xem" : undefined}
              className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-black text-white transition-colors", dirty && !isDemo ? "bg-violet-700 shadow-[0_3px_0_0_#4c1d95] hover:bg-violet-600" : "bg-slate-300")}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Lưu trang trí
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================== Thành phần nhỏ ============================== */

const RIBBON: Record<Item["rarity"], string> = {
  common: "border-emerald-500 bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950",
  rare: "border-sky-600 bg-gradient-to-b from-sky-300 to-sky-500 text-sky-950",
  epic: "border-violet-700 bg-gradient-to-b from-violet-400 to-violet-600 text-white",
  legendary: "border-amber-600 bg-gradient-to-b from-amber-300 to-orange-500 text-amber-950",
};

function Medal({ icon, from, to }: { icon: string; from: string; to: string }) {
  return (
    <svg viewBox="0 0 40 48" className="h-11 w-9" aria-hidden>
      <path d="M12 26L8 46l7-4 3 6 4-20zM28 26l4 20-7-4-3 6-4-20z" fill={to} opacity="0.85" />
      <circle cx="20" cy="18" r="15" fill={to} />
      <circle cx="20" cy="18" r="12" fill={from} stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7" />
      <text x="20" y="23" textAnchor="middle" fontSize="13">{icon}</text>
    </svg>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black text-slate-800">{n}) {title}</p>
      {children}
    </div>
  );
}

const Owned = () => <span className="text-[11px] font-bold text-emerald-600">Đã sở hữu</span>;
const Price = ({ text }: { text: string }) => <span className="text-[11px] font-black text-amber-700">{text}</span>;
const Locked = ({ text = "Chỉ từ rương" }: { text?: string }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600"><Lock className="h-3 w-3" /> {text}</span>
);

function footFor(it: Item, has: (it: Item) => boolean) {
  if (has(it)) return it.free ? <span className="text-[11px] font-bold text-slate-400">Miễn phí</span> : <Owned />;
  if (!it.price) return <Locked />;
  return <Price text={"xu" in it.price ? `🪙 ${it.price.xu.toLocaleString("vi-VN")} xu` : `💎 ${it.price.gem} ngọc`} />;
}

function Tile({ selected, onClick, art, name, foot, testId, rarity, wide, small }: {
  selected: boolean; onClick: () => void; art: React.ReactNode; name: string; foot: React.ReactNode; testId?: string; rarity?: Item["rarity"]; wide?: boolean; small?: boolean;
}) {
  const rar = rarity ? RARITY[rarity] : null;
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center rounded-2xl border-2 bg-white p-1.5 text-center transition-all hover:-translate-y-0.5",
        selected ? "border-violet-700 shadow-[0_0_0_3px_rgba(124,58,237,0.18)]" : "border-slate-200 hover:border-violet-300",
      )}
    >
      {selected && <span className="absolute right-1.5 top-1.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-violet-700 text-white"><Check className="h-3 w-3" /></span>}
      <span className={cn("flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br", wide ? "aspect-[16/9]" : small ? "h-[68px]" : "h-[84px]", rar ? rar.art : "from-slate-50 to-slate-100")}>{art}</span>
      <span className="mt-1 line-clamp-1 text-xs font-black text-slate-800">{name}</span>
      <span className="leading-tight">{foot}</span>
    </button>
  );
}

function ItemGrid({ slot, config, has, put, art, optional, wide, small }: {
  slot: Slot; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; art: (it: Item) => React.ReactNode; optional?: boolean; wide?: boolean; small?: boolean;
}) {
  const items = itemsOfSlot(slot);
  return (
    <div className={cn("grid gap-2.5", wide ? "grid-cols-2 sm:grid-cols-3" : small ? "grid-cols-3 sm:grid-cols-4 xl:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4")}>
      {optional && (
        <Tile testId={`none-${slot}`} selected={!config[slot]} onClick={() => put(slot, null)} art={<span className="text-2xl text-slate-300">✕</span>} name="Không dùng" foot={<span className="text-[11px] font-bold text-slate-400">Bỏ trống</span>} wide={wide} small={small} />
      )}
      {items.map((it) => (
        <Tile key={it.id} testId={`item-${it.id}`} rarity={it.rarity} selected={config[slot] === it.id} onClick={() => put(slot, it.id)} art={art(it)} name={it.name} foot={footFor(it, has)} wide={wide} small={small} />
      ))}
    </div>
  );
}

function Swatches({ slot, config, has, put, render }: {
  slot: Slot; config: AvatarConfig; has: (it: Item) => boolean; put: (slot: Slot, id: string | null) => void; render: (it: Item) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {itemsOfSlot(slot).map((it) => {
        const own = has(it);
        const on = config[slot] === it.id;
        const price = it.price ? ("xu" in it.price ? `${it.price.xu.toLocaleString("vi-VN")} xu` : `${it.price.gem} ngọc`) : "chỉ từ rương";
        return (
          <button
            key={it.id}
            type="button"
            data-testid={`item-${it.id}`}
            aria-pressed={on}
            aria-label={`${it.name}${own ? "" : ` (${price})`}`}
            title={`${it.name}${own ? "" : ` — ${price}`}`}
            onClick={() => put(slot, it.id)}
            className={cn("relative h-10 w-10 rounded-full border-2 p-0.5 transition-transform hover:scale-110", on ? "border-violet-700 ring-4 ring-violet-200" : "border-slate-200")}
          >
            {render(it)}
            {!own && <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-violet-600 shadow"><Lock className="h-2.5 w-2.5" /></span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ô xem trước hiệu ứng: nền tối + hạt tĩnh (lưới chọn không chạy hoạt ảnh — review Gemini GĐ8) */
function EffectThumb({ kind }: { kind: string }) {
  const pts: [number, number][] = [[18, 22], [44, 14], [70, 30], [86, 12], [30, 44], [58, 48], [82, 46], [12, 50]];
  return (
    <svg viewBox="0 0 100 56" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`fxthumb-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#312e81" /><stop offset="100%" stopColor="#1e1b4b" /></linearGradient>
      </defs>
      <rect width="100" height="56" fill={`url(#fxthumb-${kind})`} />
      {kind === "thunder" && <ellipse cx="50" cy="28" rx="20" ry="20" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />}
      {pts.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${0.6 + (i % 3) * 0.15})`}><FxShape kind={kind} i={i} /></g>
      ))}
    </svg>
  );
}
