import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType, UnitType, UserRole } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import * as bcrypt from 'bcrypt';

export interface ExportInventoryOptions {
  organizationId?: string;
  productType?: ProductType | string;
  search?: string;
  lowStock?: boolean | string;
}

@Injectable()
export class InventoryExcelService {
  constructor(private prisma: PrismaService) {}

  async exportExcel(
    organizationIdOrOptions?: string | ExportInventoryOptions,
    maybeProductType?: ProductType | string,
  ): Promise<{ buffer: Buffer; organizationName: string; resolvedType?: ProductType }> {
    let organizationId: string | undefined;
    let productType: ProductType | string | undefined;
    let search: string | undefined;
    let lowStock: boolean | string | undefined;

    if (typeof organizationIdOrOptions === 'object' && organizationIdOrOptions !== null) {
      organizationId = organizationIdOrOptions.organizationId;
      productType = organizationIdOrOptions.productType;
      search = organizationIdOrOptions.search;
      lowStock = organizationIdOrOptions.lowStock;
    } else {
      organizationId = organizationIdOrOptions;
      productType = maybeProductType;
    }

    const cleanOrgId =
      organizationId && organizationId !== 'undefined' && organizationId !== 'null'
        ? organizationId
        : undefined;

    let orgName = 'Barcha Tashkilotlar';
    if (cleanOrgId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: cleanOrgId },
        select: { id: true, name: true, code: true },
      });
      orgName = organization ? organization.name : 'Boshqarma';
    }

    let resolvedProductType: ProductType | undefined = undefined;
    if (productType) {
      const upper = String(productType).toUpperCase().trim();
      if (
        upper === ProductType.BERILADIGAN ||
        upper === 'ASSET' ||
        upper === 'ASOSIY_VOSITA' ||
        upper === 'JIHOZ'
      ) {
        resolvedProductType = ProductType.BERILADIGAN;
      } else if (
        upper === ProductType.SARFLANADIGAN ||
        upper === 'CONSUMABLE' ||
        upper === 'TMZ' ||
        upper === 'SARFLANADIGAN_MATERIAL'
      ) {
        resolvedProductType = ProductType.SARFLANADIGAN;
      }
    }

    const orgFilter = cleanOrgId ? { organizationId: cleanOrgId } : {};
    const typeFilter = resolvedProductType ? { productType: resolvedProductType } : {};
    const searchTrim = search && typeof search === 'string' ? search.trim() : undefined;
    const searchFilter = searchTrim
      ? {
          OR: [
            { name: { contains: searchTrim, mode: 'insensitive' as const } },
            { description: { contains: searchTrim, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const shouldIncludeAssets =
      cleanOrgId !== undefined && resolvedProductType !== ProductType.SARFLANADIGAN;

    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...orgFilter,
        ...typeFilter,
        ...searchFilter,
      },
      select: {
        id: true,
        name: true,
        productType: true,
        unit: true,
        description: true,
        organization: { select: { name: true, code: true } },
        inventory: {
          select: {
            quantity: true,
            unitPrice: true,
            minLevel: true,
            totalValue: true,
          },
        },
        departmentAssets: {
          select: { quantity: true },
        },
        _count: {
          select: {
            assets: {
              where: {
                deletedAt: null,
                ...(cleanOrgId ? { organizationId: cleanOrgId } : {}),
                assignments: { some: { returnedAt: null } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let filteredProducts = products;

    const isLowStockOnly = lowStock === true || lowStock === 'true' || lowStock === '1';
    if (isLowStockOnly) {
      filteredProducts = filteredProducts.filter((p) => {
        const qty = p.inventory?.quantity ?? 0;
        const minLevel = p.inventory?.minLevel ?? 0;
        return qty <= minLevel;
      });
    }

    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];
    passThrough.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: passThrough,
      useStyles: true,
    });
    workbook.creator = 'Ombor Boshqaruv Tizimi';

    let sheetTitle = 'Ombor Qoldiqlari';
    if (resolvedProductType === ProductType.BERILADIGAN) {
      sheetTitle = 'Asosiy vositalar';
    } else if (resolvedProductType === ProductType.SARFLANADIGAN) {
      sheetTitle = 'TMZ';
    }
    const worksheet = workbook.addWorksheet(sheetTitle, {
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Tashkilot / Boshqarma', key: 'organization', width: 34 },
      { header: 'Mahsulot nomi', key: 'name', width: 38 },
      { header: 'Turi', key: 'type', width: 22 },
      { header: 'O‘lchov birligi', key: 'unit', width: 14 },
      { header: 'Ombordagi qoldiq', key: 'warehouseQty', width: 18 },
      { header: 'Biriktirilgan / Bo‘limlarda', key: 'assignedQty', width: 24 },
      { header: 'Jami qoldiq', key: 'totalQty', width: 16 },
      { header: 'Birlik narxi (so‘m)', key: 'price', width: 18 },
      { header: 'Jami qiymati (so‘m)', key: 'totalValue', width: 20 },
      { header: 'Minimal chegara', key: 'minLevel', width: 16 },
      { header: 'Holati', key: 'status', width: 18 },
      { header: 'Tavsif', key: 'desc', width: 30 },
    ];

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerAlign: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' };

    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = headerAlign;
    });
    headerRow.commit();

    const rowAlignment: Partial<ExcelJS.Alignment> = { vertical: 'middle' };
    let rowIdx = 1;
    for (const product of filteredProducts) {
      const currentOrgName = product.organization?.name || orgName;
      const isAsset = product.productType === ProductType.BERILADIGAN;
      const typeText = isAsset ? 'Jihoz (Asosiy vosita)' : 'TMZ (Sarflanadigan)';
      const unitText = product.unit || 'dona';
      const minLevel = product.inventory?.minLevel ?? 0;
      const descText = product.description || '';

      const warehouseQty = product.inventory?.quantity ?? 0;
      const assignedQty = isAsset
        ? (product._count?.assets ?? 0)
        : product.departmentAssets.reduce((sum, da) => sum + da.quantity, 0);
      const totalQty = warehouseQty + assignedQty;

      const unitPrice = product.inventory?.unitPrice ? Number(product.inventory.unitPrice) : 0;
      const totalVal = product.inventory?.totalValue
        ? Number(product.inventory.totalValue)
        : totalQty * unitPrice;

      let statusText = 'Yetarli';
      if (warehouseQty === 0) {
        statusText = 'Tugagan';
      } else if (warehouseQty <= minLevel) {
        statusText = 'Kam qolgan';
      }

      const row = worksheet.addRow([
        rowIdx++,
        currentOrgName,
        product.name,
        typeText,
        unitText,
        warehouseQty,
        assignedQty,
        totalQty,
        unitPrice,
        totalVal,
        minLevel,
        statusText,
        descText,
      ]);
      row.height = 20;
      row.alignment = rowAlignment;
      row.commit();
    }

    worksheet.commit();
    await workbook.commit();

    const buffer = Buffer.concat(chunks);
    return {
      buffer,
      organizationName: orgName,
      resolvedType: resolvedProductType,
    };
  }

  parseUnitType(rawUnit?: string, productName?: string): UnitType {
    if (productName) {
      const p = productName.toLowerCase();
      // Ko'chmas mulk, xonadon, bino, inshootlar har doim DONA hisoblanadi
      if (p.includes('хонадон') || p.includes('xonadon') || p.includes('квартира') || p.includes('бино') || p.includes('bino')) {
        return UnitType.DONA;
      }
    }
    if (!rawUnit) return UnitType.DONA;
    const u = String(rawUnit).toLowerCase().trim();
    if (u.includes('pachka') || u.includes('пачка') || u.includes('упаковка') || u.includes('quti') || u.includes('korobka')) {
      return UnitType.PACHKA;
    }
    if (u.includes('komplekt') || u.includes('комплект') || u.includes('juft') || u.includes('nabor') || u.includes('набор')) {
      return UnitType.KOMPLEKT;
    }
    if (u.includes('litr') || u.includes('литр') || u.includes('л')) {
      return UnitType.LITR;
    }
    if (u.includes('kg') || u.includes('кг') || u.includes('kilo')) {
      return UnitType.KG;
    }
    if (u.includes('metr') || u.includes('метр') || u.includes('м')) {
      return UnitType.METR;
    }
    return UnitType.DONA;
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
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xlsm fayl kiriting.");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    if (!rows || rows.length < 2) {
      throw new BadRequestException("Excel faylida yetarli ma'lumot topilmadi");
    }

    // Fayl turini avtomatik aniqlash (UzASBO OS, UzASBO TMZ yoki standart shablon)
    const headerSlice = rows.slice(0, 10).map((r) => (Array.isArray(r) ? r.join(' ') : '')).join(' ').toLowerCase();
    const isUzasboOs =
      headerSlice.includes('оборотная ведомость ос') ||
      (headerSlice.includes('инвентар') && headerSlice.includes('основных средств'));
    const isUzasboTmz =
      !isUzasboOs &&
      (headerSlice.includes('оборотная ведомость тмз') ||
        (headerSlice.includes('тмз тип') && headerSlice.includes('материалы')));

    let itemsToProcess: Array<{
      name: string;
      productType: ProductType;
      unit: UnitType;
      qty: number;
      price: number;
      invNumber?: string;
      oldInvNumber?: string;
      serialNumber?: string;
      minLevel?: number;
      notes?: string;
    }> = [];

    if (isUzasboOs) {
      // 1. UzASBO Asosiy vositalar (ОС) — 11-qatordan boshlab o'qish
      for (let i = 10; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !Array.isArray(r) || r.length === 0) continue;
        const c1 = String(r[0] || '').trim();
        const rawName = String(r[8] || '').trim();
        const inv = String(r[5] || '').trim();
        const oldInv = String(r[6] || '').trim();
        const rawUnit = String(r[9] || '').trim();
        const dept = String(r[3] || '').trim();
        const mol = String(r[2] || '').trim();

        if (
          !rawName ||
          c1.includes('Итого') ||
          c1.includes('Всего') ||
          rawName.includes('Итого') ||
          rawName.includes('Всего') ||
          rawName.includes('Исполнитель') ||
          rawName.includes('_____________')
        ) {
          continue;
        }

        const qty = parseFloat(String(r[16] != null ? r[16] : r[10] || '1').replace(',', '.')) || 1;
        if (qty <= 0) continue; // Balansda qolmagan jihozlar tashlab o'tiladi

        const price =
          parseFloat(
            String(r[17] != null ? r[17] : r[11] || '0')
              .replace(/[\s\u00a0]+/g, '')
              .replace(',', '.'),
          ) || 0;

        const noteParts = [
          oldInv ? `Eski inv: ${oldInv}` : '',
          dept ? `Bo‘lim: ${dept}` : '',
          mol ? `M.O.L: ${mol}` : '',
        ].filter(Boolean);

        itemsToProcess.push({
          name: rawName,
          productType: ProductType.BERILADIGAN,
          unit: this.parseUnitType(rawUnit, rawName),
          qty,
          price,
          invNumber: inv || undefined,
          oldInvNumber: oldInv || undefined,
          notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
        });
      }
    } else if (isUzasboTmz) {
      // 2. UzASBO TMZ (Sarflanadigan materiallar) — 11-qatordan boshlab o'qish
      for (let i = 10; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !Array.isArray(r) || r.length === 0) continue;
        const c1 = String(r[0] || '').trim();
        const rawName = String(r[6] || '').trim();
        const code = String(r[7] || '').trim();
        const rawUnit = String(r[9] || '').trim();
        const dept = String(r[3] || '').trim();
        const mol = String(r[4] || '').trim();

        if (
          !rawName ||
          c1.includes('Итого') ||
          c1.includes('Всего') ||
          rawName.includes('Итого') ||
          rawName.includes('Всего') ||
          rawName.includes('Исполнитель') ||
          rawName.includes('_____________')
        ) {
          continue;
        }

        const qty = parseFloat(String(r[18] != null ? r[18] : r[12] || '0').replace(',', '.')) || 0;
        if (qty <= 0) continue; // Qoldiq 0 bo'lsa o'tkazib yuborish

        const price =
          parseFloat(
            String(r[10] || '0')
              .replace(/[\s\u00a0]+/g, '')
              .replace(',', '.'),
          ) || 0;

        const noteParts = [
          code ? `Kod: ${code}` : '',
          dept ? `Bo‘lim: ${dept}` : '',
          mol ? `M.O.L: ${mol}` : '',
        ].filter(Boolean);

        itemsToProcess.push({
          name: rawName,
          productType: ProductType.SARFLANADIGAN,
          unit: this.parseUnitType(rawUnit, rawName),
          qty,
          price,
          notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
        });
      }
    } else {
      // 3. Standart shablon (Sarlavha ustunlari bo'yicha dinamik aniqlash)
      let headerRowIdx = -1;
      let nameCol = -1, typeCol = -1, qtyCol = -1, invCol = -1, serialCol = -1, priceCol = -1, unitCol = -1, minCol = -1, locCol = -1, oldInvCol = -1;

      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').toLowerCase().trim();
          if ((val.includes('nomi') || val.includes('name') || val.includes('наименование')) && nameCol === -1) { nameCol = c; headerRowIdx = r; }
          if ((val.includes('turi') || val.includes('type') || val.includes('тип')) && typeCol === -1) typeCol = c;
          if ((val.includes('miqdor') || val.includes('soni') || val.includes('qty') || val.includes('кол')) && qtyCol === -1) qtyCol = c;
          if ((val.includes('eski') || val.includes('старый')) && oldInvCol === -1) oldInvCol = c;
          else if ((val.includes('inventar') || val.includes('inv') || val.includes('инвентар')) && invCol === -1) invCol = c;
          if ((val.includes('seriya') || val.includes('serial') || val.includes('сери')) && serialCol === -1) serialCol = c;
          if ((val.includes('narx') || val.includes('summa') || val.includes('price') || val.includes('цена')) && priceCol === -1) priceCol = c;
          if ((val.includes('birlik') || val.includes('unit') || val.includes('ед')) && unitCol === -1) unitCol = c;
          if ((val.includes('minimal') || val.includes('min')) && minCol === -1) minCol = c;
          if ((val.includes('joylashuv') || val.includes('location') || val.includes('место')) && locCol === -1) locCol = c;
        }
      }

      if (nameCol === -1) nameCol = 1;
      if (headerRowIdx === -1) headerRowIdx = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const rawName = String(row[nameCol] || '').trim();
        if (!rawName || rawName === '№' || rawName.toLowerCase().startsWith('jami')) continue;

        let pType = requestedProductType || ProductType.BERILADIGAN;
        if (!requestedProductType && typeCol !== -1 && row[typeCol]) {
          const tVal = String(row[typeCol]).toLowerCase();
          if (tVal.includes('sarflan') || tVal.includes('tmz') || tVal.includes('rashod')) {
            pType = ProductType.SARFLANADIGAN;
          }
        }

        const rawQtyNum = parseFloat(String(qtyCol !== -1 ? row[qtyCol] || '1' : '1').replace(',', '.')) || 1;
        const qty = Math.max(0.0001, Math.round(rawQtyNum * 10000) / 10000);
        const minLevel = minCol !== -1 && row[minCol] ? parseFloat(String(row[minCol]).replace(',', '.')) || 0 : 0;
        const unitPrice = priceCol !== -1 && row[priceCol] ? parseFloat(String(row[priceCol]).replace(/[\s\u00a0]+/g, '').replace(',', '.')) || 0 : 0;
        const invNumber = invCol !== -1 && row[invCol] ? String(row[invCol]).trim() : undefined;
        const oldInvNumber = oldInvCol !== -1 && row[oldInvCol] ? String(row[oldInvCol]).trim() : undefined;
        const serialNumber = serialCol !== -1 && row[serialCol] ? String(row[serialCol]).trim() : undefined;

        itemsToProcess.push({
          name: rawName,
          productType: pType as ProductType,
          unit: this.parseUnitType(unitCol !== -1 ? String(row[unitCol] || '') : ''),
          qty,
          price: unitPrice,
          invNumber,
          oldInvNumber,
          serialNumber,
          minLevel,
          notes: oldInvNumber ? `Eski inv: ${oldInvNumber}` : undefined,
        });
      }
    }

    if (itemsToProcess.length === 0) {
      throw new BadRequestException("Excel faylida kirim qilinadigan haqiqiy ma'lumot topilmadi");
    }

    // 4. Tezkor kirim qilish (Pre-caching orqali yuqori unumdorlik)
    const existingProducts = await this.prisma.product.findMany({
      where: { organizationId: performerOrgId, deletedAt: null },
      select: { id: true, name: true, productType: true },
    });
    const productMap = new Map<string, string>();
    existingProducts.forEach((p) => {
      productMap.set(`${p.name.toLowerCase().trim()}__${p.productType}`, p.id);
    });

    const existingAssets = await this.prisma.asset.findMany({
      where: { organizationId: performerOrgId, deletedAt: null },
      select: { inventoryNumber: true },
    });
    const existingInvSet = new Set<string>(existingAssets.map((a) => a.inventoryNumber));

    let createdCount = 0;
    let updatedCount = 0;
    let errors: string[] = [];
    const documentNumber = `IMP-${Date.now().toString().slice(-6)}`;

    for (let idx = 0; idx < itemsToProcess.length; idx++) {
      const item = itemsToProcess[idx];
      try {
        await this.prisma.$transaction(async (tx) => {
          const mapKey = `${item.name.toLowerCase().trim()}__${item.productType}`;
          let productId = productMap.get(mapKey);

          if (!productId) {
            const newProd = await tx.product.create({
              data: {
                name: item.name,
                productType: item.productType,
                unit: item.unit,
                organizationId: performerOrgId,
              },
            });
            productId = newProd.id;
            productMap.set(mapKey, productId);
            createdCount++;
          } else {
            updatedCount++;
          }

          // Ombor balansi (Inventory)
          const inv = await tx.inventory.findUnique({
            where: { productId },
          });

          if (!inv) {
            await tx.inventory.create({
              data: {
                productId,
                quantity: item.qty,
                minLevel: item.minLevel ?? 0,
                unitPrice: item.price > 0 ? item.price : undefined,
                totalValue: item.price > 0 ? item.price * item.qty : undefined,
              },
            });
          } else {
            await tx.inventory.update({
              where: { productId },
              data: {
                quantity: { increment: item.qty },
                ...(item.price > 0 ? { unitPrice: item.price } : {}),
                totalValue: { increment: item.price > 0 ? item.price * item.qty : 0 },
              },
            });
          }

          // Asosiy vositalar (Asset) yaratish
          if (item.productType === ProductType.BERILADIGAN) {
            if (item.invNumber) {
              if (!existingInvSet.has(item.invNumber)) {
                await tx.asset.create({
                  data: {
                    productId,
                    inventoryNumber: item.invNumber,
                    serialNumber: item.serialNumber || null,
                    purchasePrice: item.price > 0 ? item.price : null,
                    status: 'ACTIVE',
                    organizationId: performerOrgId,
                    notes: item.notes || null,
                  },
                });
                existingInvSet.add(item.invNumber);
              }
            } else {
              for (let q = 0; q < item.qty; q++) {
                const autoInv = `${Date.now().toString().slice(-6)}-${idx + 1}-${q + 1}`;
                if (!existingInvSet.has(autoInv)) {
                  await tx.asset.create({
                    data: {
                      productId,
                      inventoryNumber: autoInv,
                      purchasePrice: item.price > 0 ? item.price : null,
                      status: 'ACTIVE',
                      organizationId: performerOrgId,
                      notes: item.notes || null,
                    },
                  });
                  existingInvSet.add(autoInv);
                }
              }
            }
          }

          // STOCK_IN harakati
          await tx.operation.create({
            data: {
              type: 'STOCK_IN',
              quantity: item.qty,
              productId,
              performedById,
              documentNumber,
              note: item.notes ? `Excel import: ${item.notes}` : 'Excel import orqali kirim qilindi',
              organizationId: performerOrgId,
            },
          });
        });
      } catch (err: any) {
        errors.push(`Qator ${idx + 1} (${item.name}): ${err.message}`);
      }
    }

    const fileTypeName = isUzasboOs ? 'Asosiy vositalar' : isUzasboTmz ? 'TMZ (materiallar)' : 'Mahsulotlar';

    return {
      success: true,
      message: `${fileTypeName} muvaffaqiyatli kirim qilindi (${itemsToProcess.length} ta pozitsiya)`,
      createdCount,
      updatedCount,
      totalImported: itemsToProcess.length,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
      documentNumber,
    };
  }

    matchUserSmart(
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

    for (const u of users) {
      const uFull = u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      const uUser = u.username.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      if (uFull === cleanRaw || uUser === cleanRaw) return u;
      if (translit(uFull) === cleanLat || translit(uUser) === cleanLat) return u;
    }

    const inputWords = cleanLat.split(' ').filter(Boolean).sort().join(' ');
    for (const u of users) {
      const uFull = u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim();
      const uWords = translit(uFull).split(' ').filter(Boolean).sort().join(' ');
      if (inputWords === uWords && inputWords.length > 3) return u;
    }

    for (const u of users) {
      const uFullLat = translit(u.fullName.toLowerCase().replace(/[‘'`ʻʼ"“”,.]/g, '').replace(/[\s\-_]+/g, ' ').trim());
      const rawWords = cleanLat.split(' ').filter(Boolean);
      const uWords = uFullLat.split(' ').filter(Boolean);
      if (rawWords.length >= 2 && uWords.length >= 2) {
        if ((rawWords[0] === uWords[0] && rawWords[1] === uWords[1]) || (rawWords[0] === uWords[1] && rawWords[1] === uWords[0])) {
          return u;
        }
      }
    }

    return null;
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

    // UzASBO Oborotka fayllarini avtomatik importExcel ga yo'naltirish
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const firstRows: any[] = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });
    const fullHeader = firstRows.slice(0, 10).map((r) => (Array.isArray(r) ? r.join(' ') : '')).join(' ').toLowerCase();

    if (fullHeader.includes('оборотная ведомость ос') || (fullHeader.includes('инвентар') && fullHeader.includes('основных средств'))) {
      return this.importExcel(fileBuffer, performedById, ProductType.BERILADIGAN);
    }
    if (fullHeader.includes('оборотная ведомость тмз') || (fullHeader.includes('тмз тип') && fullHeader.includes('материалы'))) {
      return this.importExcel(fileBuffer, performedById, ProductType.SARFLANADIGAN);
    }

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

    // STEP 1: PARSE EMPLOYEES & DEPARTMENTS
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

    // STEP 2: PARSE FIXED ASSETS & AUTO-ASSIGN
    if (assetsSheetName && workbook.Sheets[assetsSheetName]) {
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[assetsSheetName], { header: 1 });
      if (rows && rows.length > 1) {
        let nameCol = -1, invCol = -1, serialCol = -1, priceCol = -1, unitCol = -1, assignCol = -1;
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
                  data: { productId: product.id, quantity: targetUserId ? 0 : 1, unitPrice },
                });
              } else if (!targetUserId) {
                inventory = await tx.inventory.update({
                  where: { productId: product.id },
                  data: {
                    quantity: { increment: 1 },
                    unitPrice: unitPrice > 0 ? unitPrice : inventory.unitPrice,
                  },
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
                    serialNumber,
                    purchasePrice: unitPrice,
                    status: 'ACTIVE',
                    organizationId: performerOrgId,
                  },
                });
                stats.assetsCreated++;
                stats.totalSumValue += unitPrice;
              }

              if (targetUserId) {
                const existingAssignment = await tx.assignment.findFirst({
                  where: { assetId: asset.id, returnedAt: null },
                });
                if (!existingAssignment) {
                  await tx.assignment.create({
                    data: {
                      userId: targetUserId,
                      assetId: asset.id,
                      assignedAt: new Date(),
                      status: 'ACCEPTED',
                    },
                  });
                  stats.assetsAssigned++;
                }
              } else {
                stats.assetsInStock++;
              }

              await tx.operation.create({
                data: {
                  type: 'STOCK_IN',
                  quantity: 1,
                  productId: product.id,
                  assetId: asset.id,
                  performedById,
                  documentNumber,
                  note: `Master Excel import (${assetsSheetName})`,
                  organizationId: performerOrgId,
                },
              });
            });
          } catch (e: any) {
            stats.errors.push(`Jihoz qatori ${i + 1} (${rawName}): ${e.message}`);
          }
        }
      }
    }

    // STEP 3: PARSE CONSUMABLES (TMZ)
    if (tmzSheetName && workbook.Sheets[tmzSheetName]) {
      const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[tmzSheetName], { header: 1 });
      if (rows && rows.length > 1) {
        let nameCol = -1, qtyCol = -1, unitCol = -1, priceCol = -1;
        let headerRow = 0;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').toLowerCase().trim();
            if ((v.includes('nomi') || v.includes('material') || v.includes('tmz') || v.includes('наименование')) && nameCol === -1) { nameCol = c; headerRow = r; }
            if ((v.includes('miqdor') || v.includes('soni') || v.includes('qty') || v.includes('кол')) && qtyCol === -1) qtyCol = c;
            if ((v.includes('birlik') || v.includes('unit') || v.includes('ед')) && unitCol === -1) unitCol = c;
            if ((v.includes('narx') || v.includes('summa') || v.includes('цена')) && priceCol === -1) priceCol = c;
          }
        }

        if (nameCol === -1) nameCol = 1;
        if (qtyCol === -1) qtyCol = 2;
        if (unitCol === -1) unitCol = 3;
        if (priceCol === -1) priceCol = 4;

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          const rawName = String(row[nameCol] || '').trim();
          if (!rawName || rawName === '№' || rawName.toLowerCase().startsWith('итого')) continue;

          const quantity = Math.max(1, parseInt(String(row[qtyCol] || '1'), 10) || 1);
          let priceStr = String(row[priceCol] || '0').replace(/[\s\u00a0]+/g, '').replace(',', '.');
          let unitPrice = parseFloat(priceStr) || 0;

          let unit: UnitType = UnitType.DONA;
          if (unitCol !== -1 && row[unitCol]) {
            const uVal = String(row[unitCol]).toLowerCase();
            if (uVal.includes('pachka') || uVal.includes('quti') || uVal.includes('flakon') || uVal.includes('kg') || uVal.includes('litr')) {
              unit = UnitType.PACHKA;
            } else if (uVal.includes('komplekt') || uVal.includes('juft') || uVal.includes('nabor')) {
              unit = UnitType.KOMPLEKT;
            }
          }

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

  async downloadTemplate(productType?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ombor Boshqaruv Tizimi';
    const worksheet = workbook.addWorksheet('Kirim Shablon');
    worksheet.views = [{ showGridLines: true }];

    const isBeriladigan = productType === 'BERILADIGAN' || productType === 'ASSET';
    const isSarflanadigan = productType === 'SARFLANADIGAN' || productType === 'TMZ';

    if (isBeriladigan) {
      worksheet.columns = [
        { header: '№', key: 'num', width: 6 },
        { header: 'Jihoz nomi *', key: 'name', width: 40 },
        { header: 'Inventar raqami *', key: 'inv', width: 25 },
        { header: 'Eski inventar raqami', key: 'oldInv', width: 22 },
        { header: 'Boshlang‘ich narxi (so‘m)', key: 'price', width: 22 },
        { header: 'O‘lchov birligi', key: 'unit', width: 16 },
        { header: 'Bo‘lim nomi (ixtiyoriy)', key: 'dept', width: 25 },
        { header: 'Moddiy javobgar shaxs (M.O.L.)', key: 'mol', width: 32 },
      ];
      worksheet.addRow([1, 'Monoblok HP Pavilion 27', '22122150000100', '0130600376', 9500000, 'DONA', 'Xo‘jalik ishlari', 'BEGIMQULOV AKRAM']);
      worksheet.addRow([2, 'Printer Canon i-SENSYS MF-237W', '22122230000011', '0130600405', 4670000, 'DONA', 'Xo‘jalik ishlari', 'BEGIMQULOV AKRAM']);
      worksheet.addRow([3, 'Kreslo ofis uchun', '22122230000051', '0131000382', 3150000, 'DONA', 'Sklad', '']);
    } else if (isSarflanadigan) {
      worksheet.columns = [
        { header: '№', key: 'num', width: 6 },
        { header: 'Material nomi *', key: 'name', width: 40 },
        { header: 'O‘lchov birligi', key: 'unit', width: 18 },
        { header: 'Ombordagi miqdori *', key: 'qty', width: 18 },
        { header: 'Birlik narxi (so‘m)', key: 'price', width: 20 },
        { header: 'Material kodi (ixtiyoriy)', key: 'code', width: 20 },
        { header: 'Minimal chegara (ogohlantirish)', key: 'min', width: 25 },
      ];
      worksheet.addRow([1, 'A4 qog‘oz SvetoCopy (500 varaq)', 'PACHKA', 100, 42000, '4252300', 20]);
      worksheet.addRow([2, 'дипенсер "Silver Water"', 'DONA', 5, 1000000, '4252300', 2]);
      worksheet.addRow([3, 'Табиий ичимлик суви газсиз 0.5л', 'DONA', 400, 3100, '4252300', 50]);
    } else {
      worksheet.columns = [
        { header: '№', key: 'num', width: 6 },
        { header: 'Mahsulot / Jihoz nomi *', key: 'name', width: 40 },
        { header: 'Turi (BERILADIGAN / SARFLANADIGAN) *', key: 'type', width: 30 },
        { header: 'Miqdori *', key: 'qty', width: 12 },
        { header: 'Inventar raqami (Asosiy vosita uchun)', key: 'inv', width: 30 },
        { header: 'Eski inventar raqami', key: 'oldInv', width: 22 },
        { header: 'Narxi (so‘m)', key: 'price', width: 18 },
        { header: 'O‘lchov birligi (DONA/PACHKA/KOMPLEKT/LITR/KG/METR)', key: 'unit', width: 32 },
        { header: 'Bo‘lim nomi (ixtiyoriy)', key: 'dept', width: 25 },
      ];
      worksheet.addRow([1, 'Monoblok HP 27', 'BERILADIGAN', 1, '22122150000100', '0130600376', 8500000, 'DONA', 'Sklad']);
      worksheet.addRow([2, 'A4 qog‘oz SvetoCopy', 'SARFLANADIGAN', 50, '', '', 42000, 'PACHKA', 'Sklad']);
    }

    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async downloadMasterTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ombor Boshqaruv Tizimi';

    // 1. Sheet: Xodimlar
    const empSheet = workbook.addWorksheet('1. Xodimlar');
    empSheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'F.I.SH *', key: 'name', width: 35 },
      { header: 'Bo‘lim nomi *', key: 'dept', width: 30 },
      { header: 'Lavozim', key: 'pos', width: 25 },
      { header: 'Login (Username)', key: 'user', width: 20 },
      { header: 'Ichki telefon', key: 'intPhone', width: 15 },
      { header: 'Telefon raqam', key: 'phone', width: 20 },
      { header: 'Pasport seriya/raqam', key: 'pass', width: 22 },
      { header: 'PINFL (JSHSHIR)', key: 'pinfl', width: 20 },
      { header: 'Yashash manzili', key: 'addr', width: 35 },
    ];
    const empHeader = empSheet.getRow(1);
    empHeader.height = 28;
    empHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    empSheet.addRow([1, 'Karimov Alisher Saidjanovich', 'Raqamlashtirish boshqarmasi', 'Bosh mutaxassis', 'akarimov', '1024', '+998901234567', 'AA1234567', '30101901234567', 'Toshkent sh., Yunusobod tumani']);
    empSheet.addRow([2, 'Sobirov Jasur Bahodirovich', 'Buxgalteriya', 'Yetakchi hisobchi', 'jsobirov', '1055', '+998909876543', 'AB7654321', '30505881234567', 'Toshkent sh., Chilonzor tumani']);

    // 2. Sheet: Asosiy vositalar
    const assetSheet = workbook.addWorksheet('2. Asosiy vositalar');
    assetSheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Jihoz nomi *', key: 'name', width: 38 },
      { header: 'Inventar raqami *', key: 'inv', width: 25 },
      { header: 'Seriya raqami', key: 'serial', width: 22 },
      { header: 'Boshlang‘ich narxi (so‘m)', key: 'price', width: 22 },
      { header: 'O‘lchov birligi', key: 'unit', width: 16 },
      { header: 'Biriktirilgan xodim (F.I.SH / Login)', key: 'assign', width: 35 },
    ];
    const assetHeader = assetSheet.getRow(1);
    assetHeader.height = 28;
    assetHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    assetSheet.addRow([1, 'Monoblok HP Pavilion 27', '22122150000100', 'SN-HP001', 9500000, 'DONA', 'Karimov Alisher Saidjanovich']);
    assetSheet.addRow([2, 'Printer Canon i-SENSYS LBP226dw', '22122150000101', 'SN-CN002', 3800000, 'DONA', 'Sobirov Jasur']);
    assetSheet.addRow([3, 'Konditsioner Artel 18', '22122230000055', 'SN-ART99', 6200000, 'DONA', '']);

    // 3. Sheet: TMZ
    const tmzSheet = workbook.addWorksheet('3. TMZ (Sarflanadigan)');
    tmzSheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Material nomi *', key: 'name', width: 38 },
      { header: 'Miqdori *', key: 'qty', width: 14 },
      { header: 'O‘lchov birligi', key: 'unit', width: 18 },
      { header: 'Narxi (so‘m)', key: 'price', width: 20 },
    ];
    const tmzHeader = tmzSheet.getRow(1);
    tmzHeader.height = 28;
    tmzHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    tmzSheet.addRow([1, 'A4 qog‘oz Ballet Universal', 50, 'QUTI', 42000]);
    tmzSheet.addRow([2, 'Kasseta HP 05A (Konditsioner/Printer uchun)', 10, 'DONA', 180000]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
