import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class StatsAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getComparison(organizationId?: string) {
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const getMonthMetricsRaw = async (startDate: Date, endDate: Date) => {
      const result = await this.prisma.$queryRaw<
        Array<{
          total_ops: bigint;
          stock_in_qty: bigint;
          stock_in_value: number;
          stock_out_qty: bigint;
          stock_out_value: number;
          write_off_qty: bigint;
          write_off_value: number;
        }>
      >`
        SELECT
          COUNT(*)::bigint AS total_ops,
          COALESCE(SUM(CASE WHEN o.type::text = 'STOCK_IN' THEN o.quantity ELSE 0 END), 0)::bigint AS stock_in_qty,
          COALESCE(SUM(CASE WHEN o.type::text = 'STOCK_IN' THEN o.quantity * COALESCE(a."purchasePrice", i."unitPrice", 0) ELSE 0 END), 0)::float AS stock_in_value,
          COALESCE(SUM(CASE WHEN o.type::text IN ('GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT') THEN o.quantity ELSE 0 END), 0)::bigint AS stock_out_qty,
          COALESCE(SUM(CASE WHEN o.type::text IN ('GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT') THEN o.quantity * COALESCE(a."purchasePrice", i."unitPrice", 0) ELSE 0 END), 0)::float AS stock_out_value,
          COALESCE(SUM(CASE WHEN o.type::text = 'WRITE_OFF' THEN o.quantity ELSE 0 END), 0)::bigint AS write_off_qty,
          COALESCE(SUM(CASE WHEN o.type::text = 'WRITE_OFF' THEN o.quantity * COALESCE(a."purchasePrice", i."unitPrice", 0) ELSE 0 END), 0)::float AS write_off_value
        FROM "Operation" o
        LEFT JOIN "Asset" a ON o."assetId" = a.id
        LEFT JOIN "Inventory" i ON o."productId" = i."productId"
        WHERE o."createdAt" >= ${startDate} AND o."createdAt" <= ${endDate}
          AND (${organizationId ?? null}::text IS NULL OR o."organizationId" = ${organizationId})
      `;

      const row = result[0] || {
        total_ops: 0n,
        stock_in_qty: 0n,
        stock_in_value: 0,
        stock_out_qty: 0n,
        stock_out_value: 0,
        write_off_qty: 0n,
        write_off_value: 0,
      };

      return {
        totalOperations: Number(row.total_ops),
        stockInQty: Number(row.stock_in_qty),
        stockInValue: Number(row.stock_in_value),
        stockOutQty: Number(row.stock_out_qty),
        stockOutValue: Number(row.stock_out_value),
        writeOffQty: Number(row.write_off_qty),
        writeOffValue: Number(row.write_off_value),
      };
    };

    const [thisMonth, lastMonth] = await Promise.all([
      getMonthMetricsRaw(thisMonthStart, thisMonthEnd),
      getMonthMetricsRaw(lastMonthStart, lastMonthEnd),
    ]);

    const getPercentageChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      thisMonthName: thisMonthStart.toLocaleString('uz-UZ', { month: 'long' }),
      lastMonthName: lastMonthStart.toLocaleString('uz-UZ', { month: 'long' }),
      comparison: {
        totalOperations: {
          thisMonth: thisMonth.totalOperations,
          lastMonth: lastMonth.totalOperations,
          changePercent: getPercentageChange(
            thisMonth.totalOperations,
            lastMonth.totalOperations,
          ),
        },
        stockInValue: {
          thisMonth: thisMonth.stockInValue,
          lastMonth: lastMonth.stockInValue,
          changePercent: getPercentageChange(
            thisMonth.stockInValue,
            lastMonth.stockInValue,
          ),
        },
        stockOutValue: {
          thisMonth: thisMonth.stockOutValue,
          lastMonth: lastMonth.stockOutValue,
          changePercent: getPercentageChange(
            thisMonth.stockOutValue,
            lastMonth.stockOutValue,
          ),
        },
        writeOffValue: {
          thisMonth: thisMonth.writeOffValue,
          lastMonth: lastMonth.writeOffValue,
          changePercent: getPercentageChange(
            thisMonth.writeOffValue,
            lastMonth.writeOffValue,
          ),
        },
      },
    };
  }

  async getConsolidatedStats() {
    const organizations = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        address: true,
        phone: true,
        _count: {
          select: {
            users: { where: { deletedAt: null, isActive: true } },
            departments: { where: { deletedAt: null } },
            products: { where: { deletedAt: null } },
            assets: { where: { deletedAt: null, status: 'ACTIVE' } },
            operations: true,
          },
        },
        products: {
          where: { deletedAt: null },
          select: {
            inventory: { select: { quantity: true, unitPrice: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return organizations.map((org) => {
      const totalInventoryValue = org.products.reduce((sum, p) => {
        const qty = p.inventory?.quantity || 0;
        const price = Number(p.inventory?.unitPrice || 0);
        return sum + qty * price;
      }, 0);

      const totalStockCount = org.products.reduce((sum, p) => {
        return sum + (p.inventory?.quantity || 0);
      }, 0);

      return {
        id: org.id,
        name: org.name,
        code: org.code,
        type: org.type,
        address: org.address,
        phone: org.phone,
        userCount: org._count.users,
        departmentCount: org._count.departments,
        productTypesCount: org._count.products,
        activeAssetsCount: org._count.assets,
        operationsCount: org._count.operations,
        totalStockCount,
        totalInventoryValue,
      };
    });
  }
}
