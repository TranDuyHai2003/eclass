import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getWeekOfMonth } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { compareVietnameseName } from "@/lib/utils";

const TIMEZONE = "Asia/Ho_Chi_Minh";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const level = searchParams.get("level"); // "BASIC" | "ADVANCED" | "ALL"
    const debug = searchParams.get("debug") === "1";

    if (!startDateStr || !endDateStr) {
      return new NextResponse("Missing date range", { status: 400 });
    }

    // Adjust query parameters in the same timezone used for display
    const startDate = fromZonedTime(
      new Date(`${startDateStr}T00:00:00.000`),
      TIMEZONE,
    );
    const endDate = fromZonedTime(
      new Date(`${endDateStr}T23:59:59.999`),
      TIMEZONE,
    );

    // 1. Fetch Students
    const students = await prisma.user.findMany({
      where: {
        studentType: "OFFLINE",
      },
      include: {
        studyClass: true,
        attempts: {
          where: {
            test: {
              OR: [
                { dueDate: { gte: startDate, lte: endDate } },
                { dueDate: null, createdAt: { gte: startDate, lte: endDate } }
              ]
            },
          },
          select: {
            score: true,
            test: { select: { id: true, type: true, createdAt: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    students.sort((a, b) => compareVietnameseName(a.name, b.name));

    // Helper: Determine student class name
    const getStudentClassName = (s: any) => {
      if (s.studyClass?.name) return s.studyClass.name;
      if (s.level === "ADVANCED") return "12A";
      if (s.level === "BASIC") return "12B";
      return "Chưa xếp lớp";
    };

    // Group students by class
    const classStudentsMap = new Map<string, typeof students>();
    for (const s of students) {
      const cName = getStudentClassName(s);
      if (!classStudentsMap.has(cName)) {
        classStudentsMap.set(cName, []);
      }
      classStudentsMap.get(cName)!.push(s);
    }

    // Determine classes to render
    let classesToRender = Array.from(classStudentsMap.keys()).sort((a, b) =>
      a.localeCompare(b, "vi", { numeric: true })
    );

    if (level && level !== "ALL") {
      classesToRender = classesToRender.filter((cName) => {
        if (cName === level) return true;
        if (level === "ADVANCED" && (cName === "12A" || cName === "ADVANCED")) return true;
        if (level === "BASIC" && (cName === "12B" || cName === "BASIC")) return true;
        const stus = classStudentsMap.get(cName) || [];
        return stus.some(
          (s) =>
            s.classId === level ||
            s.studyClass?.id === level ||
            s.studyClass?.name === level ||
            s.level === level
        );
      });
    }

    // 2. Pre-process and Group Tests by Date
    const testsInPeriod = await prisma.test.findMany({
      where: {
        OR: [
          { dueDate: { gte: startDate, lte: endDate } },
          { dueDate: null, createdAt: { gte: startDate, lte: endDate } }
        ]
      },
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
        type: true,
        lesson: {
          select: {
            chapter: {
              select: {
                course: {
                  select: {
                    level: true,
                    classes: { select: { id: true, name: true } }
                  }
                }
              }
            }
          },
        },
        course: {
          select: {
            level: true,
            classes: { select: { id: true, name: true } }
          }
        },
      },
    });

    const isTestForClass = (t: any, className: string, levelStudents: any[]) => {
      const courseClasses = t.course?.classes || t.lesson?.chapter?.course?.classes || [];
      const hasExplicitClass = courseClasses.length > 0;
      const isClassAssigned = courseClasses.some((c: any) => c.name === className || c.id === className);
      const isAttemptedByClassStudent = levelStudents.some((s) => s.attempts.some((a: any) => a.test.id === t.id));

      if (hasExplicitClass) {
        // If course is explicitly assigned to specific classes, only include if this class is in courseClasses OR if a student attempted it
        return isClassAssigned || isAttemptedByClassStudent;
      }

      // If course is NOT explicitly assigned to any class, include ONLY if a student of this class has attempted it
      return isAttemptedByClassStudent;
    };

    // 3. Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bảng Điểm Offline");

    // Standard styling for headers
    const headerStyle = {
      font: {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF000000" },
      },
      alignment: {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      } as ExcelJS.Alignment,
      border: {
        top: { style: "thin" as ExcelJS.BorderStyle },
        left: { style: "thin" as ExcelJS.BorderStyle },
        bottom: { style: "thin" as ExcelJS.BorderStyle },
        right: { style: "thin" as ExcelJS.BorderStyle },
      },
    };

    // Helper to style merged cells
    const styleMergedCell = (sheet: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, styleObj: any, fillObj: any) => {
      sheet.mergeCells(r1, c1, r2, c2);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = sheet.getCell(r, c);
          if (styleObj && styleObj.border) cell.border = styleObj.border;
          if (fillObj) cell.fill = fillObj;
        }
      }
      return sheet.getCell(r1, c1);
    };

    if (debug) {
      const debugLevels = classesToRender.map((currentClassName) => {
        const levelStudents = classStudentsMap.get(currentClassName) || [];
        const relevantTests = testsInPeriod.filter((t) => isTestForClass(t, currentClassName, levelStudents));

        const testGroups = new Map<
          string,
          { homeworks: string[]; exams: string[]; displayDate: string }
        >();

        for (const t of relevantTests) {
          const targetDate = t.dueDate || t.createdAt;
          if (!targetDate) continue;
          const dateObj = toZonedTime(targetDate, TIMEZONE);
          const month = dateObj.getMonth() + 1;
          const year = dateObj.getFullYear();
          const week = getWeekOfMonth(dateObj, { weekStartsOn: 1 });
          const dateStr = `${year}-${month.toString().padStart(2, "0")}-W${week.toString().padStart(2, "0")}`;
          const displayStr = `Tuần ${week} (Tháng ${month})`;

          if (!testGroups.has(dateStr)) {
            testGroups.set(dateStr, {
              homeworks: [],
              exams: [],
              displayDate: displayStr,
            });
          }

          const group = testGroups.get(dateStr)!;
          if (t.type === "HOMEWORK") {
            group.homeworks.push(t.id);
          } else {
            group.exams.push(t.id);
          }
        }

        return {
          currentClassName,
          levelStudents: levelStudents.length,
          relevantTests: relevantTests.length,
          dateKeys: Array.from(testGroups.keys()).sort(),
        };
      });

      return NextResponse.json(
        {
          input: {
            startDateStr,
            endDateStr,
            level,
            timezone: TIMEZONE,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          counts: {
            students: students.length,
            testsInPeriod: testsInPeriod.length,
          },
          levels: debugLevels,
        },
        { status: 200 },
      );
    }

    let currentRowIndex = 1;

    for (const currentClassName of classesToRender) {
      const levelStudents = classStudentsMap.get(currentClassName) || [];
      if (levelStudents.length === 0 && level === "ALL") continue; // Skip if empty and we are exporting ALL

      // Find tests relevant to this class
      const relevantTests = testsInPeriod.filter((t) => isTestForClass(t, currentClassName, levelStudents));

      const weekGroups = new Map<
        string,
        {
          weekKey: string;
          displayWeek: string;
          days: Map<
            string,
            { dateStr: string; displayDate: string; homeworks: string[]; exams: string[] }
          >;
        }
      >();

      for (const t of relevantTests) {
        const targetDate = t.dueDate || t.createdAt;
        if (!targetDate) continue;
        const dateObj = toZonedTime(targetDate, TIMEZONE);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const week = getWeekOfMonth(dateObj, { weekStartsOn: 1 });
        const weekKey = `${year}-${month.toString().padStart(2, "0")}-W${week.toString().padStart(2, "0")}`;
        const displayWeek = `Tuần ${week} (tháng ${month})`;

        const dateStr = formatInTimeZone(targetDate, TIMEZONE, "yyyy-MM-dd");
        const dayNames = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        const displayDate = `${dayNames[dateObj.getDay()]} (${formatInTimeZone(targetDate, TIMEZONE, "d/M")})`;

        if (!weekGroups.has(weekKey)) {
          weekGroups.set(weekKey, {
            weekKey,
            displayWeek,
            days: new Map(),
          });
        }

        const wGroup = weekGroups.get(weekKey)!;
        if (!wGroup.days.has(dateStr)) {
          wGroup.days.set(dateStr, {
            dateStr,
            displayDate,
            homeworks: [],
            exams: [],
          });
        }

        const dGroup = wGroup.days.get(dateStr)!;
        if (t.type === "HOMEWORK") {
          dGroup.homeworks.push(t.id);
        } else {
          dGroup.exams.push(t.id);
        }
      }

      const levelName = currentClassName.startsWith("Lớp") ? currentClassName : `Lớp ${currentClassName}`;
      const sortedWeekKeys = Array.from(weekGroups.keys()).sort();

      if (debug) {
        console.log("[EXPORT_OFFLINE_DEBUG]", {
          currentClassName,
          levelStudents: levelStudents.length,
          relevantTests: relevantTests.length,
          weekKeys: sortedWeekKeys.length,
        });
      }

      let dateColumnsCount = 0;
      for (const weekKey of sortedWeekKeys) {
        const wGroup = weekGroups.get(weekKey)!;
        dateColumnsCount += wGroup.days.size * 3 + 1;
      }
      const totalColumns = 2 + dateColumnsCount;
      const maxColMerge = Math.max(totalColumns, 4);

      const titleCell = styleMergedCell(sheet, currentRowIndex, 1, currentRowIndex, maxColMerge, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } });
      titleCell.value = `Nhận xét hàng tuần (${levelName})`;
      titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      currentRowIndex++;

      const subTitleCell = styleMergedCell(sheet, currentRowIndex, 1, currentRowIndex, maxColMerge, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } });
      subTitleCell.value = `Từ ${formatInTimeZone(startDate, TIMEZONE, "dd/MM/yyyy")} đến ${formatInTimeZone(endDate, TIMEZONE, "dd/MM/yyyy")}`;
      subTitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
      currentRowIndex++;

      const headerRow1 = currentRowIndex;
      const headerRow2 = currentRowIndex + 1;
      const headerRow3 = currentRowIndex + 2;

      sheet.getColumn(1).width = 5;
      sheet.getColumn(2).width = 25;

      const sttCell = styleMergedCell(sheet, headerRow1, 1, headerRow3, 1, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } });
      sttCell.value = "STT";
      sttCell.font = headerStyle.font;
      sttCell.alignment = headerStyle.alignment;

      const nameCell = styleMergedCell(sheet, headerRow1, 2, headerRow3, 2, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } });
      nameCell.value = "Tên học sinh";
      nameCell.font = headerStyle.font;
      nameCell.alignment = headerStyle.alignment;

      let colIdx = 3;
      for (const weekKey of sortedWeekKeys) {
        const wGroup = weekGroups.get(weekKey)!;
        const sortedDateKeys = Array.from(wGroup.days.keys()).sort();
        const weekColSpan = wGroup.days.size * 3 + 1;

        const weekCell = styleMergedCell(sheet, headerRow1, colIdx, headerRow1, colIdx + weekColSpan - 1, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } });
        weekCell.value = wGroup.displayWeek;
        weekCell.font = headerStyle.font;
        weekCell.alignment = headerStyle.alignment;

        let dayColIdx = colIdx;
        for (const dateKey of sortedDateKeys) {
          const dGroup = wGroup.days.get(dateKey)!;

          const dayCell = styleMergedCell(sheet, headerRow2, dayColIdx, headerRow2, dayColIdx + 2, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } });
          dayCell.value = dGroup.displayDate;
          dayCell.font = headerStyle.font;
          dayCell.alignment = headerStyle.alignment;

          const subHeaders = ["Điểm danh", "BTVN", "Điểm kiểm tra"];
          for (let i = 0; i < 3; i++) {
            const subCell = sheet.getCell(headerRow3, dayColIdx + i);
            subCell.value = subHeaders[i];
            subCell.border = headerStyle.border;
            subCell.font = headerStyle.font;
            subCell.alignment = headerStyle.alignment;
            subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
            sheet.getColumn(dayColIdx + i).width = 12;
          }

          dayColIdx += 3;
        }

        const noteCell = styleMergedCell(sheet, headerRow2, dayColIdx, headerRow3, dayColIdx, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } });
        noteCell.value = "Nhận xét";
        noteCell.font = headerStyle.font;
        noteCell.alignment = headerStyle.alignment;
        sheet.getColumn(dayColIdx).width = 40;

        colIdx += weekColSpan;
      }

      currentRowIndex += 3;

      for (let i = 0; i < levelStudents.length; i++) {
        const student = levelStudents[i];

        const cellStt = sheet.getCell(currentRowIndex, 1);
        cellStt.value = i + 1;
        cellStt.border = headerStyle.border;
        cellStt.alignment = { vertical: "middle", horizontal: "center" };
        cellStt.font = { name: "Arial", size: 10 };

        const cellName = sheet.getCell(currentRowIndex, 2);
        cellName.value = student.name || "N/A";
        cellName.border = headerStyle.border;
        cellName.alignment = { vertical: "middle", horizontal: "left" };
        cellName.font = { name: "Arial", size: 10 };

        let dataColIdx = 3;
        for (const weekKey of sortedWeekKeys) {
          const wGroup = weekGroups.get(weekKey)!;
          const sortedDateKeys = Array.from(wGroup.days.keys()).sort();

          for (const dateKey of sortedDateKeys) {
            const dGroup = wGroup.days.get(dateKey)!;

            const homeworkAttempts = student.attempts.filter(
              (a) => dGroup.homeworks.includes(a.test.id) && a.score !== null
            );
            const maxHomeworkScore = homeworkAttempts.length > 0 ? Math.max(...homeworkAttempts.map((a) => a.score!)) : null;

            const examAttempts = student.attempts.filter(
              (a) => dGroup.exams.includes(a.test.id) && a.score !== null
            );
            const maxExamScore = examAttempts.length > 0 ? Math.max(...examAttempts.map((a) => a.score!)) : null;

            const attCell = sheet.getCell(currentRowIndex, dataColIdx);
            attCell.value = "ĐỦ"; // From image
            attCell.border = headerStyle.border;
            attCell.alignment = { vertical: "middle", horizontal: "center" };
            attCell.font = { name: "Arial", size: 10 };

            const hwCell = sheet.getCell(currentRowIndex, dataColIdx + 1);
            if (maxHomeworkScore !== null) {
              hwCell.value = maxHomeworkScore;
              hwCell.numFmt = "0.00";
            } else if (dGroup.homeworks.length > 0) {
              hwCell.value = "Chưa làm";
              hwCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFF0000" } };
            } else {
              hwCell.value = "";
            }
            hwCell.border = headerStyle.border;
            hwCell.alignment = { vertical: "middle", horizontal: "center" };
            if (!hwCell.font) hwCell.font = { name: "Arial", size: 10 };

            const examCell = sheet.getCell(currentRowIndex, dataColIdx + 2);
            if (maxExamScore !== null) {
              examCell.value = maxExamScore;
              examCell.numFmt = "0.00";
            } else if (dGroup.exams.length > 0) {
              examCell.value = "Chưa làm";
              examCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFF0000" } };
            } else {
              examCell.value = "";
            }
            examCell.border = headerStyle.border;
            examCell.alignment = { vertical: "middle", horizontal: "center" };
            if (!examCell.font) examCell.font = { name: "Arial", size: 10 };

            dataColIdx += 3;
          }

          const stuNoteCell = sheet.getCell(currentRowIndex, dataColIdx);
          stuNoteCell.value = "";
          stuNoteCell.border = headerStyle.border;
          stuNoteCell.alignment = { vertical: "middle", horizontal: "left" };

          dataColIdx++;
        }

        currentRowIndex++;
      }

      currentRowIndex += 4;
    }
// 6. Return the Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Offline_Report_${formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_OFFLINE]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
