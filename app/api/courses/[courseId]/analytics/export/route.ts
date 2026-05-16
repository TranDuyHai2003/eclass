import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCourseProgressMatrix } from "@/actions/analytics";
import ExcelJS from "exceljs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { courseId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const month = parseInt(searchParams.get("month") || "0");
  const year = parseInt(searchParams.get("year") || "0");

  try {
    const data = await getCourseProgressMatrix(courseId, month, year);

    const workbook = new ExcelJS.Workbook();

    // SHEET 1: Thống kê chi tiết (Smart Matrix) - Case 2 Requirement
    const matrixSheet = workbook.addWorksheet('Báo cáo tiến độ');
    
    const matrixColumns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã Học Sinh', key: 'id', width: 25 },
      { header: 'Họ và Tên', key: 'name', width: 30 },
      { header: '📈 Điểm Trung Bình', key: 'averageScore', width: 18 },
      ...data.tests.map((test, index) => ({
        header: test.title || `Bài KT ${index + 1}`,
        key: `test_${test.id}`,
        width: 15
      })),
      { header: 'Số bài đã làm', key: 'completedCount', width: 15 },
      { header: '⚠️ BỎ BÀI', key: 'missedCount', width: 15 }
    ];
    matrixSheet.columns = matrixColumns;

    // Style header
    const headerRow = matrixSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF444444' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    data.matrix.forEach((student, index) => {
      const rowData: any = {
        stt: index + 1,
        id: student.studentId,
        name: student.studentName,
        averageScore: student.averageScore.toFixed(2),
        completedCount: student.completedCount,
        missedCount: student.missedCount
      };

      student.testStatuses.forEach((status) => {
        rowData[`test_${status.testId}`] = status.status === "COMPLETED" ? (status.score ?? 0).toFixed(2) : "X";
      });

      const row = matrixSheet.addRow(rowData);

      // Styling
      row.alignment = { vertical: 'middle' };
      row.getCell('stt').alignment = { horizontal: 'center' };
      row.getCell('averageScore').font = { bold: true };
      row.getCell('averageScore').alignment = { horizontal: 'center' };
      row.getCell('completedCount').alignment = { horizontal: 'center' };
      
      const missedCell = row.getCell('missedCount');
      missedCell.alignment = { horizontal: 'center' };
      if (student.missedCount > 0) {
        missedCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      }
      
      student.testStatuses.forEach((status) => {
         const cell = row.getCell(`test_${status.testId}`);
         cell.alignment = { horizontal: 'center' };
         if (status.status !== "COMPLETED") {
           cell.font = { color: { argb: 'FFFF0000' }, bold: true };
         }
      });
    });

    // Add borders to matrixSheet
    matrixSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // SHEET 2: Nhật ký làm bài (Detailed Logs)
    const logsSheet = workbook.addWorksheet('Nhật ký làm bài');
    logsSheet.columns = [
      { header: 'Tên Học Sinh', key: 'studentName', width: 30 },
      { header: 'Tên Bài Kiểm Tra', key: 'testTitle', width: 40 },
      { header: 'Điểm Số', key: 'score', width: 15 },
      { header: 'Ngày Nộp', key: 'completedAt', width: 25 },
    ];

    logsSheet.getRow(1).font = { bold: true };
    logsSheet.getRow(1).alignment = { horizontal: 'center' };

    data.matrix.forEach((student) => {
      student.testStatuses.forEach((status) => {
        if (status.status === "COMPLETED") {
          const testInfo = data.tests.find(t => t.id === status.testId);
          logsSheet.addRow({
            studentName: student.studentName,
            testTitle: testInfo?.title || "N/A",
            score: status.score,
            completedAt: status.completedAt ? new Date(status.completedAt).toLocaleString('vi-VN') : "N/A"
          });
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Thong_ke_Course_${courseId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
