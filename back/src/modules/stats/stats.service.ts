import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { StatsAnalyticsService } from './services/stats-analytics.service';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private analyticsService: StatsAnalyticsService,
  ) {}

  async getOverview(organizationId?: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const orgFilter = organizationId ? { organizationId } : {};

    const [
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      activeAssignments,
      inventoryStats,
      productTypeCounts,
      thisMonthOpsCount,
      lastMonthOpsCount,
      thisMonthProductsCount,
      lastMonthProductsCount,
      thisMonthAssignmentsCount,
      lastMonthAssignmentsCount,
      assignedAssetsSum,
      writeOffStats,
    ] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true, role: 'XODIM', ...orgFilter } }),
      this.prisma.department.count({ where: { deletedAt: null, ...orgFilter } }),
      this.prisma.operation.count({ where: { ...orgFilter } }),
      this.prisma.assignment.count({
        where: {
          returnedAt: null,
          ...(organizationId ? { asset: { organizationId } } : {}),
        },
      }),
      this.prisma.$queryRaw<Array<{ total_value: number; low_stock_count: bigint }>>`
        SELECT
          COALESCE(SUM(i.quantity * COALESCE(i."unitPrice", 0)), 0)::float AS total_value,
          COUNT(*) FILTER (WHERE i.quantity <= i."minLevel")::bigint AS low_stock_count
        FROM "Inventory" i
        JOIN "Product" p ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL
          AND (${organizationId ?? null}::text IS NULL OR p."organizationId" = ${organizationId})
      `,
      this.prisma.product.groupBy({
        by: ['productType'],
        where: { deletedAt: null, ...orgFilter },
        _count: { id: true },
      }),
      this.prisma.operation.count({ where: { createdAt: { gte: thisMonthStart }, ...orgFilter } }),
      this.prisma.operation.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, ...orgFilter } }),
      this.prisma.product.count({ where: { createdAt: { gte: thisMonthStart }, deletedAt: null, ...orgFilter } }),
      this.prisma.product.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, deletedAt: null, ...orgFilter } }),
      this.prisma.assignment.count({
        where: {
          assignedAt: { gte: thisMonthStart },
          returnedAt: null,
          ...(organizationId ? { asset: { organizationId } } : {}),
        },
      }),
      this.prisma.assignment.count({
        where: {
          assignedAt: { gte: lastMonthStart, lte: lastMonthEnd },
          returnedAt: null,
          ...(organizationId ? { asset: { organizationId } } : {}),
        },
      }),
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM(a."purchasePrice"), 0)::float AS total
        FROM "Assignment" asgn
        JOIN "Asset" a ON asgn."assetId" = a.id
        WHERE asgn."returnedAt" IS NULL
          AND a."deletedAt" IS NULL
          AND (${organizationId ?? null}::text IS NULL OR a."organizationId" = ${organizationId})
      `,
      this.prisma.$queryRaw<Array<{ total_loss: number; count: bigint }>>`
        SELECT
          COUNT(*)::bigint AS count,
          COALESCE(SUM(o.quantity * COALESCE(a."purchasePrice", i."unitPrice", 0)), 0)::float AS total_loss
        FROM "Operation" o
        LEFT JOIN "Asset" a ON o."assetId" = a.id
        LEFT JOIN "Inventory" i ON o."productId" = i."productId"
        WHERE o.type::text = 'WRITE_OFF'
          AND (${organizationId ?? null}::text IS NULL OR o."organizationId" = ${organizationId})
      `,
    ]);

    const getPercentageChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const productsTrend = getPercentageChange(thisMonthProductsCount, lastMonthProductsCount);
    const operationsTrend = getPercentageChange(thisMonthOpsCount, lastMonthOpsCount);
    const assignmentsTrend = getPercentageChange(thisMonthAssignmentsCount, lastMonthAssignmentsCount);

    const lowStockCount = Number(inventoryStats[0]?.low_stock_count ?? 0);
    const totalInventoryValue = Number(inventoryStats[0]?.total_value ?? 0);

    const totalAssignedValue = Number(assignedAssetsSum[0]?.total ?? 0);
    const totalWriteOffCount = Number(writeOffStats[0]?.count ?? 0);
    const totalWriteOffLoss = Number(writeOffStats[0]?.total_loss ?? 0);

    const assetProductsCount = productTypeCounts.find((p) => p.productType === 'BERILADIGAN')?._count.id ?? 0;
    const consumableProductsCount = productTypeCounts.find((p) => p.productType === 'SARFLANADIGAN')?._count.id ?? 0;

    return {
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      lowStockCount,
      activeAssignments,
      activeAssets: activeAssignments,
      totalInventoryValue,
      totalAssignedValue,
      totalWriteOffCount,
      totalWriteOffLoss,
      productTypeDistribution: {
        assetCount: assetProductsCount,
        consumableCount: consumableProductsCount,
      },
      trends: {
        products: productsTrend,
        operations: operationsTrend,
        assignments: assignmentsTrend,
      },
    };
  }

  async getByDepartment(organizationId?: string) {
    const orgFilter = organizationId ? { organizationId } : {};

    const [departments, deptAssetSums] = await Promise.all([
      this.prisma.department.findMany({
        where: { deletedAt: null, ...orgFilter },
        select: {
          id: true,
          name: true,
          _count: { select: { users: { where: { deletedAt: null, isActive: true, role: 'XODIM' } } } },
          departmentAssets: {
            select: {
              quantity: true,
              product: { select: { name: true, productType: true } },
            },
          },
        },
      }),
      this.prisma.$queryRaw<Array<{ department_id: string; total_value: number }>>`
        SELECT
          COALESCE(asgn."departmentId", u."departmentId") AS department_id,
          COALESCE(SUM(a."purchasePrice"), 0)::float AS total_value
        FROM "Assignment" asgn
        LEFT JOIN "User" u ON asgn."userId" = u.id
        JOIN "Asset" a ON asgn."assetId" = a.id
        WHERE asgn."returnedAt" IS NULL
          AND a."deletedAt" IS NULL
          AND (${organizationId ?? null}::text IS NULL OR a."organizationId" = ${organizationId})
        GROUP BY COALESCE(asgn."departmentId", u."departmentId")
      `,
    ]);

    const valueMap = new Map<string, number>();
    for (const row of deptAssetSums) {
      if (row.department_id) {
        valueMap.set(row.department_id, Number(row.total_value));
      }
    }

    return departments.map((dept) => {
      let assetCount = 0;
      let consumableCount = 0;
      for (const da of dept.departmentAssets) {
        if (da.product?.productType === 'BERILADIGAN') {
          assetCount += Number(da.quantity ?? 0);
        } else if (da.product?.productType === 'SARFLANADIGAN') {
          consumableCount += Number(da.quantity ?? 0);
        }
      }

      return {
        id: dept.id,
        name: dept.name,
        userCount: dept._count.users,
        totalAssetValue: valueMap.get(dept.id) || 0,
        assetCount,
        consumableCount,
        sharedCount: 0,
        assets: dept.departmentAssets.map((da) => ({
          productName: da.product?.name || 'Jihoz',
          productType: da.product?.productType || 'BERILADIGAN',
          quantity: da.quantity,
        })),
      };
    });
  }

  async getByProduct(organizationId?: string) {
    const orgFilter = organizationId ? { organizationId } : {};

    const [operations, products] = await Promise.all([
      this.prisma.operation.groupBy({
        by: ['productId', 'type'],
        where: { ...orgFilter },
        _sum: { quantity: true },
      }),
      this.prisma.product.findMany({
        where: { deletedAt: null, ...orgFilter },
        select: {
          id: true,
          name: true,
          productType: true,
          inventory: { select: { quantity: true, minLevel: true } },
        },
      }),
    ]);

    const opsMap = new Map<string, number>();
    operations.forEach((op) => {
      if (['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT'].includes(op.type)) {
        const current = opsMap.get(op.productId) || 0;
        opsMap.set(op.productId, current + (op._sum.quantity ?? 0));
      }
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      productType: product.productType,
      currentStock: product.inventory?.quantity ?? 0,
      minLevel: product.inventory?.minLevel ?? 0,
      totalOut: opsMap.get(product.id) || 0,
    }));
  }

  async getLowStock(organizationId?: string) {
    const orgFilter = organizationId ? { organizationId } : {};

    const items = await this.prisma.inventory.findMany({
      where: {
        product: { deletedAt: null, ...orgFilter },
      },
      select: {
        productId: true,
        quantity: true,
        minLevel: true,
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
          },
        },
      },
    });

    return items
      .filter((item) => item.quantity < item.minLevel)
      .map((item) => ({
        productId: item.productId,
        name: item.product.name,
        productType: item.product.productType,
        unit: item.product.unit,
        quantity: item.quantity,
        minLevel: item.minLevel,
        shortage: item.minLevel - item.quantity,
      }));
  }

  async getMonthly(organizationId?: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const result = await this.prisma.$queryRaw<
      Array<{ month: string; stock_in: bigint; stock_out: bigint }>
    >`
      SELECT
        to_char(o."createdAt", 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN o.type::text = 'STOCK_IN' THEN o.quantity ELSE 0 END), 0)::bigint AS stock_in,
        COALESCE(SUM(CASE WHEN o.type::text != 'STOCK_IN' THEN o.quantity ELSE 0 END), 0)::bigint AS stock_out
      FROM "Operation" o
      WHERE o."createdAt" >= ${sixMonthsAgo}
        AND (${organizationId ?? null}::text IS NULL OR o."organizationId" = ${organizationId})
      GROUP BY to_char(o."createdAt", 'YYYY-MM')
      ORDER BY month ASC
    `;

    return result.map((r) => ({
      month: r.month,
      stockIn: Number(r.stock_in),
      stockOut: Number(r.stock_out),
    }));
  }

  async getComparison(organizationId?: string) {
    return this.analyticsService.getComparison(organizationId);
  }

  async getByUser(organizationId?: string) {
    const orgFilter = organizationId ? { organizationId } : {};

    const [users, userAssetStats] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null, isActive: true, role: 'XODIM', ...orgFilter },
        select: {
          id: true,
          fullName: true,
          username: true,
          position: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.$queryRaw<Array<{ user_id: string; asset_count: bigint; total_value: number }>>`
        SELECT
          asgn."userId" AS user_id,
          COUNT(asgn.id)::bigint AS asset_count,
          COALESCE(SUM(a."purchasePrice"), 0)::float AS total_value
        FROM "Assignment" asgn
        JOIN "Asset" a ON asgn."assetId" = a.id
        WHERE asgn."returnedAt" IS NULL
          AND asgn."userId" IS NOT NULL
          AND a."deletedAt" IS NULL
          AND (${organizationId ?? null}::text IS NULL OR a."organizationId" = ${organizationId})
        GROUP BY asgn."userId"
      `,
    ]);

    const statsMap = new Map<string, { count: number; value: number }>();
    for (const row of userAssetStats) {
      if (row.user_id) {
        statsMap.set(row.user_id, {
          count: Number(row.asset_count),
          value: Number(row.total_value),
        });
      }
    }

    return users.map((user) => {
      const stats = statsMap.get(user.id);
      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        position: user.position,
        department: user.department,
        assetCount: stats?.count ?? 0,
        totalValue: stats?.value ?? 0,
        assets: [],
      };
    });
  }

  async getConsolidatedStats() {
    return this.analyticsService.getConsolidatedStats();
  }
}

