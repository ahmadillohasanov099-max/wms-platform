import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

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
      inventories,
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
      this.prisma.inventory.findMany({
        where: { product: { deletedAt: null, ...orgFilter } },
        select: { quantity: true, minLevel: true, unitPrice: true },
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

    const lowStockCount = inventories.filter(
      (i) => i.quantity <= i.minLevel,
    ).length;

    const totalInventoryValue = inventories.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.unitPrice ?? 0),
      0,
    );

    const totalAssignedValue = Number(assignedAssetsSum[0]?.total ?? 0);
    const totalWriteOffCount = Number(writeOffStats[0]?.count ?? 0);
    const totalWriteOffLoss = Number(writeOffStats[0]?.total_loss ?? 0);

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

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      userCount: dept._count.users,
      totalAssetValue: valueMap.get(dept.id) || 0,
      assets: dept.departmentAssets.map((da) => ({
        productName: da.product.name,
        productType: da.product.productType,
        quantity: da.quantity,
      })),
    }));
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
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orgFilter = organizationId ? { organizationId } : {};

    const operations = await this.prisma.operation.findMany({
      where: { createdAt: { gte: sixMonthsAgo }, ...orgFilter },
      select: { type: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthly: Record<
      string,
      { month: string; stockIn: number; stockOut: number }
    > = {};

    operations.forEach((op) => {
      const month = op.createdAt.toISOString().slice(0, 7);
      if (!monthly[month]) {
        monthly[month] = { month, stockIn: 0, stockOut: 0 };
      }
      if (op.type === 'STOCK_IN') {
        monthly[month].stockIn += op.quantity;
      } else {
        monthly[month].stockOut += op.quantity;
      }
    });

    return Object.values(monthly);
  }

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

  async getByUser(organizationId?: string) {
    const orgFilter = organizationId ? { organizationId } : {};

    const [users, activeAssignments] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null, isActive: true, ...orgFilter },
        select: {
          id: true,
          fullName: true,
          username: true,
          position: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.assignment.findMany({
        where: {
          returnedAt: null,
          asset: { deletedAt: null, ...orgFilter },
          userId: { not: null },
        },
        select: {
          userId: true,
          assignedAt: true,
          asset: {
            select: {
              id: true,
              inventoryNumber: true,
              status: true,
              purchasePrice: true,
              product: {
                select: { id: true, name: true, productType: true },
              },
            },
          },
        },
      }),
    ]);

    const assignmentsByUser = new Map<string, any[]>();
    for (const asgn of activeAssignments) {
      if (!asgn.userId) continue;
      const list = assignmentsByUser.get(asgn.userId) || [];
      list.push({
        assetId: asgn.asset.id,
        inventoryNumber: asgn.asset.inventoryNumber,
        status: asgn.asset.status,
        productName: asgn.asset.product?.name || 'Jihoz',
        purchasePrice: asgn.asset.purchasePrice ?? 0,
        assignedAt: asgn.assignedAt,
      });
      assignmentsByUser.set(asgn.userId, list);
    }

    return users.map((user) => {
      const assets = assignmentsByUser.get(user.id) || [];
      const totalValue = assets.reduce(
        (sum, a) => sum + Number(a.purchasePrice),
        0,
      );

      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        position: user.position,
        department: user.department,
        assetCount: assets.length,
        totalValue,
        assets,
      };
    });
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

