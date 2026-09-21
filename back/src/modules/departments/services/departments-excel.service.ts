import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import * as ExcelJS from 'exceljs';

@Injectable()
export class DepartmentsExcelService {
  constructor(private prisma: PrismaService) {}

  async exportExcel(organizationId?: string): Promise<{ buffer: Buffer; organizationName: string }> {
    let orgName = 'Barcha Boshqarmalar';
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      orgName = org?.name || 'Boshqarma';
    }

    const orgFilter = organizationId ? { organizationId } : {};

    const departments = await this.prisma.department.findMany({
      where: {
        deletedAt: null,
        ...orgFilter,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        organization: { select: { name: true } },
        _count: {
          select: {
            users: { where: { deletedAt: null, isActive: true } },
            assignments: { where: { returnedAt: null } },
          },
        },
        departmentAssets: {
          where: { product: { deletedAt: null } },
          select: { quantity: true },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ombor Boshqaruv Tizimi';
    const worksheet = workbook.addWorksheet('Bo‘limlar');
    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Tashkilot / Boshqarma', key: 'organization', width: 34 },
      { header: 'Bo‘lim nomi', key: 'name', width: 36 },
      { header: 'Tavsif', key: 'description', width: 32 },
      { header: 'Xodimlar soni', key: 'usersCount', width: 18 },
      { header: 'Sarflanadigan materiallar miqdori', key: 'consumablesQty', width: 32 },
      { header: 'Biriktirilgan jihozlar (Shared) soni', key: 'sharedAssetsQty', width: 34 },
    ];

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
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
    const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const alignLeft: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
    const zebraFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = headerAlign;
      cell.border = headerBorder;
    });

    let rowIdx = 1;
    for (const d of departments) {
      const currentOrgName = d.organization?.name || orgName;
      const sarflanadiganQty = d.departmentAssets.reduce((sum, da) => sum + da.quantity, 0);
      const isZebra = rowIdx % 2 === 0;

      const row = worksheet.addRow([
        rowIdx++,
        currentOrgName,
        d.name,
        d.description || '—',
        d._count.users,
        sarflanadiganQty,
        d._count.assignments,
      ]);
      row.height = 22;

      row.eachCell((cell, colNumber) => {
        const isCenter = colNumber === 1 || colNumber >= 5;
        cell.font = cellFont;
        cell.alignment = isCenter ? alignCenter : alignLeft;
        cell.border = cellBorder;
        if (isZebra) {
          cell.fill = zebraFill;
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      organizationName: orgName,
    };
  }

  async exportCsv(organizationId: string): Promise<{ csvContent: string; organizationName: string }> {
    const { buffer, organizationName } = await this.exportExcel(organizationId);
    return {
      csvContent: buffer.toString('utf-8'),
      organizationName,
    };
  }
}
