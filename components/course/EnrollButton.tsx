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
        toast.success("Đã gửi yêu cầu ghi danh. Vui lòng chờ Admin duyệt!");
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
        className="inline-flex w-full items-center justify-center px-10 py-5 bg-white text-red-600 font-black text-lg rounded-2xl shadow-xl hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wide"
      >
        Vào học ngay
      </Link>
    );
  }

  // 2. Chờ duyệt
  if (enrollmentStatus === "PENDING") {
    return (
      <button
        disabled
        className="inline-flex w-full items-center justify-center px-10 py-5 bg-orange-100 text-orange-600 font-black text-lg rounded-2xl shadow-inner opacity-90 cursor-not-allowed uppercase tracking-wide border-2 border-orange-200"
      >
        Đang chờ duyệt
      </button>
    );
  }

  // 3. Chưa ghi danh (hoặc bị từ chối)
  return (
    <button
      onClick={handleEnrollClick}
      disabled={isLoading}
      className="inline-flex w-full items-center justify-center px-10 py-5 bg-white text-red-600 font-black text-lg rounded-2xl shadow-xl hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isLoading ? "Đang xử lý..." : "Ghi danh ngay"}
    </button>
  );
}
