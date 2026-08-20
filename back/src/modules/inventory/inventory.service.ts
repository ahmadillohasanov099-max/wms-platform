import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { BulkStockInDto } from './dto';
import { ProductType, UnitType, UserRole } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};


    const items = await this.prisma.inventory.findMany({
      where: {
        product: {
          deletedAt: null,
          ...orgFilter,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            assets: {
              where: { deletedAt: null },
              select: {
                inventoryNumber: true,
                serialNumber: true,
                status: true,
                assignments: {
                  where: { returnedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => {
      let realQty = item.quantity;
      if (item.product?.productType === ProductType.BERILADIGAN && item.product.assets) {
        realQty = item.product.assets.filter(
          (a: any) => (!a.status || a.status === 'ACTIVE') && (!a.assignments || a.assignments.length === 0)
        ).length;
      }

      return {
        ...item,
        quantity: realQty,
        totalValue: realQty * Number(item.unitPrice ?? 0),
        isLowStock: realQty < item.minLevel,
      };
    });
  }

  async findOne(productId: string) {
    const inventory = await this.prisma.inventory.findFirst({
      where: {
        productId,
        product: {
          deletedAt: null,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            assets: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                assignments: { none: { returnedAt: null } },
              },
              select: {
                id: true,
                inventoryNumber: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return {
      ...inventory,
      totalValue: inventory.quantity * Number(inventory.unitPrice ?? 0),
      isLowStock: inventory.quantity < inventory.minLevel,
    };
  }

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
      };
    });
  }

  async getLowStock(organizationId?: string): Promise<any[]> {
    if (organizationId) {
      return this.prisma.$queryRaw`
        SELECT
          i."productId",
          p.name,
          p."productType",
          p.unit,
          i.quantity,
          i."minLevel",
          (i."minLevel" - i.quantity) AS shortage
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i."productId"
        WHERE i.quantity < i."minLevel"
          AND p."deletedAt" IS NULL
          AND p."organizationId" = ${organizationId}
        ORDER BY shortage DESC
      `;
    }

    return this.prisma.$queryRaw`
      SELECT
        i."productId",
        p.name,
        p."productType",
        p.unit,
        i.quantity,
        i."minLevel",
        (i."minLevel" - i.quantity) AS shortage
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity < i."minLevel"
        AND p."deletedAt" IS NULL
      ORDER BY shortage DESC
    `;
  }

  async setMinLevel(dto: SetMinLevelDto) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return this.prisma.inventory.update({
      where: { productId: dto.productId },
      data: { minLevel: dto.minLevel },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async bulkStockIn(dto: BulkStockInDto, performedById: string) {
    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    const results: any[] = [];

    // 1. Ommaviy validatsiya (Senior Validation)
    const allInventoryNumbers: string[] = [];
    for (const item of dto.items) {
      if (item.productType === ProductType.BERILADIGAN) {
        if (
          !item.inventoryNumbers ||
          item.inventoryNumbers.length !== item.quantity
        ) {
          throw new BadRequestException(
            `"${item.name}" jihozi uchun aynan ${item.quantity} ta inventar raqam yuborilishi shart!`,
          );
        }
        allInventoryNumbers.push(...item.inventoryNumbers);
      }
    }

    if (allInventoryNumbers.length > 0) {
      const uniqueNumbers = new Set(allInventoryNumbers);
      if (uniqueNumbers.size !== allInventoryNumbers.length) {
        throw new BadRequestException(
          'Ommaviy yuklanayotgan inventar raqamlari ichida takrorlanishlar mavjud!',
        );
      }

      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          inventoryNumber: { in: allInventoryNumbers },
          organizationId: performerOrgId,
          deletedAt: null,
        },
      });
      if (existingAsset) {
        throw new BadRequestException(
          `Inventar raqamlaridan biri bazada allaqachon band: ${existingAsset.inventoryNumber}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        let product = await tx.product.findFirst({
          where: {
            name: item.name,
            productType: item.productType,
            organizationId: performerOrgId,
            deletedAt: null,
          },
          include: { inventory: true },
        });

        if (!product) {
          product = await tx.product.create({
            data: {
              name: item.name,
              productType: item.productType,
              unit: item.unit ?? 'DONA',
              year: item.year ?? null,
              description: item.description,
              organizationId: performerOrgId,
            },
            include: { inventory: true },
          });

          await tx.inventory.create({
            data: {
              productId: product.id,
              quantity: 0,
              minLevel: 0,
            },
          });

          product = await tx.product.findUnique({
            where: { id: product.id },
            include: { inventory: true },
          });
        }

        const updatedInventory = await tx.inventory.update({
          where: { productId: product!.id },
          data: {
            quantity: { increment: item.quantity },
            unitPrice: item.unitPrice,
            totalValue: { increment: item.quantity * item.unitPrice },
          },
        });

        // 2. Jihozlarni (Asset) avtomatik yaratish
        if (
          item.productType === ProductType.BERILADIGAN &&
          item.inventoryNumbers
        ) {
          for (let i = 0; i < item.inventoryNumbers.length; i++) {
            await tx.asset.create({
              data: {
                productId: product!.id,
                inventoryNumber: item.inventoryNumbers[i],
                serialNumber: item.serialNumbers?.[i] || null,
                organizationId: performerOrgId,
                status: 'ACTIVE',
                purchasePrice: item.unitPrice || null,
              },
            });
          }
        }

        await tx.operation.create({
          data: {
            type: 'STOCK_IN',
            quantity: item.quantity,
            productId: product!.id,
            performedById,
            documentNumber: item.documentNumber,
            note: item.note,
            organizationId: performerOrgId,
          },
        });


        results.push({
          productId: product!.id,
          name: product!.name,
          productType: product!.productType,
          quantity: updatedInventory.quantity,
          unitPrice: item.unitPrice,
          totalValue: updatedInventory.quantity * item.unitPrice,
        });
      }
    });

    return {
      message: `${dto.items.length} ta mahsulot muvaffaqiyatli kirim qilindi`,
      count: dto.items.length,
      results,
    };
  }

  async exportExcel(organizationId?: string): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        inventory: true,
        assets: {
          where: { deletedAt: null },
          include: {
            assignments: {
              where: { returnedAt: null },
              include: {
                user: { select: { fullName: true, username: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
        departmentAssets: {
          include: { department: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ombor Boshqaruv Tizimi';
    const worksheet = workbook.addWorksheet('Ombor Qoldiqlari');
    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Mahsulot nomi', key: 'name', width: 38 },
      { header: 'Turi', key: 'type', width: 18 },
      { header: 'O‘lchov birligi', key: 'unit', width: 14 },
      { header: 'Inventar raqami', key: 'invNumber', width: 22 },
      { header: 'Seriya raqami', key: 'serialNumber', width: 20 },
      { header: 'Holati', key: 'status', width: 22 },
      { header: 'Joylashuvi (Xodim / Bo‘lim)', key: 'location', width: 34 },
      { header: 'Biriktirilgan sana', key: 'assignedAt', width: 18 },
      { header: 'Ombordagi qoldiq', key: 'warehouseQty', width: 18 },
      { header: 'Bo‘limlardagi qoldiq', key: 'deptsQty', width: 20 },
      { header: 'Narxi (so‘m)', key: 'price', width: 18 },
      { header: 'Minimal chegara', key: 'minLevel', width: 16 },
      { header: 'Tavsif', key: 'desc', width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let rowIdx = 1;
    for (const product of products) {
      const typeText =
        product.productType === ProductType.BERILADIGAN
          ? 'Jihoz (Asosiy vosita)'
          : 'TMZ (Sarflanadigan)';
      const unitText = product.unit || 'dona';
      const minLevelText = product.inventory?.minLevel ?? 0;
      const descText = product.description || '';

      if (product.productType === ProductType.SARFLANADIGAN) {
        const warehouseQty = product.inventory?.quantity ?? 0;
        const deptsQty = product.departmentAssets.reduce(
          (sum, da) => sum + da.quantity,
          0,
        );
        const unitPrice = product.inventory?.unitPrice
          ? Number(product.inventory.unitPrice)
          : 0;

        const row = worksheet.addRow([
          rowIdx++,
          product.name,
          typeText,
          unitText,
          '—',
          '—',
          warehouseQty > 0 ? 'Omborda mavjud' : 'Tugagan',
          'Markaziy Ombor',
          '—',
          warehouseQty,
          deptsQty,
          unitPrice,
          minLevelText,
          descText,
        ]);
        row.height = 20;
        row.alignment = { vertical: 'middle' };
      } else {
        if (product.assets.length > 0) {
          for (const asset of product.assets) {
            const activeAssignment = asset.assignments[0];
            let statusText = 'Omborda';
            let locationText = 'Markaziy Ombor';
            let assignedDateText = '—';

            if (asset.status === 'WRITTEN_OFF') {
              statusText = 'Hisobdan chiqarilgan';
              locationText = 'Arxiv';
            } else if (activeAssignment) {
              if (activeAssignment.user) {
                statusText = 'Xodimda';
                locationText = `${activeAssignment.user.fullName} (@${activeAssignment.user.username})`;
              } else if (activeAssignment.department) {
                statusText = 'Bo‘limda';
                locationText = activeAssignment.department.name;
              }
              if (activeAssignment.assignedAt) {
                const d = new Date(activeAssignment.assignedAt);
                assignedDateText = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
              }
            }

            const priceVal = asset.purchasePrice
              ? Number(asset.purchasePrice)
              : product.inventory?.unitPrice
              ? Number(product.inventory.unitPrice)
              : 0;

            const row = worksheet.addRow([
              rowIdx++,
              product.name,
              typeText,
              unitText,
              asset.inventoryNumber || '—',
              asset.serialNumber || '—',
              statusText,
              locationText,
              assignedDateText,
              asset.status === 'ACTIVE' && !activeAssignment ? 1 : 0,
              activeAssignment ? 1 : 0,
              priceVal,
              minLevelText,
              descText,
            ]);
            row.height = 20;
            row.alignment = { vertical: 'middle' };
          }
        } else {
          const qty = product.inventory?.quantity ?? 0;
          const row = worksheet.addRow([
            rowIdx++,
            product.name,
            typeText,
            unitText,
            '—',
            '—',
            'Omborda (Jihozlar yo‘q)',
            '—',
            '—',
            qty,
            0,
            product.inventory?.unitPrice ? Number(product.inventory.unitPrice) : 0,
            minLevelText,
            descText,
          ]);
          row.height = 20;
          row.alignment = { vertical: 'middle' };
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExcel(fileBuffer: Buffer, performedById: string, requestedProductType?: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException("Excel fayli bo'sh yoki topilmadi");
    }

    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xls fayl kiriting.");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException("Excel varaqlari bo'sh");
    }

    let headerRowIndex = -1;
    let nameCol = -1;
    let typeCol = -1;
    let invNumberCol = -1;
    let unitCol = -1;
    let qtyCol = -1;
    let priceCol = -1;

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").toLowerCase().trim();

        if ((val.includes("наименовани") || val.includes("mahsulot") || val.includes("nomi") || val.includes("объекта")) && nameCol === -1) {
          nameCol = c;
          headerRowIndex = r;
        }
        if ((val.includes("turi") || val.includes("type") || val.includes("вид") || val.includes("категори")) && typeCol === -1) {
          typeCol = c;
        }
        if ((val.includes("инвентар") || val.includes("inv")) && !val.includes("turi") && invNumberCol === -1) {
          invNumberCol = c;
        }
        if ((val.includes("ед") || val.includes("birlik") || val.includes("изм")) && unitCol === -1) {
          unitCol = c;
        }
        if ((val.includes("кол") || val.includes("soni") || val.includes("микдор") || val.includes("наличие")) && qtyCol === -1) {
          qtyCol = c;
        }
        if ((val.includes("сумма") || val.includes("narx") || val.includes("qiymat") || val.includes("сум")) && priceCol === -1) {
          priceCol = c;
        }
      }

      if (nameCol !== -1 && (invNumberCol !== -1 || qtyCol !== -1 || priceCol !== -1 || typeCol !== -1)) {
        break;
      }
    }

    const firstRowLength = (rawRows[0] && Array.isArray(rawRows[0])) ? rawRows[0].length : 7;
    const isSevenColFormat = firstRowLength <= 8;

    if (nameCol === -1) nameCol = 1;
    if (typeCol === -1 && firstRowLength >= 8) typeCol = 2;
    if (invNumberCol === -1 && typeCol !== 3) invNumberCol = 3;
    if (unitCol === -1) unitCol = 4;
    if (qtyCol === -1) qtyCol = isSevenColFormat ? 5 : 6;
    if (priceCol === -1) priceCol = isSevenColFormat ? 6 : 7;

    const documentNumber = `IMP-EXCEL-${Date.now().toString().slice(-6)}`;
    let importedCount = 0;
    let totalQtyCount = 0;
    let totalSumValue = 0;
    const errors: string[] = [];

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawName = String(row[nameCol] || "").trim();
      const colZero = String(row[0] || "").toLowerCase().trim();
      const colOne = String(row[1] || "").toLowerCase().trim();

      if (
        !rawName ||
        rawName === "1" ||
        rawName === "2" ||
        colOne === "2" ||
        rawName.toLowerCase().startsWith("№") ||
        rawName.toLowerCase().startsWith("итого") ||
        rawName.toLowerCase().startsWith("председатель") ||
        rawName.toLowerCase().startsWith("члены") ||
        rawName.toLowerCase().startsWith("общее") ||
        rawName.toLowerCase().startsWith("все ценности") ||
        rawName.toLowerCase().startsWith("материальное") ||
        colZero.startsWith("итого") ||
        colZero.startsWith("председатель") ||
        colZero.startsWith("члены") ||
        rawName.toLowerCase().includes("наименование")
      ) {
        continue;
      }

      const typeRaw = typeCol !== -1 ? String(row[typeCol] || "").trim().toLowerCase() : "";
      const invNumberRaw = (invNumberCol !== -1 && invNumberCol !== typeCol) ? String(row[invNumberCol] || "").trim() : "";
      const unitRaw = String(row[unitCol] || "").trim().toLowerCase();

      let qtyStr = String(row[qtyCol] || "1").replace(/[\s\u00a0]+/g, "").replace(",", ".");
      let quantity = Math.max(1, parseInt(qtyStr, 10) || 1);

      let priceStr = String(row[priceCol] || "0").replace(/[\s\u00a0]+/g, "").replace(",", ".");
      let sumValue = parseFloat(priceStr) || 0;
      let unitPrice = sumValue > 0 ? (sumValue > quantity ? sumValue / quantity : sumValue) : 0;

      let unit: UnitType = UnitType.DONA;
      if (unitRaw.includes('komplekt') || unitRaw.includes('компл')) {
        unit = UnitType.KOMPLEKT;
      } else if (unitRaw.includes('pachka') || unitRaw.includes('пачк') || unitRaw.includes('quti') || unitRaw.includes('короб') || unitRaw.includes('flakon') || unitRaw.includes('rulon')) {
        unit = UnitType.PACHKA;
      }

      let productType: ProductType = ProductType.SARFLANADIGAN;
      const reqTypeUpper = String(requestedProductType || "").toUpperCase();

      if (reqTypeUpper === 'SARFLANADIGAN' || reqTypeUpper === 'TMZ') {
        productType = ProductType.SARFLANADIGAN;
      } else if (reqTypeUpper === 'BERILADIGAN' || reqTypeUpper === 'ASOSIY VOSITA') {
        productType = ProductType.BERILADIGAN;
      } else if (typeRaw.includes('tmz') || typeRaw.includes('sarflanadiga') || typeRaw.includes('rashod') || typeRaw.includes('материал')) {
        productType = ProductType.SARFLANADIGAN;
      } else if (typeRaw.includes('beriladiga') || typeRaw.includes('asosiy') || typeRaw.includes('jihoz') || typeRaw.includes('asset')) {
        productType = ProductType.BERILADIGAN;
      } else {
        const isRealInvNumber = invNumberRaw.length >= 4 && /^\d+$/.test(invNumberRaw);
        productType = isRealInvNumber ? ProductType.BERILADIGAN : ProductType.SARFLANADIGAN;
      }

            try {
              await this.prisma.$transaction(async (tx) => {
                let product = await tx.product.findFirst({
                  where: { name: rawName, organizationId: performerOrgId, deletedAt: null },
                });

                if (!product) {
                  product = await tx.product.create({
                    data: {
                      name: rawName,
                      productType,
                      unit,
                      organizationId: performerOrgId,
                    },
                  });
                }

                let inventory = await tx.inventory.findUnique({
                  where: { productId: product.id },
                });

                if (!inventory) {
                  inventory = await tx.inventory.create({
                    data: {
                      productId: product.id,
                      quantity,
                      unitPrice,
                    },
                  });
                } else {
                  inventory = await tx.inventory.update({
                    where: { productId: product.id },
                    data: {
                      quantity: { increment: quantity },
                      unitPrice: unitPrice > 0 ? unitPrice : inventory.unitPrice,
                    },
                  });
                }

                let createdAssetId: string | undefined = undefined;
                if (productType === ProductType.BERILADIGAN) {
                  const invNumber = invNumberRaw || `${product.id.slice(0, 4)}-${Date.now().toString().slice(-6)}-${i}`;
                  
                  const existingAsset = await tx.asset.findFirst({
                    where: { inventoryNumber: invNumber, organizationId: performerOrgId, deletedAt: null },
                  });

                  if (!existingAsset) {
                    const asset = await tx.asset.create({
                      data: {
                        productId: product.id,
                        inventoryNumber: invNumber,
                        purchasePrice: unitPrice > 0 ? unitPrice : undefined,
                        status: 'ACTIVE',
                        organizationId: performerOrgId,
                      },
                    });
                    createdAssetId = asset.id;
                  }
                }

                await tx.operation.create({
                  data: {
                    type: 'STOCK_IN',
                    quantity,
                    productId: product.id,
                    assetId: createdAssetId,
                    performedById,
                    documentNumber,
                    note: `Excel orqali ommaviy kirim (${sheetName})`,
                    organizationId: performerOrgId,
                  },
                });
              });
        totalSumValue += sumValue;
      } catch (err: any) {
        console.error(`Row ${i} import error:`, err);
        errors.push(`Qator ${i + 1} (${rawName}): ${err.message}`);
      }
    }

    return {
      message: `${importedCount} ta mahsulot muvaffaqiyatli kirim qilindi!`,
      importedCount,
      totalQtyCount,
      totalSumValue,
      documentNumber,
      errorCount: errors.length,
      errors: errors.slice(0, 5),
    };
  }

  async generateMasterTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Inventory Management System';

    // ──────────────────────────────────────────────────────────
    // 1. SHEET: Xodimlar va Bo'limlar
    // ──────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('1. Xodimlar va Bo‘limlar');
    sheet1.views = [{ showGridLines: true }];
    sheet1.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'F.I.Sh (To‘liq ism) *', key: 'fullName', width: 35 },
      { header: 'Bo‘lim nomi *', key: 'department', width: 30 },
      { header: 'Lavozimi', key: 'position', width: 25 },
      { header: 'Username (Login)', key: 'username', width: 22 },
      { header: 'Ichki tel', key: 'internalPhone', width: 14 },
      { header: 'Mobil telefon', key: 'phone', width: 18 },
      { header: 'Pasport seriyasi va №', key: 'passport', width: 22 },
      { header: 'JSHSHIR (14 xonali)', key: 'pinfl', width: 20 },
      { header: 'Yashash manzili', key: 'address', width: 35 },
    ];
    const h1 = sheet1.getRow(1);
    h1.height = 28;
    h1.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.font = { name: 'Yu Gothic UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // ──────────────────────────────────────────────────────────
    // 2. SHEET: Asosiy vositalar (Jihozlar)
    // ──────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('2. Asosiy vositalar (Jihozlar)');
    sheet2.views = [{ showGridLines: true }];
    sheet2.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Jihoz / Mahsulot nomi *', key: 'name', width: 42 },
      { header: 'Inventar raqami *', key: 'invNumber', width: 24 },
      { header: 'Seriya raqami', key: 'serialNumber', width: 20 },
      { header: 'Sotib olingan narxi (so‘m)', key: 'price', width: 24 },
      { header: 'O‘lchov birligi', key: 'unit', width: 15 },
      { header: 'Biriktirilgan xodim (F.I.Sh yoki Username)', key: 'assignedTo', width: 42 },
      { header: 'Hujjat raqami', key: 'docNumber', width: 20 },
      { header: 'Izoh', key: 'note', width: 25 },
    ];
    const h2 = sheet2.getRow(1);
    h2.height = 28;
    h2.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } };
      cell.font = { name: 'Yu Gothic UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // ──────────────────────────────────────────────────────────
    // 3. SHEET: TMZ (Sarflanadigan)
    // ──────────────────────────────────────────────────────────
    const sheet3 = workbook.addWorksheet('3. TMZ (Sarflanadigan)');
    sheet3.views = [{ showGridLines: true }];
    sheet3.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Material nomi *', key: 'name', width: 42 },
      { header: 'O‘lchov birligi', key: 'unit', width: 16 },
      { header: 'Ombordagi miqdori *', key: 'quantity', width: 22 },
      { header: 'Birlik narxi (so‘m)', key: 'price', width: 22 },
      { header: 'Minimal chegara', key: 'minLevel', width: 18 },
      { header: 'Hujjat raqami', key: 'docNumber', width: 20 },
      { header: 'Izoh', key: 'note', width: 25 },
    ];
    const h3 = sheet3.getRow(1);
    h3.height = 28;
    h3.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
      cell.font = { name: 'Yu Gothic UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private matchUserSmart(
    inputName: string,
    users: { id: string; fullName: string; username: string }[],
  ): { id: string; fullName: string } | null {
    if (!inputName || !inputName.trim()) return null;
    const cleanRaw = inputName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
    if (!cleanRaw) return null;

    const cyrMap: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
      и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
      с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ҳ: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
      щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', ғ: 'g', қ: 'q',
    };
    const translit = (s: string) => s.split('').map((c) => cyrMap[c] || c).join('');
    const cleanLat = translit(cleanRaw);

    // 1. Exact match (Latin or Cyrillic)
    for (const u of users) {
      const uFull = u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      const uUser = u.username.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      if (uFull === cleanRaw || uUser === cleanRaw) return u;
      if (translit(uFull) === cleanLat || translit(uUser) === cleanLat) return u;
    }

    // 2. Word permutation / reordered match (e.g. "Karimov Alisher" vs "Alisher Karimov")
    const inputWords = cleanLat.split(' ').filter(Boolean).sort().join(' ');
    for (const u of users) {
      const uFull = u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      const uWords = translit(uFull).split(' ').filter(Boolean).sort().join(' ');
      if (inputWords === uWords && inputWords.length > 3) return u;
    }

    // 3. Substring / Father name inclusion match (e.g. "Karimov Alisher Saidjanovich" vs "Karimov Alisher")
    for (const u of users) {
      const uFullLat = translit(u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim());
      const rawWords = cleanLat.split(' ').filter(Boolean);
      const uWords = uFullLat.split(' ').filter(Boolean);
      if (rawWords.length >= 2 && uWords.length >= 2) {
        // If first 2 words match
        if ((rawWords[0] === uWords[0] && rawWords[1] === uWords[1]) || (rawWords[0] === uWords[1] && rawWords[1] === uWords[0])) {
          return u;
        }
      }
    }

    // 4. Fuzzy Levenshtein Distance (Tolerate 1-2 character typos)
    const lev = (a: string, b: string) => {
      const an = a.length, bn = b.length;
      if (an === 0) return bn;
      if (bn === 0) return an;
      const m: number[][] = Array.from({ length: bn + 1 }, (_, i) => [i]);
      for (let j = 0; j <= an; j++) m[0][j] = j;
      for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
          m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
      }
      return m[bn][an];
    };

    let bestUser: { id: string; fullName: string } | null = null;
    let minDiff = 999;
    for (const u of users) {
      const uFullLat = translit(u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim());
      const dist = lev(cleanLat, uFullLat);
      const maxLen = Math.max(cleanLat.length, uFullLat.length);
      if (dist <= 2 && (maxLen - dist) / maxLen >= 0.8) {
        if (dist < minDiff) {
          minDiff = dist;
          bestUser = u;
        }
      }
    }

    return bestUser;
  }

  async importMasterExcel(fileBuffer: Buffer, performedById: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException("Excel fayli bo'sh yoki topilmadi");
    }

    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xlsm fayl kiriting.");
    }

    const sheetNames = workbook.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    // Identify Sheets
    let employeesSheetName = sheetNames.find((s) => {
      const lower = s.toLowerCase();
      return lower.includes('xodim') || lower.includes('сотруд') || lower.includes('работ') || lower.includes('user');
    });

    let assetsSheetName = sheetNames.find((s) => {
      const lower = s.toLowerCase();
      return lower.includes('asosiy') || lower.includes('jihoz') || lower.includes('asset') || lower.includes('инвентар') || lower.includes('опис');
    });

    let tmzSheetName = sheetNames.find((s) => {
      const lower = s.toLowerCase();
      return lower.includes('tmz') || lower.includes('sarflan') || lower.includes('rashod') || lower.includes('материал');
    });

    // Fallback if 3 sheets exist
    if (!employeesSheetName && sheetNames.length >= 1) employeesSheetName = sheetNames[0];
    if (!assetsSheetName && sheetNames.length >= 2) assetsSheetName = sheetNames[1];
    if (!tmzSheetName && sheetNames.length >= 3) tmzSheetName = sheetNames[2];

    const stats = {
      departmentsCreated: 0,
      usersCreated: 0,
      assetsCreated: 0,
      assetsAssigned: 0,
      assetsInStock: 0,
      tmzCreated: 0,
      totalSumValue: 0,
      errors: [] as string[],
    };

    const userList: { id: string; fullName: string; username: string }[] = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(performerOrgId && { organizationId: performerOrgId }),
      },
      select: { id: true, username: true, fullName: true },
    });

    const defaultPasswordHash = await bcrypt.hash('123456', 10);
    const documentNumber = `MASTER-IMP-${Date.now().toString().slice(-6)}`;

    // ──────────────────────────────────────────────────────────
    // STEP 1: PARSE EMPLOYEES & DEPARTMENTS
    // ──────────────────────────────────────────────────────────
    if (employeesSheetName && workbook.Sheets[employeesSheetName]) {
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[employeesSheetName], { header: 1 });
      if (rows && rows.length > 1) {
        let nameCol = -1, deptCol = -1, posCol = -1, userCol = -1, intPhoneCol = -1, phoneCol = -1, passCol = -1, pinflCol = -1, addrCol = -1;
        let headerRow = 0;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').toLowerCase().trim();
            if ((v.includes('f.i.sh') || v.includes('fio') || v.includes('ism') || v.includes('фио')) && nameCol === -1) { nameCol = c; headerRow = r; }
            if ((v.includes('bo‘lim') || v.includes('bo\'lim') || v.includes('bolim') || v.includes('отдел')) && deptCol === -1) deptCol = c;
            if ((v.includes('lavozim') || v.includes('должность') || v.includes('pos')) && posCol === -1) posCol = c;
            if ((v.includes('username') || v.includes('login') || v.includes('user')) && userCol === -1) userCol = c;
            if ((v.includes('ichki') || v.includes('внутр')) && intPhoneCol === -1) intPhoneCol = c;
            if ((v.includes('telefon') || v.includes('phone') || v.includes('тел')) && !v.includes('ichki') && phoneCol === -1) phoneCol = c;
            if ((v.includes('pasport') || v.includes('pass')) && passCol === -1) passCol = c;
            if ((v.includes('pinfl') || v.includes('jshshir')) && pinflCol === -1) pinflCol = c;
            if ((v.includes('manzil') || v.includes('address')) && addrCol === -1) addrCol = c;
          }
        }

        if (nameCol === -1) nameCol = 1;
        if (deptCol === -1) deptCol = 2;
        if (posCol === -1) posCol = 3;
        if (userCol === -1) userCol = 4;
        if (intPhoneCol === -1) intPhoneCol = 5;
        if (phoneCol === -1) phoneCol = 6;

        const deptCache = new Map<string, string>();
        const allDepts = await this.prisma.department.findMany({
          where: {
            deletedAt: null,
            ...(performerOrgId && { organizationId: performerOrgId }),
          },
        });
        allDepts.forEach((d) => deptCache.set(d.name.toLowerCase().trim(), d.id));

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          const fullName = String(row[nameCol] || '').trim();
          if (!fullName || fullName.toLowerCase().includes('f.i.sh') || fullName === 'ВАКАНТ' || fullName === '№') continue;

          const rawDept = String(row[deptCol] || '').trim() || 'Umumiy bo‘lim';
          let deptId = deptCache.get(rawDept.toLowerCase().trim());
          if (!deptId) {
            const newDept = await this.prisma.department.create({
              data: { name: rawDept, organizationId: performerOrgId },
            });
            deptId = newDept.id;
            deptCache.set(rawDept.toLowerCase().trim(), deptId);
            stats.departmentsCreated++;
          }

          let username = String(row[userCol] || '').trim().toLowerCase().replace(/[@\s]+/g, '_');
          if (!username) {
            username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + (i + 1);
          }

          let user = await this.prisma.user.findFirst({
            where: {
              OR: [{ username }, { fullName }],
              ...(performerOrgId && { organizationId: performerOrgId }),
              deletedAt: null,
            },
          });

          if (!user) {
            user = await this.prisma.user.create({
              data: {
                fullName,
                username,
                passwordHash: defaultPasswordHash,
                role: UserRole.XODIM,
                position: String(row[posCol] || '').trim() || undefined,
                departmentId: deptId,
                organizationId: performerOrgId,
                internalPhone: intPhoneCol !== -1 ? String(row[intPhoneCol] || '').trim() : undefined,
                phone: phoneCol !== -1 ? String(row[phoneCol] || '').trim() : undefined,
                passport: passCol !== -1 ? String(row[passCol] || '').trim() : undefined,
                pinfl: pinflCol !== -1 ? String(row[pinflCol] || '').trim() : undefined,
                address: addrCol !== -1 ? String(row[addrCol] || '').trim() : undefined,
                isActive: true,
              },
            });
            stats.usersCreated++;
          }

          if (user && !userList.some((u) => u.id === user.id)) {
            userList.push({ id: user.id, fullName: user.fullName, username: user.username });
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // STEP 2: PARSE FIXED ASSETS & AUTO-ASSIGN
    // ──────────────────────────────────────────────────────────
    if (assetsSheetName && workbook.Sheets[assetsSheetName]) {
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[assetsSheetName], { header: 1 });
      if (rows && rows.length > 1) {
        let nameCol = -1, invCol = -1, serialCol = -1, priceCol = -1, unitCol = -1, assignCol = -1, noteCol = -1;
        let headerRow = 0;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').toLowerCase().trim();
            if ((v.includes('nomi') || v.includes('jihoz') || v.includes('mahsulot') || v.includes('наименование')) && nameCol === -1) { nameCol = c; headerRow = r; }
            if ((v.includes('inventar') || v.includes('инвентар') || v.includes('inv')) && invCol === -1) invCol = c;
            if ((v.includes('seriya') || v.includes('сери') || v.includes('serial')) && serialCol === -1) serialCol = c;
            if ((v.includes('narx') || v.includes('summa') || v.includes('цена') || v.includes('стоимость')) && priceCol === -1) priceCol = c;
            if ((v.includes('birlik') || v.includes('ед')) && unitCol === -1) unitCol = c;
            if ((v.includes('xodim') || v.includes('biriktir') || v.includes('kimda') || v.includes('сотруд')) && assignCol === -1) assignCol = c;
            if ((v.includes('izoh') || v.includes('note') || v.includes('примеч')) && noteCol === -1) noteCol = c;
          }
        }

        if (nameCol === -1) nameCol = 1;
        if (invCol === -1) invCol = 2;
        if (priceCol === -1) priceCol = 4;
        if (unitCol === -1) unitCol = 5;
        if (assignCol === -1) assignCol = 6;

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          const rawName = String(row[nameCol] || '').trim();
          if (!rawName || rawName === '№' || rawName.toLowerCase().startsWith('итого')) continue;

          const invNumber = String(row[invCol] || '').trim() || `${Date.now().toString().slice(-6)}-${i}`;
          const serialNumber = serialCol !== -1 ? String(row[serialCol] || '').trim() : undefined;
          let priceStr = String(row[priceCol] || '0').replace(/[\s\u00a0]+/g, '').replace(',', '.');
          let unitPrice = parseFloat(priceStr) || 0;

          const assignedTarget = assignCol !== -1 ? String(row[assignCol] || '').trim() : '';
          const matchedUser = assignedTarget ? this.matchUserSmart(assignedTarget, userList) : null;
          const targetUserId = matchedUser ? matchedUser.id : null;

          if (assignedTarget && !matchedUser) {
            stats.errors.push(`Qator ${i + 1} (${rawName}): '${assignedTarget}' xodimi topilmadi, jihoz omborga joylandi`);
          }

          try {
            await this.prisma.$transaction(async (tx) => {
              let product = await tx.product.findFirst({
                where: {
                  name: rawName,
                  productType: ProductType.BERILADIGAN,
                  ...(performerOrgId && { organizationId: performerOrgId }),
                  deletedAt: null,
                },
              });

              if (!product) {
                product = await tx.product.create({
                  data: {
                    name: rawName,
                    productType: ProductType.BERILADIGAN,
                    unit: UnitType.DONA,
                    organizationId: performerOrgId,
                  },
                });
              }

              let inventory = await tx.inventory.findUnique({ where: { productId: product.id } });
              if (!inventory) {
                inventory = await tx.inventory.create({
                  data: { productId: product.id, quantity: 0, unitPrice },
                });
              }

              let asset = await tx.asset.findFirst({
                where: {
                  inventoryNumber: invNumber,
                  ...(performerOrgId && { organizationId: performerOrgId }),
                  deletedAt: null,
                },
              });

              if (!asset) {
                asset = await tx.asset.create({
                  data: {
                    productId: product.id,
                    inventoryNumber: invNumber,
                    serialNumber: serialNumber || null,
                    purchasePrice: unitPrice > 0 ? unitPrice : undefined,
                    status: 'ACTIVE',
                    organizationId: performerOrgId,
                  },
                });
                stats.assetsCreated++;
                stats.totalSumValue += unitPrice;
              }

              // STOCK IN operation
              await tx.operation.create({
                data: {
                  type: 'STOCK_IN',
                  quantity: 1,
                  productId: product.id,
                  assetId: asset.id,
                  performedById,
                  documentNumber,
                  note: `Master Excel kirim (${assetsSheetName})`,
                  organizationId: performerOrgId,
                },
              });

              // Check assignment
              if (targetUserId) {
                const existingAsgn = await tx.assignment.findFirst({
                  where: { assetId: asset.id, returnedAt: null },
                });
                if (!existingAsgn) {
                  await tx.assignment.create({
                    data: { userId: targetUserId, assetId: asset.id },
                  });
                  await tx.operation.create({
                    data: {
                      type: 'GIVE_TO_USER',
                      quantity: 1,
                      userId: targetUserId,
                      productId: product.id,
                      assetId: asset.id,
                      performedById,
                      documentNumber,
                      note: 'Master Excel avtomatik biriktirish',
                      organizationId: performerOrgId,
                    },
                  });
                  stats.assetsAssigned++;
                }
              } else {
                await tx.inventory.update({
                  where: { productId: product.id },
                  data: { quantity: { increment: 1 } },
                });
                stats.assetsInStock++;
              }
            });
          } catch (e: any) {
            stats.errors.push(`Jihoz qatori ${i + 1} (${rawName}): ${e.message}`);
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // STEP 3: PARSE TMZ (CONSUMABLES)
    // ──────────────────────────────────────────────────────────
    if (tmzSheetName && workbook.Sheets[tmzSheetName]) {
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[tmzSheetName], { header: 1 });
      if (rows && rows.length > 1) {
        let nameCol = -1, unitCol = -1, qtyCol = -1, priceCol = -1;
        let headerRow = 0;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').toLowerCase().trim();
            if ((v.includes('nomi') || v.includes('tmz') || v.includes('material')) && nameCol === -1) { nameCol = c; headerRow = r; }
            if ((v.includes('birlik') || v.includes('ед')) && unitCol === -1) unitCol = c;
            if ((v.includes('miqdor') || v.includes('soni') || v.includes('кол')) && qtyCol === -1) qtyCol = c;
            if ((v.includes('narx') || v.includes('цена') || v.includes('summa')) && priceCol === -1) priceCol = c;
          }
        }

        if (nameCol === -1) nameCol = 1;
        if (unitCol === -1) unitCol = 2;
        if (qtyCol === -1) qtyCol = 3;
        if (priceCol === -1) priceCol = 4;

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          const rawName = String(row[nameCol] || '').trim();
          if (!rawName || rawName === '№') continue;

          let qtyStr = String(row[qtyCol] || '1').replace(/[\s\u00a0]+/g, '').replace(',', '.');
          let quantity = Math.max(1, parseInt(qtyStr, 10) || 1);

          let priceStr = String(row[priceCol] || '0').replace(/[\s\u00a0]+/g, '').replace(',', '.');
          let unitPrice = parseFloat(priceStr) || 0;

          const unitRaw = unitCol !== -1 ? String(row[unitCol] || '').toLowerCase().trim() : '';
          let unit: UnitType = UnitType.DONA;
          if (unitRaw.includes('pachka') || unitRaw.includes('quti') || unitRaw.includes('flakon')) unit = UnitType.PACHKA;
          if (unitRaw.includes('komplekt') || unitRaw.includes('kompl')) unit = UnitType.KOMPLEKT;

          try {
            await this.prisma.$transaction(async (tx) => {
              let product = await tx.product.findFirst({
                where: {
                  name: rawName,
                  productType: ProductType.SARFLANADIGAN,
                  ...(performerOrgId && { organizationId: performerOrgId }),
                  deletedAt: null,
                },
              });

              if (!product) {
                product = await tx.product.create({
                  data: {
                    name: rawName,
                    productType: ProductType.SARFLANADIGAN,
                    unit,
                    organizationId: performerOrgId,
                  },
                });
              }

              let inventory = await tx.inventory.findUnique({ where: { productId: product.id } });
              if (!inventory) {
                inventory = await tx.inventory.create({
                  data: { productId: product.id, quantity, unitPrice },
                });
              } else {
                inventory = await tx.inventory.update({
                  where: { productId: product.id },
                  data: {
                    quantity: { increment: quantity },
                    unitPrice: unitPrice > 0 ? unitPrice : inventory.unitPrice,
                  },
                });
              }

              await tx.operation.create({
                data: {
                  type: 'STOCK_IN',
                  quantity,
                  productId: product.id,
                  performedById,
                  documentNumber,
                  note: `Master Excel TMZ kirim (${tmzSheetName})`,
                  organizationId: performerOrgId,
                },
              });

              stats.tmzCreated++;
              stats.totalSumValue += quantity * unitPrice;
            });
          } catch (e: any) {
            stats.errors.push(`TMZ qatori ${i + 1} (${rawName}): ${e.message}`);
          }
        }
      }
    }

    return {
      success: true,
      message: 'Master Excel muvaffaqiyatli import qilindi!',
      documentNumber,
      ...stats,
    };
  }
}
    