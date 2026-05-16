"use client";

import { useEffect, useMemo, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Settings,
  Link2,
  BarChart3,
  FileUp,
  Search,
  Download,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTeacherCoursesWithLessons, mapTestToLesson, unmapTest } from "@/actions/test";
import { toast } from "sonner";
import UnifiedTestBuilder from "@/components/teacher/test-builder/UnifiedTestBuilder";
import type { UnifiedSaveData } from "@/components/teacher/test-builder/UnifiedTestBuilder";

type TabKey = "config" | "content" | "mapping" | "analytics";

interface AttemptData {
  id: string;
  user: {
    name: string | null;
    email: string;
  };
  score: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface QuestionStat {
  id: string;
  label: string;
  correctRate: number;
}

export default function TestBankEditorClient({ testId }: { testId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("content");
  const [questions, setQuestions] = useState<any[]>([]);
  const [testData, setTestData] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("90");
  const [passScore, setPassScore] = useState("5.0");
  const [pdfUrl, setPdfUrl] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isMapping, startMappingTransition] = useTransition();
  const [mappedLessonId, setMappedLessonId] = useState<string | null>(null);
  const [mappedCourseId, setMappedCourseId] = useState<string | null>(null);

  const isDirtyRef = useRef(false);
  const markDirty = () => { isDirtyRef.current = true; };
  const resetDirty = () => { isDirtyRef.current = false; };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const scoreDistribution = useMemo(() => {
    if (attempts.length === 0) return [0, 0, 0, 0, 0];
    const distribution = [0, 0, 0, 0, 0];
    attempts.forEach(a => {
      if (a.score === null) return;
      if (a.score < 4) distribution[0]++;
      else if (a.score < 6) distribution[1]++;
      else if (a.score < 7) distribution[2]++;
      else if (a.score < 8) distribution[3]++;
      else distribution[4]++;
    });
    return distribution;
  }, [attempts]);

  const maxScoreBucket = Math.max(...scoreDistribution);

  useEffect(() => {
    let isMounted = true;

    const loadTest = async () => {
      try {
        const res = await fetch(`/api/tests/${testId}`);
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (!isMounted) return;

        const test = data.test;
        setTestData(test);
        setTitle(test?.title || "");
        setSubject(test?.subject || "");
        setDescription(test?.description || "");
        setDuration(test?.duration?.toString() || "90");
        setPassScore(test?.passScore?.toString() || "5.0");
        setPdfUrl(test?.pdfUrl || "");
        setMappedLessonId(test?.lessonId || null);
        setMappedCourseId(test?.courseId || null);
        if (test?.dueDate) {
          setDueDate(new Date(test.dueDate).toISOString().slice(0, 16));
        }

        if (Array.isArray(test?.sections) && test.sections.length > 0) {
          const flatQuestions = test.sections
            .flatMap((section: any) => section.questions || [])
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((q: any, index: number) => ({
              id: q.id,
              label: `Câu ${index + 1}`,
              answer: q.correctAnswer || "",
              points: q.points ?? 1,
              category: q.category || "",
            }));
          if (flatQuestions.length > 0) {
            setQuestions(flatQuestions);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadAnalytics = async () => {
      try {
        const res = await fetch(`/api/tests/${testId}/analytics`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAttempts(data.attempts || []);
            setQuestionStats(data.questionStats || []);
          }
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      }
    };

    loadTest();
    if (activeTab === "analytics") {
      loadAnalytics();
    }
    return () => {
      isMounted = false;
    };
  }, [testId, activeTab]);

  useEffect(() => {
    if (activeTab !== "mapping") return;
    let cancelled = false;
    setIsLoadingCourses(true);
    getTeacherCoursesWithLessons().then((data) => {
      if (!cancelled) {
        setCourses(data);
        setIsLoadingCourses(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          description,
          pdfUrl,
          duration: Number(duration),
          passScore: passScore ? Number(passScore) : null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      resetDirty();
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/tests/${testId}/export`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Ket_qua_${title.replace(/\s+/g, "_")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setIsExporting(false);
    }
  };

  const unifiedInitialTest = useMemo(() => ({
    id: testId,
    pdfUrl,
    duration: Number(duration),
    showAnswers: testData?.showAnswers ?? true,
    explanation: testData?.explanation || "",
    videoUrl: testData?.videoUrl || "",
    audioUrl: testData?.audioUrl || "",
    dueDate: dueDate ? new Date(dueDate) : null,
    sections: testData?.sections || [],
  }), [testId, pdfUrl, duration, dueDate, testData]);

  const handleContentSave = useCallback(async (data: UnifiedSaveData) => {
    const res = await fetch(`/api/tests/${testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfUrl: data.pdfUrl,
        duration: data.duration,
        showAnswers: data.showAnswers,
        explanation: data.explanation || "",
        videoUrl: data.videoUrl || "",
        audioUrl: data.audioUrl || "",
        dueDate: data.dueDate ? data.dueDate.toISOString() : null,
      }),
    });
    if (!res.ok) throw new Error("Lỗi khi lưu thông tin chung");
    const result = await res.json();
    return { success: true, testId: result.testId };
  }, [testId]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-10 text-center text-slate-500">
          Đang tải dữ liệu đề thi...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl space-y-6">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-2xl">
            <Link href="/teacher/tests">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Test Bank
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">
              Đề thi độc lập #{testId}
            </h1>
            <p className="text-slate-500 text-sm">
              Cập nhật thông tin và xem thống kê trong cùng một màn hình.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "config" && (
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold"
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
            >
              {isSavingConfig ? "Đang lưu" : "Lưu nháp"}
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "config", label: "Cấu hình đề", icon: Settings },
            { key: "content", label: "Nội dung / Đáp án", icon: FileText },
            { key: "mapping", label: "Cài đặt khóa học", icon: Link2 },
            {
              key: "analytics",
              label: "Thống kê & Bảng điểm",
              icon: BarChart3,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all",
              activeTab === tab.key
                ? "bg-slate-900 text-white shadow-lg shadow-black/10"
                : "bg-white text-slate-600 hover:text-slate-900 hover:shadow-md",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "config" && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-bold">Tên đề thi</Label>
              <Input
                value={title}
                onChange={(event) => { setTitle(event.target.value); markDirty(); }}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Môn / Chủ đề</Label>
              <Input
                value={subject}
                onChange={(event) => { setSubject(event.target.value); markDirty(); }}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="font-bold">Thời gian làm bài</Label>
              <Input
                value={duration}
                onChange={(event) => { setDuration(event.target.value); markDirty(); }}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Số câu hỏi</Label>
              <Input value={questions.length} type="number" disabled />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Điểm đạt</Label>
              <Input
                value={passScore}
                onChange={(event) => { setPassScore(event.target.value); markDirty(); }}
                type="number"
                step="0.1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Mô tả / Ghi chú</Label>
            <Textarea
              value={description}
              onChange={(event) => { setDescription(event.target.value); markDirty(); }}
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Hạn nộp bài</Label>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
              className="max-w-xs"
            />
          </div>
          <div className="border border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="font-bold text-slate-800">PDF đề thi</p>
                <p className="text-xs text-slate-500">
                  Đang tải lên: de-thi-toan-12.pdf
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold"
            >
              Đổi file
            </Button>
          </div>
        </section>
      )}

      {activeTab === "content" && (
        <div className="-mx-4 md:-mx-6 -mb-8" style={{ height: 'calc(100vh - 200px)' }}>
          <UnifiedTestBuilder
            key={testId}
            initialTest={unifiedInitialTest}
            title="Nội dung đề thi"
            subtitle="Test Bank"
            hideHeader
            onSave={handleContentSave}
          />
        </div>
      )}

      {activeTab === "mapping" && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Mapping
              </p>
              <h2 className="text-xl font-black text-slate-900">
                Gán vào bài học
              </h2>
              <p className="text-xs text-slate-500">
                Chọn bài học để gán đề thi này. Mỗi bài học chỉ chứa một đề.
              </p>
            </div>
            {mappedLessonId && (
              <Button
                variant="outline"
                className="rounded-2xl border-red-200 text-red-600 font-bold hover:bg-red-50"
                onClick={async () => {
                  const ok = confirm("Gỡ đề thi khỏi bài học hiện tại?");
                  if (!ok) return;
                  const res = await unmapTest(testId);
                  if (res.success) {
                    setMappedLessonId(null);
                    setMappedCourseId(null);
                    toast.success("Đã gỡ đề thi khỏi bài học");
                  }
                }}
                disabled={isMapping}
              >
                Gỡ đề
              </Button>
            )}
          </div>

          {isLoadingCourses ? (
            <div className="text-center py-12 text-slate-400 font-bold">
              Đang tải danh sách khóa học...
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic">
              Chưa có khóa học nào. Hãy tạo khóa học trước.
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-[24px] border border-slate-100 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 bg-slate-50/50">
                    <div>
                      <p className="font-black text-slate-900">{course.title}</p>
                      <p className="text-xs text-slate-500">
                        {course.chapters.reduce((acc: number, ch: any) => acc + ch.lessons.length, 0)} bài học
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {course.chapters.map((chapter: any) => (
                      <div key={chapter.id} className="px-5 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                          {chapter.title}
                        </p>
                        <div className="space-y-2">
                          {chapter.lessons.map((lesson: any) => {
                            const isMapped = mappedLessonId === lesson.id;
                            const hasOtherTest = lesson.test && lesson.test.id !== testId;
                            return (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between rounded-xl px-4 py-2.5 bg-slate-50/50 hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-sm font-bold text-slate-700 truncate">
                                    {lesson.title}
                                  </span>
                                  {isMapped && (
                                    <Badge className="rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                                      Đã gán
                                    </Badge>
                                  )}
                                  {hasOtherTest && (
                                    <Badge className="rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest">
                                      Đã có đề khác
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant={isMapped ? "default" : "outline"}
                                  className={cn(
                                    "rounded-xl font-black text-[10px] uppercase tracking-widest h-8 px-4 shrink-0 ml-3",
                                    isMapped
                                      ? "bg-emerald-600 hover:bg-emerald-700"
                                      : "border-slate-200"
                                  )}
                                  disabled={hasOtherTest || isMapping}
                                  onClick={async () => {
                                    if (!confirm(`Gán đề thi này vào bài học "${lesson.title}"?`)) return;
                                    const res = await mapTestToLesson(testId, lesson.id);
                                    if (res.success) {
                                      setMappedLessonId(lesson.id);
                                      setMappedCourseId(null);
                                      toast.success(`Đã gán vào bài học "${lesson.title}"`);
                                    }
                                  }}
                                >
                                  {isMapped ? "Đã gán" : "Gán"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "analytics" && (
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { label: "Đã nộp", value: "42/60", tone: "bg-blue-600" },
              { label: "Điểm TB", value: "7.2", tone: "bg-emerald-600" },
              { label: "Điểm cao nhất", value: "9.6", tone: "bg-slate-900" },
              { label: "Điểm thấp nhất", value: "2.4", tone: "bg-amber-600" },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    {card.label}
                  </p>
                  <span className={cn("w-2 h-2 rounded-full", card.tone)} />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-3">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Score Distribution
                  </p>
                  <h3 className="text-lg font-black text-slate-900">
                    Phổ điểm học sinh
                  </h3>
                </div>
                <Badge className="rounded-full bg-slate-100 text-slate-600">
                  0-10
                </Badge>
              </div>
              <div className="flex items-end gap-4 h-[240px]">
                {["0-4", "4-6", "6-7", "7-8", "8-10"].map((label, index) => {
                  const value = scoreDistribution[index];
                  const height = maxScoreBucket
                    ? (value / maxScoreBucket) * 100
                    : 0;
                  return (
                    <div
                      key={label}
                      className="flex-1 flex flex-col items-center gap-3"
                    >
                      <div className="w-full h-full flex items-end">
                        <div
                          className="w-full rounded-2xl bg-gradient-to-t from-slate-900 to-slate-500"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-bold">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Nhanh
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  Điểm nhấn UX
                </h3>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>44% học sinh trên điểm TB</span>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  <span>3 câu có tỉ lệ đúng dưới 35%</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>5 lớp đang sử dụng đề này</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-slate-200 font-bold"
              >
                Xem chi tiết
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Danh sách nộp bài
                </h3>
                <p className="text-xs text-slate-500">
                  Tìm kiếm và lọc theo học viên.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    className="pl-9 h-10 rounded-2xl border-slate-200"
                    placeholder="Tìm theo tên..."
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-10 rounded-2xl border-slate-200 font-bold"
                  onClick={handleExport}
                  disabled={isExporting || attempts.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" /> 
                  {isExporting ? "Đang xuất..." : "Xuất Excel"}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">Bắt đầu</th>
                    <th className="px-4 py-3">Nộp bài</th>
                    <th className="px-4 py-3 text-center">Điểm số</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold italic">
                        Chưa có học sinh nào nộp bài.
                      </td>
                    </tr>
                  ) : (
                    attempts.map((attempt, index) => (
                      <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-bold">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{attempt.user.name || "N/A"}</p>
                          <p className="text-[10px] text-slate-400">{attempt.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(attempt.startedAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString("vi-VN") : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={cn(
                            "rounded-xl font-black",
                            (attempt.score || 0) >= 5 ? "bg-emerald-500" : "bg-red-500"
                          )}>
                            {attempt.score !== null ? attempt.score.toFixed(2) : "N/A"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl font-bold text-blue-600 hover:bg-blue-50"
                          >
                            Chi tiết
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Phân tích độ khó câu hỏi
              </h3>
              <p className="text-xs text-slate-500">
                Nhận biết câu hỏi cần điều chỉnh dựa trên tỉ lệ trả lời đúng.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {questionStats.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 italic font-bold">
                  Không có dữ liệu phân tích.
                </div>
              ) : (
                questionStats.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 px-5 py-4 hover:shadow-md transition-shadow"
                  >
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight text-xs">{q.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tỉ lệ đúng</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                        <div
                          className={cn(
                            "h-full transition-all duration-1000",
                            q.correctRate > 70
                              ? "bg-emerald-500"
                              : q.correctRate > 40
                              ? "bg-amber-500"
                              : "bg-red-500",
                          )}
                          style={{ width: `${q.correctRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-slate-900 w-10 text-right">
                        {Math.round(q.correctRate)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
