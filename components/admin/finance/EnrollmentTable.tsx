"use client";

import { adminApproveEnrollment, adminRejectEnrollment } from "@/actions/enrollment";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { Check, X, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface EnrollmentProps {
  initialEnrollments: any[];
}

export function EnrollmentTable({ initialEnrollments }: EnrollmentProps) {
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await adminApproveEnrollment(id);
      if (res.success) {
        setEnrollments(prev => prev.filter(e => e.id !== id));
        toast.success("Đã duyệt thành công");
        router.refresh();
      } else {
        toast.error(res.error || "Lỗi duyệt");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn từ chối yêu cầu này?")) return;
    setLoadingId(id);
    try {
      const res = await adminRejectEnrollment(id);
      if (res.success) {
        setEnrollments(prev => prev.filter(e => e.id !== id));
        toast.success("Đã từ chối ghi danh");
        router.refresh();
      } else {
        toast.error(res.error || "Lỗi từ chối");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    } finally {
      setLoadingId(null);
    }
  };

  if (enrollments.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <p className="text-gray-500 font-medium text-sm">Không có yêu cầu ghi danh nào đang chờ duyệt.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm text-left align-middle">
        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
          <tr>
            <th className="px-4 sm:px-6 py-4 font-bold">Học viên</th>
            <th className="px-4 sm:px-6 py-4 font-bold hidden sm:table-cell">Khóa học</th>
            <th className="px-4 sm:px-6 py-4 font-bold hidden sm:table-cell">Ngày yêu cầu</th>
            <th className="px-4 sm:px-6 py-4 font-bold text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
              <td className="px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                    {enrollment.user.image ? (
                      <Image src={enrollment.user.image} alt={enrollment.user.name || "User"} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate text-sm sm:text-base">{enrollment.user.name || "Học viên"}</p>
                    <p className="text-xs text-gray-500 truncate">{enrollment.user.email}</p>
                    <p className="text-xs text-gray-400 font-medium truncate sm:hidden mt-0.5">
                      {enrollment.course.title}
                    </p>
                    <p className="text-[10px] text-gray-400 sm:hidden">
                      {new Date(enrollment.createdAt).toLocaleDateString("vi-VN", {
                         hour: "2-digit", minute: "2-digit",
                         day: "2-digit", month: "2-digit", year: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 sm:px-6 py-4 font-bold text-gray-900 hidden sm:table-cell">
                <span className="line-clamp-2">{enrollment.course.title}</span>
              </td>
              <td className="px-4 sm:px-6 py-4 text-gray-500 font-medium hidden sm:table-cell whitespace-nowrap">
                {new Date(enrollment.createdAt).toLocaleDateString("vi-VN", {
                   hour: "2-digit", minute: "2-digit",
                   day: "2-digit", month: "2-digit", year: "numeric"
                })}
              </td>
              <td className="px-4 sm:px-6 py-4 text-right">
                <div className="flex justify-end gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleApprove(enrollment.id)}
                    disabled={loadingId === enrollment.id}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 hover:text-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-green-200 shadow-sm"
                    title="Duyệt yêu cầu"
                  >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => handleReject(enrollment.id)}
                    disabled={loadingId === enrollment.id}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 shadow-sm"
                    title="Từ chối yêu cầu"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
