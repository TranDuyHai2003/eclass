"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, Check, Download, Gift, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  archiveReward,
  deliverRedemptions,
  grantPoints,
  rejectRedemption,
  saveReward,
} from "@/actions/points";
import type { RewardInput } from "@/lib/points/reward-input";
import { REWARD_TEMPLATES as TEMPLATES } from "@/lib/points/templates";
import { rarityOf } from "@/lib/points/rarity";
import type { TeacherRewardsPageData } from "@/lib/points/queries";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TabKey = "requests" | "rewards" | "grant" | "stats";
type Data = TeacherRewardsPageData;
type ActionResult = { success: boolean; message?: string; error?: string };

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

const STATUS_LABEL: Record<string, string> = {
  DELIVERED: "Đã trao",
  CANCELLED: "HS huỷ",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn",
};

const REASONS = ["Phát biểu xây dựng bài", "Giúp đỡ bạn", "Đi học đầy đủ", "Làm bài tốt trên lớp", "Tiến bộ rõ rệt"];

const emptyForm = (): RewardInput => ({
  title: "",
  description: "",
  emoji: "🎁",
  price: 100,
  stock: null,
  perStudentMonthlyLimit: null,
  kind: "PHYSICAL",
  costVnd: null,
  classIds: [],
  isActive: true,
});

export function TeacherRewards({ data, manualMax, manualDailyCap }: { data: Data; manualMax: number; manualDailyCap: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(data.pending.length ? "requests" : "rewards");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.success) {
          if (res.message) toast.success(res.message);
          after?.();
          router.refresh();
        } else toast.error(res.error || "Có lỗi xảy ra");
      } catch {
        toast.error("Có lỗi xảy ra, vui lòng thử lại.");
      }
    });

  const tabs: { key: TabKey; label: string; icon: typeof Gift; badge?: number }[] = [
    { key: "requests", label: "Yêu cầu đổi quà", icon: Gift, badge: data.pending.length },
    { key: "rewards", label: "Quản lý quà", icon: Star },
    { key: "grant", label: "Thưởng điểm", icon: Plus },
    { key: "stats", label: "Thống kê", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/70 sm:flex sm:overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center justify-center sm:justify-start gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 text-[13px] sm:text-sm font-bold transition-colors",
              tab === t.key ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {!!t.badge && (
              <span className={cn("rounded-full px-1.5 text-[11px]", tab === t.key ? "bg-white/25" : "bg-amber-100 text-amber-700")}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab data={data} pending={pending} run={run} />}
      {tab === "rewards" && <RewardsTab data={data} pending={pending} run={run} />}
      {tab === "grant" && <GrantTab data={data} pending={pending} run={run} manualMax={manualMax} manualDailyCap={manualDailyCap} />}
      {tab === "stats" && <StatsTab data={data} />}
    </div>
  );
}

type TabProps = { data: Data; pending: boolean; run: (fn: () => Promise<ActionResult>, after?: () => void) => void };

function ClassFilter({ classes, value, onChange }: { classes: { id: string; name: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
    >
      <option value="">Tất cả lớp</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------- Yêu cầu đổi quà
function RequestsTab({ data, pending, run }: TabProps) {
  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Data["pending"][number] | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const rows = data.pending.filter((p) =>
    !classId ? true : classId === "__none__" ? !p.user.studyClass : p.user.studyClass?.id === classId,
  );
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportExcel = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Quà cần trao");
    ws.columns = [
      { header: "STT", key: "i", width: 6 },
      { header: "Học sinh", key: "name", width: 28 },
      { header: "Lớp", key: "cls", width: 16 },
      { header: "Quà", key: "gift", width: 30 },
      { header: "Điểm", key: "price", width: 8 },
      { header: "Ngày đổi", key: "date", width: 16 },
      { header: "Đã trao", key: "done", width: 10 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r, i) =>
      ws.addRow({
        i: i + 1,
        name: r.user.name || r.user.email,
        cls: r.user.studyClass?.name ?? "",
        gift: r.reward.title,
        price: r.price,
        date: fmtDate(r.createdAt),
        done: "☐",
      }),
    );
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `qua-can-trao-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chosen = rows.filter((r) => selected.has(r.id)).map((r) => r.id);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 sm:p-4">
          <ClassFilter classes={data.classes} value={classId} onChange={setClassId} />
          <span className="text-sm text-slate-500">{rows.length} quà đang chờ trao</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportExcel}
              disabled={!rows.length}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Excel
            </button>
            <button
              type="button"
              disabled={pending || chosen.length === 0}
              onClick={() => run(() => deliverRedemptions(chosen), () => setSelected(new Set()))}
              className="btn-3d btn-3d-green h-10 px-3.5 text-sm disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Đã trao ({chosen.length})
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Không có quà nào đang chờ trao.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            <label className="flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={allChecked}
                onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
              />
              Chọn tất cả
            </label>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-blue-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="text-2xl leading-none">{r.reward.emoji || "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 line-clamp-1">
                    {r.user.name || r.user.email}
                    {r.user.studyClass && <span className="ml-1.5 font-semibold text-slate-400">· {r.user.studyClass.name}</span>}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {r.reward.title} · {r.price} điểm · {fmtDate(r.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setRejecting(r);
                    setRejectNote("");
                  }}
                  className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  Từ chối
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Đã xử lý gần đây</p>
          <div className="divide-y divide-slate-100">
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xl leading-none">{r.reward.emoji || "🎁"}</span>
                <p className="min-w-0 flex-1 text-sm text-slate-700 line-clamp-1">
                  <b>{r.user.name || r.user.email}</b> · {r.reward.title}
                  {r.note ? <span className="text-slate-400"> · {r.note}</span> : null}
                </p>
                <span className="shrink-0 text-xs font-bold text-slate-500">{STATUS_LABEL[r.status] ?? r.status}</span>
                <span className="hidden sm:block shrink-0 text-xs text-slate-400">{r.handledAt ? fmtDate(r.handledAt) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Từ chối yêu cầu đổi quà</DialogTitle>
            <DialogDescription>
              {rejecting && (
                <>
                  {rejecting.user.name || rejecting.user.email} · {rejecting.reward.title}. Học sinh được hoàn lại {rejecting.price} điểm.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Lý do (vd: hết hàng, đổi quà khác nhé)"
            rows={3}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
          />
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setRejecting(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              Thôi
            </button>
            <button
              type="button"
              disabled={pending || !rejectNote.trim()}
              onClick={() => rejecting && run(() => rejectRedemption(rejecting.id, rejectNote), () => setRejecting(null))}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Từ chối & hoàn điểm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Quản lý quà
function RewardsTab({ data, pending, run }: TabProps) {
  const [form, setForm] = useState<RewardInput | null>(null);
  const [deleting, setDeleting] = useState<Data["rewards"][number] | null>(null);
  const classes = data.classes.filter((c) => c.id !== "__none__");
  const existingTitles = new Set(data.rewards.map((r) => r.title.toLowerCase()));
  const templates = TEMPLATES.filter((t) => !existingTitles.has(t.title.toLowerCase()));

  const edit = (r: Data["rewards"][number]) =>
    setForm({
      id: r.id,
      title: r.title,
      description: r.description,
      emoji: r.emoji,
      price: r.price,
      stock: r.stock,
      perStudentMonthlyLimit: r.perStudentMonthlyLimit,
      kind: r.kind,
      costVnd: r.costVnd,
      classIds: r.classes.map((c) => c.id),
      isActive: r.isActive,
    });

  const numberField = (key: "price" | "stock" | "perStudentMonthlyLimit" | "costVnd", label: string, placeholder?: string) =>
    form && (
      <label className="block">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <input
          type="number"
          min={key === "price" ? 1 : 0}
          inputMode="numeric"
          value={form[key] ?? ""}
          placeholder={placeholder}
          onChange={(e) => setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) })}
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setForm(emptyForm())}
          className="btn-3d btn-3d-blue h-10 px-4 text-sm"
        >
          <Plus className="h-4 w-4" /> Thêm quà
        </button>
        <p className="text-xs text-slate-500">Học sinh chăm cả tháng được khoảng 80–90 điểm (≈ 1 gói bim bim).</p>
      </div>

      {templates.length > 0 && (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-3 sm:p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Thêm nhanh từ mẫu</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setForm({ ...emptyForm(), ...t })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                <span>{t.emoji}</span> {t.title} <span className="text-xs text-amber-600 font-black">⭐{t.price}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.rewards.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 border border-slate-200/70">Chưa có quà nào. Thêm quà để học sinh có mục tiêu tích điểm.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.rewards.map((r) => (
            <div key={r.id} className={cn("rounded-3xl border-2 bg-white p-4", r.isActive ? rarityOf(r.price).card : "border-dashed border-slate-300 opacity-70")}>
              <div className="flex items-start gap-3">
                <span className={cn("dots-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl", rarityOf(r.price).art)} style={{ "--dot": rarityOf(r.price).dot } as React.CSSProperties}>{r.emoji || "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900 line-clamp-1">{r.title}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-amber-600">
                    ⭐ {r.price} điểm
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase", rarityOf(r.price).chip)}>{rarityOf(r.price).label}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => edit(r)} title="Sửa" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setDeleting(r)} title="Xoá" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className={cn("rounded-full px-2 py-0.5", r.kind === "PHYSICAL" ? "bg-orange-50 text-orange-700" : "bg-sky-50 text-sky-700")}>
                  {r.kind === "PHYSICAL" ? "Nhận tại lớp" : "Mọi học sinh"}
                </span>
                {!r.isActive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Đang ẩn</span>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.stock === null ? "Không giới hạn" : `Còn ${r.stock}`}</span>
                {r.perStudentMonthlyLimit !== null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.perStudentMonthlyLimit} lần/tháng</span>
                )}
                {r.costVnd ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{fmtVnd(r.costVnd)}</span> : null}
                {r._count.redemptions > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{r._count.redemptions} chờ trao</span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500 line-clamp-1">{r.classes.length ? `Lớp: ${r.classes.map((c) => c.name).join(", ")}` : "Tất cả lớp"}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Sửa quà" : "Thêm quà"}</DialogTitle>
            <DialogDescription>Giá tính bằng điểm thưởng. Để trống số lượng nếu không giới hạn.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <label className="block w-20">
                  <span className="text-xs font-bold text-slate-500">Biểu tượng</span>
                  <input
                    value={form.emoji ?? ""}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 text-center text-xl"
                  />
                </label>
                <label className="block flex-1">
                  <span className="text-xs font-bold text-slate-500">Tên quà</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-slate-500">Mô tả (không bắt buộc)</span>
                <input
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {numberField("price", "Giá (điểm)")}
                {numberField("stock", "Số lượng", "Không giới hạn")}
                {numberField("perStudentMonthlyLimit", "Mỗi HS / tháng", "Không giới hạn")}
                {numberField("costVnd", "Chi phí thật (đ)", "Để thống kê")}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500">Ai được đổi</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["PHYSICAL", "Nhận tại lớp", "Chỉ học sinh offline"],
                      ["VIRTUAL", "Mọi học sinh", "Đặc quyền, không cần đến lớp"],
                    ] as const
                  ).map(([k, label, hint]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, kind: k })}
                      className={cn(
                        "rounded-xl border p-2.5 text-left",
                        form.kind === k ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <p className="text-sm font-bold text-slate-800">{label}</p>
                      <p className="text-[11px] text-slate-500">{hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              {classes.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-500">Áp dụng cho lớp (không chọn = tất cả)</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {classes.map((c) => {
                      const on = form.classIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setForm({ ...form, classIds: on ? form.classIds.filter((x) => x !== c.id) : [...form.classIds, c.id] })
                          }
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-bold",
                            on ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Đang cho đổi (bỏ chọn để tạm ẩn)
              </label>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              Huỷ
            </button>
            <button
              type="button"
              disabled={pending || !form?.title.trim() || !form?.price}
              onClick={() => form && run(() => saveReward(form), () => setForm(null))}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Lưu
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xoá quà “{deleting?.title}”?</DialogTitle>
            <DialogDescription>
              Học sinh sẽ không thấy quà này nữa. Lịch sử đổi quà vẫn được giữ.
              {deleting && deleting._count.redemptions > 0 && ` Còn ${deleting._count.redemptions} yêu cầu chờ trao — thầy vẫn trao hoặc từ chối được ở tab Yêu cầu.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
              Thôi
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => deleting && run(() => archiveReward(deleting.id), () => setDeleting(null))}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700"
            >
              Xoá
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Thưởng điểm
function GrantTab({ data, pending, run, manualMax, manualDailyCap }: TabProps & { manualMax: number; manualDailyCap: number }) {
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");

  const students = useMemo(() => {
    const list = data.classes.find((c) => c.id === classId)?.students ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((s) => (s.name || s.email).toLowerCase().includes(q)) : list;
  }, [data.classes, classId, query]);
  const allChecked = students.length > 0 && students.every((s) => selected.has(s.id));
  const chosen = students.filter((s) => selected.has(s.id)).map((s) => s.id);

  if (data.classes.length === 0) {
    return <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 border border-slate-200/70">Chưa có lớp hoặc học sinh nào được duyệt.</p>;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 sm:p-4">
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelected(new Set());
            }}
            className="h-10 min-w-0 flex-1 sm:flex-none rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          >
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.students.length})
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm học sinh…"
            className="h-10 min-w-[140px] flex-1 rounded-xl border border-slate-200 px-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={allChecked}
            onChange={() => setSelected(allChecked ? new Set() : new Set(students.map((s) => s.id)))}
          />
          Chọn cả lớp ({students.length})
        </label>
        <div className="max-h-[55dvh] overflow-y-auto divide-y divide-slate-100">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={selected.has(s.id)}
                onChange={() =>
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
              />
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800 line-clamp-1">{s.name || s.email}</span>
              {s.studentType === "ONLINE" && <span className="text-[10px] font-bold text-sky-600">ONLINE</span>}
              <span className="shrink-0 text-xs font-black text-amber-600 tabular-nums">⭐ {s.balance}</span>
            </label>
          ))}
          {students.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Không có học sinh.</p>}
        </div>
      </div>

      <div className="h-fit space-y-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm lg:sticky lg:top-24">
        <p className="text-sm font-black text-slate-800">Đã chọn {chosen.length} học sinh</p>
        <div>
          <span className="text-xs font-bold text-slate-500">Số điểm (âm để trừ)</span>
          <div className="mt-1 flex gap-1.5">
            {[1, 2, 3, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={cn("h-10 flex-1 rounded-xl border text-sm font-black", amount === v ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 text-slate-600")}
              >
                +{v}
              </button>
            ))}
            <input
              type="number"
              value={amount}
              min={-manualMax}
              max={manualMax}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="h-10 w-16 rounded-xl border border-slate-200 px-2 text-center text-sm font-black"
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-bold text-slate-500">Lý do (học sinh sẽ thấy)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="vd: Phát biểu xây dựng bài"
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={pending || chosen.length === 0 || !amount || !reason.trim()}
          onClick={() => run(() => grantPoints({ userIds: chosen, amount, reason }), () => setSelected(new Set()))}
          className={cn(
            "btn-3d h-11 w-full text-sm disabled:opacity-50",
            amount < 0 ? "bg-rose-600 text-white [--btn-edge:#9f1239] hover:bg-rose-500" : "btn-3d-amber",
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : amount < 0 ? <X className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          {amount < 0 ? `Trừ ${-amount} điểm` : `Thưởng ${amount} điểm`}
        </button>
        <p className="text-[11px] text-slate-400">
          Mỗi lần tối đa {manualMax} điểm; mỗi học sinh nhận tối đa {manualDailyCap} điểm thưởng tay mỗi ngày. Học sinh nhận thông báo kèm lý do.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Thống kê
function StatsTab({ data }: { data: Data }) {
  const s = data.stats;
  const cards = [
    { label: "Điểm phát ra tháng này", value: s.earnedThisMonth },
    { label: "Điểm đã dùng đổi quà", value: s.spentThisMonth },
    { label: "Quà đã trao tháng này", value: s.deliveredThisMonth },
    { label: "Chi phí quà tháng này", value: fmtVnd(s.costThisMonth) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Chăm chỉ nhất tháng này</p>
        {s.top.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Chưa có dữ liệu.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {s.top.map((t, i) => (
              <div key={t.userId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-center text-sm font-black text-slate-400">{i + 1}</span>
                <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800 line-clamp-1">
                  {t.name}
                  {t.className && <span className="text-slate-400"> · {t.className}</span>}
                </p>
                <span className="text-sm font-black text-amber-600 tabular-nums">+{t.points}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
