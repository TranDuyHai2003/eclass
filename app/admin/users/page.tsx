"use client"

import { useState, useEffect, useTransition } from "react"
import { getUsers, toggleUserApproval, deleteUser } from "@/actions/user"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { User } from "@prisma/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, X, Trash2, ShieldCheck, ShieldAlert } from "lucide-react"

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
        <div className="space-y-6 px-4 md:px-0">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">Quản lý người dùng</h1>
            
            <div className="card-surface rounded-[2rem] overflow-x-auto border border-border/50">
                <div className="min-w-[700px] md:min-w-full">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Vai trò</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`${user.isApproved ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"}`}>
                                        {user.isApproved ? "Đã duyệt" : "Chưa duyệt"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    {user.role !== "ADMIN" && (
                                        <>
                                            <Button 
                                                size="sm" 
                                                variant={user.isApproved ? "outline" : "default"}
                                                onClick={() => handleToggleApproval(user.id, user.isApproved)}
                                                disabled={isPending}
                                                className={user.isApproved ? "border-amber-500 text-amber-600 hover:bg-amber-50" : "bg-green-600 hover:bg-green-700"}
                                            >
                                                {user.isApproved ? (
                                                    <><ShieldAlert className="w-4 h-4 mr-1" /> Khóa</>
                                                ) : (
                                                    <><ShieldCheck className="w-4 h-4 mr-1" /> Duyệt</>
                                                )}
                                            </Button>

                                            <Button 
                                                size="sm" 
                                                variant="destructive"
                                                onClick={() => handleDelete(user.id)}
                                                disabled={isPending}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
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
