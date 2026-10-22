import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import * as fs from 'fs';
import * as path from 'path';
import {
  CreateLimitExceptionDto,
  QueryLimitsListDto,
  QueryLimitStatusDto,
  SetMonthlyLimitDto,
  UpdateMonthlyLimitDto,
} from './dto';

@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Joriy yil-oy va boshlanish/tugash sanalarini hisoblash
   */
  /**
   * Davlat standarti bo'yicha choraklik (kvartal / 3 oylik) oraliq va yangilanish sanasini hisoblash:
   * I chorak:  01.01 - 31.03 (Yangilanish: 01.04)
   * II chorak: 01.04 - 30.06 (Yangilanish: 01.07)
   * III chorak: 01.07 - 30.09 (Yangilanish: 01.10)
   * IV chorak: 01.10 - 31.12 (Yangilanish: 01.01 keyingi yil)
   */
  private getQuarterRange(dateInput?: string | Date) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0..11

    const quarterIndex = Math.floor(month / 3) + 1; // 1, 2, 3, 4
    const startMonth = (quarterIndex - 1) * 3; // 0, 3, 6, 9
    const endMonth = startMonth + 2; // 2, 5, 8, 11

    const startOfQuarter = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const endOfQuarter = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);

    let nextResetDate: Date;
    if (quarterIndex === 4) {
      nextResetDate = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    } else {
      nextResetDate = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);
    }

    const quarterRoman = ['I', 'II', 'III', 'IV'][quarterIndex - 1];
    const quarterCode = `${year}-Q${quarterIndex}`;
    const quarterName = `${year}-yil ${quarterRoman} chorak (3 oylik)`;

    const monthNamesUz = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
    ];
    const periodRangeStr = `1-${monthNamesUz[startMonth]} – ${endOfQuarter.getDate()}-${monthNamesUz[endMonth]}`;

    return {
      startOfQuarter,
      endOfQuarter,
      nextResetDate,
      quarterCode,
      quarterName,
      periodRangeStr,
      quarterIndex,
      year,
      // Backward compatibility aliases
      startOfMonth: startOfQuarter,
      endOfMonth: endOfQuarter,
      yearMonth: quarterCode,
    };
  }

  private getMonthRange(dateInput?: string | Date) {
    return this.getQuarterRange(dateInput);
  }

  /**
   * Berilgan mahsulot va xodim/bo'lim uchun oylik limit holatini olish
   */
  async getLimitStatus(
    productId: string,
    organizationId: string | null,
    target: { userId?: string; departmentId?: string; date?: string | Date },
  ) {
    const { startOfMonth, endOfMonth, yearMonth } = this.getMonthRange(
      target.date,
    );

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, unit: true, packageSize: true, productType: true },
    });
    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi');
    }

    // 1. Shu obyekt uchun qo'llaniladigan faol limitni aniqlaymiz
    let activeLimit: any = null;

    if (target.userId) {
      // a) Avval xodimning shaxsiy limiti bormi?
      // Foydalanuvchi UUID si yagona bo'lganligi sababli, unga atalgan limit har doim topiladi
      activeLimit = await this.prisma.tmzMonthlyLimit.findFirst({
        where: {
          productId,
          userId: target.userId,
          isActive: true,
        },
        include: {
          product: true,
          department: true,
          user: true,
          createdBy: { select: { id: true, fullName: true, role: true } },
          updatedBy: { select: { id: true, fullName: true, role: true } },
        },
      });

      // b) Agar xodim shaxsiy limiti bo'lmasa, uning bo'limi uchun limit bormi?
      if (!activeLimit) {
        const user = await this.prisma.user.findUnique({
          where: { id: target.userId },
          select: { departmentId: true, organizationId: true },
        });
        if (user?.departmentId) {
          activeLimit = await this.prisma.tmzMonthlyLimit.findFirst({
            where: {
              productId,
              departmentId: user.departmentId,
              userId: null,
              isActive: true,
            },
            include: {
              product: true,
              department: true,
              user: true,
              createdBy: { select: { id: true, fullName: true, role: true } },
              updatedBy: { select: { id: true, fullName: true, role: true } },
            },
          });
        }
      }

      // c) Agar u ham bo'lmasa, tashkilot darajasidagi umumiy xodim limiti
      if (!activeLimit) {
        const user = await this.prisma.user.findUnique({
          where: { id: target.userId },
          select: { organizationId: true },
        });
        const targetOrg = organizationId || user?.organizationId || null;

        activeLimit = await this.prisma.tmzMonthlyLimit.findFirst({
          where: {
            productId,
            departmentId: null,
            userId: null,
            isActive: true,
            ...(targetOrg
              ? {
                  OR: [
                    { organizationId: targetOrg },
                    { organizationId: null },
                  ],
                }
              : {}),
          },
          include: {
            product: true,
            department: true,
            user: true,
            createdBy: { select: { id: true, fullName: true, role: true } },
            updatedBy: { select: { id: true, fullName: true, role: true } },
          },
        });
      }
    } else if (target.departmentId) {
      // Bo'lim limiti
      activeLimit = await this.prisma.tmzMonthlyLimit.findFirst({
        where: {
          productId,
          departmentId: target.departmentId,
          userId: null,
          isActive: true,
        },
        include: {
          product: true,
          department: true,
          user: true,
          createdBy: { select: { id: true, fullName: true, role: true } },
          updatedBy: { select: { id: true, fullName: true, role: true } },
        },
      });

      // Agar bo'lim uchun alohida limit bo'lmasa, umumiy tashkilot / vazirlik limiti
      if (!activeLimit) {
        const dept = await this.prisma.department.findUnique({
          where: { id: target.departmentId },
          select: { organizationId: true },
        });
        const targetOrg = organizationId || dept?.organizationId || null;

        activeLimit = await this.prisma.tmzMonthlyLimit.findFirst({
          where: {
            productId,
            departmentId: null,
            userId: null,
            isActive: true,
            ...(targetOrg
              ? {
                  OR: [
                    { organizationId: targetOrg },
                    { organizationId: null },
                  ],
                }
              : {}),
          },
          include: {
            product: true,
            department: true,
            user: true,
            createdBy: { select: { id: true, fullName: true, role: true } },
            updatedBy: { select: { id: true, fullName: true, role: true } },
          },
        });
      }
    }

    // Agar hech qanday limit belgilanmagan bo'lsa -> cheklov yo'q
    if (!activeLimit) {
      const qRange = this.getQuarterRange(target.date);
      return {
        hasLimit: false,
        limitId: null,
        productId,
        productName: product.name,
        unit: product.unit,
        packageSize: product.packageSize,
        baseLimit: null,
        totalExceptions: 0,
        totalAllowed: null,
        currentMonthSpent: 0,
        currentQuarterSpent: 0,
        remaining: null,
        yearMonth,
        periodCode: qRange.quarterCode,
        periodName: qRange.quarterName,
        periodRange: qRange.periodRangeStr,
        limitSetDate: null,
        nextResetDate: qRange.nextResetDate,
        exceptions: [],
      };
    }

    // 2. Ushbu oy uchun kiritilgan istisnolar (Vazir/Rahbariyat buyruqlari)
    const exceptionFilterConditions: any[] = [];
    if (activeLimit.userId) {
      exceptionFilterConditions.push({ userId: activeLimit.userId });
    } else if (target.userId) {
      exceptionFilterConditions.push({ userId: target.userId });
    }
    if (activeLimit.departmentId) {
      exceptionFilterConditions.push({ departmentId: activeLimit.departmentId });
    } else if (target.departmentId) {
      exceptionFilterConditions.push({ departmentId: target.departmentId });
    }
    if (activeLimit.id) {
      exceptionFilterConditions.push({ monthlyLimitId: activeLimit.id });
    }

    const exceptions = await this.prisma.tmzLimitException.findMany({
      where: {
        productId,
        yearMonth,
        ...(exceptionFilterConditions.length > 0
          ? { OR: exceptionFilterConditions }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalExceptions = Math.round(
      exceptions.reduce((sum, item) => sum + (item.additionalQuantity || 0), 0) * 10000,
    ) / 10000;

    const baseLimitQuantity = activeLimit.limitQuantity;
    const totalAllowed = Math.round((baseLimitQuantity + totalExceptions) * 10000) / 10000;

    // 3. Joriy oyda qancha sarflanganini hisoblash
    let currentMonthSpent = 0;

    if (activeLimit.userId) {
      // Aniq xodimga belgilangan shaxsiy limit
      const gives = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          userId: activeLimit.userId,
          type: 'GIVE_TO_USER',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const returns = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          userId: activeLimit.userId,
          type: 'RETURN_FROM_USER',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const netGiven = (gives._sum.quantity || 0) - (returns._sum.quantity || 0);
      currentMonthSpent = Math.max(0, Math.round(netGiven * 10000) / 10000);
    } else if (activeLimit.departmentId) {
      // Bo'lim limiti: bo'limga to'g'ridan-to'g'ri berilganlar (GIVE_TO_DEPT)
      // VA shu bo'lim xodimlariga berilganlar (GIVE_TO_USER) birgalikda hisoblanadi
      const deptGives = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          departmentId: activeLimit.departmentId,
          type: 'GIVE_TO_DEPT',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const deptReturns = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          departmentId: activeLimit.departmentId,
          type: 'RETURN_FROM_DEPT',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const userGives = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          user: { departmentId: activeLimit.departmentId },
          type: 'GIVE_TO_USER',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const userReturns = await this.prisma.operation.aggregate({
        _sum: { quantity: true },
        where: {
          productId,
          user: { departmentId: activeLimit.departmentId },
          type: 'RETURN_FROM_USER',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const totalGiven = (deptGives._sum.quantity || 0) + (userGives._sum.quantity || 0);
      const totalReturns = (deptReturns._sum.quantity || 0) + (userReturns._sum.quantity || 0);
      const netGiven = totalGiven - totalReturns;
      currentMonthSpent = Math.max(0, Math.round(netGiven * 10000) / 10000);
    } else {
      // Umumiy tashkilot/vazirlik me'yori
      if (target.userId) {
        const gives = await this.prisma.operation.aggregate({
          _sum: { quantity: true },
          where: {
            productId,
            userId: target.userId,
            type: 'GIVE_TO_USER',
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const returns = await this.prisma.operation.aggregate({
          _sum: { quantity: true },
          where: {
            productId,
            userId: target.userId,
            type: 'RETURN_FROM_USER',
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const netGiven = (gives._sum.quantity || 0) - (returns._sum.quantity || 0);
        currentMonthSpent = Math.max(0, Math.round(netGiven * 10000) / 10000);
      } else if (target.departmentId) {
        const gives = await this.prisma.operation.aggregate({
          _sum: { quantity: true },
          where: {
            productId,
            departmentId: target.departmentId,
            type: 'GIVE_TO_DEPT',
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const returns = await this.prisma.operation.aggregate({
          _sum: { quantity: true },
          where: {
            productId,
            departmentId: target.departmentId,
            type: 'RETURN_FROM_DEPT',
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const netGiven = (gives._sum.quantity || 0) - (returns._sum.quantity || 0);
        currentMonthSpent = Math.max(0, Math.round(netGiven * 10000) / 10000);
      }
    }

    const remaining = Math.max(0, Math.round((totalAllowed - currentMonthSpent) * 10000) / 10000);

    const qRange = this.getQuarterRange(target.date);
    return {
      hasLimit: true,
      limitId: activeLimit.id,
      productId,
      productName: product.name,
      unit: product.unit,
      packageSize: product.packageSize,
      baseLimit: baseLimitQuantity,
      fileUrl: activeLimit.fileUrl,
      fileName: activeLimit.fileName,
      totalExceptions,
      totalAllowed,
      currentMonthSpent,
      currentQuarterSpent: currentMonthSpent,
      remaining,
      yearMonth,
      periodCode: qRange.quarterCode,
      periodName: qRange.quarterName,
      periodRange: qRange.periodRangeStr,
      limitSetDate: activeLimit.createdAt,
      nextResetDate: qRange.nextResetDate,
      createdBy: activeLimit.createdBy,
      updatedBy: activeLimit.updatedBy,
      createdAt: activeLimit.createdAt,
      updatedAt: activeLimit.updatedAt,
      latestDecree: activeLimit.fileUrl
        ? {
            fileUrl: activeLimit.fileUrl,
            fileName: activeLimit.fileName,
            documentNumber: activeLimit.decreeReference,
            createdAt: activeLimit.updatedAt,
            createdBy: activeLimit.updatedBy || activeLimit.createdBy,
          }
        : null,
      exceptions,
    };
  }

  /**
   * Omborchi TMZ berayotganda limitdan oshib ketmaganligini tekshiradi.
   * Agar oshsa, rasmiy ogohlantirish va bloklovchi xatolik tashlaydi.
   */
  async checkLimitOrThrow(
    productId: string,
    quantityToGive: number,
    organizationId: string | null,
    target: { userId?: string; departmentId?: string },
  ) {
    const status = await this.getLimitStatus(productId, organizationId, target);
    if (!status.hasLimit) {
      return; // Cheklov yo'q
    }

    const cleanQty = Math.round(quantityToGive * 10000) / 10000;
    if (cleanQty > (status.remaining ?? 0)) {
      const nextResetStr = status.nextResetDate
        ? new Date(status.nextResetDate).toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'keyingi chorak boshida';

      throw new BadRequestException({
        statusCode: 400,
        errorCode: 'OVER_MONTHLY_LIMIT',
        message: `Choraklik meʼyor cheklovi! ${status.periodName} (${status.periodRange}) uchun belgilangan 3 oylik limit: ${status.totalAllowed} ${status.unit || 'dona'}. Shu chorakda olingan: ${status.currentQuarterSpent || status.currentMonthSpent}. Qolgan ruxsat etilgan limit: ${status.remaining}. Berilayotgan miqdor (${cleanQty}) 3 oylik meʼyordan oshib ketmoqda. Yangi limit ${nextResetStr}da ochiladi!`,
        limitStatus: status,
        requestedQuantity: cleanQty,
      });
    }
  }

  /**
   * Asosiy oylik limitni o'rnatish
   */
  async setMonthlyLimit(
    dto: SetMonthlyLimitDto,
    performer: { id: string; organizationId: string | null; role: string },
    isSuper: boolean,
  ) {
    const targetOrgId = dto.userId
      ? (await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { organizationId: true } }))?.organizationId ?? (isSuper ? null : performer.organizationId)
      : dto.departmentId
        ? (await this.prisma.department.findUnique({ where: { id: dto.departmentId }, select: { organizationId: true } }))?.organizationId ?? (isSuper ? null : performer.organizationId)
        : (isSuper ? null : performer.organizationId);

    const existing = await this.prisma.tmzMonthlyLimit.findFirst({
      where: {
        productId: dto.productId,
        departmentId: dto.departmentId || null,
        userId: dto.userId || null,
      },
    });

    const newQty = Math.round(dto.limitQuantity * 10000) / 10000;

    if (existing) {
      const prevQty = existing.limitQuantity;
      const updated = await this.prisma.tmzMonthlyLimit.update({
        where: { id: existing.id },
        data: {
          limitQuantity: newQty,
          decreeReference: dto.decreeReference || existing.decreeReference,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
        include: {
          product: true,
          department: true,
          user: true,
          createdBy: { select: { id: true, fullName: true, role: true } },
          updatedBy: { select: { id: true, fullName: true, role: true } },
        },
      });

      return updated;
    }

    const created = await this.prisma.tmzMonthlyLimit.create({
      data: {
        organizationId: targetOrgId,
        productId: dto.productId,
        departmentId: dto.departmentId || null,
        userId: dto.userId || null,
        limitQuantity: newQty,
        decreeReference: dto.decreeReference,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        createdById: performer.id,
      },
      include: {
        product: true,
        department: true,
        user: true,
        createdBy: { select: { id: true, fullName: true, role: true } },
        updatedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    return created;
  }

  /**
   * Oylik me'yorni tahrirlash (Buyruq fayli yuklash bilan)
   */
  async updateMonthlyLimit(
    id: string,
    dto: UpdateMonthlyLimitDto,
    file: any,
    performer: { id: string; organizationId: string | null; role: string },
    isSuper: boolean,
  ) {
    const existing = await this.prisma.tmzMonthlyLimit.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Oylik meʼyor topilmadi");
    }

    if (!isSuper && performer.organizationId && existing.organizationId && existing.organizationId !== performer.organizationId) {
      throw new BadRequestException("Ushbu meʼyorni tahrirlash huquqingiz yo‘q!");
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (file && file.buffer) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'decrees');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeExt = path.extname(file.originalname) || '.pdf';
      const storedFileName = `decree-edit-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
      const filePath = path.join(uploadDir, storedFileName);

      fs.writeFileSync(filePath, file.buffer);
      fileUrl = `/api/v1/limits/decrees/${storedFileName}`;
      fileName = file.originalname;
    }

    const newQty = Math.round(Number(dto.limitQuantity) * 10000) / 10000;
    const prevQty = existing.limitQuantity;

    const updated = await this.prisma.tmzMonthlyLimit.update({
      where: { id },
      data: {
        limitQuantity: newQty,
        fileUrl: fileUrl || existing.fileUrl,
        fileName: fileName || existing.fileName,
        updatedById: performer.id,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
      include: {
        product: true,
        department: true,
        user: true,
        createdBy: { select: { id: true, fullName: true, role: true } },
        updatedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    return {
      message: `Oylik meʼyor muvaffaqiyatli tahrirlandi (${prevQty} -> ${newQty})`,
      updated,
    };
  }

  /**
   * Vazir / Rahbariyat buyrug'i bilan limitni oshirish (Fayl yuklash bilan)
   */
  async addLimitException(
    dto: CreateLimitExceptionDto,
    file: any,
    performer: { id: string; organizationId: string | null; role: string },
  ) {
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (file && file.buffer) {
      const uploadDir = path.join(process.cwd(), 'uploads', 'decrees');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeExt = path.extname(file.originalname) || '.pdf';
      const storedFileName = `decree-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
      const filePath = path.join(uploadDir, storedFileName);

      fs.writeFileSync(filePath, file.buffer);
      fileUrl = `/api/v1/limits/decrees/${storedFileName}`;
      fileName = file.originalname;
    }

    const { yearMonth } = this.getMonthRange();
    const targetYearMonth = dto.yearMonth || yearMonth;

    const additionalQty = Math.round(Number(dto.additionalQuantity) * 10000) / 10000;
    if (additionalQty <= 0) {
      throw new BadRequestException('Qo‘shimcha beriladigan miqdor 0 dan katta bo‘lishi shart!');
    }

    const docNumber = dto.documentNumber?.trim() || (fileName ? fileName : 'Vazir buyrug‘i');

    // Agar oylik limit yozuvi ID ko'rsatilmagan bo'lsa, mavjud bo'lganini qidirib biriktiramiz
    let monthlyLimitId = dto.monthlyLimitId;
    if (!monthlyLimitId) {
      const active = await this.prisma.tmzMonthlyLimit.findFirst({
        where: {
          productId: dto.productId,
          departmentId: dto.departmentId || null,
          userId: dto.userId || null,
          ...(performer.organizationId ? { organizationId: performer.organizationId } : {}),
        },
      });
      if (active) {
        monthlyLimitId = active.id;
      }
    }

    const exception = await this.prisma.tmzLimitException.create({
      data: {
        organizationId: performer.organizationId,
        productId: dto.productId,
        departmentId: dto.departmentId || null,
        userId: dto.userId || null,
        monthlyLimitId: monthlyLimitId || null,
        yearMonth: targetYearMonth,
        additionalQuantity: additionalQty,
        documentNumber: docNumber,
        fileUrl,
        fileName,
        createdById: performer.id,
      },
      include: {
        product: true,
        department: true,
        user: true,
        createdBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Yangilangan statusni qaytaramiz
    const updatedStatus = await this.getLimitStatus(
      dto.productId,
      performer.organizationId,
      {
        userId: dto.userId,
        departmentId: dto.departmentId,
      },
    );

    return {
      message: `Vazir buyrug‘i asosida limit +${additionalQty} ga oshirildi`,
      exception,
      updatedStatus,
    };
  }

  /**
   * Barcha sozlangan me'yorlar ro'yxatini olish (Tarix va buyruqlar bilan)
   */
  async getLimits(
    query: QueryLimitsListDto,
    organizationId: string | null,
    isSuper: boolean,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (!isSuper && organizationId && !query.departmentId && !query.userId) {
      where.OR = [
        { organizationId },
        { organizationId: null },
      ];
    }
    if (query.search) {
      where.OR = [
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
        { department: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { decreeReference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.tmzMonthlyLimit.count({ where }),
      this.prisma.tmzMonthlyLimit.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, unit: true, packageSize: true, productType: true } },
          department: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, position: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
          updatedBy: { select: { id: true, fullName: true, role: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Har bir limit uchun joriy oydagi sarf va qo'shimcha buyruqlarni yuklaymiz
    const { yearMonth, startOfMonth, endOfMonth } = this.getMonthRange();

    const itemsWithUsage = await Promise.all(
      items.map(async (item) => {
        // Exceptionlar
        const exceptions = await this.prisma.tmzLimitException.findMany({
          where: {
            productId: item.productId,
            yearMonth,
            OR: [
              ...(item.userId ? [{ userId: item.userId }] : []),
              ...(item.departmentId ? [{ departmentId: item.departmentId }] : []),
              { monthlyLimitId: item.id },
            ],
          },
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const totalExceptions = Math.round(
          exceptions.reduce((sum, e) => sum + (e.additionalQuantity || 0), 0) * 10000,
        ) / 10000;
        const totalAllowed = Math.round((item.limitQuantity + totalExceptions) * 10000) / 10000;

        // Sarf
        let spent = 0;
        if (item.userId) {
          const gives = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              userId: item.userId,
              type: 'GIVE_TO_USER',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          const returns = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              userId: item.userId,
              type: 'RETURN_FROM_USER',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          spent = Math.max(0, Math.round(((gives._sum.quantity || 0) - (returns._sum.quantity || 0)) * 10000) / 10000);
        } else if (item.departmentId) {
          const deptGives = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              departmentId: item.departmentId,
              type: 'GIVE_TO_DEPT',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          const deptReturns = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              departmentId: item.departmentId,
              type: 'RETURN_FROM_DEPT',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });

          const userGives = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              user: { departmentId: item.departmentId },
              type: 'GIVE_TO_USER',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          const userReturns = await this.prisma.operation.aggregate({
            _sum: { quantity: true },
            where: {
              productId: item.productId,
              user: { departmentId: item.departmentId },
              type: 'RETURN_FROM_USER',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });

          const totalGiven = (deptGives._sum.quantity || 0) + (userGives._sum.quantity || 0);
          const totalReturns = (deptReturns._sum.quantity || 0) + (userReturns._sum.quantity || 0);
          spent = Math.max(0, Math.round((totalGiven - totalReturns) * 10000) / 10000);
        }

        const remaining = Math.max(0, Math.round((totalAllowed - spent) * 10000) / 10000);
        const latestDecree = item.fileUrl
          ? {
              fileUrl: item.fileUrl,
              fileName: item.fileName,
              documentNumber: item.decreeReference,
              createdAt: item.updatedAt,
              createdBy: item.updatedBy || item.createdBy,
            }
          : null;

        const qRange = this.getQuarterRange();
        return {
          ...item,
          currentMonth: yearMonth,
          periodCode: qRange.quarterCode,
          periodName: qRange.quarterName,
          periodRange: qRange.periodRangeStr,
          limitSetDate: item.createdAt,
          nextResetDate: qRange.nextResetDate,
          totalExceptions,
          totalAllowed,
          currentMonthSpent: spent,
          currentQuarterSpent: spent,
          remaining,
          latestDecree,
          exceptionsCount: exceptions.length,
          exceptions,
        };
      }),
    );

    return {
      data: itemsWithUsage,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Oylik limitni o'chirish
   */
  async deleteMonthlyLimit(
    id: string,
    performerOrgId: string | null,
    isSuper: boolean,
  ) {
    const existing = await this.prisma.tmzMonthlyLimit.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Meʼyor topilmadi');
    }

    if (!isSuper && performerOrgId && existing.organizationId && existing.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu meʼyorni o‘chirish huquqingiz yo‘q!');
    }

    await this.prisma.tmzMonthlyLimit.delete({
      where: { id },
    });

    return { message: 'Oylik meʼyor muvaffaqiyatli o‘chirildi' };
  }
}
