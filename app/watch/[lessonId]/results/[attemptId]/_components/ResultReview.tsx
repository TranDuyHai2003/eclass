"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Headphones,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListChecks,
  Maximize2,
  Minimize2,
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
  type SolutionAnchorsData,
  type SolutionRegion,
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

const STATUS_STYLE: Record<Status, { cell: string; label: string; text: string }> = {
  correct: { cell: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Đúng", text: "text-emerald-600" },
  wrong: { cell: "bg-blue-100 text-blue-700 border-blue-200", label: "Sai", text: "text-blue-600" },
  blank: { cell: "bg-slate-100 text-slate-500 border-slate-200", label: "Bỏ trống", text: "text-slate-500" },
  pending: { cell: "bg-violet-100 text-violet-700 border-violet-200", label: "Chờ chấm", text: "text-violet-600" },
  ungraded: { cell: "bg-amber-100 text-amber-700 border-amber-200", label: "Không tính điểm", text: "text-amber-700" },
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

  // "focus" = chỉ phần lời giải của câu đang xem; "full" = cả file, cuộn tới câu
  const [preferFull, setPreferFull] = useState(false);
  const [focusZoom, setFocusZoomState] = useState(1);
  // Nhớ mức phóng to lời giải trên thiết bị (site tắt pinch-zoom nên học sinh dùng nút +/−)
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
  const showFull = preferFull || (anchorsReady && !region);
  const [fullMounted, setFullMounted] = useState(false);
  useEffect(() => {
    if (showFull) setFullMounted(true);
  }, [showFull]);

  const scrollTarget = region
    ? { page: region.start.page, yPct: region.start.y, key: selected!.q.id, label: region.label }
    : null;
  const docLabel = solutionPdfUrl ? "lời giải" : "đề";

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

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {/* Thanh tab + điểm */}
      <div className="shrink-0 border-b bg-slate-50/60 px-3 md:px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => openTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs md:text-sm font-black transition-colors",
                  tab === t.id ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex gap-3 text-xs font-black uppercase tracking-widest">
            <span className="text-emerald-600">Đúng {counts.correct}</span>
            <span className="text-blue-600">Sai {counts.wrong}</span>
            {counts.blank > 0 && <span className="text-slate-500">Trống {counts.blank}</span>}
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm md:text-base font-black text-blue-600">{score.toFixed(2)} / 10</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* TAB: Chữa từng câu */}
        {canSeeAnswers && mountedTabs.has("review") && (
          <div className={cn("absolute inset-0 flex justify-center bg-slate-100/70", tab !== "review" && "hidden")}>
            <div className="flex w-full max-w-[1280px] bg-white xl:border-x xl:border-slate-200">
            <aside className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col border-r bg-white overflow-y-auto custom-scrollbar">
              {grid}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
              {selected ? (
                <>
                  {/* Chế độ tập trung: câu hỏi + đúng phần lời giải, cuộn chung một cột */}
                  <div className={cn("flex-1 min-h-0 overflow-y-auto custom-scrollbar", showFull && "hidden")}>
                    <div className="mx-auto w-full max-w-4xl">
                    <QuestionDetail
                      item={selected}
                      isTeacher={isTeacher}
                      attemptId={attemptId}
                      position={`${selectedVisibleIndex + 1}/${visible.length}`}
                      canPrev={selectedVisibleIndex > 0}
                      canNext={selectedVisibleIndex !== -1 && selectedVisibleIndex < visible.length - 1}
                      onPrev={() => goTo(-1)}
                      onNext={() => goTo(1)}
                      onOpenGrid={() => setGridOpen(true)}
                    />
                    <section className="px-3 md:px-5 pb-6">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                          <p className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-widest text-slate-500">
                            {solutionPdfUrl ? "Lời giải" : "Đề bài"}
                            {region && (
                              <span className="ml-2 normal-case tracking-normal font-bold text-slate-400">
                                {region.label ? `${region.label} · ` : ""}trang {region.start.page}
                                {region.end.page !== region.start.page ? `–${region.end.page}` : ""}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setFocusZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                              disabled={focusZoom <= 1}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                              aria-label="Thu nhỏ lời giải"
                            >
                              <ZoomOut className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setFocusZoom((z) => Math.min(2.5, z + 0.25))}
                              disabled={focusZoom >= 2.5}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                              aria-label="Phóng to lời giải"
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
                            <button
                              onClick={() => setPreferFull(true)}
                              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black text-blue-600 hover:bg-blue-50"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                              Toàn bộ {docLabel}
                            </button>
                          </div>
                        </div>
                        <PdfRegionView
                          url={reviewPdfUrl}
                          segments={segments}
                          layout={anchorsData?.layout ?? { left: 0, right: 100 }}
                          zoom={focusZoom}
                          onDocumentLoad={handleReviewPdfLoad}
                          className="bg-white"
                          placeholder={
                            <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400">
                              <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Đang tìm lời giải câu này...
                            </div>
                          }
                        />
                      </div>
                    </section>
                    </div>
                  </div>

                  {/* Chế độ toàn bộ file: thông tin câu ở trên, PDF cuộn tới câu ở dưới */}
                  {fullMounted && (
                    <div className={cn("flex-1 min-h-0 flex flex-col", !showFull && "hidden")}>
                      <div className="shrink-0 max-h-[45%] overflow-y-auto custom-scrollbar">
                        <div className="mx-auto w-full max-w-4xl">
                        <QuestionDetail
                          item={selected}
                          isTeacher={isTeacher}
                          attemptId={attemptId}
                          position={`${selectedVisibleIndex + 1}/${visible.length}`}
                          canPrev={selectedVisibleIndex > 0}
                          canNext={selectedVisibleIndex !== -1 && selectedVisibleIndex < visible.length - 1}
                          onPrev={() => goTo(-1)}
                          onNext={() => goTo(1)}
                          onOpenGrid={() => setGridOpen(true)}
                          statusLine={
                            <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-400">
                              {region ? (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                                  Đã chuyển tới {region.label ?? "câu này"} (trang {region.start.page}) trong {docLabel} bên dưới
                                </>
                              ) : anchorsReady ? (
                                <>Chưa xác định được vị trí câu này, hãy cuộn {docLabel} bên dưới để xem.</>
                              ) : (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" /> Đang tìm vị trí câu trong {docLabel}...
                                </>
                              )}
                              {region && preferFull && (
                                <button
                                  onClick={() => setPreferFull(false)}
                                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 font-black text-blue-600 hover:bg-blue-50"
                                >
                                  <Minimize2 className="h-3.5 w-3.5" /> Chỉ xem lời giải câu này
                                </button>
                              )}
                            </p>
                          }
                        />
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 border-t bg-slate-100">
                        <PDFViewer
                          url={reviewPdfUrl}
                          flat
                          maxPageWidth={880}
                          onDocumentLoad={handleReviewPdfLoad}
                          scrollTarget={scrollTarget}
                          renderLeft={
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                              {solutionPdfUrl ? "Lời giải" : "Đề bài (chưa có file lời giải)"}
                            </span>
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-sm font-bold text-slate-400">Bài không có câu hỏi.</div>
              )}
            </div>

            {/* Điện thoại/tablet: tab dọc ở mép phải mở ngăn kết quả (tham khảo LAB Study) */}
            <button
              onClick={() => setGridOpen(true)}
              className="lg:hidden fixed right-0 top-[64%] z-40 -translate-y-1/2 flex flex-col items-center gap-0.5 rounded-l-xl bg-blue-600/95 px-1 py-2.5 text-white shadow-lg shadow-blue-600/30 active:bg-blue-700"
              aria-label="Mở kết quả chi tiết"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                Kết quả
              </span>
            </button>

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
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Điểm</p>
          <p className="text-xl font-black text-blue-600">{score.toFixed(2)}<span className="text-sm text-slate-400">/10</span></p>
        </div>
        {durationSeconds !== null && (
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Thời gian</p>
            <p className="text-xl font-black text-slate-700">{formatDuration(durationSeconds)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-50 py-2">
          <div className="text-lg font-black text-emerald-600">{counts.correct}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700/70">Đúng</div>
        </div>
        <div className="rounded-2xl bg-blue-50 py-2">
          <div className="text-lg font-black text-blue-600">{counts.wrong}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-blue-700/70">Sai</div>
        </div>
        <div className="rounded-2xl bg-slate-100 py-2">
          <div className="text-lg font-black text-slate-600">{counts.blank}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bỏ trống</div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
        <input type="checkbox" checked={onlyWrong} onChange={onToggleOnlyWrong} className="h-4 w-4 accent-blue-600" />
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
                      selectedId === q.id && "ring-2 ring-slate-900 ring-offset-1",
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

function QuestionDetail({
  item,
  isTeacher,
  attemptId,
  position,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onOpenGrid,
  statusLine,
}: {
  item: FlatQuestion;
  isTeacher: boolean;
  attemptId: string;
  position: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenGrid: () => void;
  statusLine?: React.ReactNode;
}) {
  const { q, answer, status } = item;
  const style = STATUS_STYLE[status];
  const subQuestions = [...(q.subQuestions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="bg-white">
      {/* Header câu + điều hướng */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 backdrop-blur px-3 md:px-5 py-2.5">
        <button
          onClick={onOpenGrid}
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
          aria-label="Danh sách câu"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">Câu {item.number}</span>
            <span className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase", style.cell)}>
              {style.label}
            </span>
          </div>
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.sectionName}</p>
        </div>
        <span className="hidden sm:block text-[10px] font-black text-slate-400">{position}</span>
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-black text-slate-600 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">Câu trước</span>
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-2.5 text-xs font-black text-white disabled:opacity-40"
        >
          <span className="hidden md:inline">Câu tiếp</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 px-3 md:px-5 py-3">
        {/* Đáp án của bạn / đáp án đúng */}
        {q.type === "MULTIPLE_CHOICE_GROUP" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[3rem_1fr_1fr_2rem] bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Ý</span>
              <span>Bạn chọn</span>
              <span>Đáp án</span>
              <span />
            </div>
            {subQuestions.map((sq, i) => {
              const sub = answer?.subAnswers?.find((a) => a.subQuestionId === sq.id);
              const value = cleanStudentAnswer(sub?.answerProvided);
              return (
                <div
                  key={sq.id}
                  className="grid grid-cols-[3rem_1fr_1fr_2rem] items-center border-t border-slate-100 px-3 py-2 text-sm font-bold"
                >
                  <span className="text-slate-400">{String.fromCharCode(97 + i)})</span>
                  <span className={value ? "text-slate-800" : "text-slate-400"}>{value ? tfLabel(value) : "Bỏ trống"}</span>
                  <span className="text-emerald-600">{tfLabel(sq.correctAnswer)}</span>
                  {sub?.isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        ) : q.type === "ESSAY" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bài làm</span>
            {answer?.answerProvided ? (
              <a
                href={answer.answerProvided}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-black text-blue-600 hover:underline"
              >
                <ImageIcon className="h-4 w-4" /> Xem bài làm <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-sm font-bold text-slate-500">Làm ra giấy</span>
            )}
            {status === "pending" && (
              <span className="ml-auto flex items-center gap-1 text-xs font-bold text-violet-600">
                <Clock className="h-3.5 w-3.5" /> Chờ chấm
              </span>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bạn chọn</p>
              <p className={cn("text-lg font-black", style.text)}>{formatStudentAnswer(q, answer)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/70">Đáp án đúng</p>
              <p className="text-lg font-black text-emerald-600">{formatCorrectAnswer(q)}</p>
            </div>
          </div>
        )}

        {/* Chấm tự luận (giáo viên) */}
        {isTeacher && q.type === "ESSAY" && answer && (
          <GradeEssay
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
            {answer.isCorrect === false && <ReuploadForm attemptId={attemptId} questionId={q.id} />}
          </>
        )}

        {/* Lời giải / media riêng của câu (nếu giáo viên có nhập) */}
        {(q.videoUrl || q.audioUrl) && (
          <div className="flex flex-wrap gap-2">
            {q.videoUrl && (
              <a
                href={q.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-blue-50 hover:text-blue-600"
              >
                <Video className="h-3.5 w-3.5" /> Video câu này
              </a>
            )}
            {q.audioUrl && (
              <a
                href={q.audioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-blue-50 hover:text-blue-600"
              >
                <Headphones className="h-3.5 w-3.5" /> Audio
              </a>
            )}
          </div>
        )}
        {q.explanation && (
          <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="whitespace-pre-wrap text-sm text-slate-600">{q.explanation}</p>
          </div>
        )}

        {statusLine}
      </div>
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
