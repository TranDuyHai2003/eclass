"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Settings,
  Link2,
  BarChart3,
  FileUp,
  Zap,
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
import { FastEntryModal } from "@/components/teacher/test-builder/FastEntryModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 font-bold text-slate-400">
      Dang tai PDF...
    </div>
  ),
});

type TabKey = "config" | "content" | "mapping" | "analytics";

const mockQuestions = Array.from({ length: 12 }, (_, index) => ({
  id: `q-${index + 1}`,
  label: `Cau ${index + 1}`,
  answer: ["A", "B", "C", "D"][index % 4],
  points: 1,
}));

const mockStudents = [
  {
    id: "s1",
    name: "Nguyen Thu Linh",
    course: "Toan 12",
    time: "45p 12s",
    submittedAt: "02/05/2026 08:42",
    score: 8.4,
  },
  {
    id: "s2",
    name: "Tran Duc Anh",
    course: "Toan 12",
    time: "39p 10s",
    submittedAt: "02/05/2026 08:55",
    score: 6.9,
  },
  {
    id: "s3",
    name: "Le Quoc Bao",
    course: "Toan 12",
    time: "48p 02s",
    submittedAt: "02/05/2026 09:10",
    score: 9.2,
  },
  {
    id: "s4",
    name: "Pham Ha My",
    course: "Toan 12",
    time: "52p 45s",
    submittedAt: "02/05/2026 09:32",
    score: 4.8,
  },
];

const mockQuestionStats = Array.from({ length: 10 }, (_, index) => ({
  id: `q-${index + 1}`,
  label: `Cau ${index + 1}`,
  correctRate: 90 - index * 6,
}));

export default function TestBankEditorClient({ testId }: { testId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("content");
  const [isFastEntryOpen, setIsFastEntryOpen] = useState(false);
  const [questions, setQuestions] = useState(mockQuestions);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("90");
  const [passScore, setPassScore] = useState("5.0");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  const scoreDistribution = useMemo(() => [3, 6, 9, 7, 5], []);
  const maxScoreBucket = Math.max(...scoreDistribution);

  const handleFastEntry = (answers: string[]) => {
    const next = answers.map((answer, index) => ({
      id: `q-new-${Date.now()}-${index}`,
      label: `Cau ${questions.length + index + 1}`,
      answer,
      points: 1,
    }));
    setQuestions((prev) => [...prev, ...next]);
  };

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
        setTitle(test?.title || "");
        setSubject(test?.subject || "");
        setDescription(test?.description || "");
        setDuration(test?.duration?.toString() || "90");
        setPassScore(test?.passScore?.toString() || "5.0");
        setPdfUrl(test?.pdfUrl || "");

        if (Array.isArray(test?.sections) && test.sections.length > 0) {
          const flatQuestions = test.sections
            .flatMap((section: any) => section.questions || [])
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((q: any, index: number) => ({
              id: q.id,
              label: `Cau ${index + 1}`,
              answer: q.correctAnswer || "",
              points: q.points ?? 1,
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

    loadTest();
    return () => {
      isMounted = false;
    };
  }, [testId]);

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
        }),
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveMatrix = async () => {
    setIsSavingMatrix(true);
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
        }),
      });
      await fetch(`/api/tests/${testId}/matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: [
            {
              name: "Phan 1: Trac nghiem",
              order: 1,
              questions: questions.map((q, index) => ({
                order: index + 1,
                type: "MULTIPLE_CHOICE",
                correctAnswer: q.answer,
                points: q.points,
              })),
            },
          ],
        }),
      });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-10 text-center text-slate-500">
          Dang tai du lieu de thi...
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
              De thi doc lap #{testId}
            </h1>
            <p className="text-slate-500 text-sm">
              Cap nhat thong tin va xem thong ke trong cung mot man hinh.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-2xl border-slate-200 font-bold"
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
          >
            {isSavingConfig ? "Dang luu" : "Luu nhap"}
          </Button>
          <Button
            className="rounded-2xl bg-slate-900 hover:bg-black font-black"
            onClick={handleSaveMatrix}
            disabled={isSavingMatrix}
          >
            {isSavingMatrix ? "Dang luu" : "Luu va cong bo"}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "config", label: "Cau hinh de", icon: Settings },
            { key: "content", label: "Noi dung / Dap an", icon: FileText },
            { key: "mapping", label: "Cai dat khoa hoc", icon: Link2 },
            {
              key: "analytics",
              label: "Thong ke & Bang diem",
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
              <Label className="font-bold">Ten de thi</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Mon / Chu de</Label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="font-bold">Thoi gian lam bai</Label>
              <Input
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">So cau hoi</Label>
              <Input value={questions.length} type="number" disabled />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Diem dat</Label>
              <Input
                value={passScore}
                onChange={(event) => setPassScore(event.target.value)}
                type="number"
                step="0.1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Mo ta / Ghi chu</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="border border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="font-bold text-slate-800">PDF de thi</p>
                <p className="text-xs text-slate-500">
                  Dang tai len: de-thi-toan-12.pdf
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 font-bold"
            >
              Doi file
            </Button>
          </div>
        </section>
      )}

      {activeTab === "content" && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  PDF Viewer
                </p>
                <h2 className="text-lg font-black text-slate-900">
                  De thi PDF
                </h2>
              </div>
              <Button
                variant="outline"
                className="rounded-2xl border-slate-200 font-bold"
              >
                Mo toan man hinh
              </Button>
            </div>
            <div className="h-[620px] bg-slate-50">
              {pdfUrl ? (
                <PDFViewer url={pdfUrl} />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-400">
                  <FileText className="w-10 h-10" />
                  <p className="text-sm font-bold uppercase tracking-widest">
                    Chua co file PDF
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-200 font-bold"
                  >
                    Tai len PDF
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Answer Matrix
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  Ma tran dap an
                </h3>
              </div>
              <Button
                onClick={() => setIsFastEntryOpen(true)}
                className="rounded-2xl bg-blue-600 hover:bg-blue-700 font-black"
              >
                <Zap className="w-4 h-4 mr-2" /> Nhap nhanh
              </Button>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {q.label}
                    </p>
                    <p className="text-xs text-slate-500">Diem: {q.points}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="rounded-xl bg-slate-900 text-white font-black">
                      {q.answer}
                    </Badge>
                    <span className="text-xs text-slate-400">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600">
              Nhap nhanh dap an hoac chinh sua tung cau de hoan thien ma tran.
            </div>
          </div>

          <FastEntryModal
            open={isFastEntryOpen}
            onOpenChange={setIsFastEntryOpen}
            onConfirm={handleFastEntry}
          />
        </section>
      )}

      {activeTab === "mapping" && (
        <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Mapping
              </p>
              <h2 className="text-xl font-black text-slate-900">
                Gan vao khoa hoc
              </h2>
            </div>
            <Button className="rounded-2xl bg-slate-900 hover:bg-black font-black">
              Gan de
            </Button>
          </div>

          <div className="grid gap-4">
            {[
              {
                id: "c1",
                title: "Toan 12 - Lo trinh 2026",
                lessons: 12,
                status: "Dang hoc",
              },
              {
                id: "c2",
                title: "Toan 12 - On tap hoc ky",
                lessons: 8,
                status: "San sang",
              },
              {
                id: "c3",
                title: "Luyen de dai hoc 01",
                lessons: 15,
                status: "San sang",
              },
            ].map((course) => (
              <div
                key={course.id}
                className="flex flex-col gap-4 rounded-[24px] border border-slate-100 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {course.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {course.lessons} bai hoc
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="rounded-full bg-slate-100 text-slate-600">
                    {course.status}
                  </Badge>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-slate-200 font-bold"
                  >
                    Chon bai hoc
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "analytics" && (
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { label: "Da nop", value: "42/60", tone: "bg-blue-600" },
              { label: "Diem TB", value: "7.2", tone: "bg-emerald-600" },
              { label: "Diem cao nhat", value: "9.6", tone: "bg-slate-900" },
              { label: "Diem thap nhat", value: "2.4", tone: "bg-amber-600" },
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
                    Pho diem hoc sinh
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
                  Diem nhan UX
                </h3>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>44% hoc sinh tren diem TB</span>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  <span>3 cau co ti le dung duoi 35%</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>5 lop dang su dung de nay</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-slate-200 font-bold"
              >
                Xem chi tiet
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Danh sach nop bai
                </h3>
                <p className="text-xs text-slate-500">
                  Tim kiem va loc theo hoc vien.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    className="pl-9 h-10 rounded-2xl"
                    placeholder="Tim theo ten"
                  />
                </div>
                <Select>
                  <SelectTrigger className="h-10 rounded-2xl w-[160px]">
                    <SelectValue placeholder="Bo loc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="below">Duoi diem TB</SelectItem>
                    <SelectItem value="not-submitted">Chua nop bai</SelectItem>
                    <SelectItem value="top">Top 10</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-10 rounded-2xl border-slate-200 font-bold"
                >
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Ho va ten</th>
                    <th className="px-4 py-3">Khoa hoc</th>
                    <th className="px-4 py-3">Thoi gian</th>
                    <th className="px-4 py-3">Ngay nop</th>
                    <th className="px-4 py-3">Diem so</th>
                    <th className="px-4 py-3">Hanh dong</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {student.course}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {student.time}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {student.submittedAt}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {student.score}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          className="rounded-2xl border-slate-200 font-bold h-9"
                        >
                          Xem chi tiet
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Phan tich do kho cau hoi
              </h3>
              <p className="text-xs text-slate-500">
                Nhan biet cau hoi can dieu chinh.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {mockQuestionStats.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">{q.label}</p>
                    <p className="text-xs text-slate-500">Ti le dung</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full",
                          q.correctRate > 60
                            ? "bg-emerald-500"
                            : "bg-amber-500",
                        )}
                        style={{ width: `${q.correctRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      {q.correctRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
