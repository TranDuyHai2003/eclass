import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGlobalTestAnalytics } from "@/actions/analytics";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const courseIds = searchParams.get("courseIds")?.split(",").filter(Boolean);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const studentTypeRaw = searchParams.get("studentType");
    const studentType = (studentTypeRaw === "ONLINE" || studentTypeRaw === "OFFLINE") ? studentTypeRaw : undefined;

    const data = await getGlobalTestAnalytics({
      startDate,
      endDate,
      courseIds,
      studentType: studentType as any
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Master Gradebook", {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }]
    });

    const coursesSchema = data.coursesSchema;
    const students = data.students;

    // Build Row 1 (Course Headers)
    const row1 = ["STT", "Mã HS", "Họ & Tên"];
    
    // Build Row 2 (Test Headers)
    const row2 = ["", "", ""];

    let currentColIndex = 4; // Excel uses 1-based index, STT(1), Mã(2), Tên(3) -> Course starts at 4

    const merges: { s: { r: number, c: number }, e: { r: number, c: number } }[] = [];

    // For STT, Mã HS, Tên - Merge vertically Row 1 and Row 2
    merges.push({ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } });
    merges.push({ s: { r: 1, c: 2 }, e: { r: 2, c: 2 } });
    merges.push({ s: { r: 1, c: 3 }, e: { r: 2, c: 3 } });

    coursesSchema.forEach((course) => {
      const courseStartCol = currentColIndex;
      const numTests = course.tests.length;
      const colSpan = numTests + 1; // +1 for TB Khóa
      
      row1.push(course.title);
      for(let i=0; i<colSpan-1; i++) row1.push(""); // Fill empty for merged cells
      
      merges.push({ s: { r: 1, c: courseStartCol }, e: { r: 1, c: courseStartCol + colSpan - 1 } });

      course.tests.forEach(t => {
        row2.push(t.title);
        currentColIndex++;
      });
      row2.push("TB Khóa");
      currentColIndex++;
    });

    row1.push("Điểm TB Chung");
    row2.push("");
    merges.push({ s: { r: 1, c: currentColIndex }, e: { r: 2, c: currentColIndex } });

    sheet.addRow(row1);
    sheet.addRow(row2);

    // Apply merges
    merges.forEach(merge => {
      sheet.mergeCells(merge.s.r, merge.s.c, merge.e.r, merge.e.c);
    });

    // Style Headers
    const headerRows = [sheet.getRow(1), sheet.getRow(2)];
    headerRows.forEach(row => {
      row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' } // slate-800
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'thin', color: { argb: 'FF475569' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });
    });

    // Fill Data
    students.forEach((student, index) => {
      const rowData: any[] = [
        index + 1,
        student.email,
        student.name
      ];

      coursesSchema.forEach((course) => {
        const studentCourse = student.courses.find((c: any) => c.id === course.id);
        
        let sumScore = 0;
        let validTests = 0;

        course.tests.forEach(t => {
          const testAttempt = studentCourse?.tests.find((st: any) => st.testId === t.id);
          if (testAttempt && testAttempt.score !== null) {
            rowData.push(testAttempt.score);
            sumScore += testAttempt.score;
            validTests++;
          } else {
            rowData.push("-");
          }
        });

        const tbKhoa = validTests > 0 ? (sumScore / course.tests.length).toFixed(2) : "-"; // Chú ý: chia cho tổng số bài của khóa
        rowData.push(tbKhoa);
      });

      rowData.push(student.stats.averageScore > 0 ? student.stats.averageScore.toFixed(2) : "-");
      
      const excelRow = sheet.addRow(rowData);
      
      // Style Data Row
      excelRow.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: colNumber > 3 ? 'center' : 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        
        // Color coding for scores
        if (colNumber > 3) {
           const val = cell.value;
           if (typeof val === 'number') {
              if (val >= 8) {
                 cell.font = { color: { argb: 'FF10B981' }, bold: true }; // emerald-500
              } else if (val < 5) {
                 cell.font = { color: { argb: 'FFEF4444' }, bold: true }; // red-500
              }
           }
        }
      });
    });

    // Auto-fit columns
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 25;
    
    for (let i = 4; i <= currentColIndex; i++) {
        sheet.getColumn(i).width = 12;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="Master_Gradebook.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error: any) {
    console.error("Export Master Gradebook Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
