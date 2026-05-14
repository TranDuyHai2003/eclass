import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(
  req: NextRequest,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId") || session.user.id;

  // Security: Only Admin/Teacher can view others' stats
  if (userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 1. Fetch student info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) return new NextResponse("User not found", { status: 404 });

  // 2. Fetch all completed attempts
  const attempts = await prisma.studentAttempt.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    include: {
      test: {
        select: {
          title: true,
          lesson: { select: { title: true } },
          course: { select: { title: true } },
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  // 3. Prepare data for Excel
  const exportData = attempts.map((a) => ({
    "Bài kiểm tra": a.test.title || a.test.lesson?.title || a.test.course?.title || "N/A",
    "Khóa học": a.test.course?.title || "Bài lẻ",
    "Điểm số": a.score !== null ? a.score.toFixed(2) : "Chưa chấm",
    "Thời gian bắt đầu": a.startedAt.toLocaleString("vi-VN"),
    "Thời gian nộp bài": a.completedAt?.toLocaleString("vi-VN") || "N/A",
  }));

  // 4. Create Workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);

  const wscols = [
    { wch: 40 }, // Bài kiểm tra
    { wch: 30 }, // Khóa học
    { wch: 15 }, // Điểm số
    { wch: 25 }, // Bắt đầu
    { wch: 25 }, // Nộp bài
  ];
  ws["!cols"] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Thống kê cá nhân");

  // 5. Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Thong_ke_${user.name?.replace(/\s+/g, "_")}.xlsx"`,
    },
  });
}
