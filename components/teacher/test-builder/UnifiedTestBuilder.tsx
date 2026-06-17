"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  Zap,
  LayoutGrid,
  X,
  Upload,
  Eye,
  BarChart3,
  FileText,
  GripVertical,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveTestMatrix } from "@/actions/test";
import { cn } from "@/lib/utils";
import { FastEntryModal } from "@/components/teacher/test-builder/FastEntryModal";
import {
  ParsedQuestionsForm,
  type ParsedQuestion,
} from "@/components/teacher/test-builder/ParsedQuestionsForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, FileWarning } from "lucide-react";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 font-bold text-slate-400">
      Đang tải PDF...
    </div>
  ),
});

export interface UnifiedSaveData {
  title: string;
  pdfUrl: string;
  duration: number;
  showAnswers: boolean;
  explanation: string;
  solutionVideos: { title: string; url: string }[];
  audioUrl: string;
  dueDate: Date | null;
}

interface UnifiedTestBuilderProps {
  initialTest: any;
  title: string;
  subtitle: string;
  backHref?: string;
  onBack?: () => void;
  onSave: (
    data: UnifiedSaveData,
  ) => Promise<{ success: boolean; testId?: string }>;
  previewHref?: string;
  analyticsHref?: string;
  showDelete?: boolean;
  onDelete?: () => Promise<void>;
  disableAutoParse?: boolean;
  hideHeader?: boolean;
}

export default function UnifiedTestBuilder({
  initialTest,
  title,
  subtitle,
  onBack,
  onSave,
  previewHref,
  analyticsHref,
  showDelete,
  onDelete,
  disableAutoParse,
  hideHeader,
}: UnifiedTestBuilderProps) {
  const [isPending, startTransition] = useTransition();

  const [testName, setTestName] = useState(initialTest?.title || "");
  const [pdfUrl, setPdfUrl] = useState(initialTest?.pdfUrl || "");
  const [duration, setDuration] = useState(initialTest?.duration || 45);
  const [dueDate, setDueDate] = useState(
    initialTest?.dueDate
      ? new Date(initialTest.dueDate).toISOString().slice(0, 16)
      : "",
  );
  const [showAnswers, setShowAnswers] = useState(
    initialTest?.showAnswers ?? true,
  );
  const [explanation, setExplanation] = useState(
    initialTest?.explanation || "",
  );
  const [solutionVideos, setSolutionVideos] = useState<
    { title: string; url: string }[]
  >(() => {
    if (
      initialTest?.solutionVideos &&
      Array.isArray(initialTest.solutionVideos)
    ) {
      return initialTest.solutionVideos;
    }
    if (initialTest?.videoUrl) {
      return [{ title: "Video lời giải", url: initialTest.videoUrl }];
    }
    return [{ title: "Phần 1", url: "" }];
  });
  const [audioUrl, setAudioUrl] = useState(initialTest?.audioUrl || "");

  const [isUploadingExplanation, setIsUploadingExplanation] = useState(false);

  const isDirtyRef = useRef(false);
  const markDirty = () => {
    isDirtyRef.current = true;
  };
  const resetDirty = () => {
    isDirtyRef.current = false;
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const [isUploading, setIsUploading] = useState(false);
  const [isFastEntryOpen, setIsFastEntryOpen] = useState(false);
  const [fastEntrySectionIdx, setFastEntrySectionIdx] = useState<number | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"matrix" | "explanation">(
    "matrix",
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPdfUrl(initialTest?.pdfUrl || "");
    setDuration(initialTest?.duration || 45);
    setDueDate(
      initialTest?.dueDate
        ? new Date(initialTest.dueDate).toISOString().slice(0, 16)
        : "",
    );
    setShowAnswers(initialTest?.showAnswers ?? true);
    setExplanation(initialTest?.explanation || "");

    if (
      initialTest?.solutionVideos &&
      Array.isArray(initialTest.solutionVideos)
    ) {
      setSolutionVideos(initialTest.solutionVideos);
    } else if (initialTest?.videoUrl) {
      setSolutionVideos([
        { title: "Video lời giải", url: initialTest.videoUrl },
      ]);
    } else {
      setSolutionVideos([{ title: "Video lời giải phần 1", url: "" }]);
    }

    setAudioUrl(initialTest?.audioUrl || "");
    setSections(
      initialTest?.sections?.map((s: any) => ({
        ...s,
        questions: s.questions?.map((q: any) => ({ ...q })) || [],
      })) || [
        {
          id: "temp-section-1",
          name: "Phần 1: Trắc nghiệm",
          position: 0,
          questions: [],
        },
      ],
    );
    resetDirty();
  }, [initialTest]);

  const [isParseDialogOpen, setIsParseDialogOpen] = useState(false);
  const [tempParsedQuestions, setTempParsedQuestions] = useState<
    ParsedQuestion[]
  >([]);
  const [parseWarning, setParseWarning] = useState("");

  const [sections, setSections] = useState<any[]>(
    initialTest?.sections?.map((s: any) => ({
      ...s,
      questions: s.questions?.map((q: any) => ({ ...q })) || [],
    })) || [
      {
        id: "temp-section-1",
        name: "Phần 1: Trắc nghiệm",
        position: 0,
        questions: [],
      },
    ],
  );

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Vui lòng tải lên file PDF");
      return;
    }

    setIsUploading(true);
    setParseWarning("");
    setTempParsedQuestions([]);
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      });
      if (!presignRes.ok) throw new Error("Không tạo được link upload");
      const presignData = await presignRes.json();

      await axios.put(presignData.uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });
      setPdfUrl(presignData.fileUrl);
      markDirty();
      toast.success("Tải file PDF thành công!");

      if (!disableAutoParse) {
        const parseFormData = new FormData();
        parseFormData.append("file", file);
        const parseRes = await fetch("/api/exams/parse-pdf", {
          method: "POST",
          body: parseFormData,
        });
        const parseData = await parseRes.json();

        if (parseData.status === "warning") {
          setParseWarning(parseData.message);
          setIsParseDialogOpen(true);
        } else if (parseData.data?.questions?.length > 0) {
          const mapped: ParsedQuestion[] = parseData.data.questions.map(
            (q: any, i: number) => ({
              id: `parsed-${Date.now()}-${i}`,
              order: q.order,
              question_label: q.question_label,
              question_category: q.question_category,
              type: "MULTIPLE_CHOICE" as const,
              correctAnswer: "",
            }),
          );
          setTempParsedQuestions(mapped);
          setIsParseDialogOpen(true);
          toast.success(`Đã bóc tách được ${mapped.length} câu hỏi từ PDF`);
        }
      }
    } catch {
      toast.error("Lỗi tải file hoặc phân tích PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExplanationPdfUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Vui lòng tải lên file PDF");
      return;
    }

    setIsUploadingExplanation(true);
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: `explanation_${file.name}`, fileType: file.type, fileSize: file.size }),
      });
      if (!presignRes.ok) throw new Error("Không tạo được link upload");
      const presignData = await presignRes.json();

      await axios.put(presignData.uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });
      setExplanation(presignData.fileUrl);
      markDirty();
      toast.success("Tải file lời giải PDF thành công!");
    } catch {
      toast.error("Lỗi tải file lời giải");
    } finally {
      setIsUploadingExplanation(false);
    }
  };

  const handleAddQuestion = (
    sIdx: number,
    type: string = "MULTIPLE_CHOICE",
  ) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      targetSection.questions = [
        ...targetSection.questions,
        {
          id: `temp-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          position: targetSection.questions.length,
          type,
          correctAnswer: "",
          points: 1.0,
          explanation: "",
          videoUrl: "",
          audioUrl: "",
          needsManualGrading: false,
        },
      ];
      ns[sIdx] = targetSection;
      return ns;
    });
  };

  const handleUpdateQuestion = (
    sIdx: number,
    qIdx: number,
    field: string,
    value: any,
  ) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      const targetQuestions = [...targetSection.questions];
      targetQuestions[qIdx] = { ...targetQuestions[qIdx], [field]: value };
      targetSection.questions = targetQuestions;
      ns[sIdx] = targetSection;
      return ns;
    });
  };

  const handleRemoveQuestion = (sIdx: number, qIdx: number) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      const targetQuestions = [...targetSection.questions];
      targetQuestions.splice(qIdx, 1);
      targetSection.questions = targetQuestions;
      ns[sIdx] = targetSection;
      return ns;
    });
  };

  const handleChangeQuestionType = (sIdx: number, qIdx: number, newType: string) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      const targetQuestions = [...targetSection.questions];
      const currentQ = targetQuestions[qIdx];
      
      let newCorrectAnswer = "";
      if (newType === "MULTIPLE_CHOICE") {
        const validOpts = ["A", "B", "C", "D"];
        const currentOpts = (currentQ.correctAnswer || "").split(",").map((s: string) => s.trim());
        if (currentOpts.length > 0 && currentOpts.every((opt: string) => validOpts.includes(opt))) {
          newCorrectAnswer = currentQ.correctAnswer;
        }
      } else if (newType === "TRUE_FALSE") {
        if (currentQ.correctAnswer === "T" || currentQ.correctAnswer === "F") {
          newCorrectAnswer = currentQ.correctAnswer;
        } else {
          newCorrectAnswer = "T";
        }
      } else {
        newCorrectAnswer = currentQ.correctAnswer;
      }

      targetQuestions[qIdx] = { ...currentQ, type: newType, correctAnswer: newCorrectAnswer };
      targetSection.questions = targetQuestions;
      ns[sIdx] = targetSection;
      return ns;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId) {
      const sIdxMatch = source.droppableId.match(/droppable-section-(\d+)/);
      if (!sIdxMatch) return;
      const sIdx = parseInt(sIdxMatch[1]);
      if (isNaN(sIdx)) return;
      if (source.index === destination.index) return;

      markDirty();
      setSections((prev) => {
        const ns = [...prev];
        const targetSection = { ...ns[sIdx] };
        const targetQuestions = Array.from(targetSection.questions);
        const [removed] = targetQuestions.splice(source.index, 1);
        targetQuestions.splice(destination.index, 0, removed);
        
        targetQuestions.forEach((q: any, idx: number) => {
          q.position = idx;
        });

        targetSection.questions = targetQuestions;
        ns[sIdx] = targetSection;
        return ns;
      });
    } else {
      const sourceMatch = source.droppableId.match(/droppable-section-(\d+)/);
      const destMatch = destination.droppableId.match(/droppable-section-(\d+)/);
      if (!sourceMatch || !destMatch) return;
      const sourceSIdx = parseInt(sourceMatch[1]);
      const destSIdx = parseInt(destMatch[1]);
      
      if (isNaN(sourceSIdx) || isNaN(destSIdx)) return;

      markDirty();
      setSections((prev) => {
        const ns = [...prev];
        const sourceSection = { ...ns[sourceSIdx] };
        const destSection = { ...ns[destSIdx] };
        
        const sourceQuestions = Array.from(sourceSection.questions);
        const destQuestions = Array.from(destSection.questions);
        
        const [removed] = sourceQuestions.splice(source.index, 1);
        destQuestions.splice(destination.index, 0, removed);
        
        sourceQuestions.forEach((q: any, idx: number) => q.position = idx);
        destQuestions.forEach((q: any, idx: number) => q.position = idx);
        
        sourceSection.questions = sourceQuestions;
        destSection.questions = destQuestions;
        
        ns[sourceSIdx] = sourceSection;
        ns[destSIdx] = destSection;
        return ns;
      });
    }
  };

  const handleAddSolutionVideo = () => {
    markDirty();
    setSolutionVideos([
      ...solutionVideos,
      { title: `Phần ${solutionVideos.length + 1}`, url: "" },
    ]);
  };

  const handleUpdateSolutionVideo = (
    index: number,
    field: "title" | "url",
    value: string,
  ) => {
    markDirty();
    const newVideos = [...solutionVideos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setSolutionVideos(newVideos);
  };

  const handleRemoveSolutionVideo = (index: number) => {
    markDirty();
    setSolutionVideos(solutionVideos.filter((_, i) => i !== index));
  };

  const router = useRouter();

  const handleSave = () => {
    if (!pdfUrl) return toast.error("Vui lòng tải file PDF");

    // Process videos to have default titles if empty
    const processedVideos = solutionVideos
      .filter((v) => v.url.trim() !== "") // Remove empty URLs
      .map((v, idx) => ({
        title: v.title.trim() || `Video lời giải phần ${idx + 1}`,
        url: v.url.trim(),
      }));

    startTransition(async () => {
      try {
        const resSave = await onSave({
          title: testName,
          pdfUrl,
          duration,
          showAnswers,
          explanation,
          solutionVideos: processedVideos,
          audioUrl,
          dueDate: dueDate ? new Date(dueDate) : null,
        });

        if (!resSave.success) throw new Error("Lỗi khi lưu thông tin chung");

        const resMatrix = await saveTestMatrix(resSave.testId!, sections);
        if (resMatrix.success) {
          resetDirty();
          toast.success("Đã lưu ma trận đáp án & lời giải");
          router.refresh();
        }
      } catch (e: any) {
        toast.error(e.message || "Lỗi khi lưu");
      }
    });
  };

  const handleFastEntry = (
    answers: string[],
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" = "MULTIPLE_CHOICE",
  ) => {
    markDirty();
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newQuestions = answers.map((ans, idx) => ({
      id: `temp-q-fast-${batchId}-${idx}`,
      position: idx,
      type,
      correctAnswer: ans.toUpperCase(),
      points: 1.0,
      explanation: "",
      videoUrl: "",
      audioUrl: "",
      needsManualGrading: false,
    }));

    setSections((prev) => {
      const ns = [...prev];
      if (ns.length === 0) return prev;

      const targetIdx =
        fastEntrySectionIdx !== null ? fastEntrySectionIdx : ns.length - 1;
      if (targetIdx >= 0 && targetIdx < ns.length) {
        ns[targetIdx] = {
          ...ns[targetIdx],
          questions: [...ns[targetIdx].questions, ...newQuestions],
        };
      }
      return ns;
    });
    toast.success(`Đã thêm nhanh ${answers.length} câu hỏi`);
    setFastEntrySectionIdx(null);
  };

  const handleConfirmParse = () => {
    markDirty();
    const newQuestions = tempParsedQuestions.map((q, i) => ({
      id: `parsed-final-${Date.now()}-${i}`,
      position: i,
      type: q.type,
      correctAnswer: q.correctAnswer,
      points: 1.0,
      category: q.question_category || "",
      explanation: "",
      videoUrl: "",
      audioUrl: "",
      needsManualGrading: false,
    }));

    setSections([
      {
        id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: "Phần 1: Trắc nghiệm & Tự luận",
        position: 0,
        questions: newQuestions,
      },
    ]);
    setIsParseDialogOpen(false);
    toast.success(`Đã cập nhật ${newQuestions.length} câu hỏi vào ma trận`);
  };

  const handleDelete = async () => {
    if (!initialTest?.id || !onDelete) return;
    if (!confirm("Bạn chắc chắn muốn xóa bài kiểm tra này?")) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkDirtySectionName = (sIdx: number, value: string) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      ns[sIdx] = { ...ns[sIdx], name: value };
      return ns;
    });
  };

  const handleRemoveSection = (sIdx: number) => {
    markDirty();
    setSections((prev) => {
      const ns = [...prev];
      ns.splice(sIdx, 1);
      return ns;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header removed per request */}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 h-full border-r bg-slate-100 relative group">
          {!pdfUrl ? (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Chưa có đề thi
              </h3>
              <p className="text-sm text-slate-500 mt-2 mb-8 max-w-[280px]">
                Tải lên file PDF chứa nội dung bài quiz để bắt đầu thiết lập.
              </p>
              <label className="cursor-pointer">
                <div className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {isUploading ? "Đang tải..." : "Chọn file PDF"}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          ) : (
            <>
              <PDFViewer url={pdfUrl} />
              <label className="absolute bottom-4 left-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="px-4 py-2 bg-white/90 backdrop-blur border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-2xl flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Đổi file PDF
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isUploading}
                />
              </label>
            </>
          )}
        </div>

        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="h-12 px-6 border-b flex items-center justify-between bg-slate-50/50 shrink-0 gap-3">
            <div className="flex gap-4 h-full">
              <button
                onClick={() => setActiveTab("matrix")}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest border-b-2 transition-all h-full",
                  activeTab === "matrix"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600",
                )}
              >
                Ma trận đáp án
              </button>
              <button
                onClick={() => setActiveTab("explanation")}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest border-b-2 transition-all h-full",
                  activeTab === "explanation"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600",
                )}
              >
                Lời giải toàn bài
              </button>
            </div>
            <div className="flex gap-2 items-center">
              {activeTab === "matrix" && (
                <div className="flex items-center gap-2 mr-4 border-r pr-4">
                  <Switch
                    id="showAnswers"
                    checked={showAnswers}
                    onCheckedChange={(v) => {
                      setShowAnswers(v);
                      markDirty();
                    }}
                  />
                  <Label
                    htmlFor="showAnswers"
                    className="text-[9px] font-black uppercase text-slate-500 cursor-pointer"
                  >
                    Hiện đáp án
                  </Label>
                </div>
              )}
              <Button
                onClick={handleSave}
                disabled={isPending || isUploading}
                size="sm"
                className="h-8 rounded-lg gap-1.5 font-black bg-yellow-500 hover:bg-yellow-600 shadow-sm shadow-yellow-100"
              >
                <Save className="w-3.5 h-3.5" />
                {isPending ? "..." : "Lưu"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === "explanation" ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-black text-slate-900 uppercase tracking-tight text-sm">
                      Video lời giải toàn bài
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddSolutionVideo}
                      className="h-8 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 font-bold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm video
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {solutionVideos.map((video, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300"
                      >
                        <div className="flex-1 space-y-1">
                          <Input
                            value={video.title}
                            onChange={(e) =>
                              handleUpdateSolutionVideo(
                                idx,
                                "title",
                                e.target.value,
                              )
                            }
                            placeholder="Tiêu đề (VD: Phần 1 - Đại số)"
                            className="h-9 rounded-xl font-bold text-slate-700 bg-slate-50/50"
                          />
                          <Input
                            value={video.url}
                            onChange={(e) =>
                              handleUpdateSolutionVideo(
                                idx,
                                "url",
                                e.target.value,
                              )
                            }
                            placeholder="Dán link Youtube tại đây..."
                            className="h-9 rounded-xl text-sm"
                          />
                        </div>
                        {solutionVideos.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSolutionVideo(idx)}
                            className="mt-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">
                    File PDF lời giải chi tiết toàn bài
                  </Label>
                  {!explanation ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-[24px] p-12 text-center bg-slate-50/50">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 mx-auto">
                        <Upload className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 mb-6">
                        Tải lên file PDF chứa lời giải chi tiết cho toàn bộ đề
                        thi.
                      </p>
                      <label className="cursor-pointer">
                        <div className="inline-flex px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95 items-center gap-2 text-sm">
                          <Upload className="w-4 h-4" />
                          {isUploadingExplanation
                            ? "Đang tải..."
                            : "Chọn file PDF"}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf"
                          onChange={handleExplanationPdfUpload}
                          disabled={isUploadingExplanation}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-emerald-900 truncate">
                              {explanation.split("/").pop()}
                            </p>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase">
                              File PDF đã tải lên
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setExplanation("");
                            markDirty();
                          }}
                          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl shrink-0"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                      <div className="h-[500px] border rounded-2xl overflow-hidden bg-slate-100">
                        <PDFViewer url={explanation} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-2 pb-6 border-b border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-slate-400">
                    Tên bài kiểm tra / Quiz Title
                  </Label>
                  <Input
                    value={testName}
                    onChange={(e) => {
                      setTestName(e.target.value);
                      markDirty();
                    }}
                    placeholder="Nhập tên bài kiểm tra (VD: Bài 1, Kiểm tra 15 phút...)"
                    className="h-10 rounded-xl font-bold text-slate-700 bg-slate-50/30 focus-visible:bg-white transition-all"
                  />
                </div>

                <DragDropContext onDragEnd={handleDragEnd}>
                {sections.map((section, sIdx) => (
                  <div key={section.id || sIdx} className="space-y-4">
                    <div className="flex items-center justify-between group/sec">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                          {sIdx + 1}
                        </div>
                        <Input
                          value={section.name}
                          onChange={(e) =>
                            handleMarkDirtySectionName(sIdx, e.target.value)
                          }
                          className="font-black text-slate-900 uppercase tracking-tight border-none p-0 h-auto focus-visible:ring-0 shadow-none w-[200px] bg-transparent"
                        />
                      </div>
                      <div className="flex gap-1 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFastEntrySectionIdx(sIdx);
                            setIsFastEntryOpen(true);
                          }}
                          className="h-8 rounded-lg gap-1.5 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Nhập nhanh
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveSection(sIdx)}
                          className="h-8 w-8 text-blue-400 hover:text-blue-600 opacity-0 group-hover/sec:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <Droppable droppableId={`droppable-section-${sIdx}`}>
                      {(provided) => (
                        <div
                          className="grid grid-cols-1 gap-4"
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {section.questions.map((q: any, qIdx: number) => (
                            <Draggable key={q.id || `temp-q-${sIdx}-${qIdx}`} draggableId={q.id?.toString() || `temp-q-${sIdx}-${qIdx}`} index={qIdx}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="flex flex-col gap-3 p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group/q relative"
                                >
                                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="w-6 text-center text-[10px] font-black text-slate-400 shrink-0">
                                      #{qIdx + 1}
                                    </div>

                                    {q.type === "MULTIPLE_CHOICE" ? (
                              <div className="flex gap-2 items-center">
                                <div className="flex gap-1">
                                  {["A", "B", "C", "D"].map((opt) => {
                                    const opts = (q.correctAnswer || "")
                                      .split(/[,|]/)
                                      .map((s: string) => s.trim());
                                    const isSelected = opts.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        onClick={() => {
                                          let currentOpts = (
                                            q.correctAnswer || ""
                                          )
                                            .split(",")
                                            .map((s: string) => s.trim())
                                            .filter(Boolean);
                                          if (
                                            (q.correctAnswer || "").includes(
                                              "|",
                                            )
                                          )
                                            currentOpts = [];
                                          if (currentOpts.includes(opt)) {
                                            currentOpts = currentOpts.filter(
                                              (o: string) => o !== opt,
                                            );
                                          } else {
                                            currentOpts.push(opt);
                                            currentOpts.sort();
                                          }
                                          handleUpdateQuestion(
                                            sIdx,
                                            qIdx,
                                            "correctAnswer",
                                            currentOpts.join(","),
                                          );
                                        }}
                                        className={cn(
                                          "w-8 h-8 rounded-lg border text-[11px] font-black transition-all",
                                          isSelected
                                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                            : "bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500",
                                        )}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                                <Input
                                  value={q.correctAnswer || ""}
                                  onChange={(e) =>
                                    handleUpdateQuestion(
                                      sIdx,
                                      qIdx,
                                      "correctAnswer",
                                      e.target.value.toUpperCase(),
                                    )
                                  }
                                  placeholder="Hoặc nhập (VD: A|B)"
                                  className="h-8 text-xs font-bold w-[130px] rounded-lg bg-white"
                                />
                              </div>
                            ) : q.type === "TRUE_FALSE" ? (
                              <div className="flex gap-1">
                                {[
                                  { label: "Đúng", value: "T" },
                                  { label: "Sai", value: "F" },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() =>
                                      handleUpdateQuestion(
                                        sIdx,
                                        qIdx,
                                        "correctAnswer",
                                        opt.value,
                                      )
                                    }
                                    className={cn(
                                      "px-3 h-8 rounded-lg border text-[11px] font-black transition-all",
                                      q.correctAnswer === opt.value
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500",
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <Input
                                value={q.correctAnswer}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    sIdx,
                                    qIdx,
                                    "correctAnswer",
                                    e.target.value,
                                  )
                                }
                                placeholder="Đáp án..."
                                className="h-9 rounded-lg border-slate-200 text-sm font-bold max-w-[120px]"
                              />
                            )}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={q.points}
                                  onChange={(e) =>
                                    handleUpdateQuestion(
                                      sIdx,
                                      qIdx,
                                      "points",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className="w-16 h-8 text-[11px] font-black pl-5 rounded-lg border-slate-200"
                                />
                                <span className="absolute left-1.5 top-1.5 text-[9px] font-black text-slate-400">
                                  P
                                </span>
                              </div>
                              <Button
                                onClick={() => handleRemoveQuestion(sIdx, qIdx)}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-300 hover:text-blue-600 opacity-0 group-hover/q:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full">
                            <div className="space-y-1 flex-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Phạm vi kiến thức (Dạng bài)
                              </Label>
                              <Input
                                value={q.category || ""}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    sIdx,
                                    qIdx,
                                    "category",
                                    e.target.value,
                                  )
                                }
                                placeholder="VD: Hàm số bậc 3..."
                                className="h-8 text-[11px] rounded-lg"
                              />
                            </div>
                            <div className="space-y-1 w-[140px] shrink-0">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Loại câu hỏi
                              </Label>
                              <Select
                                value={q.type}
                                onValueChange={(val) => handleChangeQuestionType(sIdx, qIdx, val)}
                              >
                                <SelectTrigger className="h-8 w-full text-[11px] font-bold bg-white border-slate-200">
                                  <SelectValue placeholder="Loại câu hỏi" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MULTIPLE_CHOICE" className="text-[11px] font-bold">Trắc nghiệm</SelectItem>
                                  <SelectItem value="TRUE_FALSE" className="text-[11px] font-bold">Đúng/Sai</SelectItem>
                                  <SelectItem value="SHORT_ANSWER" className="text-[11px] font-bold">Điền khuyết</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    <div className="pt-2 flex gap-2">
                      <Button
                        onClick={() =>
                          handleAddQuestion(sIdx, "MULTIPLE_CHOICE")
                        }
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Trắc nghiệm
                      </Button>
                      <Button
                        onClick={() => handleAddQuestion(sIdx, "TRUE_FALSE")}
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Đúng/Sai
                      </Button>
                      <Button
                        onClick={() => handleAddQuestion(sIdx, "SHORT_ANSWER")}
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Điền khuyết
                      </Button>
                    </div>
                  </div>
                ))}
                </DragDropContext>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setSections([
                      ...sections,
                      {
                        id: `temp-section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        name: `Phần ${sections.length + 1}`,
                        position: sections.length,
                        questions: [],
                      },
                    ]);
                  }}
                  className="w-full h-12 rounded-xl border-2 border-dashed border-slate-100 text-slate-400 font-bold hover:bg-slate-50 gap-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Thêm Phần mới (Section)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <FastEntryModal
        open={isFastEntryOpen}
        onOpenChange={(open) => {
          setIsFastEntryOpen(open);
          if (!open) setFastEntrySectionIdx(null);
        }}
        onConfirm={handleFastEntry}
      />

      <Dialog open={isParseDialogOpen} onOpenChange={setIsParseDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem]">
          <DialogHeader className="px-8 pt-8 pb-4 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900">
                  Kết quả bóc tách đề thi
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-500">
                  Hệ thống đã tự động nhận diện các câu hỏi từ file PDF của bạn.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-2 custom-scrollbar">
            {parseWarning && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-sm text-amber-800">
                <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">
                  {parseWarning}
                </span>
              </div>
            )}

            {tempParsedQuestions.length > 0 ? (
              <ParsedQuestionsForm
                questions={tempParsedQuestions}
                onChange={setTempParsedQuestions}
              />
            ) : (
              !parseWarning && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileWarning className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-bold">
                    Không tìm thấy câu hỏi nào theo đúng định dạng.
                  </p>
                </div>
              )
            )}
          </div>

          <DialogFooter className="px-8 py-6 bg-slate-50/80 border-t shrink-0 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsParseDialogOpen(false)}
              className="rounded-xl font-bold text-slate-500"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleConfirmParse}
              disabled={tempParsedQuestions.length === 0}
              className="rounded-xl px-8 font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
            >
              Xác nhận và Tạo ma trận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
