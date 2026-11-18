"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  LayoutGrid,
  FileText,
  Headphones,
  Image as ImageIcon,
  Info,
  ListChecks,
  Maximize2,
  PencilLine,
  ZoomIn,
  ZoomOut,
  Loader2,
  MessageSquareText,
  Trophy,
  Video,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import VideoPlayer from "@/components/player/VideoPlayer";
import { GradeEssay } from "@/components/teacher/test-builder/GradeEssay";
import { cn } from "@/lib/utils";
import {
  buildAutoAnchors,
  regionSegments,
  resolveRegion,
  splitRegion,
  type SolutionAnchorsData,
} from "@/lib/pdf-question-anchors";
import { analyzePdfCached } from "@/lib/pdf-analysis-client";
import { ReuploadForm } from "./ReuploadForm";

const PdfRegionView = dynamic(() => import("@/components/pdf/PdfRegionView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Đang tải lời giải...
    </div>
  ),
});

const PdfDocumentLoader = dynamic(() => import("@/components/pdf/PdfRegionView").then((m) => m.PdfDocumentLoader), {
  ssr: false,
});

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm font-bold text-slate-400">
      Đang tải tài liệu...
    </div>
  ),
});

// ---------- Kiểu dữ liệu (chỉ các trường dùng tới) ----------

interface ReviewSubQuestion {
  id: string;
  correctAnswer: string;
  position: number;
}

interface ReviewQuestion {
  id: string;
  type: string;
  points: number;
  correctAnswer: string | null;
  explanation: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  subQuestions: ReviewSubQuestion[];
}

interface ReviewSection {
  id: string;
  name: string;
  questions: ReviewQuestion[];
}

interface ReviewAnswer {
  id: string;
  questionId: string;
  answerProvided: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
  feedback: string | null;
  subAnswers: { subQuestionId: string; answerProvided: string | null; isCorrect: boolean | null }[];
}

interface ResultReviewProps {
  attemptId: string;
  testId: string;
  pdfUrl: string;
  solutionPdfUrl: string | null;
  /** Mốc lời giải đã lưu (đã kiểm tra khớp file lời giải hiện tại) */
  solutionAnchors: SolutionAnchorsData | null;
  solutionVideos: { title?: string; url: string }[];
  sections: ReviewSection[];
  answers: ReviewAnswer[];
  canSeeAnswers: boolean;
  isTeacher: boolean;
  score: number;
  /** Thời gian làm bài (giây), null nếu chưa nộp */
  durationSeconds: number | null;
  /** Thời điểm nộp bài đã định dạng (giờ Việt Nam), vd "00:13:15 16/11/2026" */
  completedLabel: string | null;
  /** Nút quay lại (về bài học) ở đầu thanh công cụ */
  backHref: string;
  /** Tên bài kiểm tra */
  title: string;
  /** Ngày bắt đầu làm (dd/MM/yyyy) — hiển thị khi bài chưa nộp */
  startedLabel: string;
  /** Nút thao tác thêm ở cuối thanh công cụ (vd. giáo viên "Cho phép sửa bài") */
  headerAction?: React.ReactNode;
}

type Status = "correct" | "wrong" | "blank" | "pending" | "ungraded";
type Tab = "review" | "paper" | "video";

interface FlatQuestion {
  q: ReviewQuestion;
  sectionIndex: number;
  sectionName: string;
  number: number; // số thứ tự trong phần
  answer: ReviewAnswer | undefined;
  status: Status;
}

// ---------- Helpers hiển thị đáp án ----------

function cleanStudentAnswer(ans: string | undefined | null) {
  if (!ans) return "";
  if (ans.startsWith("http://") || ans.startsWith("https://")) {
    try {
      return decodeURIComponent(new URL(ans).pathname.split("/").pop() || ans);
    } catch {
      return decodeURIComponent(ans.split("/").pop() || ans);
    }
  }
  return ans;
}

const tfLabel = (v: string) => (v.trim() === "T" ? "Đúng" : v.trim() === "F" ? "Sai" : v);

function formatStudentAnswer(q: ReviewQuestion, ans: ReviewAnswer | undefined) {
  const cleaned = cleanStudentAnswer(ans?.answerProvided);
  if (!cleaned) return "Bỏ trống";
  if (q.type === "TRUE_FALSE") return cleaned.split(",").map(tfLabel).join(", ");
  return cleaned;
}

function formatCorrectAnswer(q: ReviewQuestion) {
  const raw = q.correctAnswer || "";
  if (q.type === "TRUE_FALSE") {
    return raw.split(/[,|]/).map(tfLabel).join(raw.includes("|") ? " hoặc " : ", ");
  }
  return raw.includes("|") ? raw.split("|").join(" hoặc ") : raw;
}

function hasAnswer(ans: ReviewAnswer | undefined) {
  if (!ans) return false;
  if (ans.answerProvided && ans.answerProvided.trim()) return true;
  return ans.subAnswers?.some((s) => !!s.answerProvided?.trim()) ?? false;
}

function getStatus(q: ReviewQuestion, ans: ReviewAnswer | undefined): Status {
  if (q.points === 0) return "ungraded";
  if (q.type === "ESSAY" && ans && ans.isCorrect === null) return "pending";
  if (ans?.isCorrect === true) return "correct";
  if (!hasAnswer(ans)) return "blank";
  return "wrong";
}

// Màu theo trạng thái: đúng = xanh lá, sai = đỏ hồng, bỏ trống = xám, chờ chấm = tím, không tính điểm = vàng
const STATUS_STYLE: Record<Status, { cell: string; label: string; text: string; card: string; badge: string }> = {
  correct: {
    cell: "bg-emerald-100 text-emerald-700 border-emerald-200",
    label: "Đúng",
    text: "text-emerald-600",
    card: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-500 text-white",
  },
  wrong: {
    cell: "bg-rose-100 text-rose-700 border-rose-200",
    label: "Sai",
    text: "text-rose-600",
    card: "bg-rose-50 border-rose-200",
    badge: "bg-rose-500 text-white",
  },
  blank: {
    cell: "bg-slate-100 text-slate-500 border-slate-200",
    label: "Bỏ trống",
    text: "text-slate-500",
    card: "bg-slate-50 border-dashed border-slate-300",
    badge: "bg-slate-400 text-white",
  },
  pending: {
    cell: "bg-violet-100 text-violet-700 border-violet-200",
    label: "Chờ chấm",
    text: "text-violet-600",
    card: "bg-violet-50 border-violet-200",
    badge: "bg-violet-500 text-white",
  },
  ungraded: {
    cell: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Không tính điểm",
    text: "text-amber-700",
    card: "bg-amber-50 border-amber-200",
    badge: "bg-amber-500 text-white",
  },
};

// ---------- Component ----------

export function ResultReview({
  attemptId,
  testId,
  pdfUrl,
  solutionPdfUrl,
  solutionAnchors,
  solutionVideos,
  sections,
  answers,
  canSeeAnswers,
  isTeacher,
  score,
  durationSeconds,
  completedLabel,
  backHref,
  title,
  startedLabel,
  headerAction,
}: ResultReviewProps) {
  const answerMap = useMemo(() => new Map(answers.map((a) => [a.questionId, a])), [answers]);

  const flat: FlatQuestion[] = useMemo(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.questions.map((q, i) => {
          const answer = answerMap.get(q.id);
          return {
            q,
            sectionIndex,
            sectionName: section.name,
            number: i + 1,
            answer,
            status: getStatus(q, answer),
          };
        }),
      ),
    [sections, answerMap],
  );

  const counts = useMemo(() => {
    const c: Record<Status, number> = { correct: 0, wrong: 0, blank: 0, pending: 0, ungraded: 0 };
    flat.forEach((f) => c[f.status]++);
    return c;
  }, [flat]);

  const [onlyWrong, setOnlyWrong] = useState(false);
  const visible = useMemo(
    () => (onlyWrong ? flat.filter((f) => f.status === "wrong" || f.status === "blank") : flat),
    [flat, onlyWrong],
  );

  // Mặc định mở câu sai/bỏ trống đầu tiên
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (flat.find((f) => f.status === "wrong" || f.status === "blank") ?? flat[0])?.q.id ?? null,
  );
  const selected = flat.find((f) => f.q.id === selectedId) ?? visible[0] ?? null;
  const selectedVisibleIndex = selected ? visible.findIndex((f) => f.q.id === selected.q.id) : -1;

  // Bật lọc "chỉ câu sai" khi đang xem câu đúng → chuyển sang câu đầu tiên trong danh sách lọc
  useEffect(() => {
    if (selectedVisibleIndex === -1 && visible.length > 0) setSelectedId(visible[0].q.id);
  }, [selectedVisibleIndex, visible]);

  const [tab, setTab] = useState<Tab>(canSeeAnswers ? "review" : "paper");
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(() => new Set([canSeeAnswers ? "review" : "paper"]));
  const openTab = (t: Tab) => {
    setTab(t);
    setMountedTabs((prev) => new Set(prev).add(t));
  };

  const [gridOpen, setGridOpen] = useState(false);
  // Máy tính: bảng kết quả ở bên phải (giống điện thoại), thu gọn được
  const [panelOpen, setPanelOpen] = useState(true);
  const openResultPanel = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setPanelOpen(true);
    else setGridOpen(true);
  };

  const goTo = useCallback(
    (offset: number) => {
      if (visible.length === 0) return;
      const base = selectedVisibleIndex === -1 ? 0 : selectedVisibleIndex;
      const next = visible[Math.min(visible.length - 1, Math.max(0, base + offset))];
      if (next) setSelectedId(next.q.id);
    },
    [visible, selectedVisibleIndex],
  );

  // Phím ← / → để chuyển câu
  useEffect(() => {
    if (tab !== "review") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "ArrowLeft") goTo(-1);
      if (e.key === "ArrowRight") goTo(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, goTo]);

  // Vị trí lời giải từng câu: ưu tiên mốc giáo viên đã lưu, nếu chưa có thì tự dò trong PDF
  const reviewPdfUrl = solutionPdfUrl || pdfUrl;
  const [autoAnchors, setAutoAnchors] = useState<SolutionAnchorsData | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const analysisStartedRef = useRef(false);
  const anchorsData = solutionAnchors ?? autoAnchors;
  const anchorsReady = anchorsData !== null || analysisFailed;

  const handleReviewPdfLoad = useCallback(
    async (pdf: PDFDocumentProxy) => {
      if (solutionAnchors || analysisStartedRef.current) return;
      analysisStartedRef.current = true;
      try {
        const analysis = await analyzePdfCached(pdf);
        setAutoAnchors(
          buildAutoAnchors(analysis, sections.map((s) => s.questions.map((q) => q.id)), reviewPdfUrl),
        );
      } catch (error) {
        console.error("[ResultReview] Không dò được vị trí câu trong PDF", error);
        setAnalysisFailed(true);
      }
    },
    [solutionAnchors, sections, reviewPdfUrl],
  );

  const region = selected && anchorsData ? resolveRegion(anchorsData, selected.q.id) : null;
  const segments = region && anchorsData ? regionSegments(region, anchorsData.layout) : null;

  // Tải file lời giải một lần, dùng chung cho phần đề và phần lời giải của mọi câu
  const [reviewPdf, setReviewPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const onReviewPdfLoaded = useCallback(
    (pdf: PDFDocumentProxy) => {
      setReviewPdf(pdf);
      handleReviewPdfLoad(pdf);
    },
    [handleReviewPdfLoad],
  );

  // Tách vùng của câu: phần đề (luôn hiện) và phần lời giải (bấm "Xem đáp án chi tiết")
  const split = region ? splitRegion(region, anchorsData?.solutionMarks) : null;
  const layout = anchorsData?.layout ?? { top: 0, bottom: 100, left: 0, right: 100 };
  const questionSegments = split ? regionSegments(split.question, layout) : null;
  const solutionSegments = split?.solution ? regionSegments(split.solution, layout) : null;
  // Đang dò vị trí câu / tải file (chỉ ở lần mở đầu; kết quả dò được lưu lại trên trình duyệt)
  const questionVisualLoading = !questionSegments && !pdfFailed && (!anchorsReady || !reviewPdf);

  // Câu không tách riêng được → hiện toàn bộ đề gốc ngay trong thẻ câu. Nếu file đề cũng là file đã dò
  // (không có file lời giải riêng) thì cuộn sẵn tới ngay sau câu liền trước đã tách được.
  let paperGuess: { page: number; yPct: number; key: string; label?: string } | null = null;
  if (selected && !questionSegments && !solutionPdfUrl && anchorsData) {
    const idx = flat.findIndex((f) => f.q.id === selected.q.id);
    for (let i = idx - 1; i >= 0 && !paperGuess; i--) {
      const prev = resolveRegion(anchorsData, flat[i].q.id);
      if (prev) paperGuess = { page: prev.end.page, yPct: Math.max(0, prev.end.y - 1), key: selected.q.id };
    }
  }

  const [showSolution, setShowSolution] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showWholeFile, setShowWholeFile] = useState(false);
  const [showAnswerOnly, setShowAnswerOnly] = useState(false);
  const [wholeFileMounted, setWholeFileMounted] = useState(false);
  // Sang câu khác thì thu gọn lại như LAB Study
  useEffect(() => {
    setShowSolution(false);
    setShowVideo(false);
    setShowWholeFile(false);
    setShowAnswerOnly(false);
  }, [selectedId]);
  useEffect(() => {
    if (showWholeFile) setWholeFileMounted(true);
  }, [showWholeFile]);

  const [focusZoom, setFocusZoomState] = useState(1);
  // Nhớ mức phóng to (site tắt pinch-zoom nên học sinh dùng nút +/−)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("result-solution-zoom"));
      if (saved >= 1 && saved <= 2.5) setFocusZoomState(saved);
    } catch {
      // localStorage bị chặn — dùng mặc định
    }
  }, []);
  const setFocusZoom = (update: (z: number) => number) =>
    setFocusZoomState((z) => {
      const next = update(z);
      try {
        localStorage.setItem("result-solution-zoom", String(next));
      } catch {
        // bỏ qua
      }
      return next;
    });

  const scrollTarget = region
    ? { page: region.start.page, yPct: region.start.y, key: selected!.q.id, label: region.label }
    : null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "review", label: "Chữa từng câu", icon: <ListChecks className="w-4 h-4" />, show: canSeeAnswers },
    { id: "paper", label: "Đề gốc", icon: <FileText className="w-4 h-4" />, show: true },
    {
      id: "video",
      label: `Video chữa${solutionVideos.length > 1 ? ` (${solutionVideos.length})` : ""}`,
      icon: <Video className="w-4 h-4" />,
      show: canSeeAnswers && solutionVideos.length > 0,
    },
  ];

  const grid = (
    <QuestionGrid
      sections={sections}
      flat={flat}
      visibleIds={new Set(visible.map((f) => f.q.id))}
      selectedId={selected?.q.id ?? null}
      onSelect={(id) => {
        setSelectedId(id);
        setGridOpen(false);
      }}
      onlyWrong={onlyWrong}
      onToggleOnlyWrong={() => setOnlyWrong((v) => !v)}
      counts={counts}
      score={score}
      durationSeconds={durationSeconds}
    />
  );

  const visibleTabs = tabs.filter((t) => t.show);
  const tabButtons = visibleTabs.map((t) => (
    <button
      key={t.id}
      onClick={() => openTab(t.id)}
      aria-pressed={tab === t.id}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black transition-colors md:flex-none md:text-sm",
        tab === t.id ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "text-slate-500 hover:bg-white hover:text-slate-900 md:hover:bg-white",
      )}
    >
      {t.icon}
      {t.label}
    </button>
  ));
  const subtitle = [
    completedLabel ? `Nộp lúc ${completedLabel}` : `Bắt đầu ${startedLabel} · chưa nộp`,
    durationSeconds !== null ? `làm trong ${formatDuration(durationSeconds)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {/* Thanh công cụ gọn: quay lại · tên bài · tab · điểm (điện thoại: tab xuống hàng thứ hai) */}
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-2 px-2 md:gap-3 md:px-4">
          <Link
            href={backHref}
            aria-label="Quay lại bài học"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1 lg:max-w-[38%] lg:flex-none">
            <h1 className="truncate text-sm font-black text-slate-900 md:text-base" title={title}>
              {title}
            </h1>
            <p className="truncate text-[11px] font-semibold text-slate-400">{subtitle}</p>
          </div>

          {visibleTabs.length > 1 && <nav className="ml-1 hidden md:flex items-center gap-1 rounded-xl bg-slate-100 p-1">{tabButtons}</nav>}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* Bảng bên phải đã có số câu đúng/sai → chỉ hiện ở thanh trên khi bảng đó không hiển thị */}
            <div className={cn("hidden xl:flex gap-1.5 text-xs font-black", tab === "review" && panelOpen && "xl:hidden")}>
              <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">Đúng {counts.correct}</span>
              <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700">Sai {counts.wrong}</span>
              {counts.blank > 0 && <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">Trống {counts.blank}</span>}
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1.5 text-white shadow-sm shadow-indigo-200 md:px-3">
              <Trophy className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-black md:text-base">
                {score.toFixed(2)}
                <span className="text-xs font-bold text-indigo-200">/10</span>
              </span>
            </div>
            {headerAction}
          </div>
        </div>
        {visibleTabs.length > 1 && <nav className="flex gap-1 px-2 pb-2 md:hidden">{tabButtons}</nav>}
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* TAB: Chữa từng câu */}
        {canSeeAnswers && mountedTabs.has("review") && (
          <div className={cn("absolute inset-0 flex bg-slate-100", tab !== "review" && "hidden")}>
            {!pdfFailed && (
              <PdfDocumentLoader url={reviewPdfUrl} onLoad={onReviewPdfLoaded} onError={() => setPdfFailed(true)} />
            )}

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {selected ? (
                  <article className="mx-auto w-full max-w-5xl p-2 sm:p-3 md:p-6">
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-6">
                      {/* Số câu + phần */}
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-black text-slate-700">
                          {selected.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-400">{selected.sectionName}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setFocusZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                            disabled={focusZoom <= 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                            aria-label="Thu nhỏ"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setFocusZoom((z) => Math.min(2.5, z + 0.25))}
                            disabled={focusZoom >= 2.5}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                            aria-label="Phóng to"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                          {isTeacher && solutionPdfUrl && (
                            <Link
                              href={`/teacher/tests/solutions/${testId}?q=${selected.q.id}`}
                              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-slate-500 hover:bg-slate-100"
                              title="Chỉnh vị trí lời giải"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Chỉnh</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Đề bài (cắt từ file) */}
                      {questionSegments ? (
                        <PdfRegionView
                          url={reviewPdfUrl}
                          pdf={reviewPdf}
                          segments={questionSegments}
                          layout={layout}
                          zoom={focusZoom}
                          placeholder={null}
                        />
                      ) : questionVisualLoading ? (
                        // Giữ sẵn chỗ khi đang dò vị trí câu → nội dung bên dưới không bị đẩy xuống khi đề hiện ra (giảm giật bố cục)
                        <div className="flex min-h-[38vh] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Đang tải đề bài...
                          </span>
                        </div>
                      ) : (
                        // Không tách được câu này → cho xem luôn toàn bộ đề gốc (file đề, không chứa lời giải)
                        // Điện thoại: tràn sát mép thẻ để trang đề rộng nhất có thể
                        <div className="-mx-3 overflow-hidden border-y border-amber-200 bg-amber-50/50 sm:mx-0 sm:rounded-xl sm:border-x">
                          <p className="flex items-start gap-2 px-3 py-2 text-xs font-bold text-amber-800 sm:text-sm">
                            <Info className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              Chưa tách riêng được câu này — dưới đây là toàn bộ đề, em tìm{" "}
                              <b className="font-black">Câu {selected.number}</b>
                              {sections.length > 1 && <> ({selected.sectionName})</>} nhé.
                            </span>
                          </p>
                          <div className="h-[62vh] border-t border-amber-200 bg-slate-100 md:h-[68vh]">
                            <PDFViewer
                              url={pdfUrl}
                              flat
                              maxPageWidth={900}
                              scrollTarget={paperGuess}
                              highlightTarget={false}
                              renderTextLayer={false}
                              renderLeft={
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Toàn bộ đề</span>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Đợi đề của câu sẵn sàng rồi mới vẽ phần trả lời bên dưới: phần này xuất hiện lần đầu
                          (không bị xô lệch) thay vì bị đẩy lên/xuống khi đề hiện ra → hết giật bố cục ở lần mở đầu */}
                      {!questionVisualLoading && (
                      <QuestionCard
                        item={selected}
                        isTeacher={isTeacher}
                        attemptId={attemptId}
                        hasSolutionFile={!!solutionPdfUrl}
                        solutionOpen={
                          !solutionPdfUrl ? showAnswerOnly : solutionSegments ? showSolution : showWholeFile
                        }
                        onToggleSolution={() =>
                          !solutionPdfUrl
                            ? setShowAnswerOnly((v) => !v)
                            : solutionSegments
                              ? setShowSolution((v) => !v)
                              : setShowWholeFile((v) => !v)
                        }
                        hasVideo={solutionVideos.length > 0 || !!selected.q.videoUrl}
                        videoOpen={showVideo}
                        onToggleVideo={() => setShowVideo((v) => !v)}
                      >
                        {/* Đáp án chi tiết (bung ra ngay dưới, như LAB Study) */}
                        {solutionSegments && showSolution && (
                          <div className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50/40">
                            <p className="px-4 pt-3 text-sm font-black text-rose-600">Đáp án chi tiết:</p>
                            <div className="p-1 sm:p-2 md:p-3">
                              <PdfRegionView
                                url={reviewPdfUrl}
                                pdf={reviewPdf}
                                segments={solutionSegments}
                                layout={layout}
                                zoom={focusZoom}
                                className="rounded-lg bg-white"
                              />
                            </div>
                            <button
                              onClick={() => setShowWholeFile((v) => !v)}
                              className="flex w-full items-center justify-center gap-1 border-t border-rose-200 py-2 text-xs font-black text-rose-600 hover:bg-rose-50"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              {showWholeFile ? "Ẩn toàn bộ file lời giải" : "Xem trong toàn bộ file lời giải"}
                            </button>
                          </div>
                        )}

                        {/* Toàn bộ file lời giải, cuộn tới câu đang xem */}
                        {wholeFileMounted && (
                          <div
                            className={cn(
                              "h-[75vh] overflow-hidden rounded-xl border border-rose-200",
                              !showWholeFile && "hidden",
                            )}
                          >
                            <PDFViewer
                              url={reviewPdfUrl}
                              flat
                              maxPageWidth={960}
                              scrollTarget={scrollTarget}
                              renderLeft={
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                                  Toàn bộ file lời giải
                                </span>
                              }
                            />
                          </div>
                        )}

                        {/* Video hướng dẫn giải (chưa chia mốc theo câu → video đầy đủ) */}
                        {showVideo && (
                          <div className="space-y-3">
                            {(selected.q.videoUrl
                              ? [{ title: "Video câu này", url: selected.q.videoUrl }]
                              : solutionVideos
                            ).map((video, idx) => (
                              <div key={idx} className="space-y-1.5">
                                {solutionVideos.length > 1 && !selected.q.videoUrl && (
                                  <p className="text-xs font-black text-slate-500">{video.title || `Video ${idx + 1}`}</p>
                                )}
                                <VideoPlayer src={video.url} title={video.title || "Video hướng dẫn giải"} />
                              </div>
                            ))}
                          </div>
                        )}
                      </QuestionCard>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="p-8 text-center text-sm font-bold text-slate-400">Bài không có câu hỏi.</div>
                )}
              </div>

              {/* Thanh dưới cùng: vị trí câu (bấm để mở bảng câu hỏi) + điều hướng */}
              <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 md:px-6">
                <button
                  onClick={openResultPanel}
                  className={cn(
                    "flex h-9 min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50",
                    // Máy tính đang mở bảng bên phải → chỉ là nhãn vị trí, không cần nút
                    panelOpen && "lg:pointer-events-none lg:border-transparent lg:px-0 lg:text-slate-500",
                  )}
                  aria-label="Mở bảng câu hỏi"
                >
                  <LayoutGrid className={cn("h-4 w-4 shrink-0 text-indigo-600", panelOpen && "lg:hidden")} />
                  <span className="truncate">
                    Câu {selectedVisibleIndex + 1}
                    <span className="text-slate-400"> / {visible.length}</span>
                  </span>
                  <span className={cn("hidden text-indigo-600", !panelOpen && "lg:inline")}>· Mở bảng kết quả</span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => goTo(-1)}
                    disabled={selectedVisibleIndex <= 0}
                    aria-label="Câu trước"
                    className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Câu trước</span>
                  </button>
                  <button
                    onClick={() => goTo(1)}
                    disabled={selectedVisibleIndex === -1 || selectedVisibleIndex >= visible.length - 1}
                    className="flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
                  >
                    Câu tiếp
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </footer>
            </div>

            {/* Máy tính: bảng kết quả chi tiết ở bên phải (giống ngăn kéo trên điện thoại) */}
            {panelOpen && (
              <aside className="hidden lg:flex w-72 2xl:w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
                  <p className="text-sm font-black text-slate-900">Kết quả chi tiết</p>
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-slate-500 hover:bg-slate-100"
                    aria-label="Thu gọn bảng kết quả"
                  >
                    Thu gọn <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">{grid}</div>
              </aside>
            )}


            <Sheet open={gridOpen} onOpenChange={setGridOpen}>
              <SheetContent side="right" className="w-[86vw] max-w-sm gap-0 overflow-y-auto p-0">
                <SheetHeader className="border-b px-5 py-4">
                  <SheetTitle>Kết quả chi tiết</SheetTitle>
                  <SheetDescription className="sr-only">Chọn một câu để xem đáp án và lời giải</SheetDescription>
                </SheetHeader>
                {grid}
              </SheetContent>
            </Sheet>
          </div>
        )}

        {/* TAB: Đề gốc */}
        {mountedTabs.has("paper") && (
          <div className={cn("absolute inset-0 flex flex-col lg:flex-row", tab !== "paper" && "hidden")}>
            <div className="flex-1 min-h-0 bg-slate-100">
              <PDFViewer url={pdfUrl} flat maxPageWidth={900} />
            </div>
            {!canSeeAnswers && (
              <HiddenAnswersPanel
                flat={flat}
                attemptId={attemptId}
              />
            )}
          </div>
        )}

        {/* TAB: Video chữa */}
        {mountedTabs.has("video") && (
          <div className={cn("absolute inset-0 overflow-y-auto custom-scrollbar bg-slate-50", tab !== "video" && "hidden")}>
            <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
              {solutionVideos.map((video, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm md:text-base font-black text-slate-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
                      {idx + 1}
                    </span>
                    {video.title || "Video chữa bài"}
                  </h3>
                  <VideoPlayer src={video.url} title={video.title || "Video chữa bài"} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Lưới câu hỏi ----------

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function QuestionGrid({
  sections,
  flat,
  visibleIds,
  selectedId,
  onSelect,
  onlyWrong,
  onToggleOnlyWrong,
  counts,
  score,
  durationSeconds,
}: {
  sections: ReviewSection[];
  flat: FlatQuestion[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onlyWrong: boolean;
  onToggleOnlyWrong: () => void;
  counts: Record<Status, number>;
  score: number;
  durationSeconds: number | null;
}) {
  const byId = new Map(flat.map((f) => [f.q.id, f]));

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-md shadow-indigo-200">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Điểm</p>
          <p className="text-2xl font-black">{score.toFixed(2)}<span className="text-sm text-indigo-200">/10</span></p>
        </div>
        {durationSeconds !== null && (
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Thời gian</p>
            <p className="text-xl font-black">{formatDuration(durationSeconds)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-50 py-2">
          <div className="text-lg font-black text-emerald-600">{counts.correct}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700/70">Đúng</div>
        </div>
        <div className="rounded-2xl bg-rose-50 py-2">
          <div className="text-lg font-black text-rose-600">{counts.wrong}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-rose-700/70">Sai</div>
        </div>
        <div className="rounded-2xl bg-slate-100 py-2">
          <div className="text-lg font-black text-slate-600">{counts.blank}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bỏ trống</div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
        <input type="checkbox" checked={onlyWrong} onChange={onToggleOnlyWrong} className="h-4 w-4 accent-rose-500" />
        Chỉ xem câu sai / bỏ trống
      </label>

      {onlyWrong && visibleIds.size === 0 && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-6 text-center text-sm font-bold text-emerald-700">
          Không có câu sai hoặc bỏ trống 🎉
        </p>
      )}

      {sections.map((section) => {
        const items = section.questions.filter((q) => visibleIds.has(q.id));
        if (items.length === 0) return null;
        return (
          <div key={section.id} className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{section.name}</h4>
            <div className="grid grid-cols-6 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
              {items.map((q) => {
                const item = byId.get(q.id)!;
                return (
                  <button
                    key={q.id}
                    onClick={() => onSelect(q.id)}
                    title={`Câu ${item.number}: ${STATUS_STYLE[item.status].label}`}
                    aria-label={`${section.name} câu ${item.number}: ${STATUS_STYLE[item.status].label}`}
                    aria-current={selectedId === q.id ? "true" : undefined}
                    className={cn(
                      "aspect-square rounded-xl border text-xs font-black transition-all hover:scale-105",
                      STATUS_STYLE[item.status].cell,
                      selectedId === q.id && "ring-2 ring-indigo-600 ring-offset-2",
                    )}
                  >
                    {item.number}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-4 text-[10px] font-bold text-slate-500">
        {(Object.keys(STATUS_STYLE) as Status[])
          .filter((s) => counts[s] > 0)
          .map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn("h-3 w-3 rounded border", STATUS_STYLE[s].cell)} />
              {STATUS_STYLE[s].label}
            </span>
          ))}
      </div>
    </div>
  );
}

// ---------- Chi tiết một câu ----------

const STATUS_LINE: Record<Status, { icon: React.ReactNode; text: string; className: string }> = {
  correct: { icon: <CheckCircle2 className="h-5 w-5" />, text: "Đúng", className: "text-emerald-600" },
  wrong: { icon: <XCircle className="h-5 w-5" />, text: "Sai", className: "text-rose-600" },
  blank: { icon: <XCircle className="h-5 w-5" />, text: "Chưa làm", className: "text-orange-500" },
  pending: { icon: <Clock className="h-5 w-5" />, text: "Chờ chấm", className: "text-violet-600" },
  ungraded: { icon: <Info className="h-5 w-5" />, text: "Không tính điểm", className: "text-amber-600" },
};

function QuestionCard({
  item,
  isTeacher,
  attemptId,
  hasSolutionFile,
  solutionOpen,
  onToggleSolution,
  hasVideo,
  videoOpen,
  onToggleVideo,
  children,
}: {
  item: FlatQuestion;
  isTeacher: boolean;
  attemptId: string;
  /** Có file lời giải → nút "Xem đáp án chi tiết"; không có → nút "Xem đáp án" */
  hasSolutionFile: boolean;
  /** Đã bấm xem → mới hiện đáp án đúng (trước đó chỉ hiện đáp án học sinh đã chọn) */
  solutionOpen: boolean;
  onToggleSolution: () => void;
  hasVideo: boolean;
  videoOpen: boolean;
  onToggleVideo: () => void;
  children?: React.ReactNode;
}) {
  const { q, answer, status } = item;
  const line = STATUS_LINE[status];
  const subQuestions = [...(q.subQuestions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const isSimple = q.type !== "MULTIPLE_CHOICE_GROUP" && q.type !== "ESSAY";
  const correctText =
    q.type === "MULTIPLE_CHOICE_GROUP"
      ? subQuestions.map((sq) => tfLabel(sq.correctAnswer)).join(" ; ")
      : q.type === "ESSAY"
        ? null
        : formatCorrectAnswer(q);

  return (
    <div className="space-y-4">
      {/* Trạng thái */}
      <p className={cn("flex items-center gap-2 text-base font-bold", line.className)}>
        {line.icon} {line.text}
      </p>

      {/* Bảng từng ý (Đúng/Sai nhiều ý) — cột đáp án và đúng/sai từng ý chỉ hiện sau khi bấm xem */}
      {q.type === "MULTIPLE_CHOICE_GROUP" && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div
            className={cn(
              "grid bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500",
              solutionOpen ? "grid-cols-[3rem_1fr_1fr_2rem]" : "grid-cols-[3rem_1fr]",
            )}
          >
            <span>Ý</span>
            <span>Bạn chọn</span>
            {solutionOpen && (
              <>
                <span>Đáp án</span>
                <span />
              </>
            )}
          </div>
          {subQuestions.map((sq, i) => {
            const sub = answer?.subAnswers?.find((a) => a.subQuestionId === sq.id);
            const value = cleanStudentAnswer(sub?.answerProvided);
            return (
              <div
                key={sq.id}
                className={cn(
                  "grid items-center border-t border-slate-100 px-3 py-2 text-sm font-bold",
                  solutionOpen ? "grid-cols-[3rem_1fr_1fr_2rem]" : "grid-cols-[3rem_1fr]",
                  solutionOpen && (sub?.isCorrect ? "bg-emerald-50/70" : value ? "bg-rose-50/70" : "bg-white"),
                )}
              >
                <span className="text-slate-500">{String.fromCharCode(97 + i)})</span>
                <span
                  className={
                    !value
                      ? "text-slate-400"
                      : !solutionOpen
                        ? "text-slate-800"
                        : sub?.isCorrect
                          ? "text-emerald-700"
                          : "text-rose-600"
                  }
                >
                  {value ? tfLabel(value) : "Chưa làm"}
                </span>
                {solutionOpen && (
                  <>
                    <span className="text-emerald-700">{tfLabel(sq.correctAnswer)}</span>
                    {sub?.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className={cn("h-4 w-4", value ? "text-rose-500" : "text-slate-300")} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hộp đáp án + nút xem lời giải / video */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        {isSimple && (
          <p className="text-base text-slate-700">
            <span className="font-bold">Bạn chọn: </span>
            <span className={cn("font-black italic", STATUS_STYLE[status].text)}>{formatStudentAnswer(q, answer)}</span>
          </p>
        )}
        {correctText && solutionOpen && (
          <p className="text-base text-slate-700">
            <span className="font-bold">Đáp án đúng: </span>
            <span className="font-black italic text-emerald-700">{correctText}</span>
          </p>
        )}
        {q.type === "ESSAY" && (
          <p className="flex flex-wrap items-center gap-2 text-base text-slate-700">
            <span className="font-bold">Bài làm:</span>
            {answer?.answerProvided ? (
              <a
                href={answer.answerProvided}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-black text-blue-600 hover:underline"
              >
                <ImageIcon className="h-4 w-4" /> Xem bài làm <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="font-bold text-slate-500">Làm ra giấy</span>
            )}
          </p>
        )}

        {(q.type !== "ESSAY" || hasSolutionFile || hasVideo) && (
          <div className="flex flex-wrap gap-2">
            {(q.type !== "ESSAY" || hasSolutionFile) && (
              <button
                onClick={onToggleSolution}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              >
                {hasSolutionFile
                  ? solutionOpen
                    ? "Ẩn đáp án chi tiết"
                    : "Xem đáp án chi tiết"
                  : solutionOpen
                    ? "Ẩn đáp án"
                    : "Xem đáp án"}
              </button>
            )}
            {hasVideo && (
              <button
                onClick={onToggleVideo}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              >
                {videoOpen ? "Ẩn video hướng dẫn giải" : "Xem video hướng dẫn giải"}
              </button>
            )}
          </div>
        )}

        {children}

        {q.explanation && (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="whitespace-pre-wrap text-sm text-slate-700">{q.explanation}</p>
          </div>
        )}
        {q.audioUrl && (
          <a
            href={q.audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100"
          >
            <Headphones className="h-3.5 w-3.5" /> Audio
          </a>
        )}
      </div>

      {/* Chấm tự luận (giáo viên) */}
      {isTeacher && q.type === "ESSAY" && answer && (
        <GradeEssay
          key={answer.id}
          answerId={answer.id}
          initialPoints={answer.pointsAwarded}
          maxPoints={q.points}
          isCorrect={answer.isCorrect}
          initialFeedback={answer.feedback}
        />
      )}

      {/* Góp ý của giáo viên + nộp lại (học sinh) */}
      {!isTeacher && q.type === "ESSAY" && answer && (
        <>
          {answer.feedback && (
            <div className="flex gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-orange-600">Góp ý của giảng viên</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{answer.feedback}</p>
              </div>
            </div>
          )}
          {answer.isCorrect === false && <ReuploadForm key={q.id} attemptId={attemptId} questionId={q.id} />}
        </>
      )}
    </div>
  );
}

// ---------- Khi giáo viên ẩn đáp án ----------

function HiddenAnswersPanel({ flat, attemptId }: { flat: FlatQuestion[]; attemptId: string }) {
  const essays = flat.filter(
    (f) => f.q.type === "ESSAY" && f.answer && (f.answer.feedback || f.answer.isCorrect === false),
  );

  return (
    <div className="w-full lg:w-[420px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l bg-white p-6 space-y-6">
      <div className="flex flex-col items-center text-center">
        <Trophy className="mb-4 h-14 w-14 text-yellow-400" />
        <h2 className="mb-2 text-xl font-black text-slate-900">Đã nộp bài thành công!</h2>
        <p className="max-w-[320px] text-sm font-medium leading-relaxed text-slate-500">
          Giảng viên đã cài đặt ẩn đáp án chi tiết. Vui lòng liên hệ giảng viên hoặc chờ thông báo để xem kết quả.
        </p>
      </div>

      {essays.map((f) => (
        <div key={f.q.id} className="space-y-3 border-t pt-4">
          <p className="text-xs font-black text-slate-500">
            {f.sectionName} · Câu {f.number}
          </p>
          {f.answer?.feedback && (
            <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-orange-600">Góp ý của giảng viên</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{f.answer.feedback}</p>
              </div>
            </div>
          )}
          {f.answer?.isCorrect === false && <ReuploadForm attemptId={attemptId} questionId={f.q.id} />}
        </div>
      ))}
    </div>
  );
}
