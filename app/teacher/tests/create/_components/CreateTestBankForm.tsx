"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, FileUp, Clock, ListChecks, Loader2, Sparkles, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ParsedQuestionsForm,
  type ParsedQuestion,
} from "@/components/teacher/test-builder/ParsedQuestionsForm";

export default function CreateTestBankForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("90");
  const [questionCount, setQuestionCount] = useState("");
  const [passScore, setPassScore] = useState("5.0");
  const [description, setDescription] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseWarning, setParseWarning] = useState("");

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setParseWarning("");
    setParsedQuestions([]);
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });

      if (!presignRes.ok) {
        throw new Error("Không tạo được link upload");
      }

      const presignData = await presignRes.json();
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Upload thất bại");
      }

      const fileUrl = presignData.fileUrl;
      setPdfUrl(fileUrl);
      toast.success("Tải PDF thành công");

      setIsParsing(true);
      try {
        const parseFormData = new FormData();
        parseFormData.append("file", file);
        const parseRes = await fetch("/api/exams/parse-pdf", {
          method: "POST",
          body: parseFormData,
        });
        const parseData = await parseRes.json();

        if (parseData.status === "warning") {
          setParseWarning(parseData.message);
        }

        if (parseData.data?.questions?.length > 0) {
          const mapped: ParsedQuestion[] = parseData.data.questions.map(
            (q: any, i: number) => ({
              id: `parsed-${i}`,
              order: q.order,
              question_label: q.question_label,
              question_category: q.question_category,
              type: "MULTIPLE_CHOICE" as const,
              correctAnswer: "",
            }),
          );
          setParsedQuestions(mapped);
          toast.success(`Phát hiện ${mapped.length} câu hỏi`);
        }
      } catch {
        toast.error("Không thể phân tích PDF");
      } finally {
        setIsParsing(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Không thể tải PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tên đề thi");
      return;
    }

    if (!pdfUrl) {
      toast.error("Vui lòng tải lên PDF");
      return;
    }

    setIsSaving(true);
    try {
      const questionsPayload = parsedQuestions.length > 0
        ? parsedQuestions.map((q) => ({
            order: q.order,
            question_category: q.question_category,
            type: q.type,
            correctAnswer: q.correctAnswer || undefined,
          }))
        : undefined;

      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          duration: Number(duration),
          passScore: passScore ? Number(passScore) : null,
          description,
          pdfUrl,
          settings: { showResultAfterSubmit: true, password: "" },
          questions: questionsPayload,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Tạo đề thi thất bại");
      }

      const data = await res.json();
      toast.success("Đã tạo đề thi");
      router.push(`/teacher/tests/bank/${data.testId}`);
    } catch (error: any) {
      toast.error(error.message || "Không thể tạo đề thi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-shell pb-16">
      <div className="container mx-auto px-4 md:px-6 py-10 max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Test Bank
            </p>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
              Tạo đề mới
            </h1>
            <p className="text-slate-500">
              Nhập thông tin cơ bản để tạo đề thi độc lập.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold"
              asChild
            >
              <Link href="/teacher/tests">Quay lại</Link>
            </Button>
            <Button
              onClick={handleCreate}
              className="rounded-2xl bg-slate-900 hover:bg-black font-black"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu
                </span>
              ) : (
                "Tạo và nhập đáp án"
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold">Tên đề thi</Label>
                <Input
                  placeholder="VD: Thi thu Toan 12 - De 01"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Môn / Chủ đề</Label>
                <Input
                  placeholder="VD: Toan 12"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="font-bold">Thời gian làm bài</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn thời gian" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45 phút</SelectItem>
                    <SelectItem value="60">60 phút</SelectItem>
                    <SelectItem value="90">90 phút</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Số câu hỏi</Label>
                <Input
                  placeholder="VD: 50"
                  type="number"
                  min={1}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Điểm đạt</Label>
                <Input
                  placeholder="VD: 5.0"
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={passScore}
                  onChange={(event) => setPassScore(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Tải lên PDF đề thi</Label>
              <div className="border border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                    <FileUp className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">
                      Kéo thả file PDF vào đây
                    </p>
                    <p className="text-xs text-slate-500">
                      {pdfUrl
                        ? "Đã tải lên"
                        : "Hoặc chọn từ máy tính, tối đa 200MB."}
                    </p>
                  </div>
                </div>
                <Input
                  type="file"
                  accept="application/pdf"
                  className="max-w-xs"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleUpload(file);
                    }
                  }}
                  disabled={isUploading}
                />
              </div>
              {isUploading && (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang tải PDF...
                </p>
              )}
              {isParsing && (
                <p className="text-xs text-blue-600 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang phân tích cấu trúc đề thi...
                </p>
              )}
              {parseWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                  <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseWarning}</span>
                </div>
              )}
              {pdfUrl && (
                <p className="text-xs text-emerald-600">
                  PDF đã sẵn sàng: {pdfUrl}
                </p>
              )}
            </div>

            {parsedQuestions.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-800">
                    Kết quả phân tích tự động
                  </span>
                </div>
                <ParsedQuestionsForm
                  questions={parsedQuestions}
                  onChange={setParsedQuestions}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-bold">Mô tả / Ghi chú</Label>
              <Textarea
                placeholder="Ghi chú về mục tiêu, kiến thức cần đánh giá..."
                className="min-h-[120px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 uppercase text-sm tracking-tight">
                  Gợi ý chuẩn hóa
                </h2>
                <p className="text-xs text-slate-500">
                  Đề thi độc lập cần đầy đủ thông tin.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    Thiết lập thời gian rõ ràng
                  </p>
                  <p className="text-xs text-slate-500">
                    Duy trì một chuẩn để so sánh kết quả.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <ListChecks className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    Nhập đáp án sau khi tạo
                  </p>
                  <p className="text-xs text-slate-500">
                    Chuyển sang màn hình split-screen để nhập nhanh.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 font-black"
              disabled={isSaving}
            >
              {isSaving ? "Đang tạo..." : "Đi đến màn nhập đáp án"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
