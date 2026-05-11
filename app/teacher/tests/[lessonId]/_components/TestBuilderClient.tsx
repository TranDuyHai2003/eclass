"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import axios from "axios";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Clock,
  Eye,
  Zap,
  Settings,
  FileUp,
  LayoutGrid,
  BarChart3,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { upsertTest, saveTestMatrix } from "@/actions/test";
import { cn } from "@/lib/utils";
import { FastEntryModal } from "@/components/teacher/test-builder/FastEntryModal";

// Lazy load PDF Viewer to avoid hydration issues
const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 font-bold text-slate-400">
      Đang tải PDF...
    </div>
  ),
});

interface TestBuilderClientProps {
  lesson: any;
  initialTest: any;
}

export default function TestBuilderClient({
  lesson,
  initialTest,
}: TestBuilderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [test, setTest] = useState(initialTest);

  // 1. Initial Setup State (PDF Upload, Duration)
  const [pdfUrl, setPdfUrl] = useState(initialTest?.pdfUrl || "");
  const [duration, setDuration] = useState(initialTest?.duration || 45);
  const [showAnswers, setShowAnswers] = useState(
    initialTest?.showAnswers || true,
  );
  const [explanation, setExplanation] = useState(
    initialTest?.explanation || "",
  );
  const [videoUrl, setVideoUrl] = useState(initialTest?.videoUrl || "");
  const [audioUrl, setAudioUrl] = useState(initialTest?.audioUrl || "");
  const [isUploading, setIsUploading] = useState(false);

  // 2. Matrix State
  const [sections, setSections] = useState<any[]>(
    initialTest?.sections.map((s: any) => ({
      ...s,
      questions: s.questions.map((q: any) => ({ ...q })),
    })) || [
      {
        id: "initial",
        name: "Phần 1: Trắc nghiệm",
        position: 0,
        questions: [],
      },
    ],
  );

  const [isFastEntryOpen, setIsFastEntryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"matrix" | "explanation">("matrix");

  // ─── Phase 1: Setup Test (Upload PDF) ───────────────────────────────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type } },
      );
      setPdfUrl(res.data.publicUrl);
      toast.success("Tải file PDF thành công!");

      const parseFormData = new FormData();
      parseFormData.append("file", file);
      const parseRes = await fetch("/api/exams/parse-pdf", {
        method: "POST",
        body: parseFormData,
      });
      const parseData = await parseRes.json();

      if (parseData.data?.questions?.length > 0 && !test) {
        const parsed = parseData.data.questions;
        const newQuestions = parsed.map((q: any, i: number) => ({
          id: `parsed-${Date.now()}-${i}`,
          position: i,
          type: "MULTIPLE_CHOICE" as const,
          correctAnswer: "",
          points: 1.0,
          explanation: q.question_category || "",
          videoUrl: "",
          audioUrl: "",
        }));
        setSections([
          {
            id: `section-${Date.now()}`,
            name: "Phần 1: Trắc nghiệm",
            position: 0,
            questions: newQuestions,
          },
        ]);
        toast.success(`Đã phát hiện ${parsed.length} câu hỏi từ PDF`);
      } else if (parseData.status === "warning") {
        toast.warning(parseData.message);
      }
    } catch {
      toast.error("Lỗi tải file PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateInitialTest = async () => {
    if (!pdfUrl) return toast.error("Vui lòng tải file PDF");

    startTransition(async () => {
      const res = await upsertTest(lesson.id, {
        pdfUrl,
        duration,
        showAnswers,
        explanation,
        videoUrl,
        audioUrl,
      });
      if (res.success) {
        setTest(res.test);
        toast.success("Đã khởi tạo bài thi");
      }
    });
  };

  const handleFastEntry = (answers: string[]) => {
    setSections((prev) => {
      const newSections = [...prev];
      if (newSections.length === 0) return prev;

      const targetSection = { ...newSections[0] };
      const startPos = targetSection.questions.length;

      const newQuestions = answers.map((ans, index) => ({
        id: `new-${Date.now()}-${index}`,
        position: startPos + index,
        type: "MULTIPLE_CHOICE",
        correctAnswer: ans,
        points: 1.0,
        explanation: "",
        videoUrl: "",
        audioUrl: "",
      }));

      targetSection.questions = [...targetSection.questions, ...newQuestions];
      newSections[0] = targetSection;
      return newSections;
    });
    toast.success(`Đã thêm nhanh ${answers.length} câu hỏi!`);
  };

  // ─── Phase 2: Matrix Management ──────────────────────────────────────────
  const addQuestion = (sectionId: string, type: string = "MULTIPLE_CHOICE") => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          const nextPos = s.questions.length;
          return {
            ...s,
            questions: [
              ...s.questions,
              {
                id: `new-${Date.now()}`,
                position: nextPos,
                type,
                correctAnswer: "",
                points: 1.0,
                explanation: "",
                videoUrl: "",
                audioUrl: "",
              },
            ],
          };
        }
        return s;
      }),
    );
  };

  const updateQuestion = (sectionId: string, qId: string, data: any) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions.map((q: any) =>
              q.id === qId ? { ...q, ...data } : q,
            ),
          };
        }
        return s;
      }),
    );
  };

  const removeQuestion = (sectionId: string, qId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions.filter((q: any) => q.id !== qId),
          };
        }
        return s;
      }),
    );
  };

  const handleSaveMatrix = async () => {
    if (!test?.id) return;
    startTransition(async () => {
      try {
        // Update general info first
        const resTest = await upsertTest(lesson.id, {
          pdfUrl,
          duration,
          showAnswers,
          explanation,
          videoUrl,
          audioUrl,
        });

        if (!resTest.success) throw new Error("Lỗi khi lưu thông tin chung");

        const resMatrix = await saveTestMatrix(test.id, sections);
        if (resMatrix.success) {
          toast.success("Đã lưu ma trận đáp án & lời giải");
        }
      } catch (e: any) {
        toast.error(e.message || "Lỗi khi lưu");
      }
    });
  };

  // ─── Render Setup UI if no test ──────────────────────────────────────────
  if (!test) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[32px] shadow-xl border border-slate-100 p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileUp className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Thiết lập Bài kiểm tra
            </h1>
            <p className="text-slate-500 text-sm">
              Tải lên đề thi PDF và cài đặt thời gian để bắt đầu.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">
                File đề thi (PDF)
              </Label>
              <div className="relative">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="h-12 pt-2.5 rounded-xl border-slate-200"
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl">
                    <Loader2 className="animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">
                Thời gian làm bài (Phút)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="h-12 rounded-xl border-slate-200 pl-10"
                />
                <Clock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
              </div>
            </div>

            <Button
              onClick={handleCreateInitialTest}
              disabled={isPending || !pdfUrl}
              className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              Tiếp tục thiết lập
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render Builder UI ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Header */}
      <header className="h-16 px-6 border-b flex items-center justify-between shrink-0 bg-white z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 truncate max-w-[300px]">
              {lesson.title}
            </h2>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Trình tạo Ma trận đề thi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {test && (
            <Button
              variant="outline"
              asChild
              className="rounded-xl font-bold gap-2 text-slate-600 border-slate-200"
            >
              <Link href={`/teacher/tests/${lesson.id}/analytics`}>
                <BarChart3 className="w-4 h-4" />
                Thống kê kết quả
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl font-bold gap-2 text-slate-600 border-slate-200"
          >
            <Eye className="w-4 h-4" />
            Xem thử (Học sinh)
          </Button>
          <Button
            onClick={handleSaveMatrix}
            disabled={isPending}
            className="rounded-xl font-black gap-2 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100"
          >
            <Save className="w-4 h-4" />
            Lưu thay đổi
          </Button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF View */}
        <div className="w-1/2 h-full border-r bg-slate-100 relative group">
          <PDFViewer url={test.pdfUrl} />
          {/* Floating settings shortcut */}
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full shadow-2xl gap-2 font-bold"
            >
              <Settings className="w-4 h-4" />
              Cài đặt đề
            </Button>
          </div>
        </div>

        {/* Right: Matrix Editor */}
        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="h-12 px-6 border-b flex items-center justify-between bg-slate-50/50 shrink-0">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("matrix")}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
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
                  "text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
                  activeTab === "explanation"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600",
                )}
              >
                Lời giải toàn bài
              </button>
            </div>
            {activeTab === "matrix" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsFastEntryOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg gap-1.5 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Nhập nhanh
                </Button>
                <FastEntryModal
                  open={isFastEntryOpen}
                  onOpenChange={setIsFastEntryOpen}
                  onConfirm={handleFastEntry}
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === "explanation" ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">
                    Video lời giải toàn bài (URL)
                  </Label>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">
                    File nghe lời giải toàn bài (URL)
                  </Label>
                  <Input
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">
                    Lời giải chi tiết toàn bài
                  </Label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Nhập nội dung lời giải chi tiết tại đây..."
                    className="w-full min-h-[300px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {sections.map((section, sIdx) => (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center justify-between group/sec">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-100">
                          {sIdx + 1}
                        </div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight">
                          {section.name}
                        </h3>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {section.questions.map((q: any, qIdx: number) => (
                        <div
                          key={q.id}
                          className="flex flex-col gap-3 p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group/q"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 text-center text-xs font-black text-slate-400">
                              #{qIdx + 1}
                            </div>

                            {q.type === "MULTIPLE_CHOICE" ? (
                              <div className="flex gap-1">
                                {["A", "B", "C", "D"].map((opt) => (
                                  <button
                                    key={opt}
                                    onClick={() =>
                                      updateQuestion(section.id, q.id, {
                                        correctAnswer: opt,
                                      })
                                    }
                                    className={cn(
                                      "w-8 h-8 rounded-lg border text-[11px] font-black transition-all",
                                      q.correctAnswer === opt
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500",
                                    )}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <Input
                                value={q.correctAnswer}
                                onChange={(e) =>
                                  updateQuestion(section.id, q.id, {
                                    correctAnswer: e.target.value,
                                  })
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
                                    updateQuestion(section.id, q.id, {
                                      points: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-16 h-8 text-[11px] font-black pl-5 rounded-lg border-slate-200"
                                />
                                <span className="absolute left-1.5 top-1.5 text-[9px] font-black text-slate-400">
                                  P
                                </span>
                              </div>
                              <Button
                                onClick={() => removeQuestion(section.id, q.id)}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-300 hover:text-red-600 opacity-0 group-hover/q:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Video câu hỏi
                              </Label>
                              <Input
                                value={q.videoUrl}
                                onChange={(e) =>
                                  updateQuestion(section.id, q.id, {
                                    videoUrl: e.target.value,
                                  })
                                }
                                placeholder="Video URL..."
                                className="h-8 text-[11px] rounded-lg"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Audio câu hỏi
                              </Label>
                              <Input
                                value={q.audioUrl}
                                onChange={(e) =>
                                  updateQuestion(section.id, q.id, {
                                    audioUrl: e.target.value,
                                  })
                                }
                                placeholder="Audio URL..."
                                className="h-8 text-[11px] rounded-lg"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400">
                              Lời giải chi tiết câu hỏi
                            </Label>
                            <textarea
                              value={q.explanation}
                              onChange={(e) =>
                                updateQuestion(section.id, q.id, {
                                  explanation: e.target.value,
                                })
                              }
                              placeholder="Giải thích tại sao chọn đáp án này..."
                              className="w-full min-h-[60px] p-2 text-[11px] rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex gap-2">
                      <Button
                        onClick={() =>
                          addQuestion(section.id, "MULTIPLE_CHOICE")
                        }
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Trắc nghiệm
                      </Button>
                      <Button
                        onClick={() => addQuestion(section.id, "SHORT_ANSWER")}
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Điền khuyết
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  variant="ghost"
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
    </div>
  );
}

