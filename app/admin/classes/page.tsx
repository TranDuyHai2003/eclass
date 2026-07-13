"use client"

import { useState, useEffect, useTransition } from "react"
import { getClasses, createClass, updateClass, deleteClass } from "@/actions/class"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { StudyClass } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Edit2, Plus, Info } from "lucide-react"

export default function ClassManagementPage() {
    const [classes, setClasses] = useState<StudyClass[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    
    const [newClassName, setNewClassName] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")

    useEffect(() => {
        loadClasses()
    }, [])

    const loadClasses = async () => {
        try {
            const data = await getClasses()
            setClasses(data)
        } catch (error) {
            toast.error("Không thể tải danh sách lớp học")
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newClassName.trim()) return

        startTransition(async () => {
            const res = await createClass(newClassName)
            if (res.success && res.data) {
                toast.success("Đã thêm lớp mới")
                setClasses(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
                setNewClassName("")
            } else {
                toast.error(res.error)
            }
        })
    }

    const handleUpdate = async (id: string) => {
        if (!editingName.trim()) return

        startTransition(async () => {
            const res = await updateClass(id, editingName)
            if (res.success && res.data) {
                toast.success("Đã cập nhật tên lớp")
                setClasses(prev => prev.map(c => c.id === id ? res.data : c).sort((a, b) => a.name.localeCompare(b.name)))
                setEditingId(null)
                setEditingName("")
            } else {
                toast.error(res.error)
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa lớp này? Không thể xóa nếu lớp đang có học viên hoặc khóa học.")) return

        startTransition(async () => {
            const res = await deleteClass(id)
            if (res.success) {
                toast.success("Đã xóa lớp")
                setClasses(prev => prev.filter(c => c.id !== id))
            } else {
                toast.error(res.error)
            }
        })
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải...</div>

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Quản lý lớp học</h1>
            
            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex gap-4 text-blue-900 shadow-sm">
                <Info className="w-6 h-6 shrink-0 text-blue-600" />
                <div className="space-y-2">
                    <p className="font-black uppercase tracking-tight text-blue-950">Quản lý danh sách lớp (Study Class):</p>
                    <ul className="list-disc list-inside space-y-1.5 opacity-90 text-sm font-medium">
                        <li>Thêm, sửa, xóa các lớp học thực tế (VD: 10A, 11A, 12B...).</li>
                        <li>Chỉ có thể xóa lớp nếu lớp đó hiện không có học sinh nào và không có khóa học nào được gán.</li>
                        <li>Việc đổi tên lớp sẽ được cập nhật tự động cho tất cả học sinh đang ở trong lớp đó.</li>
                    </ul>
                </div>
            </div>

            <div className="card-surface rounded-[2rem] p-6 border border-border/50 bg-white">
                <form onSubmit={handleCreate} className="flex gap-3 mb-6">
                    <Input 
                        placeholder="Nhập tên lớp mới (VD: 12A)..." 
                        value={newClassName}
                        onChange={e => setNewClassName(e.target.value)}
                        className="max-w-xs h-11 rounded-2xl"
                        disabled={isPending}
                    />
                    <Button type="submit" disabled={isPending || !newClassName.trim()} className="h-11 rounded-2xl px-6 font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Thêm lớp
                    </Button>
                </form>

                <div className="border rounded-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[80px] text-center">STT</TableHead>
                                <TableHead>Tên lớp</TableHead>
                                <TableHead className="text-right">Hành động</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-slate-500 font-medium">
                                        Chưa có lớp học nào. Hãy thêm lớp đầu tiên!
                                    </TableCell>
                                </TableRow>
                            ) : (
                                classes.map((c, idx) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="text-center font-medium text-slate-500">{idx + 1}</TableCell>
                                        <TableCell>
                                            {editingId === c.id ? (
                                                <div className="flex gap-2 items-center">
                                                    <Input 
                                                        value={editingName} 
                                                        onChange={e => setEditingName(e.target.value)} 
                                                        className="h-9 max-w-[200px]"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" onClick={() => handleUpdate(c.id)} disabled={isPending || !editingName.trim()}>Lưu</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => {setEditingId(null); setEditingName("")}}>Hủy</Button>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-slate-900 text-base">{c.name}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingId !== c.id && (
                                                <div className="flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => {
                                                        setEditingId(c.id);
                                                        setEditingName(c.name);
                                                    }}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(c.id)} disabled={isPending}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
