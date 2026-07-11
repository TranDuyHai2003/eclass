const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'eclass', 'app', 'api', 'admin', 'export-offline', 'route.ts');
const content = fs.readFileSync(filePath, 'utf-8');

const newCode = `      // Find tests relevant to this level (either assigned to this level OR attempted by students in this level)
      const relevantTests = testsInPeriod.filter((t) => {
        const tLevel = getTestLevel(t);
        if (tLevel === currentLevel) return true;
        for (const s of levelStudents) {
          if (s.attempts.some((a) => a.test.id === t.id)) return true;
        }
        return false;
      });

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
        if (!t.createdAt) continue;
        const dateObj = toZonedTime(t.createdAt, TIMEZONE);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const week = getWeekOfMonth(dateObj, { weekStartsOn: 1 });
        const weekKey = \\\`\\\${year}-\\\${month.toString().padStart(2, "0")}-W\\\${week.toString().padStart(2, "0")}\\\`;
        const displayWeek = \\\`Tuần \\\${week} (tháng \\\${month})\\\`;

        const dateStr = formatInTimeZone(t.createdAt, TIMEZONE, "yyyy-MM-dd");
        const dayNames = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        const displayDate = \\\`\\\${dayNames[dateObj.getDay()]} (\\\${formatInTimeZone(t.createdAt, TIMEZONE, "d/M")})\\\`;

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

      const levelName = currentLevel === "BASIC" ? "Lớp Cơ bản - 12A" : "Lớp Nâng cao - 12B";
      const sortedWeekKeys = Array.from(weekGroups.keys()).sort();

      if (debug) {
        console.log("[EXPORT_OFFLINE_DEBUG]", {
          currentLevel,
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

      sheet.mergeCells(currentRowIndex, 1, currentRowIndex, maxColMerge);
      const titleCell = sheet.getCell(currentRowIndex, 1);
      titleCell.value = \\\`Nhận xét hàng tuần (\\\${levelName})\\\`;
      titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };
      titleCell.border = headerStyle.border;
      currentRowIndex++;

      sheet.mergeCells(currentRowIndex, 1, currentRowIndex, maxColMerge);
      const subTitleCell = sheet.getCell(currentRowIndex, 1);
      subTitleCell.value = \\\`Từ \\\${format(startDate, "dd/MM/yyyy")} đến \\\${format(endDate, "dd/MM/yyyy")}\\\`;
      subTitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
      subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } };
      subTitleCell.border = headerStyle.border;
      currentRowIndex++;

      const headerRow1 = currentRowIndex;
      const headerRow2 = currentRowIndex + 1;
      const headerRow3 = currentRowIndex + 2;

      sheet.getColumn(1).width = 5;
      sheet.getColumn(2).width = 25;

      sheet.mergeCells(headerRow1, 1, headerRow3, 1);
      const sttCell = sheet.getCell(headerRow1, 1);
      sttCell.value = "STT";
      sttCell.style = headerStyle;
      sttCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } };

      sheet.mergeCells(headerRow1, 2, headerRow3, 2);
      const nameCell = sheet.getCell(headerRow1, 2);
      nameCell.value = "Tên học sinh";
      nameCell.style = headerStyle;
      nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } };

      let colIdx = 3;
      for (const weekKey of sortedWeekKeys) {
        const wGroup = weekGroups.get(weekKey)!;
        const sortedDateKeys = Array.from(wGroup.days.keys()).sort();
        const weekColSpan = wGroup.days.size * 3 + 1;

        sheet.mergeCells(headerRow1, colIdx, headerRow1, colIdx + weekColSpan - 1);
        const weekCell = sheet.getCell(headerRow1, colIdx);
        weekCell.value = wGroup.displayWeek;
        weekCell.style = headerStyle;
        weekCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } };

        let dayColIdx = colIdx;
        for (const dateKey of sortedDateKeys) {
          const dGroup = wGroup.days.get(dateKey)!;

          sheet.mergeCells(headerRow2, dayColIdx, headerRow2, dayColIdx + 2);
          const dayCell = sheet.getCell(headerRow2, dayColIdx);
          dayCell.value = dGroup.displayDate;
          dayCell.style = headerStyle;
          dayCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } };

          const subHeaders = ["Điểm", "BTVN", "Điểm kiểm"];
          for (let i = 0; i < 3; i++) {
            const subCell = sheet.getCell(headerRow3, dayColIdx + i);
            subCell.value = subHeaders[i];
            subCell.style = headerStyle;
            subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
            sheet.getColumn(dayColIdx + i).width = 12;
          }

          dayColIdx += 3;
        }

        sheet.mergeCells(headerRow2, dayColIdx, headerRow3, dayColIdx);
        const noteCell = sheet.getCell(headerRow2, dayColIdx);
        noteCell.value = "Nhận xét";
        noteCell.style = headerStyle;
        noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
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
`;

const startIndex = 5761;
const endIndex = 14726;

const finalContent = content.substring(0, startIndex) + newCode + content.substring(endIndex);
fs.writeFileSync(filePath, finalContent, 'utf-8');
console.log('File updated successfully.');
