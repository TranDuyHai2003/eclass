"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getUsers,
  toggleUserApproval,
  deleteUser,
  updateUserRole,
  updateStudentType,
  updateUserLevel,
  updateUserClass,
} from "@/actions/user";
import { getClasses } from "@/actions/class";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, StudentType, Role, Level } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Info,
  Search,
  Filter,
  GraduationCap,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<StudentType | "ALL">("ALL");
  const [levelFilter, setLevelFilter] = useState<Level | "ALL">("ALL");
  const [classFilter, setClassFilter] = useState<string | "ALL">("ALL");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let result = users;

    if (search) {
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (roleFilter !== "ALL") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (typeFilter !== "ALL") {
      result = result.filter((u) => u.studentType === typeFilter);
    }

    if (levelFilter !== "ALL") {
      result = result.filter((u) => u.level === levelFilter);
    }

    if (classFilter !== "ALL") {
      result = result.filter((u) => u.classId === classFilter);
    }

    setFilteredUsers(result);
  }, [search, roleFilter, typeFilter, levelFilter, classFilter, users]);

  const loadUsers = async () => {
    try {
      const [data, classData] = await Promise.all([getUsers(), getClasses()]);
      setClasses(classData);
      const sortedData = data.sort((a, b) => {
        // Hàm làm sạch tên: loại bỏ (CB), <NC> hoặc bất kỳ nội dung nào trong ngoặc đơn/ngoặc nhọn
        const cleanName = (name: string) => name.replace(/\(.*?\)|<.*?>/g, '').trim();
        
        const nameA = a.name || "";
        const nameB = b.name || "";
        const cleanA = cleanName(nameA);
        const cleanB = cleanName(nameB);
        
        const partsA = cleanA.split(/\s+/);
        const partsB = cleanB.split(/\s+/);
        const firstNameA = partsA.length > 0 ? partsA[partsA.length - 1] : "";
        const firstNameB = partsB.length > 0 ? partsB[partsB.length - 1] : "";
        
        const compare = firstNameA.localeCompare(firstNameB, 'vi');
        if (compare !== 0) return compare;
        return cleanA.localeCompare(cleanB, 'vi');
      });
      setUsers(sortedData);
    } catch (error) {
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproval = async (
    userId: string,
    currentStatus: boolean,
  ) => {
    startTransition(async () => {
      const res = await toggleUserApproval(userId);
      if (res.success) {
        toast.success(
          currentStatus ? "Đã khóa tài khoản" : "Đã duyệt tài khoản",
        );
        // Optimistic update
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, isApproved: !currentStatus } : u,
          ),
        );
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    startTransition(async () => {
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        toast.success("Đã cập nhật quyền người dùng");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        );
      } else {
        toast.error(res.error || "Không thể cập nhật quyền");
      }
    });
  };

  const handleLevelChange = async (userId: string, newLevel: Level) => {
    startTransition(async () => {
      const res = await updateUserLevel(userId, newLevel);
      if (res.success) {
        toast.success("Đã cập nhật cấp độ học tập");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, level: newLevel } : u)),
        );
      } else {
        toast.error(res.error || "Không thể cập nhật cấp độ");
      }
    });
  };

  const handleTypeChange = async (userId: string, newType: StudentType) => {
    startTransition(async () => {
      const res = await updateStudentType(userId, newType);
      if (res.success) {
        toast.success("Đã cập nhật hình thức học");
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, studentType: newType } : u,
          ),
        );
      } else {
        toast.error(res.error || "Không thể cập nhật hình thức học");
      }
    });
  };

  const handleClassChange = async (
    userId: string,
    newClassId: string | "NONE",
  ) => {
    const classId = newClassId === "NONE" ? null : newClassId;
    startTransition(async () => {
      const res = await updateUserClass(userId, classId);
      if (res.success) {
        toast.success("Đã cập nhật lớp học");
        const updatedClass = classId
          ? classes.find((c) => c.id === classId)
          : null;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, classId, studyClass: updatedClass } : u,
          ),
        );
      } else {
        toast.error(res.error || "Không thể cập nhật lớp học");
      }
    });
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;

    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res.success) {
        toast.success("Đã xóa người dùng");
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        toast.error(res.error);
      }
    });
  };

  if (loading)
    return <div className="p-8 text-center text-gray-500">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">
        Quản lý người dùng
      </h1>

      <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex gap-4 text-blue-900 shadow-sm">
        <Info className="w-6 h-6 shrink-0 text-blue-600" />
        <div className="space-y-2">
          <p className="font-black uppercase tracking-tight text-blue-950">
            Chi tiết phân quyền hệ thống:
          </p>
          <ul className="list-disc list-inside space-y-1.5 opacity-90 text-sm font-medium">
            <li>
              <strong className="font-black text-blue-950">
                ADMIN (Đồng quản trị):
              </strong>{" "}
              Có toàn quyền quản lý hệ thống, duyệt khóa học, duyệt người dùng,
              thiết lập giao diện và phân quyền.
            </li>
            <li>
              <strong className="font-black text-blue-950">
                TEACHER (Giảng viên):
              </strong>{" "}
              Có quyền tạo khóa học mới, tải lên bài giảng (video/pdf), tạo bài
              tập quiz, quản lý học viên trong khóa học của mình.
            </li>
            <li>
              <strong className="font-black text-blue-950">
                STUDENT (Học viên):
              </strong>{" "}
              Chỉ có quyền xem và học các khóa học đã đăng ký, làm bài tập và
              thảo luận trong lớp.
            </li>
          </ul>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm theo tên hoặc email..."
            className="pl-10 h-11 rounded-2xl border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={roleFilter}
            onValueChange={(val) => setRoleFilter(val as any)}
          >
            <SelectTrigger className="w-[140px] h-11 rounded-2xl border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <SelectValue placeholder="Vai trò" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả vai trò</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="TEACHER">TEACHER</SelectItem>
              <SelectItem value="STUDENT">STUDENT</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val as any)}
          >
            <SelectTrigger className="w-[140px] h-11 rounded-2xl border-slate-200">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <SelectValue placeholder="Hình thức" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả hình thức</SelectItem>
              <SelectItem value="ONLINE">Online</SelectItem>
              <SelectItem value="OFFLINE">Offline</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={levelFilter}
            onValueChange={(val) => setLevelFilter(val as any)}
          >
            <SelectTrigger className="w-[140px] h-11 rounded-2xl border-slate-200">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                <SelectValue placeholder="Cấp độ" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả cấp độ</SelectItem>
              <SelectItem value="BASIC">Cơ bản</SelectItem>
              <SelectItem value="ADVANCED">Nâng cao</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={classFilter}
            onValueChange={(val) => setClassFilter(val)}
          >
            <SelectTrigger className="w-[140px] h-11 rounded-2xl border-slate-200">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                <SelectValue placeholder="Lớp học" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả lớp</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card-surface rounded-[2rem] overflow-x-auto border border-border/50">
        <div className="min-w-[800px] md:min-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Thông tin</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Vai trò</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Hình thức
                </TableHead>
                <TableHead className="hidden sm:table-cell">Cấp độ</TableHead>
                <TableHead className="hidden sm:table-cell">Lớp</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Trạng thái
                </TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="text-center font-bold text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">
                      {user.name || "Chưa đặt tên"}
                    </div>
                    <div className="text-[10px] text-muted-foreground sm:hidden">
                      {user.email}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 sm:hidden">
                      <Select
                        defaultValue={user.role}
                        onValueChange={(val) =>
                          handleRoleChange(user.id, val as any)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-[90px] h-7 text-[10px] font-bold border-slate-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="ADMIN"
                            className="text-[10px] font-bold text-blue-600"
                          >
                            ADMIN
                          </SelectItem>
                          <SelectItem
                            value="TEACHER"
                            className="text-[10px] font-bold text-blue-600"
                          >
                            TEACHER
                          </SelectItem>
                          <SelectItem
                            value="STUDENT"
                            className="text-[10px] font-bold"
                          >
                            STUDENT
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {user.role === "STUDENT" && (
                        <>
                          <Select
                            defaultValue={user.studentType}
                            onValueChange={(val) =>
                              handleTypeChange(user.id, val as any)
                            }
                            disabled={isPending}
                          >
                            <SelectTrigger
                              className={cn(
                                "w-[90px] h-7 text-[10px] font-bold border-slate-200 rounded-lg",
                                user.studentType === "OFFLINE"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-blue-50 text-blue-700",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="ONLINE"
                                className="text-[10px] font-bold"
                              >
                                ONLINE
                              </SelectItem>
                              <SelectItem
                                value="OFFLINE"
                                className="text-[10px] font-bold"
                              >
                                OFFLINE
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            defaultValue={user.level}
                            onValueChange={(val) =>
                              handleLevelChange(user.id, val as any)
                            }
                            disabled={isPending}
                          >
                            <SelectTrigger
                              className={cn(
                                "w-[90px] h-7 text-[10px] font-bold border-slate-200 rounded-lg",
                                user.level === "ADVANCED"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-green-50 text-green-700",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="BASIC"
                                className="text-[10px] font-bold"
                              >
                                Cơ bản
                              </SelectItem>
                              <SelectItem
                                value="ADVANCED"
                                className="text-[10px] font-bold"
                              >
                                Nâng cao
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            defaultValue={user.classId || "NONE"}
                            onValueChange={(val) =>
                              handleClassChange(user.id, val)
                            }
                            disabled={isPending}
                          >
                            <SelectTrigger className="w-[90px] h-7 text-[10px] font-bold border-slate-200 rounded-lg">
                              <SelectValue placeholder="Chưa xếp lớp" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="NONE"
                                className="text-[10px] font-bold text-slate-400"
                              >
                                Không có lớp
                              </SelectItem>
                              {classes.map((c) => (
                                <SelectItem
                                  key={c.id}
                                  value={c.id}
                                  className="text-[10px] font-bold"
                                >
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-7 flex items-center rounded-lg ${user.isApproved ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}
                      >
                        {user.isApproved ? "Duyệt" : "Chờ"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs font-medium text-slate-500">
                    {user.email}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Select
                      defaultValue={user.role}
                      onValueChange={(val) =>
                        handleRoleChange(user.id, val as any)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs font-bold border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="ADMIN"
                          className="text-xs font-bold text-blue-600"
                        >
                          ADMIN
                        </SelectItem>
                        <SelectItem
                          value="TEACHER"
                          className="text-xs font-bold text-blue-600"
                        >
                          TEACHER
                        </SelectItem>
                        <SelectItem
                          value="STUDENT"
                          className="text-xs font-bold text-slate-700"
                        >
                          STUDENT
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {user.role === "STUDENT" ? (
                      <Select
                        defaultValue={user.studentType}
                        onValueChange={(val) =>
                          handleTypeChange(user.id, val as any)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-[110px] h-8 text-xs font-bold border-transparent rounded-xl transition-colors",
                            user.studentType === "OFFLINE"
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="ONLINE"
                            className="text-xs font-bold text-blue-700"
                          >
                            ONLINE
                          </SelectItem>
                          <SelectItem
                            value="OFFLINE"
                            className="text-xs font-bold text-orange-700"
                          >
                            OFFLINE
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-2">
                        N/A
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {user.role === "STUDENT" ? (
                      <Select
                        defaultValue={user.level}
                        onValueChange={(val) =>
                          handleLevelChange(user.id, val as any)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-[110px] h-8 text-xs font-bold border-transparent rounded-xl transition-colors",
                            user.level === "ADVANCED"
                              ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="BASIC"
                            className="text-xs font-bold text-green-700"
                          >
                            Cơ bản
                          </SelectItem>
                          <SelectItem
                            value="ADVANCED"
                            className="text-xs font-bold text-purple-700"
                          >
                            Nâng cao
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-2">
                        N/A
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {user.role === "STUDENT" ? (
                      <Select
                        defaultValue={user.classId || "NONE"}
                        onValueChange={(val) => handleClassChange(user.id, val)}
                        disabled={isPending}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-[110px] h-8 text-xs font-bold border-transparent rounded-xl transition-colors",
                            user.classId
                              ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                          )}
                        >
                          <SelectValue placeholder="Chưa xếp lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="NONE"
                            className="text-xs font-bold text-slate-500"
                          >
                            Chưa xếp lớp
                          </SelectItem>
                          {classes.map((c) => (
                            <SelectItem
                              key={c.id}
                              value={c.id}
                              className="text-xs font-bold text-indigo-700"
                            >
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-2">
                        N/A
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest border-transparent",
                        user.isApproved
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700",
                      )}
                    >
                      {user.isApproved ? "Đã duyệt" : "Chờ duyệt"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <Button
                        size="sm"
                        variant={user.isApproved ? "outline" : "default"}
                        onClick={() =>
                          handleToggleApproval(user.id, user.isApproved)
                        }
                        disabled={isPending}
                        className={cn(
                          user.isApproved
                            ? "border-amber-500 text-amber-600 hover:bg-amber-50 rounded-xl"
                            : "bg-green-600 hover:bg-green-700 rounded-xl",
                          "px-2 sm:px-3 h-8 sm:h-9",
                        )}
                        title={
                          user.isApproved ? "Khóa tài khoản" : "Duyệt tài khoản"
                        }
                      >
                        {user.isApproved ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Khóa</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Duyệt</span>
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(user.id)}
                        disabled={isPending}
                        title="Xóa người dùng"
                        className="h-8 sm:h-9 w-8 sm:w-9 p-0 rounded-xl"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center space-y-3">
              <div className="text-slate-300 flex justify-center">
                <Search className="w-12 h-12" />
              </div>
              <p className="text-slate-500 font-bold tracking-tight uppercase">
                Không tìm thấy người dùng nào phù hợp
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("ALL");
                  setTypeFilter("ALL");
                }}
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
