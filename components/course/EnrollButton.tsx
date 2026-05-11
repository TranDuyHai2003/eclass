"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEnrollment } from "@/actions/enrollment";
import Link from "next/link";
import { toast } from "sonner"; 

interface EnrollButtonProps {
  courseId: string;
  courseTitle: string;
  coursePrice?: number;
  enrollmentStatus: string | null;
  firstLessonId?: string;
  isLoggedIn: boolean;
  isAdminOrTeacher: boolean;
  userEmail: string;
}

export function EnrollButton({
  courseId,
  courseTitle,
  coursePrice = 0,
  enrollmentStatus,
  firstLessonId,
  isLoggedIn,
  isAdminOrTeacher,
  userEmail
}: EnrollButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEnrollClick = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await createEnrollment(courseId);
      if (res.success) {
        toast.success("Tuyệt vời! Yêu cầu của bạn đã được gửi. Vui lòng chờ Admin duyệt nhé!");
        router.refresh();
      } else {
        toast.error(res.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Cấp quyền ngay nếu là Admin, Teacher hoặc đã được duyệt
  if (enrollmentStatus === "ACTIVE" || isAdminOrTeacher) {
    return (
      <Link
        href={firstLessonId ? `/watch/${firstLessonId}` : "#"}
        className="group relative inline-flex w-full items-center justify-center px-10 py-5 bg-slate-900 text-white font-black text-lg rounded-[2rem] shadow-2xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <span className="relative z-10">Bắt đầu học ngay</span>
      </Link>
    );
  }

  // 2. Chờ duyệt
  if (enrollmentStatus === "PENDING") {
    return (
      <button
        disabled
        className="relative inline-flex w-full items-center justify-center px-10 py-5 bg-slate-100 text-slate-400 font-black text-lg rounded-[2rem] shadow-inner opacity-90 cursor-not-allowed uppercase tracking-widest border-2 border-slate-200"
      >
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse mr-3" />
        Đang chờ duyệt...
      </button>
    );
  }

  // 3. Chưa ghi danh (hoặc bị từ chối)
  return (
    <button
      onClick={handleEnrollClick}
      disabled={isLoading}
      className="group relative inline-flex w-full items-center justify-center px-10 py-5 bg-red-600 text-white font-black text-lg rounded-[2rem] shadow-xl shadow-red-200 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl hover:shadow-red-500/20 uppercase tracking-widest disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      <span className="relative z-10">{isLoading ? "Đang xử lý..." : "Ghi danh khóa học"}</span>
    </button>
  );
}
