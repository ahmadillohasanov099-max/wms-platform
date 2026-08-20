import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { HistoryQueryDto } from './dto/history-query.dto';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: HistoryQueryDto,
    currentUserId: string,
    currentUserRole: string,
    currentUserOrgId?: string,
  ) {
    const {
      page = 1,
      limit = 20,
      operationType,
      userId,
      departmentId,
      productId,
      assetId,
      inventoryNumber,
      organizationId,
      from,
      to,
    } = query;
    const skip = (page - 1) * limit;

    const targetUserId = currentUserRole === 'XODIM' ? currentUserId : userId;
    const resolvedOrgId = enforceTenantOrgId(
      { id: currentUserId, role: currentUserRole, organizationId: currentUserOrgId },
      organizationId,
    );
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const where: any = {
      ...orgFilter,
      ...(operationType && { type: operationType }),
      ...(departmentId && { departmentId }),
      ...(productId && { productId }),
      ...(assetId && { assetId }),
      ...(inventoryNumber && { asset: { inventoryNumber } }),
      ...(targetUserId && {
        OR: [
          { userId: targetUserId },
          { fromUserId: targetUserId },
          { performedById: targetUserId },
        ],
      }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.operation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, productType: true } },
          asset: { select: { id: true, inventoryNumber: true } },
          user: { select: { id: true, fullName: true, username: true } },
          fromUser: { select: { id: true, fullName: true, username: true } },
          department: { select: { id: true, name: true } },
          performedBy: { select: { id: true, fullName: true, username: true } },
        },
      }),
      this.prisma.operation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportCsv(
    query: HistoryQueryDto,
    currentUserId: string,
    currentUserRole: string,
    currentUserOrgId?: string,
  ): Promise<string> {
    const {
      operationType,
      userId,
      departmentId,
      productId,
      assetId,
      inventoryNumber,
      organizationId,
      from,
      to,
    } = query;

    const targetUserId = currentUserRole === 'XODIM' ? currentUserId : userId;
    const resolvedOrgId = enforceTenantOrgId(
      { id: currentUserId, role: currentUserRole, organizationId: currentUserOrgId },
      organizationId,
    );
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const where: any = {
      ...orgFilter,
      ...(operationType && { type: operationType }),
      ...(departmentId && { departmentId }),
      ...(productId && { productId }),
      ...(assetId && { assetId }),
      ...(inventoryNumber && { asset: { inventoryNumber } }),
      ...(targetUserId && {
        OR: [
          { userId: targetUserId },
          { fromUserId: targetUserId },
          { performedById: targetUserId },
        ],
      }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const items = await this.prisma.operation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {

        product: { select: { name: true } },
        asset: { select: { inventoryNumber: true } },
        user: { select: { fullName: true } },
        fromUser: { select: { fullName: true } },
        department: { select: { name: true } },
        performedBy: { select: { fullName: true } },
      },
    });

    const headers = [
      'Sana',
      'Operatsiya turi',
      'Mahsulot nomi',
      'Inventar raqami',
      'Miqdor',
      'Kimdan (Topshiruvchi)',
      'Kimga (Qabul qiluvchi)',
      'Bo‘lim',
      'Ijrochi (Mas‘ul)',
    ];

    const csvRows = [headers.join(',')];

    for (const item of items) {
      const row = [
        item.createdAt.toISOString(),
        item.type,
        item.product?.name ? `"${item.product.name.replace(/"/g, '""')}"` : '',
        item.asset?.inventoryNumber
          ? `"${item.asset.inventoryNumber.replace(/"/g, '""')}"`
          : '',
        item.quantity,
        item.fromUser?.fullName
          ? `"${item.fromUser.fullName.replace(/"/g, '""')}"`
          : '',
        item.user?.fullName
          ? `"${item.user.fullName.replace(/"/g, '""')}"`
          : '',
        item.department?.name
          ? `"${item.department.name.replace(/"/g, '""')}"`
          : '',
        item.performedBy?.fullName
          ? `"${item.performedBy.fullName.replace(/"/g, '""')}"`
          : '',
      ];
      csvRows.push(row.join(','));
    }

    return '\ufeff' + csvRows.join('\n');
  }
}
