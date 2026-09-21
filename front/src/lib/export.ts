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

export async function exportToStyledExcel({
  filename,
  sheetName = 'Hisobot',
  headers,
  rows,
  colWidths,
  centerColIndexes = [0, 1, 2, 4, 5, 7, 8],
}: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
  centerColIndexes?: number[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ombor Boshqaruv Tizimi';

  // Sanitize sheet name (Excel limits to 31 chars and disallows \ / ? * : [ ])
  const safeSheetName = (sheetName || 'Hisobot')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);

  const worksheet = workbook.addWorksheet(safeSheetName);
  worksheet.views = [{ showGridLines: true }];

  // Fast column widths setup (sample at most 50 rows to avoid freezing the UI thread)
  if (colWidths && colWidths.length > 0) {
    worksheet.columns = headers.map((header, idx) => ({
      header,
      key: `col_${idx}`,
      width: Math.max(colWidths[idx] || 15, 10),
    }));
  } else {
    const sampleCount = Math.min(rows.length, 50);
    worksheet.columns = headers.map((header, colIdx) => {
      let maxLen = String(header || '').length;
      for (let r = 0; r < sampleCount; r++) {
        const val = rows[r]?.[colIdx];
        if (val != null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return {
        header,
        key: `col_${colIdx}`,
        width: Math.min(Math.max(maxLen + 4, 12), 45),
      };
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

  const cellFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 10 };
  const cellBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    left: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    right: { style: 'thin', color: { argb: 'FFE8E8E8' } },
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

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = headerAlignment;
    cell.border = headerBorder;
  });

  const centerSet = new Set(centerColIndexes || []);

  // Add Data Rows with high-speed styling
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = worksheet.addRow(rows[rIdx]);
    row.height = 22;
    const isZebra = rIdx % 2 === 1;

    row.eachCell((cell, colNumber) => {
      const isCenter = centerSet.has(colNumber - 1);
      cell.font = cellFont;
      cell.alignment = isCenter ? alignCenter : alignLeft;
      cell.border = cellBorder;
      if (isZebra) {
        cell.fill = zebraFill;
      }
    });
  }

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
