"use client"

import { useState, useEffect, useTransition } from "react"
import { getUsers, toggleUserApproval, deleteUser, updateUserRole } from "@/actions/user"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { User } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Trash2, ShieldCheck, ShieldAlert, Info } from "lucide-react"

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        try {
            const data = await getUsers()
            setUsers(data)
        } catch (error) {
            toast.error("Không thể tải danh sách người dùng")
        } finally {
            setLoading(false)
        }
    }

    const handleToggleApproval = async (userId: string, currentStatus: boolean) => {
        startTransition(async () => {
            const res = await toggleUserApproval(userId)
            if (res.success) {
                toast.success(currentStatus ? "Đã khóa tài khoản" : "Đã duyệt tài khoản")
                // Optimistic update
                setUsers(prev => prev.map(u => 
                    u.id === userId ? { ...u, isApproved: !currentStatus } : u
                ))
            } else {
                toast.error(res.error)
            }
        })
    }

    const handleRoleChange = async (userId: string, newRole: "ADMIN" | "TEACHER" | "STUDENT") => {
        startTransition(async () => {
            const res = await updateUserRole(userId, newRole)
            if (res.success) {
                toast.success("Đã cập nhật quyền người dùng")
                setUsers(prev => prev.map(u => 
                    u.id === userId ? { ...u, role: newRole } : u
                ))
            } else {
                toast.error(res.error || "Không thể cập nhật quyền")
            }
        })
    }

    const handleDelete = async (userId: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return

        startTransition(async () => {
            const res = await deleteUser(userId)
            if (res.success) {
                toast.success("Đã xóa người dùng")
                setUsers(prev => prev.filter(u => u.id !== userId))
            } else {
                toast.error(res.error)
            }
        })
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải...</div>

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Quản lý người dùng</h1>
            
            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex gap-4 text-blue-900 shadow-sm">
                <Info className="w-6 h-6 shrink-0 text-blue-600" />
                <div className="space-y-2">
                    <p className="font-black uppercase tracking-tight text-blue-950">Chi tiết phân quyền hệ thống:</p>
                    <ul className="list-disc list-inside space-y-1.5 opacity-90 text-sm font-medium">
                        <li><strong className="font-black text-blue-950">ADMIN (Đồng quản trị):</strong> Có toàn quyền quản lý hệ thống, duyệt khóa học, duyệt người dùng, thiết lập giao diện và phân quyền.</li>
                        <li><strong className="font-black text-blue-950">TEACHER (Giảng viên):</strong> Có quyền tạo khóa học mới, tải lên bài giảng (video/pdf), tạo bài tập quiz, quản lý học viên trong khóa học của mình.</li>
                        <li><strong className="font-black text-blue-950">STUDENT (Học viên):</strong> Chỉ có quyền xem và học các khóa học đã đăng ký, làm bài tập và thảo luận trong lớp.</li>
                    </ul>
                </div>
            </div>

            <div className="card-surface rounded-[2rem] overflow-x-auto border border-border/50">
                <div className="min-w-[700px] md:min-w-full">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="hidden sm:table-cell">Vai trò</TableHead>
                            <TableHead className="hidden sm:table-cell">Trạng thái</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{user.name || "N/A"}</div>
                                    <div className="text-xs text-muted-foreground sm:hidden">{user.email}</div>
                                    <div className="flex flex-wrap gap-2 mt-2 sm:hidden">
                                        <Select 
                                            defaultValue={user.role} 
                                            onValueChange={(val) => handleRoleChange(user.id, val as any)}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger className="w-[100px] h-6 text-[10px] font-semibold border-slate-200">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ADMIN" className="text-[10px] font-semibold text-red-600">ADMIN</SelectItem>
                                                <SelectItem value="TEACHER" className="text-[10px] font-semibold text-blue-600">TEACHER</SelectItem>
                                                <SelectItem value="STUDENT" className="text-[10px] font-semibold">STUDENT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-6 flex items-center ${user.isApproved ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                                            {user.isApproved ? "Đã duyệt" : "Chưa duyệt"}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Select 
                                        defaultValue={user.role} 
                                        onValueChange={(val) => handleRoleChange(user.id, val as any)}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger className="w-[120px] h-8 text-xs font-semibold border-slate-200 bg-slate-50 hover:bg-slate-100">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADMIN" className="text-xs font-semibold text-red-600">ADMIN</SelectItem>
                                            <SelectItem value="TEACHER" className="text-xs font-semibold text-blue-600">TEACHER</SelectItem>
                                            <SelectItem value="STUDENT" className="text-xs font-semibold text-slate-700">STUDENT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className={`${user.isApproved ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"}`}>
                                        {user.isApproved ? "Đã duyệt" : "Chưa duyệt"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                                        <Button 
                                            size="sm" 
                                            variant={user.isApproved ? "outline" : "default"}
                                            onClick={() => handleToggleApproval(user.id, user.isApproved)}
                                            disabled={isPending}
                                            className={cn(
                                                user.isApproved ? "border-amber-500 text-amber-600 hover:bg-amber-50" : "bg-green-600 hover:bg-green-700",
                                                "px-2 sm:px-3 h-8 sm:h-9"
                                            )}
                                            title={user.isApproved ? "Khóa tài khoản" : "Duyệt tài khoản"}
                                        >
                                            {user.isApproved ? (
                                                <><ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /><span className="hidden sm:inline">Khóa</span></>
                                            ) : (
                                                <><ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /><span className="hidden sm:inline">Duyệt</span></>
                                            )}
                                        </Button>

                                        <Button 
                                            size="sm" 
                                            variant="destructive"
                                            onClick={() => handleDelete(user.id)}
                                            disabled={isPending}
                                            title="Xóa người dùng"
                                            className="h-8 sm:h-9 w-8 sm:w-9 p-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
