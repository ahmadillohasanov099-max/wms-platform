import api from '../api/axios';
import ExcelJS from 'exceljs';

export async function downloadExport(url: string, filename: string, params?: any) {
  try {
    const blob = (await api.get(url, {
      params,
      responseType: 'blob',
    })) as unknown as Blob;

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error: any) {
    console.error('Eksport yuklab olishda xatolik:', error);
    throw error;
  }
}

export interface StyledExcelOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
  centerColIndexes?: number[];
  minRowHeight?: number;
  titleBlock?: {
    organizationName?: string;
    title: string;
    metaText?: string;
    dateText?: string;
    responsibleText?: string;
    statsText?: string;
  };
  statusColIndex?: number;
  signatures?: {
    creatorName?: string;
    approverTitle?: string;
    dateStr?: string;
  };
}

export async function exportToStyledExcel({
  filename,
  sheetName = 'Hisobot',
  headers,
  rows,
  colWidths,
  centerColIndexes = [0, 1, 2, 4, 5, 7, 8],
  minRowHeight = 28,
  titleBlock,
  statusColIndex,
  signatures,
}: StyledExcelOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ombor Boshqaruv Tizimi';

  // Sanitize sheet name (Excel limits to 31 chars and disallows \ / ? * : [ ])
  const safeSheetName = (sheetName || 'Hisobot')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);

  const worksheet = workbook.addWorksheet(safeSheetName);
  worksheet.views = [{ showGridLines: true }];

  // Setup Column Widths
  const effectiveColWidths: number[] = [];
  if (colWidths && colWidths.length > 0) {
    colWidths.forEach((width, idx) => {
      const w = Math.max(width, 7);
      effectiveColWidths[idx] = w;
      worksheet.getColumn(idx + 1).width = w;
    });
  } else {
    const sampleCount = Math.min(rows.length, 50);
    headers.forEach((header, colIdx) => {
      let maxLen = String(header || '').length;
      for (let r = 0; r < sampleCount; r++) {
        const val = rows[r]?.[colIdx];
        if (val != null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      const w = Math.min(Math.max(maxLen + 4, 12), 52);
      effectiveColWidths[colIdx] = w;
      worksheet.getColumn(colIdx + 1).width = w;
    });
  }

  // Pre-allocated static styles to eliminate GC pressure
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const headerAlignment: Partial<ExcelJS.Alignment> = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'medium', color: { argb: 'FF16365C' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  };

  const cellFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10.5 };
  const cellBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const alignCenter: Partial<ExcelJS.Alignment> = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  const alignLeft: Partial<ExcelJS.Alignment> = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
  };
  const zebraFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' },
  };

  let currentRowIdx = 1;

  // Add Executive Title Block if provided
  if (titleBlock) {
    const totalCols = headers.length;

    // Helper for cleanly merged, centered header rows
    const addMergedHeaderRow = (
      text: string,
      height: number,
      font: Partial<ExcelJS.Font>,
    ) => {
      worksheet.mergeCells(currentRowIdx, 1, currentRowIdx, totalCols);
      const row = worksheet.getRow(currentRowIdx);
      row.height = height;
      const cell = worksheet.getCell(currentRowIdx, 1);
      cell.value = text;
      cell.font = font;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      currentRowIdx++;
    };

    // Row 1: Organization Name (Centered, Navy, Bold)
    if (titleBlock.organizationName) {
      addMergedHeaderRow(
        titleBlock.organizationName.toUpperCase(),
        28,
        { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FF1E3A8A' } }
      );
    }

    // Row 2: Document Title (Centered, Bold, Dark Slate)
    addMergedHeaderRow(
      titleBlock.title,
      32,
      { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }
    );

    // Row 3: Meta details: Date & Responsible Person (Centered, Slate)
    const metaParts = [titleBlock.dateText, titleBlock.responsibleText].filter(Boolean);
    const metaLine = metaParts.length > 0 ? metaParts.join('      |      ') : titleBlock.metaText;
    if (metaLine) {
      addMergedHeaderRow(
        metaLine,
        22,
        { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } }
      );
    }

    // Row 4: Statistics Summary (Centered, Bold, Clean)
    if (titleBlock.statsText) {
      addMergedHeaderRow(
        titleBlock.statsText,
        24,
        { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E293B' } }
      );
    }

    // Spacer row
    const spacerRow = worksheet.getRow(currentRowIdx);
    spacerRow.height = 12;
    currentRowIdx++;
  }

  // Header Row
  const headerRowIndex = currentRowIdx;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 32;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = headerAlignment;
    cell.border = headerBorder;
  });
  currentRowIdx++;

  const centerSet = new Set(centerColIndexes || []);

  // Add Data Rows with spacious padding and status styling
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowValues = rows[rIdx];
    const row = worksheet.getRow(currentRowIdx);

    // Calculate exact dynamic line count and row height
    let maxCellLines = 1;
    rowValues.forEach((val, cIdx) => {
      if (val != null) {
        const text = String(val).trim();
        if (!text) return;
        const colW = effectiveColWidths[cIdx] || 20;
        const usableWidth = Math.max(colW - 3, 8);
        const lines = text.split(/\r\n|\r|\n/);
        let cellLines = 0;
        for (const line of lines) {
          cellLines += Math.max(1, Math.ceil(line.length / usableWidth));
        }
        maxCellLines = Math.max(maxCellLines, cellLines);
      }
    });

    const calculatedHeight = Math.max(minRowHeight, maxCellLines * 16 + 12);
    row.height = Math.min(calculatedHeight, 95);

    const isZebra = rIdx % 2 === 1;

    rowValues.forEach((val, cIdx) => {
      const colNumber = cIdx + 1;
      const cell = row.getCell(colNumber);
      cell.value = val;
      const isCenter = centerSet.has(cIdx);
      cell.font = cellFont;
      cell.alignment = isCenter ? alignCenter : alignLeft;
      cell.border = cellBorder;
      if (isZebra) {
        cell.fill = zebraFill;
      }

      // Status badge styling
      if (statusColIndex != null && cIdx === statusColIndex) {
        const strVal = String(val || '').trim();
        if (strVal.includes('Tasdiq') || strVal === 'APPROVED') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        } else if (strVal.includes('Rad') || strVal === 'REJECTED') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (strVal.includes('Kutil') || strVal === 'PENDING') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB45309' } };
        }
      }
    });

    currentRowIdx++;
  }

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: currentRowIdx - 1, column: headers.length },
  };

  // Signatures Section at Bottom
  if (signatures) {
    currentRowIdx++; // blank spacer
    const spacerRow = worksheet.getRow(currentRowIdx);
    spacerRow.height = 16;
    currentRowIdx++;

    const sigRowIndex = currentRowIdx;
    const sigRow = worksheet.getRow(sigRowIndex);
    sigRow.height = 30;

    const totalCols = headers.length;
    // Left signature: merge columns 2 to 5 to prevent text from overflowing or colliding
    const leftEndCol = Math.min(5, Math.floor(totalCols / 2));
    worksheet.mergeCells(sigRowIndex, 2, sigRowIndex, leftEndCol);
    const leftCell = sigRow.getCell(2);
    leftCell.value = `Hisobotni shakllantirdi: ${signatures.creatorName || ''} ____________________`;
    leftCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF334155' } };
    leftCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Right signature: merge columns 7 to totalCols
    const rightStartCol = Math.max(leftEndCol + 2, totalCols - 4);
    worksheet.mergeCells(sigRowIndex, rightStartCol, sigRowIndex, totalCols);
    const rightCell = sigRow.getCell(rightStartCol);
    rightCell.value = `Tasdiqladi (${signatures.approverTitle || "Mas'ul rahbar"}): ____________________ (M.O'.)`;
    rightCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF334155' } };
    rightCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    if (signatures.dateStr) {
      currentRowIdx++;
      const dateRowIndex = currentRowIdx;
      const dateRow = worksheet.getRow(dateRowIndex);
      dateRow.height = 24;

      worksheet.mergeCells(dateRowIndex, rightStartCol, dateRowIndex, totalCols);
      const dateCell = dateRow.getCell(rightStartCol);
      dateCell.value = `Sana: ${signatures.dateStr} yil`;
      dateCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
  }

  // Page setup for printing & PDF export from Excel
  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const cleanName = filename.replace(/\.(xls|xlsx|csv)$/i, '');
  const exportFilename = `${cleanName}.xlsx`;

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', exportFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
