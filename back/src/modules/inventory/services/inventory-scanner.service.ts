import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { UserRole } from '@prisma/client';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';

@Injectable()
export class InventoryScannerService {
  constructor(private prisma: PrismaService) {}

  async getAssignedAssets(targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const assignments = await this.prisma.assignment.findMany({
      where: {
        returnedAt: null,
        asset: {
          deletedAt: null,
          product: { deletedAt: null, ...orgFilter },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            department: { select: { id: true, name: true } },
          },
        },
        department: { select: { id: true, name: true } },
        asset: {
          select: {
            id: true,
            inventoryNumber: true,
            serialNumber: true,
            purchasePrice: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                unit: true,
              },
            },
            operations: {
              where: {
                type: { in: ['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT', 'TRANSFER_USER'] },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                performedBy: { select: { id: true, fullName: true, username: true } },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((asgn) => {
      const asset = asgn.asset;
      const latestOp = asset?.operations?.[0];

      const holderType = asgn.userId ? 'USER' : 'DEPARTMENT';
      const holderUser = asgn.user;
      const holderDepartment = asgn.department || asgn.user?.department;
      const holderName = asgn.user?.fullName || asgn.department?.name || "Noma'lum";
      const departmentName = asgn.user?.department?.name || asgn.department?.name || "—";
      const departmentId = asgn.department?.id || asgn.user?.department?.id || '';

      return {
        id: asgn.id,
        assetId: asset?.id || '',
        productName: asset?.product?.name || 'Jihoz',
        productType: asset?.product?.productType || 'BERILADIGAN',
        productUnit: asset?.product?.unit || 'DONA',
        inventoryNumber: asset?.inventoryNumber || '—',
        serialNumber: asset?.serialNumber || '—',
        purchasePrice: Number(asset?.purchasePrice || 0),
        holderType,
        holderName,
        holderUser,
        holderDepartment,
        departmentName,
        departmentId,
        assignedAt: asgn.assignedAt || asset?.createdAt,
        performedBy: latestOp?.performedBy?.fullName || "Mas'ul",
        documentNumber: latestOp?.documentNumber || asset?.inventoryNumber || '—',
        status: asgn.status || 'ACCEPTED',
        acceptedAt: asgn.acceptedAt,
        rejectedAt: asgn.rejectedAt,
        rejectionReason: asgn.rejectionReason,
      };
    });
  }

  async lookupAssetByCode(code: string, targetOrgId?: string, currentUser?: any) {
    if (!code || !code.trim()) {
      throw new BadRequestException("Inventar raqami ko'rsatilmadi");
    }

    const raw = code.trim();
    // Normalize cyrillic 'ИНВ'/'инв'/'Инв' to 'INV'
    const normalized = raw
      .replace(/^[иИ][нН][вВ]/i, 'INV')
      .replace(/\s+/g, ' ')
      .trim();

    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    // Generate candidate strings
    const candidates = new Set<string>();
    candidates.add(raw);
    candidates.add(normalized);
    candidates.add(raw.toUpperCase());
    candidates.add(normalized.toUpperCase());

    // Without spaces
    const noSpaces = normalized.replace(/\s+/g, '');
    candidates.add(noSpaces);
    candidates.add(noSpaces.toUpperCase());

    // Strip "INV-", "INV -", "INV:", "INV" prefixes
    const withoutInvPrefix = normalized.replace(/^INV\s*[-–—:]?\s*/i, '').trim();
    if (withoutInvPrefix) {
      candidates.add(withoutInvPrefix);
      candidates.add(`INV-${withoutInvPrefix}`);
      candidates.add(`INV${withoutInvPrefix}`);
      candidates.add(`INV - ${withoutInvPrefix}`);
    }

    // Pure alphanumeric characters
    const pureAlphaNum = normalized.replace(/[^a-zA-Z0-9]/g, '');
    if (pureAlphaNum && pureAlphaNum.length >= 3) {
      candidates.add(pureAlphaNum);
      if (!pureAlphaNum.toUpperCase().startsWith('INV')) {
        candidates.add(`INV-${pureAlphaNum}`);
        candidates.add(`INV${pureAlphaNum}`);
      }
    }

    const candidateArray = Array.from(candidates);

    const includeAssetRelations = {
      product: {
        select: {
          id: true,
          name: true,
          year: true,
          productType: true,
          unit: true,
          description: true,
          imageUrl: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
        },
      },
      assignments: {
        where: { returnedAt: null },
        orderBy: { assignedAt: 'desc' as const },
        take: 1,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              phone: true,
              internalPhone: true,
              position: true,
              department: { select: { id: true, name: true } },
            },
          },
          department: { select: { id: true, name: true } },
        },
      },
      operations: {
        orderBy: { createdAt: 'desc' as const },
        take: 10,
        include: {
          performedBy: { select: { id: true, fullName: true, username: true, role: true } },
          user: { select: { id: true, fullName: true, department: { select: { name: true } } } },
          fromUser: { select: { id: true, fullName: true, department: { select: { name: true } } } },
          department: { select: { id: true, name: true } },
        },
      },
    };

    // 1. Exact / candidate match in tenant organization
    let asset = await this.prisma.asset.findFirst({
      where: {
        deletedAt: null,
        ...orgFilter,
        OR: [
          { inventoryNumber: { in: candidateArray, mode: 'insensitive' } },
          { serialNumber: { in: candidateArray, mode: 'insensitive' } },
          { id: raw },
        ],
      },
      include: includeAssetRelations,
    });

    // 2. Substring / contains match in tenant organization if exact match fails
    if (!asset) {
      const searchTerms = [withoutInvPrefix, pureAlphaNum, raw].filter(
        (t) => t && t.length >= 3,
      );

      for (const term of searchTerms) {
        asset = await this.prisma.asset.findFirst({
          where: {
            deletedAt: null,
            ...orgFilter,
            OR: [
              { inventoryNumber: { contains: term, mode: 'insensitive' } },
              { serialNumber: { contains: term, mode: 'insensitive' } },
            ],
          },
          include: includeAssetRelations,
        });
        if (asset) break;
      }
    }

    // 3. If not found in user's tenant, check globally across all organizations
    if (!asset && resolvedOrgId) {
      const isSuperOrMinistry =
        currentUser?.role === UserRole.SUPER_ADMIN ||
        currentUser?.role === UserRole.VAZIRLIK_OMBORCHI;

      const globalAsset = await this.prisma.asset.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { inventoryNumber: { in: candidateArray, mode: 'insensitive' } },
            { serialNumber: { in: candidateArray, mode: 'insensitive' } },
            { inventoryNumber: { contains: withoutInvPrefix || raw, mode: 'insensitive' } },
          ],
        },
        include: includeAssetRelations,
      });

      if (globalAsset) {
        if (isSuperOrMinistry) {
          asset = globalAsset;
        } else {
          // Tell the user gracefully that it belongs to another organization
          return {
            found: false,
            wrongOrganization: true,
            searchedCode: raw,
            otherOrganizationName: globalAsset.organization?.name || 'Boshqa tashkilot',
            message: `Ushbu jihoz boshqa tashkilot (${globalAsset.organization?.name || 'boshqa tashkilot'}) hisobida turibdi.`,
          };
        }
      }
    }

    if (!asset) {
      return {
        found: false,
        wrongOrganization: false,
        searchedCode: raw,
        message: "Ushbu mahsulot ombor hisobiga qayd qilinmagan",
      };
    }

    const activeAssignment = asset.assignments?.[0];
    let locationType: 'USER' | 'DEPARTMENT' | 'WAREHOUSE' = 'WAREHOUSE';
    let holderUser: any = null;
    let holderDepartment: any = null;

    if (activeAssignment?.userId && activeAssignment.user) {
      locationType = 'USER';
      holderUser = activeAssignment.user;
      holderDepartment = activeAssignment.user.department;
    } else if (activeAssignment?.departmentId && activeAssignment.department) {
      locationType = 'DEPARTMENT';
      holderDepartment = activeAssignment.department;
    }

    return {
      found: true,
      asset: {
        id: asset.id,
        inventoryNumber: asset.inventoryNumber,
        serialNumber: asset.serialNumber,
        status: asset.status,
        purchaseDate: asset.purchaseDate,
        purchasePrice: Number(asset.purchasePrice || 0),
        warrantyExp: asset.warrantyExp,
        notes: asset.notes,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
      product: asset.product,
      organization: asset.organization,
      location: {
        type: locationType,
        assignedAt: activeAssignment?.assignedAt || null,
        user: holderUser,
        department: holderDepartment,
      },
      operations: asset.operations.map((op) => ({
        id: op.id,
        type: op.type,
        quantity: op.quantity,
        documentNumber: op.documentNumber,
        documentDate: op.documentDate,
        note: op.note,
        createdAt: op.createdAt,
        performedBy: op.performedBy,
        user: op.user,
        fromUser: op.fromUser,
        department: op.department,
      })),
    };
  }

  async searchAssets(query: string, targetOrgId?: string, currentUser?: any) {
    if (!query || !query.trim()) {
      return [];
    }

    const trimmed = query.trim();
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const assets = await this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        ...orgFilter,
        OR: [
          { inventoryNumber: { contains: trimmed, mode: 'insensitive' } },
          { serialNumber: { contains: trimmed, mode: 'insensitive' } },
          { product: { name: { contains: trimmed, mode: 'insensitive' } } },
          {
            assignments: {
              some: {
                returnedAt: null,
                user: { fullName: { contains: trimmed, mode: 'insensitive' } },
              },
            },
          },
        ],
      },
      take: 12,
      include: {
        product: { select: { id: true, name: true, productType: true, unit: true } },
        assignments: {
          where: { returnedAt: null },
          take: 1,
          include: {
            user: { select: { id: true, fullName: true, department: { select: { name: true } } } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return assets.map((a) => {
      const asgn = a.assignments?.[0];
      return {
        id: a.id,
        inventoryNumber: a.inventoryNumber,
        serialNumber: a.serialNumber,
        status: a.status,
        productName: a.product?.name || 'Jihoz',
        productType: a.product?.productType,
        holderName: asgn?.user?.fullName || asgn?.department?.name || 'Omborda',
        holderType: asgn?.userId ? 'USER' : asgn?.departmentId ? 'DEPARTMENT' : 'WAREHOUSE',
        departmentName: asgn?.user?.department?.name || asgn?.department?.name || '—',
      };
    });
  }
}
