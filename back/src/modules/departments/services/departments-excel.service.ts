import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class DepartmentsExcelService {
  constructor(private prisma: PrismaService) {}

  async exportCsv(organizationId?: string) {
    const departments = await this.prisma.department.findMany({
      where: {
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        users: {
          where: { deletedAt: null, isActive: true },
        },
        departmentAssets: {
          where: { product: { deletedAt: null } },
        },
        assignments: {
          where: { returnedAt: null },
        },
      },
    });

    const headers = [
      'Bo‘lim nomi',
      'Tavsif',
      'Xodimlar soni',
      'Sarflanadigan materiallar miqdori',
      'Biriktirilgan jihozlar (Shared) soni',
    ];

    const csvRows = [headers.join(',')];

    for (const d of departments) {
      const sarflanadiganQty = d.departmentAssets.reduce((sum, da) => sum + da.quantity, 0);
      const row = [
        `"${d.name.replace(/"/g, '""')}"`,
        d.description ? `"${d.description.replace(/"/g, '""')}"` : '',
        d.users.length,
        sarflanadiganQty,
        d.assignments.length,
      ];
      csvRows.push(row.join(','));
    }

    return '\ufeff' + csvRows.join('\n');
  }
}
