import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

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

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thống kê cá nhân');

    worksheet.columns = [
      { header: 'Bài kiểm tra', key: 'testTitle', width: 40 },
      { header: 'Khóa học', key: 'courseTitle', width: 30 },
      { header: 'Điểm số', key: 'score', width: 15 },
      { header: 'Thời gian bắt đầu', key: 'startedAt', width: 25 },
      { header: 'Thời gian nộp bài', key: 'completedAt', width: 25 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    attempts.forEach((a) => {
      worksheet.addRow({
        testTitle: a.test.title || a.test.lesson?.title || a.test.course?.title || "N/A",
        courseTitle: a.test.course?.title || "Bài lẻ",
        score: a.score !== null ? a.score.toFixed(2) : "Chưa chấm",
        startedAt: a.startedAt.toLocaleString("vi-VN"),
        completedAt: a.completedAt?.toLocaleString("vi-VN") || "N/A",
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Thong_ke_${user.name?.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
