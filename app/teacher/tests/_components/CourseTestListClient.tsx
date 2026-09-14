"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Trophy,
  Pencil,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TestTypeSwitcherClient from "./TestTypeSwitcherClient";
import DueDateUpdaterClient from "./DueDateUpdaterClient";
import { DeleteTestButton } from "./DeleteTestButton";

export type TestItem = {
  id: string;
  testId?: string;
  title: string;
  type: string;
  test: {
    id: string;
    duration: number;
    type: string;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  attempts: {
    completedAt: string | null;
    score: number | null;
  }[];
};

interface CourseTestListClientProps {
  courseId: string;
  tests: TestItem[];
  initialLimit?: number;
}

export default function CourseTestListClient({
  courseId,
  tests,
  initialLimit = 5,
}: CourseTestListClientProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedTests = isExpanded ? tests : tests.slice(0, initialLimit);
  const remainingCount = tests.length - initialLimit;

  return (
    <div>
      <div className="divide-y divide-slate-50">
        {displayedTests.map((t) => {
          const finishedAttempts = t.attempts.filter(
            (a) => a.completedAt !== null,
          );
          const avgScore =
            finishedAttempts.length > 0
              ? finishedAttempts.reduce(
                  (acc, curr) => acc + (curr.score || 0),
                  0,
                ) / finishedAttempts.length
              : 0;

          return (
            <div
              key={t.id}
              className="px-8 py-6 hover:bg-slate-50/50 transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                      t.type === "FINAL" ? "bg-yellow-50" : "bg-blue-50",
                    )}
                  >
                    {t.type === "FINAL" ? (
                      <Trophy className="w-6 h-6 text-yellow-600" />
                    ) : (
                      <GraduationCap className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      {t.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        {t.type === "FINAL" ? "Đề thi tổng kết" : "Đề thi bài học"}{" "}
                        • {t.test?.duration} phút
                      </p>
                      {t.test && (
                        <>
                          <TestTypeSwitcherClient
                            testId={t.test.id}
                            initialType={t.test.type as "HOMEWORK" | "EXAM"}
                          />
                          <DueDateUpdaterClient
                            testId={t.test.id}
                            initialDueDate={t.test.dueDate}
                          />
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            Tạo:{" "}
                            {new Intl.DateTimeFormat("vi-VN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(t.test.createdAt))}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      Lượt nộp
                    </p>
                    <p className="text-xl font-black text-slate-900">
                      {finishedAttempts.length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      Điểm TB
                    </p>
                    <p className="text-xl font-black text-blue-600">
                      {avgScore.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-xl font-bold border-slate-200"
                    >
                      <Link
                        href={
                          t.type === "FINAL"
                            ? `/teacher/courses/${courseId}/final-test`
                            : `/teacher/tests/${t.id}`
                        }
                      >
                        <Pencil className="w-4 h-4 mr-2" /> Chỉnh sửa
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      asChild
                      className="rounded-xl font-black bg-slate-900 hover:bg-black"
                    >
                      <Link
                        href={
                          t.type === "FINAL"
                            ? `/teacher/courses/${courseId}/final-test/analytics`
                            : `/teacher/tests/${t.id}/analytics`
                        }
                      >
                        <BarChart3 className="w-4 h-4 mr-2" /> Thống kê
                      </Link>
                    </Button>
                    {t.testId && <DeleteTestButton testId={t.testId} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tests.length > initialLimit && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center">
          <Button
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-2xl font-black text-xs uppercase tracking-wider py-2.5 px-6 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm transition-all flex items-center gap-2"
          >
            <span>
              {isExpanded
                ? "Thu gọn danh sách bài thi"
                : `Xem thêm (${remainingCount} bài thi khác)`}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
