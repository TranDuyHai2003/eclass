"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEnrollment } from "@/actions/enrollment";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
interface EnrollButtonProps {
  courseId: string;
  courseTitle: string;
  coursePrice?: number;
  enrollmentStatus: string | null;
  firstLessonId?: string;
  isLoggedIn: boolean;
  isAdminOrTeacher: boolean;
  userEmail: string;
  className?: string;
}

export function EnrollButton({
  courseId,
  courseTitle,
  coursePrice = 0,
  enrollmentStatus,
  firstLessonId,
  isLoggedIn,
  isAdminOrTeacher,
  userEmail,
  className,
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
        toast.success(
          "Tuyệt vời! Yêu cầu của bạn đã được gửi. Vui lòng chờ Admin duyệt nhé!",
        );
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
        className={cn(
          "group relative inline-flex w-full items-center justify-center px-6 py-3",
          "bg-gradient-to-r from-orange-500 via-red-600 to-rose-600",
          "text-white font-black text-xs rounded-2xl shadow-[0_10px_25px_rgba(225,29,72,0.4)]",
          "transition-all duration-300 hover:scale-[1.05] active:scale-[0.95]",
          "uppercase tracking-widest overflow-hidden",
          className,
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <span className="relative z-10 flex items-center gap-2">
          Vào học ngay
          <Play className="w-3.5 h-3.5 fill-current" />
        </span>
      </Link>
    );
  }

  // 2. Chờ duyệt
  if (enrollmentStatus === "PENDING") {
    return (
      <button
        disabled
        className={cn(
          "relative inline-flex w-full items-center justify-center px-6 py-3 bg-slate-100 text-slate-400 font-black text-xs rounded-2xl shadow-inner opacity-90 cursor-not-allowed uppercase tracking-widest border-2 border-slate-200",
          className,
        )}
      >
        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse mr-2" />
        Chờ duyệt...
      </button>
    );
  }

  // 3. Chưa ghi danh (hoặc bị từ chối)
  return (
    <button
      onClick={handleEnrollClick}
      disabled={isLoading}
      className={cn(
        "group relative inline-flex w-full items-center justify-center px-6 py-3 bg-red-600 text-white font-black text-xs rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      <span className="relative z-10">
        {isLoading ? "Đang xử lý..." : "Ghi danh ngay"}
      </span>
    </button>
  );
}
