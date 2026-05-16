import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCourseProgressMatrix } from "@/actions/analytics";
import ExcelJS from "exceljs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { courseId } = await params;

  try {
    const { tests, matrix } = await getCourseProgressMatrix(courseId, 0, 0);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thống kê khóa học');

    // 1. Build columns
    const columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã Học Sinh', key: 'id', width: 25 },
      { header: 'Họ và Tên', key: 'name', width: 30 },
      { header: '📈 Điểm Trung Bình', key: 'averageScore', width: 18 },
    ];

    // Dynamic test columns
    tests.forEach((test, index) => {
      columns.push({
        header: test.title || `Bài KT ${index + 1}`,
        key: `test_${test.id}`,
        width: 15
      });
    });

    columns.push(
      { header: 'Số bài đã làm', key: 'completedCount', width: 15 },
      { header: '⚠️ BỎ BÀI', key: 'missedCount', width: 15 }
    );

    worksheet.columns = columns;

    // 2. Add data rows
    matrix.forEach((student, index) => {
      const rowData: any = {
        stt: index + 1,
        id: student.studentId,
        name: student.studentName,
        averageScore: student.averageScore.toFixed(2),
        completedCount: student.completedCount,
        missedCount: student.missedCount,
      };

      student.testStatuses.forEach((status: any) => {
        rowData[`test_${status.testId}`] = status.status === "COMPLETED" ? status.score.toFixed(2) : "X";
      });

      const addedRow = worksheet.addRow(rowData);

      // Style test cells (Red for missed)
      student.testStatuses.forEach((status: any) => {
        const cell = addedRow.getCell(`test_${status.testId}`);
        if (status.status !== "COMPLETED") {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
          cell.alignment = { horizontal: 'center' };
        } else {
          cell.alignment = { horizontal: 'center' };
        }
      });

      addedRow.getCell('averageScore').font = { bold: true };
      addedRow.getCell('averageScore').alignment = { horizontal: 'center' };
      addedRow.getCell('completedCount').alignment = { horizontal: 'center' };
      addedRow.getCell('missedCount').font = { color: { argb: 'FFFF0000' }, bold: true };
      addedRow.getCell('missedCount').alignment = { horizontal: 'center' };
    });

    // 3. Styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF444444' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

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
        "Content-Disposition": `attachment; filename="Thong_ke_khoa_hoc_${courseId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[COURSE_EXPORT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
