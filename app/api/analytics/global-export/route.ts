import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGlobalTestAnalytics } from "@/actions/analytics";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const courseIds = searchParams.get("courseIds")?.split(",").filter(Boolean);

  try {
    const data = await getGlobalTestAnalytics({ startDate, endDate, courseIds });
    const students = data.students;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo tổng hợp hệ thống');

    // 1. Identify all unique courses
    const allCourseTitles = new Set<string>();
    students.forEach(student => {
      student.courses.forEach((c: any) => allCourseTitles.add(c.title));
    });
    const sortedCourseTitles = Array.from(allCourseTitles).sort();

    // 2. Build Columns
    const columns: any[] = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã Học Sinh', key: 'id', width: 25 },
      { header: 'Họ và Tên', key: 'name', width: 30 },
      { header: 'ĐTB Toàn Bộ', key: 'globalAvg', width: 18 },
    ];

    sortedCourseTitles.forEach(title => {
      columns.push({ header: `[ĐTB] ${title}`, key: `course_${title}`, width: 20 });
    });

    columns.push(
      { header: 'Tổng số bài đã giao', key: 'totalAssigned', width: 20 },
      { header: 'Tổng số bài đã làm', key: 'totalDone', width: 20 },
      { header: 'Tổng số BỎ BÀI', key: 'totalMissed', width: 15 },
      { header: 'Tỷ lệ chuyên cần (%)', key: 'attendanceRate', width: 20 },
      { header: 'Đánh giá / Xếp loại', key: 'rank', width: 20 }
    );

    sheet.columns = columns;

    // 3. Add Data Rows
    students.sort((a, b) => b.stats.averageScore - a.stats.averageScore).forEach((student, index) => {
      const globalAvg = student.stats.averageScore;
      let rank = "Yếu";
      if (globalAvg >= 8) rank = "Giỏi";
      else if (globalAvg >= 6.5) rank = "Khá";
      else if (globalAvg >= 5) rank = "Trung Bình";

      const totalMissed = student.stats.totalAssigned - student.stats.completedCount;
      const attendanceRate = student.stats.totalAssigned > 0 
        ? ((student.stats.completedCount / student.stats.totalAssigned) * 100).toFixed(1) 
        : "0";

      const rowData: any = {
        stt: index + 1,
        id: student.id,
        name: student.name,
        globalAvg: globalAvg.toFixed(2),
        totalAssigned: student.stats.totalAssigned,
        totalDone: student.stats.completedCount,
        totalMissed: totalMissed,
        attendanceRate: `${attendanceRate}%`,
        rank: rank
      };

      sortedCourseTitles.forEach(title => {
        const studentCourse = student.courses.find((c: any) => c.title === title);
        if (studentCourse && studentCourse.tests.length > 0) {
          const courseAvg = studentCourse.tests.reduce((acc: number, t: any) => acc + (t.score || 0), 0) / studentCourse.tests.length;
          rowData[`course_${title}`] = courseAvg.toFixed(2);
        } else {
          rowData[`course_${title}`] = "-";
        }
      });

      const addedRow = sheet.addRow(rowData);

      // Styling for rank
      const rankCell = addedRow.getCell('rank');
      if (rank === "Giỏi") rankCell.font = { color: { argb: 'FF008000' }, bold: true };
      else if (rank === "Khá") rankCell.font = { color: { argb: 'FF0000FF' }, bold: true };
      else if (rank === "Trung Bình") rankCell.font = { color: { argb: 'FFFFA500' }, bold: true };
      else rankCell.font = { color: { argb: 'FFFF0000' }, bold: true };

      addedRow.getCell('globalAvg').font = { bold: true };
      addedRow.getCell('totalMissed').font = { color: { argb: 'FFFF0000' } };
    });

    // 4. Global Styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF444444' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
        if (typeof cell.value === 'number') cell.alignment = { horizontal: 'center' };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Bao_cao_tong_hop_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });

  } catch (error) {
    console.error("[GLOBAL_EXPORT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
