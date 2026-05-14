"use client";

import { useState, useTransition, useEffect } from "react";
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
  LayoutGrid,
  BarChart3,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { upsertTest, saveTestMatrix } from "@/actions/test";
import { cn } from "@/lib/utils";
import { FastEntryModal } from "@/components/teacher/test-builder/FastEntryModal";

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

  // Settings State
  const [pdfUrl, setPdfUrl] = useState(initialTest?.pdfUrl || "");
  const [duration, setDuration] = useState(initialTest?.duration || 45);
  const [showAnswers, setShowAnswers] = useState(
    initialTest?.showAnswers ?? true,
  );
  const [explanation, setExplanation] = useState(
    initialTest?.explanation || "",
  );
  const [videoUrl, setVideoUrl] = useState(initialTest?.videoUrl || "");
  const [audioUrl, setAudioUrl] = useState(initialTest?.audioUrl || "");
  
  const [isUploading, setIsUploading] = useState(false);
  const [isFastEntryOpen, setIsFastEntryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"matrix" | "explanation">("matrix");
  const [isDeleting, setIsDeleting] = useState(false);

  // Matrix State
  const [sections, setSections] = useState<any[]>(
    initialTest?.sections.map((s: any) => ({
      ...s,
      questions: s.questions.map((q: any) => ({ ...q })),
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
    try {
      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type } },
      );
      setPdfUrl(res.data.publicUrl);
      toast.success("Tải file PDF thành công!");

      // Optional: Auto-parse PDF if it's a new test
      if (!initialTest) {
        const parseFormData = new FormData();
        parseFormData.append("file", file);
        const parseRes = await fetch("/api/exams/parse-pdf", {
          method: "POST",
          body: parseFormData,
        });
        const parseData = await parseRes.json();

        if (parseData.data?.questions?.length > 0) {
          const parsed = parseData.data.questions;
          const newQuestions = parsed.map((q: any, i: number) => ({
            id: `parsed-${Date.now()}-${i}`,
            position: i,
            type: "MULTIPLE_CHOICE",
            correctAnswer: "",
            points: 1.0,
            explanation: q.question_category || "",
            videoUrl: "",
            audioUrl: "",
            needsManualGrading: false,
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
        }
      }
    } catch {
      toast.error("Lỗi tải file PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddQuestion = (sIdx: number, type: string = "MULTIPLE_CHOICE") => {
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      const nextPos = targetSection.questions.length;
      
      targetSection.questions = [
        ...targetSection.questions,
        {
          id: `temp-q-${Date.now()}`,
          position: nextPos,
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
    setSections((prev) => {
      const ns = [...prev];
      const targetSection = { ...ns[sIdx] };
      const targetQuestions = [...targetSection.questions];
      
      targetQuestions[qIdx] = {
        ...targetQuestions[qIdx],
        [field]: value,
      };
      
      targetSection.questions = targetQuestions;
      ns[sIdx] = targetSection;
      return ns;
    });
  };

  const handleRemoveQuestion = (sIdx: number, qIdx: number) => {
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

  const handleSave = async () => {
    if (!pdfUrl) return toast.error("Vui lòng tải file PDF");

    startTransition(async () => {
      try {
        const resTest = await upsertTest(lesson.id, {
          pdfUrl,
          duration,
          showAnswers,
          explanation,
          videoUrl,
          audioUrl,
        });

        if (!resTest.success) throw new Error("Lỗi khi lưu thông tin chung");

        const resMatrix = await saveTestMatrix(resTest.test!.id, sections);
        if (resMatrix.success) {
          toast.success("Đã lưu ma trận đáp án & lời giải");
          router.refresh();
        }
      } catch (e: any) {
        toast.error(e.message || "Lỗi khi lưu");
      }
    });
  };

  const handleDelete = async () => {
    if (!initialTest?.id) {
      toast.error("Chưa có bài kiểm tra để xóa");
      return;
    }
    if (!confirm("Bạn chắc chắn muốn xóa bài kiểm tra này?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tests/${initialTest.id}`, { method: "DELETE" });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Xóa bài kiểm tra thất bại");
      }
      toast.success("Đã xóa bài kiểm tra");
      router.push("/teacher/tests");
    } catch (e: any) {
      toast.error(e.message || "Không thể xóa bài kiểm tra");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFastEntry = (answers: string[]) => {
    const newQuestions = answers.map((ans, idx) => ({
      id: `temp-q-fast-${Date.now()}-${idx}`,
      position: idx,
      type: "MULTIPLE_CHOICE",
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
      ns[0].questions = [...ns[0].questions, ...newQuestions];
      return ns;
    });
    toast.success(`Đã thêm nhanh ${answers.length} câu hỏi`);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Header */}
      <header className="min-h-[64px] px-6 border-b flex items-center justify-between shrink-0 bg-white z-50 shadow-sm flex-wrap gap-3 sticky top-0">
        <div className="flex items-center gap-4 min-w-0">
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
              Trình tạo Bài Quiz bài giảng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end ml-auto w-full lg:w-auto">
          <div className="flex items-center gap-2 border-r pr-4 mr-2 w-full lg:w-auto">
            <Label
              htmlFor="duration"
              className="text-[10px] font-black uppercase text-slate-400"
            >
              Thời gian (Phút):
            </Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-16 h-8 text-xs font-bold"
            />
          </div>
          
          <Button
            variant="outline"
            asChild
            className="rounded-xl font-bold gap-2 text-slate-600 border-slate-200 h-9"
          >
            <Link href={`/watch/${lesson.id}/quiz`}>
              <Eye className="w-4 h-4" />
              Bài kiểm tra
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="rounded-xl font-bold gap-2 text-slate-600 border-slate-200 h-9"
          >
            <Link href={`/teacher/tests/${lesson.id}/analytics`}>
              <BarChart3 className="w-4 h-4" />
              Thống kê
            </Link>
          </Button>

          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting || !initialTest?.id}
            className="rounded-xl font-bold gap-2 text-red-600 border-red-200 hover:bg-red-50 h-9"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Đang xóa..." : "Xóa bài"}
          </Button>

          <Button
            onClick={handleSave}
            disabled={isPending || isUploading}
            className="rounded-xl font-black gap-2 bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-100 h-9"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Đang lưu..." : "Lưu bài kiểm tra"}
          </Button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF View */}
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

        {/* Right: Matrix Editor */}
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
            {activeTab === "matrix" && (
              <div className="flex gap-2 items-center">
                <div className="flex items-center gap-2 mr-4 border-r pr-4">
                  <Switch
                    id="showAnswers"
                    checked={showAnswers}
                    onCheckedChange={setShowAnswers}
                  />
                  <Label
                    htmlFor="showAnswers"
                    className="text-[9px] font-black uppercase text-slate-500 cursor-pointer"
                  >
                    Hiện đáp án
                  </Label>
                </div>
                <Button
                  onClick={() => setIsFastEntryOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg gap-1.5 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Nhập nhanh
                </Button>
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
                    className="rounded-xl h-12"
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
                    className="rounded-xl h-12"
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
                    className="w-full min-h-[400px] p-6 rounded-[24px] border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium leading-relaxed bg-slate-50/30"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {sections.map((section, sIdx) => (
                  <div key={section.id || sIdx} className="space-y-4">
                    <div className="flex items-center justify-between group/sec">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                          {sIdx + 1}
                        </div>
                        <Input
                          value={section.name}
                          onChange={(e) => {
                            const ns = [...sections];
                            ns[sIdx].name = e.target.value;
                            setSections(ns);
                          }}
                          className="font-black text-slate-900 uppercase tracking-tight border-none p-0 h-auto focus-visible:ring-0 shadow-none w-[200px] bg-transparent"
                        />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const ns = [...sections];
                            ns.splice(sIdx, 1);
                            setSections(ns);
                          }}
                          className="h-8 w-8 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {section.questions.map((q: any, qIdx: number) => (
                        <div
                          key={q.id || qIdx}
                          className="flex flex-col gap-3 p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group/q"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 text-center text-[10px] font-black text-slate-400">
                              #{qIdx + 1}
                            </div>

                            {q.type === "MULTIPLE_CHOICE" ? (
                              <div className="flex gap-1">
                                {["A", "B", "C", "D"].map((opt) => (
                                  <button
                                    key={opt}
                                    onClick={() =>
                                      handleUpdateQuestion(
                                        sIdx,
                                        qIdx,
                                        "correctAnswer",
                                        opt,
                                      )
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
                                onClick={() =>
                                  handleRemoveQuestion(sIdx, qIdx)
                                }
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
                                  handleUpdateQuestion(
                                    sIdx,
                                    qIdx,
                                    "videoUrl",
                                    e.target.value,
                                  )
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
                                  handleUpdateQuestion(
                                    sIdx,
                                    qIdx,
                                    "audioUrl",
                                    e.target.value,
                                  )
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
                                handleUpdateQuestion(
                                  sIdx,
                                  qIdx,
                                  "explanation",
                                  e.target.value,
                                )
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
                        onClick={() => handleAddQuestion(sIdx, "MULTIPLE_CHOICE")}
                        size="sm"
                        variant="outline"
                        className="rounded-lg border-dashed border-slate-300 text-slate-500 gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm Trắc nghiệm
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

                <Button
                  variant="ghost"
                  onClick={() => {
                    setSections([
                      ...sections,
                      {
                        id: `temp-section-${Date.now()}`,
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
        onOpenChange={setIsFastEntryOpen}
        onConfirm={handleFastEntry}
      />
    </div>
  );
}
