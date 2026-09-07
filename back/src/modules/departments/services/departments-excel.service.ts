import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class DepartmentsExcelService {
  constructor(private prisma: PrismaService) {}

  async exportCsv(organizationId: string): Promise<{ csvContent: string; organizationName: string }> {
    if (!organizationId) {
      throw new BadRequestException("Tashkilot tanlanishi shart! Eksport faqat aniq bitta tashkilot/boshqarma bo'yicha amalga oshiriladi.");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const organizationName = org?.name || 'Boshqarma';

    const departments = await this.prisma.department.findMany({
      where: {
        deletedAt: null,
        organizationId,
      },
      orderBy: { name: 'asc' },
      include: {
        organization: { select: { name: true } },
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
      'Tashkilot / Boshqarma',
      'Bo‘lim nomi',
      'Tavsif',
      'Xodimlar soni',
      'Sarflanadigan materiallar miqdori',
      'Biriktirilgan jihozlar (Shared) soni',
    ];

    const csvRows = [headers.join(',')];

    for (const d of departments) {
      const currentOrgName = d.organization?.name || organizationName;
      const sarflanadiganQty = d.departmentAssets.reduce((sum, da) => sum + da.quantity, 0);
      const row = [
        `"${currentOrgName.replace(/"/g, '""')}"`,
        `"${d.name.replace(/"/g, '""')}"`,
        d.description ? `"${d.description.replace(/"/g, '""')}"` : '',
        d.users.length,
        sarflanadiganQty,
        d.assignments.length,
      ];
      csvRows.push(row.join(','));
    }

    return {
      csvContent: '\ufeff' + csvRows.join('\n'),
      organizationName,
    };
  }
}
