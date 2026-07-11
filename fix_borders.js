const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'eclass', 'app', 'api', 'admin', 'export-offline', 'route.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const helperFunction = `    const levelsToRender = level === "ALL" ? ["BASIC", "ADVANCED"] : [level];

    // Helper to style merged cells
    const styleMergedCell = (sheet, r1, c1, r2, c2, styleObj, fillObj) => {
      sheet.mergeCells(r1, c1, r2, c2);
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = sheet.getCell(r, c);
          if (styleObj && styleObj.border) cell.border = styleObj.border;
          if (fillObj) cell.fill = fillObj;
        }
      }
      return sheet.getCell(r1, c1);
    };`;

content = content.replace(`    const levelsToRender = level === "ALL" ? ["BASIC", "ADVANCED"] : [level];`, helperFunction);

const titleReplace = `      let dateColumnsCount = 0;
      for (const weekKey of sortedWeekKeys) {
        const wGroup = weekGroups.get(weekKey)!;
        dateColumnsCount += wGroup.days.size * 3 + 1;
      }
      const totalColumns = 2 + dateColumnsCount;
      const maxColMerge = Math.max(totalColumns, 4);

      const titleCell = styleMergedCell(sheet, currentRowIndex, 1, currentRowIndex, maxColMerge, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } });
      titleCell.value = \`Nhận xét hàng tuần (\${levelName})\`;
      titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      currentRowIndex++;

      const subTitleCell = styleMergedCell(sheet, currentRowIndex, 1, currentRowIndex, maxColMerge, headerStyle, { type: "pattern", pattern: "solid", fgColor: { argb: "FF9BC2E6" } });
      subTitleCell.value = \`Từ \${format(startDate, "dd/MM/yyyy")} đến \${format(endDate, "dd/MM/yyyy")}\`;
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

          const subHeaders = ["Điểm", "BTVN", "Điểm kiểm"];
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
      }`;

const sIdx = content.indexOf(`      let dateColumnsCount = 0;`);
const eIdx = content.indexOf(`      currentRowIndex += 3;`);

if (sIdx !== -1 && eIdx !== -1) {
  content = content.substring(0, sIdx) + titleReplace + "\n\n" + content.substring(eIdx);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Borders fixed.');
} else {
  console.log('Markers not found');
}
