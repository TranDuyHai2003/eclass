"use client";

import React, { useState, useMemo, useRef, useTransition, useEffect, MouseEvent as ReactMouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Settings2,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { AnalyticsExportButton } from "@/components/analytics/AnalyticsExportButton";
import { useSearchParams, useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { deleteStudentAttempt } from "@/actions/test";
import { toast } from "sonner";

export function MultiLevelMatrixTable({
  students,
  coursesSchema,
}: {
  students: any[];
  coursesSchema: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [hiddenCourses, setHiddenCourses] = useState<Set<string>>(new Set());
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // --- LOGIC DRAG TO SCROLL ---
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const scrollPos = useRef({ left: 0, top: 0 });
  const isClick = useRef(true);

  const onMouseUp = useRef((e: MouseEvent) => {});
  const onMouseMove = useRef((e: MouseEvent) => {});

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    isClick.current = true;
    if (parentRef.current) {
      startPos.current = {
        x: e.pageX - parentRef.current.offsetLeft,
        y: e.pageY - parentRef.current.offsetTop,
      };
      scrollPos.current = {
        left: parentRef.current.scrollLeft,
        top: parentRef.current.scrollTop,
      };
    }

    onMouseMove.current = (ev: MouseEvent) => {
      if (!isDragging.current || !parentRef.current) return;
      const x = ev.pageX - parentRef.current.offsetLeft;
      const y = ev.pageY - parentRef.current.offsetTop;
      const walkX = (x - startPos.current.x) * 1.2;
      const walkY = (y - startPos.current.y) * 1.2;
      
      if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
        isClick.current = false;
      }
      
      parentRef.current.scrollLeft = scrollPos.current.left - walkX;
      parentRef.current.scrollTop = scrollPos.current.top - walkY;
    };

    onMouseUp.current = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove.current);
      document.removeEventListener("mouseup", onMouseUp.current);
    };

    document.addEventListener("mousemove", onMouseMove.current);
    document.addEventListener("mouseup", onMouseUp.current);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", onMouseMove.current);
      document.removeEventListener("mouseup", onMouseUp.current);
    };
  }, []);
  // -----------------------------

  // Filter students
  const filteredStudents = useMemo(() => {
    const s = search.toLowerCase();
    return students.filter(
      (st) =>
        st.name?.toLowerCase().includes(s) || st.email?.toLowerCase().includes(s)
    );
  }, [students, search]);

  // Filter courses schema (Hidden Columns)
  const visibleCourses = useMemo(() => {
    return coursesSchema.filter((c) => !hiddenCourses.has(c.id));
  }, [coursesSchema, hiddenCourses]);

  // Virtualizer for Rows
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, 
    overscan: 10,
  });

  const toggleCourseCollapse = (courseId: string) => {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleCourseVisibility = (courseId: string) => {
    setHiddenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm theo Mã HS, Họ & Tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-slate-50 border-transparent focus-visible:bg-white text-xs font-bold"
          />
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl h-10 text-xs font-bold gap-2">
                <Settings2 className="w-4 h-4" /> Ẩn/Hiện Khóa Học
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              {coursesSchema.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hiddenCourses.has(c.id)}
                  onCheckedChange={() => toggleCourseVisibility(c.id)}
                  className="text-xs font-medium"
                >
                  {c.title}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <AnalyticsExportButton
            apiUrl={`/api/admin/export-matrix?${searchParams.toString()}`}
            filename="Master_Gradebook.xlsx"
            variant="premium"
            className="rounded-xl h-10 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white px-4"
          />
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div 
          ref={parentRef} 
          className="flex-1 overflow-auto custom-scrollbar relative cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed", minWidth: "1200px" }}>
            <thead className="sticky top-0 z-40 bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {/* HEADER ROW 1 */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-50 bg-slate-50 px-4 py-3 border-b border-r text-[10px] font-black uppercase text-slate-500 w-[60px] min-w-[60px] text-center"
                >
                  STT
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[60px] z-50 bg-slate-50 px-4 py-3 border-b border-r text-[10px] font-black uppercase text-slate-500 w-[240px] min-w-[240px]"
                >
                  Học Sinh
                </th>

                {/* COURSES HEADER */}
                {visibleCourses.map((c) => {
                  const isCollapsed = collapsedCourses.has(c.id);
                  const colSpan = isCollapsed ? 1 : c.tests.length + 1;
                  return (
                    <th
                      key={c.id}
                      colSpan={colSpan}
                      className="px-4 py-2 border-b border-r text-center"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCourseCollapse(c.id);
                          }}
                          className="w-5 h-5 bg-white rounded flex items-center justify-center border hover:bg-slate-50 text-slate-500 cursor-pointer"
                          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
                        >
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <span className="text-[11px] font-black uppercase text-slate-700 tracking-tight truncate max-w-[200px]">
                          {c.title || "Khóa học chưa có tên"}
                        </span>
                      </div>
                    </th>
                  );
                })}

                <th
                  rowSpan={2}
                  className="sticky right-0 z-50 bg-slate-50 px-4 py-3 border-b border-l text-[10px] font-black uppercase text-indigo-600 w-[100px] min-w-[100px] text-center shadow-[-2px_0_5px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3" /> TB Chung
                  </div>
                </th>
              </tr>

              {/* HEADER ROW 2 */}
              <tr>
                {visibleCourses.map((c) => {
                  const isCollapsed = collapsedCourses.has(c.id);
                  if (isCollapsed) {
                    return (
                      <th
                        key={c.id + "_tb"}
                        className="px-3 py-2 border-b border-r text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 text-center w-[100px] min-w-[100px]"
                      >
                        TB Khóa
                      </th>
                    );
                  }

                  return (
                    <React.Fragment key={c.id + "_details"}>
                      {c.tests.map((t: any) => (
                        <th
                          key={t.id}
                          className="px-3 py-2 border-b border-r text-[10px] font-bold uppercase text-slate-500 bg-white text-center w-[120px] min-w-[120px] truncate transition-colors"
                          title={t.title || "Chưa có tên"}
                        >
                          {t.title || "Chưa có tên"}
                        </th>
                      ))}
                      <th className="px-3 py-2 border-b border-r text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 text-center w-[100px] min-w-[100px]">
                        TB Khóa
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={100} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const student = filteredStudents[virtualRow.index];
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/60 transition-colors group/row"
                  >
                    <td className="sticky left-0 z-30 bg-white group-hover/row:bg-slate-50 px-4 py-3 border-b border-r text-center text-xs font-bold text-slate-400 w-[60px] min-w-[60px]">
                      {virtualRow.index + 1}
                    </td>
                    <td className="sticky left-[60px] z-30 bg-white group-hover/row:bg-slate-50 px-4 py-3 border-b border-r w-[240px] min-w-[240px]">
                      <div className="flex flex-col pointer-events-none">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {student.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium truncate">
                            {student.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* COURSES CELLS */}
                    {visibleCourses.map((c) => {
                      const isCollapsed = collapsedCourses.has(c.id);
                      const courseProgress = student.courses.find((sc: any) => sc.id === c.id);
                      
                      let tbKhoa = null;
                      if (courseProgress && courseProgress.tests.length > 0) {
                         const sum = courseProgress.tests.reduce((acc: number, t: any) => acc + (t.score || 0), 0);
                         tbKhoa = sum / courseProgress.tests.length;
                      }

                      if (isCollapsed) {
                        return (
                          <td
                            key={c.id + "_tb"}
                            className="px-3 py-3 border-b border-r text-center align-middle bg-blue-50/20 group-hover/row:bg-blue-50/40 w-[100px] min-w-[100px]"
                          >
                            <ScoreCell score={tbKhoa} />
                          </td>
                        );
                      }

                      return (
                        <React.Fragment key={c.id + "_details"}>
                          {c.tests.map((t: any) => {
                            const testAttempt = courseProgress?.tests.find((st: any) => st.testId === t.id);
                            const hasScore = testAttempt?.score !== null && testAttempt?.score !== undefined;
                            const attemptDetail = hasScore ? student.details.find((d: any) => d.testId === t.id) : null;

                            return (
                              <td
                                key={t.id}
                                className={cn(
                                  "px-3 py-3 border-b border-r text-center align-middle relative group/cell w-[120px] min-w-[120px]",
                                  hasScore ? "cursor-pointer hover:bg-slate-100/50" : "bg-slate-50/10 pointer-events-none"
                                )}
                                onClick={() => {
                                  if (!isClick.current || !hasScore || !attemptDetail) return;
                                  setSelectedAttemptId(attemptDetail.id);
                                }}
                              >
                                <div className="flex flex-col items-center justify-center relative">
                                  <ScoreCell score={testAttempt?.score} />
                                  {hasScore && attemptDetail && (
                                    <div 
                                      className="absolute -top-1 -right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10"
                                      onClick={(e) => e.stopPropagation()} // Chống nổi bọt ở container của nút xóa
                                    >
                                      <ConfirmModal
                                        title="Xóa bài nộp?"
                                        description={`Bạn có chắc muốn xóa bài làm của ${student.name} cho bài "${t.title}"?`}
                                        disabled={isPending || isDeletingId === attemptDetail.id}
                                        onConfirm={async () => {
                                          try {
                                            setIsDeletingId(attemptDetail.id);
                                            await deleteStudentAttempt(attemptDetail.id);
                                            toast.success("Đã xóa bài nộp thành công");
                                            router.refresh();
                                          } catch {
                                            toast.error("Không thể xóa bài nộp");
                                          } finally {
                                            setIsDeletingId(null);
                                          }
                                        }}
                                      >
                                        <button 
                                          className="p-1 rounded-full bg-white shadow-sm border border-slate-200 text-red-500 hover:bg-red-50 transition-colors"
                                          type="button"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </ConfirmModal>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 border-b border-r text-center align-middle bg-blue-50/20 group-hover/row:bg-blue-50/40 w-[100px] min-w-[100px]">
                             <ScoreCell score={tbKhoa} />
                          </td>
                        </React.Fragment>
                      );
                    })}

                    <td className="sticky right-0 z-30 bg-white group-hover/row:bg-slate-50 px-4 py-3 border-b border-l text-center align-middle shadow-[-2px_0_5px_rgba(0,0,0,0.02)] w-[100px] min-w-[100px]">
                      <div className="inline-flex items-center justify-center min-w-[2.5rem] h-8 rounded-xl bg-indigo-50 border border-indigo-100">
                        <span className="text-sm font-black text-indigo-700 pointer-events-none">
                          {student.stats?.averageScore > 0 ? student.stats.averageScore.toFixed(2) : "-"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={100} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK VIEW DRAWER */}
      <Sheet open={!!selectedAttemptId} onOpenChange={(open) => !open && setSelectedAttemptId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 border-l-0 shadow-2xl">
          <div className="h-full flex flex-col bg-slate-50">
            <SheetHeader className="px-6 py-4 bg-white border-b sticky top-0 z-10 shrink-0">
              <SheetTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                Chi tiết bài làm
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden relative">
               {selectedAttemptId && (
                 <iframe 
                   src={`/watch/demo/results/${selectedAttemptId}?minimal=true`} 
                   className="w-full h-full border-none absolute inset-0"
                   style={{ backgroundColor: 'transparent' }}
                 />
               )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-slate-300 font-medium pointer-events-none">-</span>;
  }
  
  return (
    <span
      className={cn(
        "font-black text-sm pointer-events-none",
        score >= 8 ? "text-emerald-600" : score < 5 ? "text-red-500" : "text-blue-600"
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
