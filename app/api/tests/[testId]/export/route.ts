import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { testId } = await params;

  // 1. Fetch test details and all attempts
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: {
        select: {
          chapter: {
            select: { courseId: true }
          }
        }
      },
      course: { select: { id: true } },
      sections: {
        include: {
          questions: true,
        },
      },
      attempts: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          answers: {
            select: { isCorrect: true }
          }
        },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!test) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const courseId = test.courseId || test.lesson?.chapter?.courseId;
  const totalQuestions = test.sections.reduce((acc, s) => acc + s.questions.length, 0);

  // 2. Fetch all enrolled students if it's a course-related test
  let enrolledStudents: any[] = [];
  if (courseId) {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    enrolledStudents = enrollments.map(e => e.user);
  }

  // 3. Prepare data for Excel
  const studentDataMap = new Map<string, any>();

  // Add all enrolled students first as "Not Attempted"
  enrolledStudents.forEach(student => {
    studentDataMap.set(student.id, {
      id: student.id,
      name: student.name || student.email,
      email: student.email,
      status: "Chưa làm",
      score: "",
      duration: "",
      completedAt: "",
      correctTotal: `0/${totalQuestions}`
    });
  });

  // Overwrite with attempt data
  test.attempts.forEach(attempt => {
    const student = attempt.user;
    const correctCount = attempt.answers.filter(a => a.isCorrect === true).length;
    
    let duration = "N/A";
    if (attempt.completedAt) {
      const diff = attempt.completedAt.getTime() - attempt.startedAt.getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      duration = `${mins} phút ${secs} giây`;
    }

    const isLate = test.dueDate && attempt.completedAt && attempt.completedAt > test.dueDate;

    studentDataMap.set(student.id, {
      id: student.id,
      name: student.name || student.email,
      email: student.email,
      status: attempt.completedAt ? (isLate ? "Nộp trễ" : "Đã nộp") : "Chưa làm",
      score: attempt.score !== null ? attempt.score.toFixed(2) : "0",
      duration,
      completedAt: attempt.completedAt ? attempt.completedAt.toLocaleString("vi-VN") : "N/A",
      correctTotal: `${correctCount}/${totalQuestions}`
    });
  });

  const finalRows = Array.from(studentDataMap.values()).sort((a, b) => {
    if (a.status === "Chưa làm" && b.status !== "Chưa làm") return 1;
    if (a.status !== "Chưa làm" && b.status === "Chưa làm") return -1;
    return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
  });

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thống kê bài kiểm tra');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã Học Sinh', key: 'id', width: 25 },
      { header: 'Họ và Tên', key: 'name', width: 30 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Điểm số', key: 'score', width: 12 },
      { header: 'Thời gian làm bài', key: 'duration', width: 20 },
      { header: 'Ngày nộp bài', key: 'completedAt', width: 25 },
      { header: 'Số câu đúng / Tổng câu', key: 'correctTotal', width: 25 },
    ];

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF444444' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    finalRows.forEach((row, index) => {
      const addedRow = worksheet.addRow({
        stt: index + 1,
        ...row
      });

      // Conditional styling for status
      const statusCell = addedRow.getCell('status');
      if (row.status === "Chưa làm") {
        statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      } else if (row.status === "Nộp trễ") {
        statusCell.font = { color: { argb: 'FFFFA500' }, bold: true };
      } else {
        statusCell.font = { color: { argb: 'FF008000' }, bold: true };
      }
      
      addedRow.alignment = { vertical: 'middle' };
      addedRow.getCell('stt').alignment = { horizontal: 'center' };
      addedRow.getCell('score').alignment = { horizontal: 'center' };
    });

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Thong_ke_${test.title?.replace(/\s+/g, "_") || 'Bai_kiem_tra'}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
