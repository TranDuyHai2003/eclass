import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { testId } = await params;

  // 1. Fetch test details and all attempts with student info
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      attempts: {
        where: { completedAt: { not: null } },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          answers: {
            include: {
              question: true,
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
      },
      sections: {
        include: {
          questions: true,
        },
      },
    },
  });

  if (!test) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 2. Prepare data for Excel
  const exportData = test.attempts.map((attempt) => {
    const row: any = {
      "Họ và tên": attempt.user.name || "N/A",
      "Email": attempt.user.email,
      "Điểm số": attempt.score !== null ? attempt.score.toFixed(2) : "Chưa chấm",
      "Thời gian bắt đầu": attempt.startedAt.toLocaleString("vi-VN"),
      "Thời gian nộp bài": attempt.completedAt?.toLocaleString("vi-VN") || "N/A",
    };

    // Calculate correctness per category if needed, or just detailed question results
    // For simplicity in the main sheet, we add these basic fields.
    return row;
  });

  // 3. Create Workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  const wscols = [
    { wch: 30 }, // Họ và tên
    { wch: 30 }, // Email
    { wch: 15 }, // Điểm số
    { wch: 25 }, // Thời gian bắt đầu
    { wch: 25 }, // Thời gian nộp bài
  ];
  ws["!cols"] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Danh sách điểm");

  // 4. Generate buffer and return
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Ket_qua_${test.title?.replace(/\s+/g, "_")}.xlsx"`,
    },
  });
}
