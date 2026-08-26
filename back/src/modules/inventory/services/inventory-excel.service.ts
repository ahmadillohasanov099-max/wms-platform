import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType, UnitType, UserRole } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InventoryExcelService {
  constructor(private prisma: PrismaService) {}

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

    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    if (!rows || rows.length < 2) {
      throw new BadRequestException("Excel faylida yetarli ma'lumot topilmadi");
    }

    let headerRowIdx = -1;
    let nameCol = -1, typeCol = -1, qtyCol = -1, invCol = -1, serialCol = -1, priceCol = -1, unitCol = -1, minCol = -1, locCol = -1;

    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if ((val.includes('nomi') || val.includes('name') || val.includes('наименование')) && nameCol === -1) { nameCol = c; headerRowIdx = r; }
        if ((val.includes('turi') || val.includes('type') || val.includes('тип')) && typeCol === -1) typeCol = c;
        if ((val.includes('miqdor') || val.includes('soni') || val.includes('qty') || val.includes('кол')) && qtyCol === -1) qtyCol = c;
        if ((val.includes('inventar') || val.includes('inv') || val.includes('инвентар')) && invCol === -1) invCol = c;
        if ((val.includes('seriya') || val.includes('serial') || val.includes('сери')) && serialCol === -1) serialCol = c;
        if ((val.includes('narx') || val.includes('summa') || val.includes('price') || val.includes('цена')) && priceCol === -1) priceCol = c;
        if ((val.includes('birlik') || val.includes('unit') || val.includes('ед')) && unitCol === -1) unitCol = c;
        if ((val.includes('minimal') || val.includes('min')) && minCol === -1) minCol = c;
        if ((val.includes('joylashuv') || val.includes('location') || val.includes('место')) && locCol === -1) locCol = c;
      }
    }

    if (nameCol === -1) nameCol = 1;
    if (headerRowIdx === -1) headerRowIdx = 0;
    if (typeCol === -1) typeCol = 2;
    if (qtyCol === -1) qtyCol = 3;
    if (invCol === -1) invCol = 4;
    if (serialCol === -1) serialCol = 5;
    if (priceCol === -1) priceCol = 6;
    if (unitCol === -1) unitCol = 7;
    if (minCol === -1) minCol = 8;
    if (locCol === -1) locCol = 9;

    let createdCount = 0;
    let updatedCount = 0;
    let errors: string[] = [];
    const documentNumber = `IMP-${Date.now().toString().slice(-6)}`;

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

      let unit: UnitType = UnitType.DONA;
      if (unitCol !== -1 && row[unitCol]) {
        const uVal = String(row[unitCol]).toLowerCase();
        if (uVal.includes('pachka') || uVal.includes('quti') || uVal.includes('korobka') || uVal.includes('kg') || uVal.includes('litr')) {
          unit = UnitType.PACHKA;
        } else if (uVal.includes('komplekt') || uVal.includes('juft') || uVal.includes('nabor')) {
          unit = UnitType.KOMPLEKT;
        }
      }

      const qty = Math.max(1, parseInt(String(row[qtyCol] || '1'), 10) || 1);
      const minLevel = minCol !== -1 && row[minCol] ? parseInt(String(row[minCol]), 10) || 5 : 5;
      const unitPrice = priceCol !== -1 && row[priceCol] ? parseFloat(String(row[priceCol]).replace(/[\s\u00a0]+/g, '').replace(',', '.')) || 0 : 0;
      const invNumber = invCol !== -1 && row[invCol] ? String(row[invCol]).trim() : undefined;
      const serialNumber = serialCol !== -1 && row[serialCol] ? String(row[serialCol]).trim() : undefined;

      try {
        await this.prisma.$transaction(async (tx) => {
          let product = await tx.product.findFirst({
            where: {
              name: rawName,
              productType: pType as ProductType,
              organizationId: performerOrgId,
              deletedAt: null,
            },
          });

          if (!product) {
            product = await tx.product.create({
              data: {
                name: rawName,
                productType: pType as ProductType,
                unit,
                organizationId: performerOrgId,
              },
            });
            createdCount++;
          } else {
            updatedCount++;
          }

          let inventory = await tx.inventory.findUnique({
            where: { productId: product.id },
          });

          if (!inventory) {
            inventory = await tx.inventory.create({
              data: {
                productId: product.id,
                quantity: qty,
                minLevel,
                unitPrice,
              },
            });
          } else {
            inventory = await tx.inventory.update({
              where: { productId: product.id },
              data: {
                quantity: { increment: qty },
                ...(unitPrice > 0 ? { unitPrice } : {}),
              },
            });
          }

          if (pType === ProductType.BERILADIGAN) {
            if (invNumber) {
              const existingAsset = await tx.asset.findFirst({
                where: {
                  inventoryNumber: invNumber,
                  organizationId: performerOrgId,
                  deletedAt: null,
                },
              });
              if (!existingAsset) {
                await tx.asset.create({
                  data: {
                    productId: product.id,
                    inventoryNumber: invNumber,
                    serialNumber: serialNumber || null,
                    purchasePrice: unitPrice > 0 ? unitPrice : null,
                    status: 'ACTIVE',
                    organizationId: performerOrgId,
                  },
                });
              }
            } else {
              for (let q = 0; q < qty; q++) {
                const autoInv = `${Date.now().toString().slice(-6)}-${i}-${q + 1}`;
                await tx.asset.create({
                  data: {
                    productId: product.id,
                    inventoryNumber: autoInv,
                    purchasePrice: unitPrice > 0 ? unitPrice : null,
                    status: 'ACTIVE',
                    organizationId: performerOrgId,
                  },
                });
              }
            }
          }

          await tx.operation.create({
            data: {
              type: 'STOCK_IN',
              quantity: qty,
              productId: product.id,
              performedById,
              documentNumber,
              note: `Excel import orqali kirim qilindi`,
              organizationId: performerOrgId,
            },
          });
        });
      } catch (err: any) {
        errors.push(`Qator ${i + 1} (${rawName}): ${err.message}`);
      }
    }

    return {
      success: true,
      message: "Excel import muvaffaqiyatli yakunlandi",
      createdCount,
      updatedCount,
      errorsCount: errors.length,
      errors,
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

    worksheet.columns = [
      { header: '№', key: 'num', width: 6 },
      { header: 'Mahsulot nomi *', key: 'name', width: 35 },
      { header: 'Turi (BERILADIGAN / SARFLANADIGAN)', key: 'type', width: 30 },
      { header: 'Miqdor *', key: 'qty', width: 12 },
      { header: 'Inventar raqami (Asosiy vosita uchun)', key: 'inv', width: 30 },
      { header: 'Seriya raqami (ixtiyoriy)', key: 'serial', width: 25 },
      { header: 'Narxi (so‘m)', key: 'price', width: 18 },
      { header: 'O‘lchov birligi (DONA/KG/LITR/METR/QUTI/JUFT/KOMPLEKT)', key: 'unit', width: 30 },
      { header: 'Minimal chegara (ogohlantirish uchun)', key: 'min', width: 25 },
      { header: 'Joylashuv (Javon/Xona)', key: 'loc', width: 25 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const isBeriladigan = productType === 'BERILADIGAN';
    const isSarflanadigan = productType === 'SARFLANADIGAN';

    if (isBeriladigan || !productType) {
      worksheet.addRow([1, 'Monoblok HP 27', 'BERILADIGAN', 1, '221221500001', 'SN-HP982341', 8500000, 'DONA', 2, 'A-1 javon']);
      worksheet.addRow([2, 'Ofis kreslosi "Prezident"', 'BERILADIGAN', 1, '221222300005', '', 1200000, 'DONA', 3, 'B-2 qator']);
    }

    if (isSarflanadigan || !productType) {
      worksheet.addRow([3, 'A4 qog‘oz SvetoCopy (500 varaq)', 'SARFLANADIGAN', 20, '', '', 45000, 'QUTI', 10, 'Ombor-1']);
      worksheet.addRow([4, 'Ruchka ko‘k sharikli', 'SARFLANADIGAN', 100, '', '', 3000, 'DONA', 20, 'Kantselyariya']);
    }

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
