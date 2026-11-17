"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Crosshair,
  Eraser,
  Flag,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveSolutionAnchors } from "@/actions/solution-anchors";
import {
  buildAutoAnchors,
  comparePoints,
  regionSegments,
  resolveRegion,
  type AnchorItem,
  type PdfAnalysis,
  type PdfLayout,
  type SolutionAnchorsData,
} from "@/lib/pdf-question-anchors";
import { analyzePdfCached } from "@/lib/pdf-analysis-client";
import type { PdfOverlayMarker } from "@/components/ui/pdf-viewer";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Đang tải tài liệu...</div>
  ),
});
const PdfRegionView = dynamic(() => import("@/components/pdf/PdfRegionView"), { ssr: false });

interface EditorSection {
  id: string;
  name: string;
  questions: { id: string; type: string }[];
}

interface Props {
  testId: string;
  title: string;
  backHref: string;
  solutionPdfUrl: string;
  sections: EditorSection[];
  initialAnchors: SolutionAnchorsData | null;
  hadStaleAnchors: boolean;
  initialQuestionId: string | null;
}

interface Row {
  id: string;
  sectionIndex: number;
  sectionName: string;
  number: number;
  /** Nhãn ngắn trên PDF, vd "C5" hoặc "P2·C5" */
  short: string;
}

type PickMode = "start" | "end" | null;

const fmt = (p: { page: number; y: number }) => `trang ${p.page} · ${Math.round(p.y)}%`;

export default function SolutionAnchorEditor({
  testId,
  title,
  backHref,
  solutionPdfUrl,
  sections,
  initialAnchors,
  hadStaleAnchors,
  initialQuestionId,
}: Props) {
  const multiSection = sections.length > 1;
  const rows: Row[] = useMemo(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.questions.map((q, i) => ({
          id: q.id,
          sectionIndex,
          sectionName: section.name || `Phần ${sectionIndex + 1}`,
          number: i + 1,
          short: multiSection ? `P${sectionIndex + 1}·C${i + 1}` : `C${i + 1}`,
        })),
      ),
    [sections, multiSection],
  );
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sectionIds = useMemo(() => sections.map((s) => s.questions.map((q) => q.id)), [sections]);

  const [data, setData] = useState<SolutionAnchorsData | null>(initialAnchors);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQuestionId && rowById.has(initialQuestionId) ? initialQuestionId : null,
  );
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [chainMode, setChainMode] = useState(true);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const analysisStartedRef = useRef(false);

  // ---------- Phân tích PDF (tự dò mốc) ----------
  const handlePdfLoad = useCallback(
    async (pdf: PDFDocumentProxy) => {
      if (analysisStartedRef.current) return;
      analysisStartedRef.current = true;
      try {
        const result = await analyzePdfCached(pdf);
        setAnalysis(result);
        if (!initialAnchors) {
          setData(buildAutoAnchors(result, sectionIds, solutionPdfUrl));
          setDirty(true); // kết quả tự động chưa được lưu
        }
      } catch (error) {
        console.error(error);
        toast.error("Không phân tích được file PDF lời giải");
        setData((prev) => prev ?? buildAutoAnchors({ numPages: 1, markers: [], layout: { top: 0, bottom: 100, left: 0, right: 100 } }, sectionIds, solutionPdfUrl));
      } finally {
        setAnalyzing(false);
      }
    },
    [initialAnchors, sectionIds, solutionPdfUrl],
  );

  // Chọn câu mặc định: câu chưa gắn đầu tiên, nếu không có thì câu đầu
  useEffect(() => {
    if (selectedId || !data) return;
    setSelectedId((rows.find((r) => !data.items[r.id]) ?? rows[0])?.id ?? null);
  }, [data, rows, selectedId]);

  // Giữ câu đang chọn trong tầm nhìn của danh sách
  useEffect(() => {
    if (!selectedId) return;
    const row = document.querySelector<HTMLElement>(`[data-row-id="${selectedId}"]`);
    const list = row?.closest("aside");
    if (!row || !list) return;
    // Chỉ cuộn trong danh sách (scrollIntoView sẽ cuộn cả trang)
    const rowTop = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (rowTop < list.scrollTop + 40 || rowTop > list.scrollTop + list.clientHeight - 60) {
      list.scrollTo({ top: rowTop - list.clientHeight / 2, behavior: "smooth" });
    }
  }, [selectedId]);

  // ---------- Cập nhật dữ liệu ----------
  const updateItems = useCallback((fn: (items: Record<string, AnchorItem>) => void) => {
    setData((prev) => {
      if (!prev) return prev;
      const items = { ...prev.items };
      fn(items);
      return { ...prev, items };
    });
    setDirty(true);
  }, []);

  const visibleRows = onlyMissing && data ? rows.filter((r) => !data.items[r.id] || r.id === selectedId) : rows;

  const moveSelection = useCallback(
    (offset: number) => {
      const list = visibleRows;
      const idx = list.findIndex((r) => r.id === selectedId);
      const next = list[Math.min(list.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + offset))];
      if (next) setSelectedId(next.id);
    },
    [visibleRows, selectedId],
  );

  const handlePageClick = useCallback(
    (page: number, y: number) => {
      if (!pickMode || !selectedId || !data) return;
      const row = rowById.get(selectedId)!;
      const point = { page, y };

      if (pickMode === "start") {
        updateItems((items) => {
          const prev = items[selectedId];
          items[selectedId] = {
            page,
            y,
            ...(prev?.end && comparePoints(prev.end, point) > 0 ? { end: prev.end } : {}),
            label: prev?.label ?? `Câu ${row.number}`,
            source: "manual",
          };
        });
        if (chainMode) {
          const idx = rows.findIndex((r) => r.id === selectedId);
          const next = rows[idx + 1];
          if (next) {
            setSelectedId(next.id);
            return; // giữ chế độ đặt điểm bắt đầu cho câu kế tiếp
          }
        }
        setPickMode(null);
        return;
      }

      const item = data.items[selectedId];
      if (!item) {
        toast.error("Hãy đặt điểm bắt đầu trước");
      } else if (comparePoints(point, item) <= 0) {
        toast.error("Điểm kết thúc phải nằm sau điểm bắt đầu");
        return;
      } else {
        updateItems((items) => {
          items[selectedId] = { ...items[selectedId], end: point, source: "manual" };
        });
      }
      setPickMode(null);
    },
    [pickMode, selectedId, data, rowById, updateItems, chainMode, rows],
  );

  const clearEnd = () =>
    selectedId &&
    updateItems((items) => {
      if (!items[selectedId]) return;
      const { end: _end, ...rest } = items[selectedId];
      items[selectedId] = { ...rest, source: "manual" };
    });

  const removeItem = () =>
    selectedId &&
    updateItems((items) => {
      delete items[selectedId];
    });

  const updateLayout = (key: keyof PdfLayout, value: number) => {
    if (!Number.isFinite(value)) return;
    setData((prev) => (prev ? { ...prev, layout: { ...prev.layout, [key]: value } } : prev));
    setDirty(true);
  };

  const redetect = () => {
    if (!analysis || !data) return;
    const auto = buildAutoAnchors(analysis, sectionIds, solutionPdfUrl);
    const manual = Object.fromEntries(Object.entries(data.items).filter(([, it]) => it.source === "manual"));
    setData({ ...auto, layout: data.layout, items: { ...auto.items, ...manual } });
    setDirty(true);
    toast.success("Đã dò lại tự động (giữ nguyên các câu đã chỉnh tay)");
  };

  const save = () => {
    if (!data) return;
    startSaving(async () => {
      const res = await saveSolutionAnchors(testId, data);
      if (res.success) {
        setDirty(false);
        toast.success(`Đã lưu vị trí lời giải cho ${"count" in res ? res.count : 0} câu`);
      } else {
        toast.error(res.error || "Không thể lưu");
      }
    });
  };

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Phím tắt: ↑/↓ chuyển câu, B đặt bắt đầu, K đặt kết thúc, Esc huỷ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape") setPickMode(null);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key.toLowerCase() === "b") setPickMode("start");
      else if (e.key.toLowerCase() === "k") setPickMode("end");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSelection]);

  // ---------- Dữ liệu hiển thị ----------
  const selectedRow = selectedId ? rowById.get(selectedId) : undefined;
  const selectedItem = selectedId && data ? data.items[selectedId] : undefined;
  const region = selectedId && data ? resolveRegion(data, selectedId) : null;
  const segments = region && data ? regionSegments(region, data.layout) : null;
  const anchoredCount = data ? rows.filter((r) => data.items[r.id]).length : 0;

  const markers: PdfOverlayMarker[] = useMemo(() => {
    if (!data) return [];
    const list: PdfOverlayMarker[] = rows
      .filter((r) => data.items[r.id])
      .map((r) => ({
        key: r.id,
        page: data.items[r.id].page,
        y: data.items[r.id].y,
        label: r.short,
        tone: r.id === selectedId ? "active" : "default",
        onClick: pickMode ? undefined : () => setSelectedId(r.id),
      }));
    if (region && selectedRow) {
      list.push({ key: "end", page: region.end.page, y: region.end.y, label: `Hết ${selectedRow.short}`, tone: "end" });
    }
    return list;
  }, [data, rows, selectedId, pickMode, region, selectedRow]);

  const scrollTarget =
    selectedItem && selectedId ? { page: selectedItem.page, yPct: selectedItem.y, key: selectedId } : null;

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Link href={backHref} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Quay lại đề">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-black text-slate-900">Gắn lời giải từng câu</h1>
          <p className="truncate text-xs font-bold text-slate-400">{title}</p>
        </div>
        <span
          className={cn(
            "rounded-xl px-3 py-1.5 text-xs font-black",
            anchoredCount === rows.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
          )}
        >
          Đã gắn {anchoredCount}/{rows.length} câu
        </span>
        <button
          onClick={redetect}
          disabled={!analysis}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="Dò lại các nhãn TDHT/Câu trong PDF, giữ nguyên câu đã chỉnh tay"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Dò lại tự động
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving || !data}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {dirty ? "Lưu" : "Đã lưu"}
        </button>
      </header>

      {(hadStaleAnchors || (!initialAnchors && data && dirty)) && (
        <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {hadStaleAnchors
            ? "File lời giải đã thay đổi nên vị trí cũ không còn dùng được. Hệ thống đã dò lại tự động — hãy kiểm tra rồi bấm Lưu."
            : `Hệ thống đã tự nhận diện ${anchoredCount}/${rows.length} câu. Kiểm tra các câu (nhất là câu "Chưa gắn") rồi bấm Lưu để học sinh dùng.`}
        </div>
      )}

      {pickMode && selectedRow && (
        <div className="flex items-center gap-2 border-b bg-blue-600 px-4 py-2 text-xs font-bold text-white">
          <Crosshair className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Bấm vào PDF tại vị trí {pickMode === "start" ? "BẮT ĐẦU" : "KẾT THÚC"} lời giải {selectedRow.short} (
            {selectedRow.sectionName} · Câu {selectedRow.number})
            {pickMode === "start" && chainMode ? " — xong sẽ tự chuyển sang câu kế tiếp" : ""}
          </span>
          <button onClick={() => setPickMode(null)} className="rounded-lg bg-white/20 px-2 py-1 hover:bg-white/30">
            Xong (Esc)
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Danh sách câu */}
        <aside className="max-h-[30vh] shrink-0 overflow-y-auto border-b custom-scrollbar lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
          <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-2 border-b bg-white px-4 py-2.5 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Chỉ câu chưa gắn
          </label>
          {sections.map((section, si) => {
            const sectionRows = visibleRows.filter((r) => r.sectionIndex === si);
            if (sectionRows.length === 0) return null;
            return (
              <div key={section.id}>
                <p className="bg-slate-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {section.name || `Phần ${si + 1}`}
                </p>
                {sectionRows.map((r) => {
                  const it = data?.items[r.id];
                  return (
                    <button
                      key={r.id}
                      data-row-id={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-sm transition-colors",
                        r.id === selectedId ? "border-blue-600 bg-blue-50" : "border-transparent hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          !it ? "bg-slate-300" : it.source === "manual" ? "bg-emerald-500" : "bg-blue-500",
                        )}
                      />
                      <span className="font-black text-slate-800">Câu {r.number}</span>
                      <span className="ml-auto text-[11px] font-bold text-slate-400">
                        {it ? `tr.${it.page}` : analyzing ? "…" : "Chưa gắn"}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="space-y-1 border-t px-4 py-3 text-[11px] font-bold text-slate-500">
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Tự động</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đã chỉnh tay</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Chưa gắn</p>
            <p className="pt-2 font-medium text-slate-400">Phím tắt: ↑/↓ chuyển câu · B đặt bắt đầu · K đặt kết thúc · Esc huỷ</p>
          </div>
        </aside>

        {/* PDF đầy đủ để đặt mốc */}
        <div className={cn("min-h-[50vh] min-w-0 flex-1 overflow-hidden bg-slate-100 lg:min-h-0", pickMode && "ring-4 ring-inset ring-blue-500/60")}>
          <PDFViewer
            url={solutionPdfUrl}
            flat
            renderTextLayer={false}
            highlightTarget={false}
            onDocumentLoad={handlePdfLoad}
            scrollTarget={scrollTarget}
            markers={markers}
            onPageClick={pickMode ? handlePageClick : undefined}
          />
        </div>

        {/* Xem trước + điều khiển */}
        <aside className="flex shrink-0 flex-col border-t lg:w-[340px] lg:border-l lg:border-t-0">
          {selectedRow ? (
            <>
              <div className="space-y-3 border-b p-4">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">
                    {selectedRow.sectionName} · Câu {selectedRow.number}
                  </span>
                  <span
                    className={cn(
                      "ml-auto rounded-lg px-2 py-0.5 text-[10px] font-black uppercase",
                      !selectedItem
                        ? "bg-slate-100 text-slate-500"
                        : selectedItem.source === "manual"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700",
                    )}
                  >
                    {!selectedItem ? "Chưa gắn" : selectedItem.source === "manual" ? "Đã chỉnh" : "Tự động"}
                  </span>
                </div>

                {region ? (
                  <p className="text-xs font-bold text-slate-500">
                    Từ {fmt(region.start)} → {fmt(region.end)}
                    {!selectedItem?.end && <span className="text-slate-400"> (kết thúc tự động)</span>}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-slate-400">Chưa có vị trí lời giải cho câu này.</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPickMode(pickMode === "start" ? null : "start")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black",
                      pickMode === "start" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Crosshair className="h-3.5 w-3.5" /> Đặt bắt đầu
                  </button>
                  <button
                    onClick={() => setPickMode(pickMode === "end" ? null : "end")}
                    disabled={!selectedItem}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black disabled:opacity-40",
                      pickMode === "end" ? "border-rose-600 bg-rose-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Flag className="h-3.5 w-3.5" /> Đặt kết thúc
                  </button>
                  <button
                    onClick={clearEnd}
                    disabled={!selectedItem?.end}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Kết thúc tự động
                  </button>
                  <button
                    onClick={removeItem}
                    disabled={!selectedItem}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Bỏ gắn
                  </button>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500">
                  <input type="checkbox" checked={chainMode} onChange={(e) => setChainMode(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  Gắn liên tiếp: đặt xong tự chuyển sang câu sau
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Học sinh sẽ thấy</p>
                <div className="p-3">
                  {segments && data ? (
                    <PdfRegionView url={solutionPdfUrl} segments={segments} layout={data.layout} className="rounded-xl border bg-white" />
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-xs font-bold text-slate-400">
                      Bấm &quot;Đặt bắt đầu&quot; rồi bấm vào PDF ở giữa để gắn lời giải cho câu này.
                    </div>
                  )}
                </div>

                <div className="border-t px-4 py-3">
                  <button
                    onClick={() => setShowLayout((v) => !v)}
                    className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Lề cắt (áp dụng cả đề) <span>{showLayout ? "−" : "+"}</span>
                  </button>
                  {showLayout && data && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["top", "Bỏ phần trên mỗi trang"],
                            ["bottom", "Bỏ từ % dưới"],
                            ["left", "Lề trái"],
                            ["right", "Lề phải"],
                          ] as [keyof PdfLayout, string][]
                        ).map(([key, label]) => (
                          <label key={key} className="space-y-1 text-[11px] font-bold text-slate-500">
                            <span>{label} (%)</span>
                            <input
                              type="number"
                              step={0.5}
                              min={0}
                              max={100}
                              value={data.layout[key]}
                              onChange={(e) => updateLayout(key, Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-800"
                            />
                          </label>
                        ))}
                      </div>
                      {analysis && (
                        <button
                          onClick={() => {
                            setData((prev) => (prev ? { ...prev, layout: analysis.layout } : prev));
                            setDirty(true);
                          }}
                          className="flex items-center gap-1.5 text-xs font-black text-blue-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Về giá trị tự nhận diện
                        </button>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Phần trên/dưới bị bỏ chỉ áp dụng ở chỗ nối khi lời giải kéo sang trang sau (để ẩn header/footer).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm font-bold text-slate-400">
              {analyzing ? "Đang phân tích file lời giải..." : "Chọn một câu ở danh sách bên trái"}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
