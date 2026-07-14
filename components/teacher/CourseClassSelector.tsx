"use client"

import { useState, useTransition } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { updateCourse } from "@/actions/course"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Check, Users } from "lucide-react"

interface CourseClassSelectorProps {
    courseId: string
    currentClassIds?: string[]
    classes: { id: string; name: string }[]
}

export function CourseClassSelector({ courseId, currentClassIds = [], classes }: CourseClassSelectorProps) {
    const [isPending, startTransition] = useTransition()
    const [selectedIds, setSelectedIds] = useState<string[]>(currentClassIds)

    const handleToggle = (classId: string) => {
        const newIds = selectedIds.includes(classId)
            ? selectedIds.filter(id => id !== classId)
            : [...selectedIds, classId]
        
        setSelectedIds(newIds)
        
        startTransition(async () => {
            const res = await updateCourse(courseId, { classIds: newIds })
            if (res.success) {
                toast.success("Đã cập nhật lớp cho khóa học")
            } else {
                toast.error(res.error || "Có lỗi xảy ra")
                // Revert state on error
                setSelectedIds(selectedIds)
            }
        })
    }

    const handleClear = () => {
        setSelectedIds([])
        startTransition(async () => {
            const res = await updateCourse(courseId, { classIds: [] })
            if (res.success) {
                toast.success("Đã xóa tất cả lớp cho khóa học")
            } else {
                toast.error(res.error || "Có lỗi xảy ra")
                setSelectedIds(selectedIds)
            }
        })
    }

    return (
        <div className="flex items-center gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button 
                        disabled={isPending}
                        className={cn(
                            "h-8 px-3 py-1 text-xs font-bold border-transparent rounded-xl transition-colors shadow-none",
                            selectedIds.length > 0 ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        {selectedIds.length > 0 ? `${selectedIds.length} lớp` : "Chưa gắn lớp"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0 rounded-2xl shadow-2xl border-slate-100" align="start">
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                        <div 
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                            onClick={handleClear}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900">Bỏ chọn tất cả</span>
                        </div>
                        <Separator className="my-1" />
                        {classes.map((cls) => (
                            <div 
                                key={cls.id}
                                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                                onClick={() => handleToggle(cls.id)}
                            >
                                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 truncate pr-3">{cls.name}</span>
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                    selectedIds.includes(cls.id) ? "bg-indigo-600 border-indigo-600 shadow-sm" : "border-slate-200"
                                )}>
                                    {selectedIds.includes(cls.id) && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
