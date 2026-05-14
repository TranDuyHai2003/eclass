"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Test, TestSection, Question } from "@prisma/client";
import { toast } from "sonner";
import {
  Save,
  Plus,
  ArrowLeft,
  Settings2,
  FileText,
  Upload,
  Trophy,
  Zap,
  LayoutGrid,
  Trash2,
  X,
  Video,
  Headphones,
  Settings,
} from "lucide-react";
import { upsertCourseTest, saveTestMatrix } from "@/actions/test";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import axios from "axios";
import { FastEntryModal } from "@/components/teacher/test-builder/FastEntryModal";
import { cn } from "@/lib/utils";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 font-bold text-gray-400">
      Đang tải trình xem PDF...
    </div>
  ),
});

type TestWithRelations = Test & {
  sections: (TestSection & { questions: Question[] })[];
};

export default function CourseTestBuilderClient({
  course,
  initialTest,
}: {
  course: { id: string; title: string };
  initialTest: TestWithRelations | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pdfUrl, setPdfUrl] = useState(initialTest?.pdfUrl || "");
  const [duration, setDuration] = useState(initialTest?.duration || 60);
  const [showAnswers, setShowAnswers] = useState(
    initialTest?.showAnswers ?? true,
  );
  const [explanation, setExplanation] = useState(
    initialTest?.explanation || "",
  );
  const [videoUrl, setVideoUrl] = useState(initialTest?.videoUrl || "");
  const [audioUrl, setAudioUrl] = useState(initialTest?.audioUrl || "");

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [fastEntryOpen, setFastEntryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"matrix" | "explanation">(
    "matrix",
  );

  const [sections, setSections] = useState<any[]>(
    initialTest?.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => ({ ...q })),
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
    setUploadingPdf(true);
    try {
      const uploadRes = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type } },
      );
      setPdfUrl(uploadRes.data.publicUrl);
      toast.success("Tải lên PDF thành công");
    } catch {
      toast.error("Lỗi khi tải file");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleAddQuestion = (sIdx: number, type: string = "MULTIPLE_CHOICE") => {
    const ns = [...sections];
    ns[sIdx].questions.push({
      id: `temp-q-${Date.now()}`,
      position: ns[sIdx].questions.length,
      type,
      correctAnswer: "",
      points: 1.0,
      explanation: "",
      videoUrl: "",
      audioUrl: "",
      needsManualGrading: false,
    });
    setSections(ns);
  };

  const handleUpdateQuestion = (
    sIdx: number,
    qIdx: number,
    field: string,
    value: any,
  ) => {
    const ns = [...sections];
    ns[sIdx].questions[qIdx] = { ...ns[sIdx].questions[qIdx], [field]: value };
    setSections(ns);
  };

  const handleRemoveQuestion = (sIdx: number, qIdx: number) => {
    const ns = [...sections];
    ns[sIdx].questions.splice(qIdx, 1);
    setSections(ns);
  };

  const handleSave = () => {
    if (!pdfUrl) {
      toast.error("Vui lòng tải lên đề thi PDF");
      return;
    }
    startTransition(async () => {
      try {
        const resTest = await upsertCourseTest(course.id, {
          pdfUrl,
          duration,
          showAnswers,
          explanation,
          videoUrl,
          audioUrl,
        });
        if (!resTest.success) throw new Error("Lỗi khi lưu thông tin chung");

        const resMatrix = await saveTestMatrix(resTest.test!.id, sections);
        if (!resMatrix.success) throw new Error("Lỗi khi lưu ma trận đề");

        toast.success("Đã lưu bài kiểm tra khóa học");
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Đã xảy ra lỗi");
      }
    });
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
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="h-16 px-6 border-b flex items-center justify-between shrink-0 bg-white z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/teacher/courses/${course.id}`)}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h1 className="font-black text-slate-900 truncate max-w-[400px]">
                Bài kiểm tra cuối khóa
              </h1>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {course.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 border-r pr-4">
            <Label
              htmlFor="duration"
              className="text-[10px] font-black uppercase text-slate-400"
            >
              Thời gian:
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
            onClick={handleSave}
            disabled={isPending || uploadingPdf}
            className="rounded-xl font-black gap-2 bg-yellow-500 hover:bg-yellow-600 shadow-lg shadow-yellow-100"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Đang lưu..." : "Lưu bài kiểm tra"}
          </Button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF View */}
        <div className="w-1/2 border-r bg-slate-100 relative group">
          {!pdfUrl ? (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Chưa có đề thi
              </h3>
              <p className="text-sm text-slate-500 mt-2 mb-8 max-w-[280px]">
                Tải lên file PDF chứa nội dung đề thi cuối khóa để bắt đầu thiết
                lập.
              </p>
              <label className="cursor-pointer">
                <div className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {uploadingPdf ? "Đang tải..." : "Chọn file PDF"}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={uploadingPdf}
                />
              </label>
            </div>
          ) : (
            <PDFViewer url={pdfUrl} />
          )}
          {pdfUrl && (
            <label className="absolute bottom-4 left-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="px-4 py-2 bg-white/90 backdrop-blur border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-2xl flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" /> Đổi file PDF
              </div>
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={uploadingPdf}
              />
            </label>
          )}
        </div>

        {/* Right: Matrix Editor */}
        <div className="w-1/2 flex flex-col bg-white overflow-hidden">
          <div className="h-12 px-6 border-b flex items-center justify-between bg-slate-50/50 shrink-0">
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
              <div className="flex gap-2">
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
                  onClick={() => setFastEntryOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg gap-1.5 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Nhập nhanh
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
        open={fastEntryOpen}
        onOpenChange={setFastEntryOpen}
        onConfirm={handleFastEntry}
      />
    </div>
  );
}

