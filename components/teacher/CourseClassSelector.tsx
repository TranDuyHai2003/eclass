"use client"

import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateCourse } from "@/actions/course"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CourseClassSelectorProps {
    courseId: string
    currentClassId: string | null
    classes: { id: string; name: string }[]
}

export function CourseClassSelector({ courseId, currentClassId, classes }: CourseClassSelectorProps) {
    const [isPending, startTransition] = useTransition()

    const handleClassChange = (newClassId: string) => {
        const classId = newClassId === "NONE" ? null : newClassId
        
        startTransition(async () => {
            const res = await updateCourse(courseId, { classId })
            if (res.success) {
                toast.success("Đã cập nhật lớp cho khóa học")
            } else {
                toast.error(res.error || "Có lỗi xảy ra")
            }
        })
    }

    return (
        <div className="flex items-center gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <Select 
                defaultValue={currentClassId || "NONE"} 
                onValueChange={handleClassChange}
                disabled={isPending}
            >
                <SelectTrigger className={cn(
                    "w-[120px] h-8 text-xs font-bold border-transparent rounded-xl transition-colors",
                    currentClassId ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}>
                    <SelectValue placeholder="Chưa gắn lớp" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="NONE" className="text-xs font-bold text-slate-500">Chưa xếp lớp</SelectItem>
                    {classes.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-bold text-indigo-700">{c.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
