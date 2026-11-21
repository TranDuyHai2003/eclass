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
  Copy,
  Eraser,
  Flag,
  Keyboard,
  ListChecks,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Undo2,
  FileSearch,
  Eye,
  ScanText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveSolutionAnchors } from "@/actions/solution-anchors";
import {
  buildAutoAnchors,
  comparePoints,
  regionSegments,
  resolveRegion,
  snapToLine,
  splitRegion,
  type AnchorItem,
  type PdfAnalysis,
  type PdfLayout,
  type PdfPoint,
  type SolutionAnchorsData,
} from "@/lib/pdf-question-anchors";
import { analyzePdfCached } from "@/lib/pdf-analysis-client";
import { analyzePdfWithOcr, getCachedOcr, looksImageOnly, type OcrProgress } from "@/lib/pdf-ocr-client";
import type { PdfClickModifiers, PdfOverlayMarker } from "@/components/ui/pdf-viewer";

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

/** Bấm vào PDF sẽ đặt mốc gì cho câu đang chọn */
type Mode = "start" | "end" | "solution";
type Filter = "all" | "missing" | "warn";
type MobileTab = "list" | "pdf" | "preview";

const MODE_INFO: Record<Mode, { label: string; key: string; hint: string }> = {
  start: { label: "Bắt đầu câu", key: "B", hint: "Bấm vào PDF ở đầu câu → tự chuyển sang câu sau" },
  end: { label: "Kết thúc", key: "K", hint: "Bấm vào PDF nơi lời giải của câu kết thúc (thường không cần — tự lấy tới đầu câu sau)" },
  solution: { label: "Mốc “Lời giải”", key: "L", hint: "Bấm vào PDF ở dòng bắt đầu lời giải → học sinh chỉ thấy phần đề cho tới khi bấm “Xem đáp án”" },
};

const fmt = (p: PdfPoint) => `trang ${p.page} · ${Math.round(p.y)}%`;
const HISTORY_LIMIT = 60;

/** Cảnh báo cho một câu (để thầy rà nhanh) */
function rowWarning(data: SolutionAnchorsData, rows: Row[], i: number): string | null {
  const r = rows[i];
  const it = data.items[r.id];
  if (!it) return "Chưa gắn";
  const region = resolveRegion(data, r.id);
  if (region && region.end.page - region.start.page >= 2) return "Vùng dài hơn 2 trang";
  const prev = rows[i - 1];
  const prevIt = prev && prev.sectionIndex === r.sectionIndex ? data.items[prev.id] : undefined;
  if (prevIt && comparePoints(it, prevIt) < 0) return "Bắt đầu trước câu trước";
  return null;
}

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
  // dirty = giáo viên đã tự chỉnh; autoPending = chỉ có kết quả dò tự động chưa lưu (không chặn rời trang)
  const [dirty, setDirty] = useState(false);
  const [autoPending, setAutoPending] = useState(false);
  const unsaved = dirty || autoPending;
  const [saving, startSaving] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQuestionId && rowById.has(initialQuestionId) ? initialQuestionId : null,
  );
  const [mode, setMode] = useState<Mode>("start");
  const [chainMode, setChainMode] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showLayout, setShowLayout] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("pdf");
  const analysisStartedRef = useRef(false);
  // OCR cho file lời giải dạng ảnh
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [imageOnly, setImageOnly] = useState(false);
  const [usedOcr, setUsedOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);

  // ---------- Hoàn tác / làm lại ----------
  const undoRef = useRef<SolutionAnchorsData[]>([]);
  const redoRef = useRef<SolutionAnchorsData[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  /** Mọi thay đổi do thầy làm đều đi qua đây (để hoàn tác được) */
  const commit = useCallback((next: (prev: SolutionAnchorsData) => SolutionAnchorsData) => {
    setData((prev) => {
      if (!prev) return prev;
      undoRef.current = [...undoRef.current, prev].slice(-HISTORY_LIMIT);
      redoRef.current = [];
      return next(prev);
    });
    setDirty(true);
    setHistoryTick((t) => t + 1);
  }, []);
  const undo = useCallback(() => {
    setData((cur) => {
      const prev = undoRef.current.pop();
      if (!prev || !cur) return cur;
      redoRef.current = [...redoRef.current, cur];
      return prev;
    });
    setDirty(true);
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    setData((cur) => {
      const next = redoRef.current.pop();
      if (!next || !cur) return cur;
      undoRef.current = [...undoRef.current, cur];
      return next;
    });
    setDirty(true);
    setHistoryTick((t) => t + 1);
  }, []);
  const canUndo = historyTick >= 0 && undoRef.current.length > 0;
  const canRedo = historyTick >= 0 && redoRef.current.length > 0;

  // ---------- Phân tích PDF (tự dò mốc) ----------
  const handlePdfLoad = useCallback(
    async (pdf: PDFDocumentProxy) => {
      if (analysisStartedRef.current) return;
      analysisStartedRef.current = true;
      pdfRef.current = pdf;
      try {
        let result = await analyzePdfCached(pdf);
        let method: "text" | "ocr" = "text";
        // File lời giải là ảnh (không có lớp chữ), hoặc có chữ nhưng câu hỏi là ảnh dán vào (Word) nên không thấy nhãn nào
        // → dùng kết quả OCR đã có trên máy này, nếu chưa thì mời thầy chạy OCR
        if (result.markers.length === 0 || (await looksImageOnly(pdf).catch(() => false))) {
          setImageOnly(true);
          const cached = getCachedOcr(pdf);
          if (cached) {
            result = cached;
            method = "ocr";
            setUsedOcr(true);
          }
        }
        setAnalysis(result);
        if (!initialAnchors) {
          setData(buildAutoAnchors(result, sectionIds, solutionPdfUrl, method));
          setAutoPending(true); // kết quả tự động chưa được lưu
        }
      } catch (error) {
        console.error(error);
        toast.error("Không phân tích được file PDF lời giải");
        setData(
          (prev) =>
            prev ??
            buildAutoAnchors({ numPages: pdf.numPages, markers: [], layout: { top: 0, bottom: 100, left: 0, right: 100 } }, sectionIds, solutionPdfUrl),
        );
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
    const list = row?.closest<HTMLElement>("[data-row-list]");
    if (!row || !list) return;
    const rowTop = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (rowTop < list.scrollTop + 40 || rowTop > list.scrollTop + list.clientHeight - 60) {
      list.scrollTo({ top: rowTop - list.clientHeight / 2, behavior: "smooth" });
    }
  }, [selectedId]);

  // ---------- Dữ liệu hiển thị ----------
  const warnings = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    rows.forEach((r, i) => {
      const w = rowWarning(data, rows, i);
      if (w) map.set(r.id, w);
    });
    return map;
  }, [data, rows]);
  const warnCount = useMemo(() => [...warnings.values()].filter((w) => w !== "Chưa gắn").length, [warnings]);

  const visibleRows = useMemo(() => {
    if (!data || filter === "all") return rows;
    return rows.filter(
      (r) =>
        r.id === selectedId ||
        (filter === "missing" ? !data.items[r.id] : warnings.has(r.id)),
    );
  }, [data, filter, rows, warnings, selectedId]);

  const moveSelection = useCallback(
    (offset: number) => {
      const idx = visibleRows.findIndex((r) => r.id === selectedId);
      const next = visibleRows[Math.min(visibleRows.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + offset))];
      if (next) setSelectedId(next.id);
    },
    [visibleRows, selectedId],
  );

  /** Câu kế tiếp trong danh sách đang lọc (để "gắn liên tiếp" không nhảy ra ngoài bộ lọc) */
  const nextVisibleAfter = useCallback(
    (id: string) => {
      const idx = visibleRows.findIndex((r) => r.id === id);
      return idx >= 0 ? visibleRows[idx + 1] : undefined;
    },
    [visibleRows],
  );

  const selectedRow = selectedId ? rowById.get(selectedId) : undefined;
  const selectedItem = selectedId && data ? data.items[selectedId] : undefined;
  const region = selectedId && data ? resolveRegion(data, selectedId) : null;
  const split = region && data ? splitRegion(region, data.solutionMarks) : null;
  const layout = data?.layout ?? { top: 0, bottom: 100, left: 0, right: 100 };
  const questionSegments = split ? regionSegments(split.question, layout) : null;
  const solutionSegments = split?.solution ? regionSegments(split.solution, layout) : null;
  const anchoredCount = data ? rows.filter((r) => data.items[r.id]).length : 0;
  const previousRow = selectedId ? rows[rows.findIndex((r) => r.id === selectedId) - 1] : undefined;
  const previousItem = previousRow && data ? data.items[previousRow.id] : undefined;

  /** Mốc "Lời giải" nằm trong vùng câu đang chọn */
  const marksInRegion = useCallback(
    (d: SolutionAnchorsData, reg: { start: PdfPoint; end: PdfPoint } | null) =>
      (d.solutionMarks ?? []).filter(
        (m) => reg && comparePoints(m, { page: reg.start.page, y: reg.start.y + 0.8 }) > 0 && comparePoints(m, reg.end) < 0,
      ),
    [],
  );

  // ---------- Thao tác ----------
  const setStart = useCallback(
    (id: string, point: PdfPoint) => {
      const row = rowById.get(id);
      if (!row) return;
      commit((prev) => {
        const items = { ...prev.items };
        const old = items[id];
        // Các câu đang dùng chung điểm bắt đầu với câu này (vd 4 ý Đúng/Sai) dời theo
        const sharers = old
          ? Object.entries(items).filter(([oid, it]) => oid !== id && it.page === old.page && it.y === old.y).map(([oid]) => oid)
          : [];
        for (const qid of [id, ...sharers]) {
          const it = items[qid];
          items[qid] = {
            page: point.page,
            y: point.y,
            ...(it?.end && comparePoints(it.end, point) > 0 ? { end: it.end } : {}),
            label: it?.label ?? `Câu ${rowById.get(qid)?.number ?? row.number}`,
            source: "manual",
          };
        }
        return { ...prev, items };
      });
    },
    [commit, rowById],
  );

  const setEnd = useCallback(
    (id: string, point: PdfPoint) => {
      if (!data?.items[id]) {
        toast.error("Hãy đặt điểm bắt đầu trước");
        return false;
      }
      if (comparePoints(point, data.items[id]) <= 0) {
        toast.error("Điểm kết thúc phải nằm sau điểm bắt đầu");
        return false;
      }
      commit((prev) => ({ ...prev, items: { ...prev.items, [id]: { ...prev.items[id], end: point, source: "manual" } } }));
      return true;
    },
    [commit, data],
  );

  const setSolutionMark = useCallback(
    (point: PdfPoint) => {
      if (!data || !region) {
        toast.error("Hãy gắn điểm bắt đầu của câu trước");
        return;
      }
      if (comparePoints(point, region.start) <= 0 || comparePoints(point, region.end) >= 0) {
        toast.error("Mốc “Lời giải” phải nằm trong vùng của câu đang chọn");
        return;
      }
      commit((prev) => {
        const inside = new Set(marksInRegion(prev, region).map((m) => `${m.page}:${m.y}`));
        const marks = (prev.solutionMarks ?? []).filter((m) => !inside.has(`${m.page}:${m.y}`));
        // Lưu đúng như mark tự dò: lùi 0.6% so với mép trên dòng (splitRegion sẽ cộng lại)
        marks.push({ page: point.page, y: Math.max(0, Math.round((point.y - 0.6) * 10) / 10) });
        return { ...prev, solutionMarks: marks.sort(comparePoints) };
      });
    },
    [commit, data, region, marksInRegion],
  );

  const clearSolutionMark = () =>
    region &&
    commit((prev) => {
      const inside = new Set(marksInRegion(prev, region).map((m) => `${m.page}:${m.y}`));
      return { ...prev, solutionMarks: (prev.solutionMarks ?? []).filter((m) => !inside.has(`${m.page}:${m.y}`)) };
    });

  const handlePageClick = useCallback(
    (page: number, y: number, mods: PdfClickModifiers) => {
      if (!selectedId || !data) return;
      const point = { page, y };
      const effective: Mode = mods.alt ? "solution" : mods.shift ? "end" : mode;
      if (effective === "start") {
        setStart(selectedId, point);
        if (chainMode) {
          const next = nextVisibleAfter(selectedId);
          if (next) setSelectedId(next.id);
        }
      } else if (effective === "end") {
        if (setEnd(selectedId, point) && mode === "end") setMode("start");
      } else {
        setSolutionMark(point);
      }
    },
    [selectedId, data, mode, chainMode, nextVisibleAfter, setStart, setEnd, setSolutionMark],
  );

  /** Dùng chung lời giải với câu trước (các ý của cùng một câu Đúng/Sai, câu chung đề) */
  const copyFromPrevious = useCallback(() => {
    if (!selectedId || !previousItem) return;
    commit((prev) => ({ ...prev, items: { ...prev.items, [selectedId]: { ...previousItem, source: "manual" } } }));
    if (chainMode) moveSelection(1);
  }, [selectedId, previousItem, commit, chainMode, moveSelection]);

  const clearEnd = () =>
    selectedId &&
    commit((prev) => {
      if (!prev.items[selectedId]) return prev;
      const { end: _end, ...rest } = prev.items[selectedId];
      return { ...prev, items: { ...prev.items, [selectedId]: { ...rest, source: "manual" } } };
    });

  const removeItem = () =>
    selectedId &&
    commit((prev) => {
      const items = { ...prev.items };
      delete items[selectedId];
      return { ...prev, items };
    });

  const updateLayout = (key: keyof PdfLayout, value: number) => {
    if (!Number.isFinite(value)) return;
    commit((prev) => ({ ...prev, layout: { ...prev.layout, [key]: value } }));
  };

  /** Nhận dạng chữ trong file ảnh rồi tự cắt lại (giữ nguyên câu đã chỉnh tay) */
  const runOcr = async () => {
    const pdf = pdfRef.current;
    if (!pdf || ocrProgress) return;
    const ctrl = new AbortController();
    ocrAbortRef.current = ctrl;
    try {
      const result = await analyzePdfWithOcr(pdf, setOcrProgress, ctrl.signal);
      setAnalysis(result);
      setUsedOcr(true);
      const auto = buildAutoAnchors(result, sectionIds, solutionPdfUrl, "ocr");
      commit((prev) => {
        const manual = Object.fromEntries(Object.entries(prev.items).filter(([, it]) => it.source === "manual"));
        return { ...auto, items: { ...auto.items, ...manual } };
      });
      const found = rows.filter((r) => auto.items[r.id]).length;
      toast.success(`Nhận dạng xong: tự cắt được ${found}/${rows.length} câu. Kiểm tra lại rồi bấm Lưu.`);
    } catch (err) {
      if ((err as Error).name === "AbortError") toast("Đã huỷ nhận dạng chữ");
      else {
        console.error(err);
        toast.error("Không nhận dạng được chữ trong file (kiểm tra kết nối mạng rồi thử lại)");
      }
    } finally {
      setOcrProgress(null);
      ocrAbortRef.current = null;
    }
  };

  const redetect = () => {
    if (!analysis || !data) return;
    const auto = buildAutoAnchors(analysis, sectionIds, solutionPdfUrl);
    commit((prev) => {
      const manual = Object.fromEntries(Object.entries(prev.items).filter(([, it]) => it.source === "manual"));
      return { ...auto, layout: prev.layout, items: { ...auto.items, ...manual } };
    });
    toast.success("Đã dò lại tự động (giữ nguyên các câu đã chỉnh tay)");
  };

  const save = useCallback(() => {
    if (!data || saving) return;
    startSaving(async () => {
      const res = await saveSolutionAnchors(testId, data);
      if (res.success) {
        setDirty(false);
        setAutoPending(false);
        toast.success(`Đã lưu vị trí lời giải cho ${"count" in res ? res.count : 0} câu`);
      } else {
        toast.error(res.error || "Không thể lưu");
      }
    });
  }, [data, saving, testId]);

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Không gian làm việc toàn màn hình: khoá cuộn trang phía sau
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, []);

  // Phím tắt
  const keyRef = useRef({ moveSelection, copyFromPrevious, undo, redo, save });
  keyRef.current = { moveSelection, copyFromPrevious, undo, redo, save };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
      const k = keyRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        k.save();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        k.redo();
      } else if (mod) {
        return;
      } else if (e.key === "Escape") setMode("start");
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        k.moveSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        k.moveSelection(-1);
      } else if (e.key.toLowerCase() === "b") setMode("start");
      else if (e.key.toLowerCase() === "k") setMode("end");
      else if (e.key.toLowerCase() === "l") setMode("solution");
      else if (e.key.toLowerCase() === "g") k.copyFromPrevious();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- Mốc vẽ trên PDF ----------
  const markers: PdfOverlayMarker[] = useMemo(() => {
    if (!data) return [];
    // Các câu dùng chung một điểm bắt đầu (vd Đúng/Sai 4 ý nhập thành 4 câu) → gộp thành một nhãn
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const it = data.items[r.id];
      if (!it) continue;
      const key = `${it.page}:${it.y}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const list: PdfOverlayMarker[] = [...groups.values()].map((group) => {
      const first = group[0];
      const last = group[group.length - 1];
      const it = data.items[first.id];
      const active = group.find((r) => r.id === selectedId);
      return {
        key: first.id,
        page: it.page,
        y: it.y,
        label: group.length > 1 ? `${first.short}–${last.number}` : first.short,
        tone: active ? "active" : "default",
        onClick: () => setSelectedId((active ?? first).id),
        onDragEnd: (page, y) => setStart((active ?? first).id, { page, y }),
      };
    });
    if (region && selectedRow && selectedId) {
      list.push({
        key: "end",
        page: region.end.page,
        y: region.end.y,
        label: `Hết ${selectedRow.short}${selectedItem?.end ? "" : " (tự động)"}`,
        tone: "end",
        onDragEnd: (page, y) => setEnd(selectedId, { page: region.end.page === page ? page : region.end.page, y }),
      });
      for (const m of marksInRegion(data, region)) {
        list.push({
          key: `sol-${m.page}-${m.y}`,
          page: m.page,
          y: Math.min(100, m.y + 0.6),
          label: "Lời giải",
          tone: "solution",
          onDragEnd: (page, y) => setSolutionMark({ page, y }),
        });
      }
    }
    return list;
  }, [data, rows, selectedId, region, selectedRow, selectedItem, setStart, setEnd, setSolutionMark, marksInRegion]);

  const scrollTarget =
    selectedItem && selectedId ? { page: selectedItem.page, yPct: selectedItem.y, key: selectedId } : null;
  const snapY = useCallback((page: number, y: number) => snapToLine(analysis?.lineTops, page, y), [analysis]);
  const hoverLabel = useCallback(
    (mods: PdfClickModifiers) => {
      const m: Mode = mods.alt ? "solution" : mods.shift ? "end" : mode;
      const who = selectedRow?.short ?? "";
      return m === "start" ? `Bắt đầu ${who}` : m === "end" ? `Hết ${who}` : `Lời giải ${who}`;
    },
    [mode, selectedRow],
  );

  // ---------- Giao diện ----------
  const progress = rows.length ? Math.round((anchoredCount / rows.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-100" data-testid="anchor-editor">
      {/* Thanh trên */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:gap-3 sm:px-4">
        <Link href={backHref} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100" aria-label="Quay lại đề">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 truncate font-black text-slate-900">
            <Scissors className="h-4 w-4 shrink-0 text-blue-600" /> Cắt lời giải từng câu
          </h1>
          <p className="truncate text-xs font-bold text-slate-500">{title}</p>
        </div>
        <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
          <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100 sm:w-36 sm:flex-none" aria-hidden>
            <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${progress}%` }} />
          </div>
          <span className={cn("shrink-0 text-xs font-black", progress === 100 ? "text-emerald-700" : "text-slate-600")} data-testid="anchor-progress">
            {anchoredCount}/{rows.length} câu
          </span>
          {warnCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("warn")}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 hover:bg-amber-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> {warnCount} cần kiểm tra
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={!canUndo} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Làm lại (Ctrl+Shift+Z)" aria-label="Làm lại" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        {ocrProgress ? (
          <div className="flex h-9 items-center gap-2 rounded-xl bg-violet-50 px-3 text-xs font-black text-violet-700" data-testid="ocr-progress">
            <Loader2 className="h-4 w-4 animate-spin" />
            {ocrProgress.phase === "init" ? "Đang tải bộ nhận dạng…" : `Đang đọc trang ${ocrProgress.page}/${ocrProgress.total}`}
            <button type="button" onClick={() => ocrAbortRef.current?.abort()} aria-label="Huỷ nhận dạng" className="rounded-md p-0.5 hover:bg-violet-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={runOcr}
            disabled={!pdfRef.current || analyzing}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-xs font-black disabled:opacity-50",
              imageOnly && !usedOcr ? "border-violet-500 bg-violet-600 text-white hover:bg-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
            title="Nhận dạng chữ trong file (dùng cho file lời giải là ảnh scan / in ra PDF từ ảnh)"
            data-testid="ocr-run"
          >
            <ScanText className="h-4 w-4" />
            <span className="hidden sm:inline">{usedOcr ? "Nhận dạng lại" : "Nhận dạng chữ"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={redetect}
          disabled={!analysis}
          className="flex h-9 items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="Dò lại các nhãn TDHT/Câu trong PDF, giữ nguyên câu đã chỉnh tay"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">Dò lại tự động</span>
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!unsaved || saving || !data}
          className="btn-3d btn-3d-blue h-9 px-4 text-xs disabled:opacity-50"
          title="Lưu (Ctrl+S)"
          data-testid="anchor-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : unsaved ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {unsaved ? "Lưu" : "Đã lưu"}
        </button>
      </header>

      {imageOnly && !usedOcr && !ocrProgress && (
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800" data-testid="ocr-banner">
          <ScanText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Không tìm thấy nhãn câu trong lớp chữ của file (file chụp/in thành <b>ảnh</b>, hoặc câu hỏi là ảnh dán vào). Bấm <b>Nhận dạng chữ</b> để máy tự đọc nhãn
            “Câu/TDHT” và cắt — khoảng 2–4 giây/trang, chỉ cần làm một lần rồi Lưu.
          </span>
          <button type="button" onClick={runOcr} disabled={!pdfRef.current} className="btn-3d btn-3d-blue px-3 py-1.5 text-xs">
            <ScanText className="h-3.5 w-3.5" /> Nhận dạng chữ
          </button>
        </div>
      )}

      {(hadStaleAnchors || (!initialAnchors && data && autoPending)) && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {hadStaleAnchors
            ? "File lời giải đã thay đổi nên vị trí cũ không còn dùng được. Hệ thống đã dò lại tự động — hãy kiểm tra rồi bấm Lưu."
            : `Hệ thống đã tự nhận diện ${anchoredCount}/${rows.length} câu. Kiểm tra (nhất là câu "Chưa gắn" / "Cần kiểm tra") rồi bấm Lưu để học sinh dùng.`}
        </div>
      )}

      {/* Điện thoại: 3 tab */}
      <div className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-white p-1.5 lg:hidden">
        {(
          [
            ["list", "Danh sách", ListChecks],
            ["pdf", "PDF", FileSearch],
            ["preview", "Xem trước", Eye],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMobileTab(key)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black",
              mobileTab === key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Danh sách câu */}
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-64",
            mobileTab === "list" ? "flex" : "hidden",
          )}
        >
          <div className="grid grid-cols-3 gap-1 border-b border-slate-100 p-2">
            {(
              [
                ["all", "Tất cả"],
                ["missing", "Chưa gắn"],
                ["warn", "Cần xem"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  "rounded-lg px-1 py-1.5 text-[11px] font-black",
                  filter === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar" data-row-list>
            {sections.map((section, si) => {
              const sectionRows = visibleRows.filter((r) => r.sectionIndex === si);
              if (sectionRows.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span className="truncate">{section.name || `Phần ${si + 1}`}</span>
                    <span className="shrink-0 normal-case tracking-normal">
                      {section.questions.filter((q) => data?.items[q.id]).length}/{section.questions.length}
                    </span>
                  </p>
                  {sectionRows.map((r) => {
                    const it = data?.items[r.id];
                    const warn = warnings.get(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        data-row-id={r.id}
                        onClick={() => {
                          setSelectedId(r.id);
                          if (mobileTab === "list") setMobileTab("pdf");
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-sm transition-colors",
                          r.id === selectedId ? "border-blue-600 bg-blue-50" : "border-transparent hover:bg-slate-50",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            !it ? "bg-slate-300" : warn ? "bg-amber-500" : it.source === "manual" ? "bg-emerald-500" : "bg-blue-500",
                          )}
                        />
                        <span className="font-black text-slate-800">Câu {r.number}</span>
                        <span className={cn("ml-auto truncate text-[11px] font-bold", warn && it ? "text-amber-700" : "text-slate-500")}>
                          {!it ? (analyzing ? "…" : "Chưa gắn") : warn ?? `tr.${it.page}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {visibleRows.length === 0 && <p className="p-6 text-center text-xs font-bold text-slate-500">Không có câu nào trong bộ lọc này 🎉</p>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Tự động</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Đã chỉnh</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Cần xem</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> Chưa gắn</span>
          </div>
        </aside>

        {/* PDF đầy đủ để đặt mốc */}
        <section className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", mobileTab === "pdf" ? "flex" : "hidden")}>
          {/* Chế độ đặt mốc */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Bấm vào PDF để đặt">
              {(["start", "end", "solution"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black transition-colors",
                    mode === m
                      ? m === "start"
                        ? "bg-white text-blue-700 shadow-sm"
                        : m === "end"
                          ? "bg-white text-rose-600 shadow-sm"
                          : "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {MODE_INFO[m].label}
                  <kbd className="hidden rounded bg-slate-200 px-1 text-[10px] text-slate-600 sm:inline">{MODE_INFO[m].key}</kbd>
                </button>
              ))}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500">
              {selectedRow ? (
                <>
                  <b className="text-slate-800">{selectedRow.sectionName} · Câu {selectedRow.number}</b> — {MODE_INFO[mode].hint}
                </>
              ) : (
                "Chọn một câu ở danh sách"
              )}
            </p>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-600">
              <input type="checkbox" checked={chainMode} onChange={(e) => setChainMode(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              Gắn liên tiếp
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PDFViewer
              url={solutionPdfUrl}
              flat
              renderTextLayer={false}
              highlightTarget={false}
              onDocumentLoad={handlePdfLoad}
              scrollTarget={scrollTarget}
              markers={markers}
              onPageClick={selectedId && data ? handlePageClick : undefined}
              hoverLabel={selectedId && data ? hoverLabel : undefined}
              snapY={snapY}
              maxPageWidth={1000}
            />
          </div>
        </section>

        {/* Xem trước + điều khiển */}
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white custom-scrollbar lg:flex lg:w-[360px]",
            mobileTab === "preview" ? "flex" : "hidden",
          )}
        >
          {selectedRow ? (
            <>
              <div className="space-y-3 border-b border-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">
                    {selectedRow.sectionName} · Câu {selectedRow.number}
                  </span>
                  <span
                    className={cn(
                      "ml-auto rounded-lg px-2 py-0.5 text-[10px] font-black uppercase",
                      !selectedItem ? "bg-slate-100 text-slate-500" : selectedItem.source === "manual" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
                    )}
                  >
                    {!selectedItem ? "Chưa gắn" : selectedItem.source === "manual" ? "Đã chỉnh" : "Tự động"}
                  </span>
                </div>
                {warnings.get(selectedRow.id) && selectedItem && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {warnings.get(selectedRow.id)}
                  </p>
                )}
                {region ? (
                  <p className="text-xs font-bold text-slate-500">
                    Từ {fmt(region.start)} → {fmt(region.end)}
                    {!selectedItem?.end && <span className="text-slate-400"> (kết thúc tự động)</span>}
                    {split?.solution ? <span className="text-emerald-700"> · có mốc Lời giải</span> : <span className="text-amber-700"> · chưa tách Lời giải</span>}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-slate-500">Chưa có vị trí — bấm vào PDF ở đầu câu này.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={clearEnd} disabled={!selectedItem?.end} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    <Flag className="h-3.5 w-3.5" /> Kết thúc tự động
                  </button>
                  <button type="button" onClick={clearSolutionMark} disabled={!split?.solution} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    <Eraser className="h-3.5 w-3.5" /> Bỏ mốc Lời giải
                  </button>
                  <button type="button" onClick={removeItem} disabled={!selectedItem} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    <Eraser className="h-3.5 w-3.5" /> Bỏ gắn câu
                  </button>
                  <button
                    type="button"
                    onClick={copyFromPrevious}
                    disabled={!previousItem}
                    title="Dùng chung lời giải với câu trước (vd các ý của cùng một câu Đúng/Sai) · phím G"
                    className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 px-2 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" /> Giống câu trước
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-3" data-testid="anchor-preview">
                <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Học sinh sẽ thấy</p>
                {questionSegments && questionSegments.length > 0 && data ? (
                  <>
                    <div>
                      <p className="mb-1 px-1 text-[11px] font-black text-slate-600">Đề bài</p>
                      <PdfRegionView url={solutionPdfUrl} segments={questionSegments} layout={data.layout} className="rounded-xl border bg-white" />
                    </div>
                    {solutionSegments && solutionSegments.length > 0 && (
                      <div>
                        <p className="mb-1 px-1 text-[11px] font-black text-rose-600">Sau khi bấm “Xem đáp án chi tiết”</p>
                        <PdfRegionView url={solutionPdfUrl} segments={solutionSegments} layout={data.layout} className="rounded-xl border border-rose-200 bg-white" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500">
                    Bấm vào PDF ở đầu câu này để gắn lời giải.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-3">
                <button type="button" onClick={() => setShowLayout((v) => !v)} className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                        type="button"
                        onClick={() => commit((prev) => ({ ...prev, layout: analysis.layout }))}
                        className="flex items-center gap-1.5 text-xs font-black text-blue-600"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Về giá trị tự nhận diện
                      </button>
                    )}
                    <p className="text-[11px] text-slate-500">Phần trên/dưới bị bỏ chỉ áp dụng ở chỗ nối khi lời giải kéo sang trang sau (để ẩn header/footer).</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm font-bold text-slate-500">
              {analyzing ? "Đang phân tích file lời giải..." : "Chọn một câu ở danh sách bên trái"}
            </div>
          )}
        </aside>
      </div>

      {/* Gợi ý phím tắt */}
      <footer className="hidden items-center gap-4 border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-slate-500 lg:flex">
        <Keyboard className="h-3.5 w-3.5 shrink-0" />
        <span><kbd className="font-black text-slate-700">Bấm</kbd> đặt theo chế độ</span>
        <span><kbd className="font-black text-slate-700">Shift+bấm</kbd> kết thúc</span>
        <span><kbd className="font-black text-slate-700">Alt+bấm</kbd> mốc Lời giải</span>
        <span><kbd className="font-black text-slate-700">Kéo nhãn</kbd> dời mốc</span>
        <span><kbd className="font-black text-slate-700">↑ ↓</kbd> chuyển câu</span>
        <span><kbd className="font-black text-slate-700">G</kbd> giống câu trước</span>
        <span><kbd className="font-black text-slate-700">Ctrl+Z</kbd> hoàn tác</span>
        <span><kbd className="font-black text-slate-700">Ctrl+S</kbd> lưu</span>
      </footer>
    </div>
  );
}

export type { AnchorItem };
