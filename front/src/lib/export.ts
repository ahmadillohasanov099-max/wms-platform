import api from '../api/axios';

export async function downloadExport(url: string, filename: string, params?: any) {
  try {
    const blob = await api.get(url, {
      params,
      responseType: 'blob',
    }) as unknown as Blob;

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

export function exportToStyledExcel({
  filename,
  sheetName = 'Amallar Tarixi',
  headers,
  rows,
  centerColIndexes = [0, 1, 2, 4, 5, 7, 8],
}: {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
  centerColIndexes?: number[];
}) {
  const colWidthsMap = [45, 120, 160, 340, 160, 80, 220, 180, 130, 200];

  const colGroupHtml = colWidthsMap
    .map((w) => `<col style="width: ${w}px;" />`)
    .join('');

  const tableHeadersHtml = headers
    .map(
      (h, idx) =>
        `<th style="background-color: #D5D8DC; color: #000000; font-family: 'Times New Roman', Times, serif; font-weight: bold; font-size: 11pt; border: 0.3pt solid #000000; text-align: center; vertical-align: middle; padding: 8px 10px; width: ${colWidthsMap[idx] || 150}px;">${h}</th>`
    )
    .join('');

  const tableRowsHtml = rows
    .map((row) => {
      const cells = row
        .map((cellValue, colIdx) => {
          const isCenter = centerColIndexes.includes(colIdx);
          const alignStyle = isCenter ? 'text-align: center;' : 'text-align: left;';
          const isInventoryCol = colIdx === 4;
          const numFormatStyle = isInventoryCol ? "mso-number-format:'\\@';" : '';
          const fontStyle = "font-family: 'Times New Roman', Times, serif;";
          const val = cellValue != null ? String(cellValue) : '—';

          return `<td style="border: 0.3pt solid #000000; padding: 7px 10px; vertical-align: middle; font-size: 10.5pt; line-height: 1.4; white-space: normal; word-break: break-word; overflow-wrap: break-word; ${alignStyle} ${fontStyle} ${numFormatStyle}">${val}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${sheetName}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; table-layout: fixed; }
        th, td { border: 0.3pt solid #000000; font-family: 'Times New Roman', Times, serif; word-wrap: break-word; white-space: normal; word-break: break-word; }
      </style>
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; border: 0.3pt solid #000000; font-family: 'Times New Roman', Times, serif;">
        <colgroup>
          ${colGroupHtml}
        </colgroup>
        <thead>
          <tr style="height: 35px;">${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + htmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const cleanName = filename.replace(/\.(xls|xlsx|csv)$/i, '');
  const exportFilename = `${cleanName}.xls`;
  link.setAttribute('download', exportFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
