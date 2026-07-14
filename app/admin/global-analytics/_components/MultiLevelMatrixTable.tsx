"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useTransition,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from "react";
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
import { GlobalFilters } from "./GlobalFilters";
import { OfflineExportModal } from "./OfflineExportModal";
import { Separator } from "@/components/ui/separator";

export function MultiLevelMatrixTable({
  students,
  coursesSchema,
  allCourses,
  allClasses,
}: {
  students: any[];
  coursesSchema: any[];
  allCourses: { id: string; title: string }[];
  allClasses?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenCourses, setHiddenCourses] = useState<Set<string>>(new Set());
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null,
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // --- LOGIC DRAG TO SCROLL ---
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pendingDelta = useRef({ x: 0, y: 0 });
  const isClick = useRef(true);
  const rafId = useRef<number | null>(null);

  const onPointerUp = useRef((e: PointerEvent) => {});
  const onPointerMove = useRef((e: PointerEvent) => {});

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on left click
    if (e.button !== 0) return;
    
    // Pointer capture for smoother events
    e.currentTarget.setPointerCapture(e.pointerId);

    isDragging.current = true;
    isClick.current = true;
    
    lastPos.current = { x: e.clientX, y: e.clientY };
    pendingDelta.current = { x: 0, y: 0 };
    
    document.body.classList.add("dragging"); // Tắt hover khi kéo chuột
    
    if (parentRef.current) {
        parentRef.current.style.scrollBehavior = "auto";
        parentRef.current.style.userSelect = "none"; 
    }

    onPointerMove.current = (ev: PointerEvent) => {
      if (!isDragging.current || !parentRef.current) return;
      ev.preventDefault();
      
      const dx = ev.clientX - lastPos.current.x;
      const dy = ev.clientY - lastPos.current.y;
      
      lastPos.current = { x: ev.clientX, y: ev.clientY };
      
      pendingDelta.current.x += dx;
      pendingDelta.current.y += dy;

      if (Math.abs(pendingDelta.current.x) > 3 || Math.abs(pendingDelta.current.y) > 3) {
        isClick.current = false;
      }

      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          if (parentRef.current) {
            parentRef.current.scrollLeft -= pendingDelta.current.x;
            parentRef.current.scrollTop -= pendingDelta.current.y;
          }
          pendingDelta.current = { x: 0, y: 0 };
          rafId.current = null;
        });
      }
    };

    onPointerUp.current = () => {
      isDragging.current = false;
      document.body.classList.remove("dragging");
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (parentRef.current) {
        parentRef.current.style.removeProperty("user-select");
      }
      document.removeEventListener("pointermove", onPointerMove.current);
      document.removeEventListener("pointerup", onPointerUp.current);
    };

    document.addEventListener("pointermove", onPointerMove.current, { passive: false });
    document.addEventListener("pointerup", onPointerUp.current);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onPointerMove.current);
      document.removeEventListener("pointerup", onPointerUp.current);
      document.body.classList.remove("dragging");
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);
  // -----------------------------

  // Students are already filtered and sorted by the server
  const filteredStudents = useMemo(() => {
    return students.map(student => ({
      ...student,
      courseMap: Object.fromEntries(
        (student.courses || []).map((c: any) => [String(c.id), c])
      ),
      detailMap: Object.fromEntries(
        (student.details || []).map((d: any) => [String(d.testId), d])
      ),
    }));
  }, [students]);

  // Filter courses schema (Hidden Columns)
  const visibleCourses = useMemo(() => {
    return coursesSchema.filter((c) => !hiddenCourses.has(c.id));
  }, [coursesSchema, hiddenCourses]);

  // Virtualizer for Rows
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
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
      ? rowVirtualizer.getTotalSize() -
        virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div className="space-y-4">
      {/* UNIFIED TOOLBAR & FILTERS */}
      <div className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm">
        <GlobalFilters courses={allCourses} classes={allClasses}>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild></DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl shadow-2xl border-slate-100"
              >
                <div className="p-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Ẩn/Hiện Khóa Học
                </div>
                <Separator className="mb-1" />
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                  {coursesSchema.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={!hiddenCourses.has(c.id)}
                      onCheckedChange={() => toggleCourseVisibility(c.id)}
                      className="text-[10px] font-bold py-2 rounded-lg"
                    >
                      {c.title}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <AnalyticsExportButton
              apiUrl={`/api/admin/export-matrix?${searchParams?.toString() || ""}`}
              filename="Master_Gradebook.xlsx"
              variant="premium"
              className="rounded-xl h-10 text-[9px] font-black uppercase tracking-widest gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white px-4 border-none transition-all"
            />

            <OfflineExportModal />
          </div>
        </GlobalFilters>
      </div>

      {/* MATRIX TABLE */}
      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div
          ref={parentRef}
          className="flex-1 overflow-auto pb-2 custom-scrollbar relative cursor-grab active:cursor-grabbing select-none [overflow-anchor:none] [contain:strict] [will-change:scroll-position]"
          onPointerDown={handlePointerDown}
          onMouseLeave={() => { isDragging.current = false; }}
        >
          <table
            className="text-left border-separate border-spacing-0"
            style={{
              tableLayout: "fixed",
              width: "max-content",
              minWidth: "100%",
            }}
          >
            <colgroup>
              {/* Cột 1: STT */}
              <col style={{ width: "60px", minWidth: "60px" }} />
              {/* Cột 2: Học Sinh */}
              <col style={{ width: "240px", minWidth: "240px" }} />

              {/* Các cột Khóa học */}
              {visibleCourses.map((c) => {
                const isCollapsed = collapsedCourses.has(c.id);

                if (isCollapsed) {
                  return (
                    <col
                      key={`${c.id}_col_tb`}
                      style={{ width: "100px", minWidth: "100px" }}
                    />
                  );
                }

                return (
                  <React.Fragment key={`${c.id}_cols`}>
                    {c.tests.map((t: any) => (
                      <col
                        key={`${t.id}_col`}
                        style={{ width: "120px", minWidth: "120px" }}
                      />
                    ))}
                    {/* Cột TB Khóa của khóa học đó */}
                    <col
                      key={`${c.id}_col_final`}
                      style={{ width: "100px", minWidth: "100px" }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Cột cuối: TB Chung */}
              <col style={{ width: "100px", minWidth: "100px" }} />
            </colgroup>
            <thead className="sticky top-0 z-40 bg-slate-50">
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
                      className="p-0 border-b border-r align-middle bg-slate-50/50"
                      style={{ clipPath: "inset(0)" }}
                    >
                      {isCollapsed ? (
                        <div className="flex items-center justify-center gap-2 w-full h-full px-2 py-2 overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCourseCollapse(c.id);
                            }}
                            className="w-5 h-5 bg-white rounded flex items-center justify-center border hover:bg-slate-50 text-slate-500 cursor-pointer flex-shrink-0"
                            title="Mở rộng"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <span
                            className="text-[11px] font-black uppercase text-slate-700 tracking-tight flex-1"
                            title={c.title}
                          >
                            {c.title || "Khóa học chưa có tên"}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="sticky z-10 mx-auto flex items-center justify-center"
                          style={{
                            left: "calc(50% + 100px)",
                            right: "calc(50% - 100px)",
                            width: "0px",
                          }}
                        >
                          <div className="flex items-center gap-2 w-max px-4 py-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCourseCollapse(c.id);
                              }}
                              className="w-5 h-5 bg-white rounded flex items-center justify-center border hover:bg-slate-50 text-slate-500 cursor-pointer flex-shrink-0"
                              title="Thu gọn"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <span
                              className="text-[11px] font-black uppercase text-slate-700 tracking-tight truncate max-w-[300px]"
                              title={c.title}
                            >
                              {c.title || "Khóa học chưa có tên"}
                            </span>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}

                <th
                  rowSpan={2}
                  className="sticky right-0 z-50 bg-slate-50 px-4 py-3 border-b border-l border-slate-200 text-[10px] font-black uppercase text-indigo-600 w-[100px] min-w-[100px] text-center"
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
                  <td style={{ height: `${paddingTop}px`, padding: 0, border: 0, margin: 0 }} colSpan={100} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const student = filteredStudents[virtualRow.index];
                return (
                  <tr
                    key={student.id}
                    style={{ height: '60px' }}
                    className="hover:bg-slate-50/60 transition-colors group/row"
                  >
                    <td className="sticky left-0 z-30 bg-white group-hover/row:bg-slate-50 px-4 py-3 border-b border-r text-center text-xs font-bold text-slate-400 w-[60px] min-w-[60px] h-[60px]">
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
                      const courseProgress = student.courseMap[String(c.id)];

                      let tbKhoa = null;
                      if (courseProgress && courseProgress.tests.length > 0) {
                        const sum = courseProgress.tests.reduce(
                          (acc: number, t: any) => acc + (t.score || 0),
                          0,
                        );
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
                            const testAttempt = courseProgress?.tests.find(
                              (st: any) => String(st.testId) === String(t.id),
                            );
                            const hasScore =
                              testAttempt?.score !== null &&
                              testAttempt?.score !== undefined;
                            const attemptDetail = hasScore
                              ? student.detailMap[String(t.id)]
                              : null;

                            return (
                              <td
                                key={t.id}
                                className={cn(
                                  "px-3 py-3 border-b border-r text-center align-middle relative group/cell w-[120px] min-w-[120px]",
                                  hasScore
                                    ? "cursor-pointer hover:bg-slate-100/50"
                                    : "bg-slate-50/10 pointer-events-none",
                                )}
                                onClick={() => {
                                  if (
                                    !isClick.current ||
                                    !hasScore ||
                                    !attemptDetail
                                  )
                                    return;
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
                                        disabled={
                                          isPending ||
                                          isDeletingId === attemptDetail.id
                                        }
                                        onConfirm={async () => {
                                          try {
                                            setIsDeletingId(attemptDetail.id);
                                            await deleteStudentAttempt(
                                              attemptDetail.id,
                                            );
                                            toast.success(
                                              "Đã xóa bài nộp thành công",
                                            );
                                            router.refresh();
                                          } catch {
                                            toast.error(
                                              "Không thể xóa bài nộp",
                                            );
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

                    <td className="sticky right-0 z-30 bg-white group-hover/row:bg-slate-50 px-4 py-3 border-b border-l border-slate-200 text-center align-middle w-[100px] min-w-[100px]">
                      <div className="inline-flex items-center justify-center min-w-[2.5rem] h-8 rounded-xl bg-indigo-50 border border-indigo-100">
                        <span className="text-sm font-black text-indigo-700 pointer-events-none">
                          {student.stats?.averageScore > 0
                            ? student.stats.averageScore.toFixed(2)
                            : "-"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0, margin: 0 }} colSpan={100} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK VIEW DRAWER */}
      <Sheet
        open={!!selectedAttemptId}
        onOpenChange={(open) => !open && setSelectedAttemptId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl p-0 border-l-0 shadow-2xl"
        >
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
                  style={{ backgroundColor: "transparent" }}
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
    return (
      <span className="text-slate-300 font-medium pointer-events-none">-</span>
    );
  }

  return (
    <span
      className={cn(
        "font-black text-sm pointer-events-none",
        score >= 8
          ? "text-emerald-600"
          : score < 5
            ? "text-red-500"
            : "text-blue-600",
      )}
    >
      {score.toFixed(2)}
    </span>
  );
}
