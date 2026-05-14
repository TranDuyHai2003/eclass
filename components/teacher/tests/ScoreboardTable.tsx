"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Printer, ArrowDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ScoreboardAttempt {
  id: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  answersCount: number;
}

interface ScoreboardTableProps {
  attempts: ScoreboardAttempt[];
  resultsBasePath: string;
}

type StatusFilter = "all" | "not-started" | "in-progress" | "submitted";

export default function ScoreboardTable({
  attempts,
  resultsBasePath,
}: ScoreboardTableProps) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const filteredAttempts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return attempts
      .filter((attempt) => {
        if (status === "all") return true;

        const hasCompleted = Boolean(attempt.completedAt);
        const hasAnswers = attempt.answersCount > 0;

        if (status === "submitted") return hasCompleted;
        if (status === "in-progress") return !hasCompleted && hasAnswers;
        return !hasCompleted && !hasAnswers;
      })
      .filter((attempt) => {
        if (!normalizedSearch) return true;
        const name = attempt.user.name?.toLowerCase() || "";
        const email = attempt.user.email?.toLowerCase() || "";
        return name.includes(normalizedSearch) || email.includes(normalizedSearch);
      });
  }, [attempts, search, status]);

  const sortedAttempts = useMemo(() => {
    return [...filteredAttempts].sort((a, b) => {
      const scoreA = a.score ?? -1;
      const scoreB = b.score ?? -1;
      return scoreB - scoreA;
    });
  }, [filteredAttempts]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[28px] border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
            className="w-full lg:w-auto"
          >
            <TabsList className="bg-slate-100/80 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1">
              <TabsTrigger
                value="all"
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Tat ca
              </TabsTrigger>
              <TabsTrigger
                value="not-started"
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Chua lam
              </TabsTrigger>
              <TabsTrigger
                value="in-progress"
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Dang lam
              </TabsTrigger>
              <TabsTrigger
                value="submitted"
                className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Da nop
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end w-full lg:w-auto">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs font-bold w-full sm:w-[180px]">
                <SelectValue placeholder="Hoc sinh lop..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tat ca lop</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhap de tim kiem..."
                className="h-10 rounded-xl border-slate-200 pl-9 text-xs font-bold"
              />
            </div>

            <Button
              variant="outline"
              className="h-10 rounded-xl border-slate-200 px-3"
            >
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  #
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Ho va ten
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <span className="inline-flex items-center gap-2">
                    Diem <ArrowDown className="w-3 h-3 text-slate-300" />
                  </span>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Thoi luong
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Ngay nop
                </th>
                <th
                  className="px-4 py-4 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest"
                  title="So lan hoc sinh roi khoi tab hoac thoat khoi man hinh bai thi"
                >
                  Roi khoi
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Hanh dong
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedAttempts.map((attempt, index) => (
                <tr
                  key={attempt.id}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-5 text-xs font-bold text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-white shadow-sm">
                        <img
                          src={
                            attempt.user.image ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(attempt.user.name || "User")}`
                          }
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate w-40">
                          {attempt.user.name}
                        </p>
                        <p className="text-[10px] font-black text-slate-400 uppercase truncate w-40">
                          {attempt.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <span
                      className={cn(
                        "text-sm font-black",
                        (attempt.score || 0) >= 8
                          ? "text-emerald-600"
                          : (attempt.score || 0) >= 5
                            ? "text-blue-600"
                            : "text-red-500",
                      )}
                    >
                      {attempt.score !== null ? attempt.score.toFixed(1) : "--"}
                    </span>
                  </td>
                  <td className="px-4 py-5 text-xs font-bold text-slate-600">
                    {formatDuration(attempt.startedAt, attempt.completedAt)}
                  </td>
                  <td className="px-4 py-5 text-xs font-bold text-slate-600">
                    {attempt.completedAt
                      ? formatDateTime(attempt.completedAt)
                      : "--"}
                  </td>
                  <td className="px-4 py-5 text-xs font-bold text-slate-600">
                    --
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 font-bold hover:bg-blue-50"
                    >
                      <Link href={`${resultsBasePath}/${attempt.id}`}>Chi tiết</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {sortedAttempts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm font-bold text-slate-400"
                  >
                    Khong co du lieu phu hop voi bo loc hien tai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatDuration(startedAt: string, completedAt: string | null) {
  if (!completedAt) return "--";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "--";
  }
  const totalMinutes = Math.round((end - start) / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "long",
  }).format(date);
}
