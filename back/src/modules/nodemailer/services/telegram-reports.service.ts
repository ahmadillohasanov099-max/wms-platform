import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { TelegramSenderService, STAFF_ROLES, serverLogBuffer } from './telegram-sender.service';

@Injectable()
export class TelegramReportsService {
  private readonly logger = new Logger(TelegramReportsService.name);

  constructor(
    private prisma: PrismaService,
    private sender: TelegramSenderService,
  ) {}

  buildPaginationKeyboard(prefix: string, page: number, totalPages: number, extra = '') {
    if (totalPages <= 1) return undefined;
    const buttons: any[] = [];
    if (page > 1) {
      buttons.push({ text: '◀️ Oldingi', callback_data: `${prefix}_page_${page - 1}${extra}` });
    }
    buttons.push({ text: `📄 ${page}/${totalPages}`, callback_data: `${prefix}_page_${page}${extra}` });
    if (page < totalPages) {
      buttons.push({ text: 'Keyingi ➡️', callback_data: `${prefix}_page_${page + 1}${extra}` });
    }
    return { inline_keyboard: [buttons] };
  }

  async sendAccessDenied(chatId: string) {
    await this.sender.sendMessage(
      `⛔ <b>Ruxsat etilmadi!</b>\n\n` +
      `Kechirasiz, ushbu ma'lumotlar va bo'lim faqat omborchi hamda mas'ul xodimlar uchun ochiq.\n` +
      `Siz "📱 Mening Jihozlarim" yoki "🏢 Mening Bo'limim" imkoniyatlaridan foydalanishingiz mumkin.`,
      chatId,
    );
  }

  async sendStatusReport(chatId: string) {
    try {
      const [prod, users, depts, activeAssets] = await Promise.all([
        this.prisma.product.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.department.count({ where: { deletedAt: null } }),
        this.prisma.assignment.count({ where: { returnedAt: null } }),
      ]);

      const text =
        `📊 <b>TIZIM UMUMIY STATISTIKASI</b>\n\n` +
        `📦 Barcha mahsulotlar: <b>${prod} ta tur</b>\n` +
        `👥 Faol xodimlar: <b>${users} ta</b>\n` +
        `🏢 Bo'limlar soni: <b>${depts} ta</b>\n` +
        `💻 Biriktirilgan jihozlar: <b>${activeAssets} ta</b>\n` +
        `🟢 Tizim holati: <b>Faol (OK)</b>\n\n` +
        `📥 <i>Excel hisobot yuklash: <code>/stats_export</code></i>`;

      await this.sender.sendMessage(text, chatId);
    } catch (err) {
      await this.sender.sendMessage('❌ Xatolik yuz berdi.', chatId);
    }
  }

  async sendStockReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.inventory.count({
        where: { product: { deletedAt: null } },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage('📦 Omborda mahsulotlar topilmadi.', chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const items = await this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
        include: { product: { select: { name: true, unit: true } } },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        orderBy: { quantity: 'desc' },
      });

      let text = `📦 <b>OMBORDAGI QOLDIQLAR</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      items.forEach((item, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        const isLow = item.quantity <= item.minLevel;
        const statusIcon = isLow ? '⚠️' : '🔹';
        text += `${statusIcon} <b>${index}. ${item.product.name}</b>\n` +
          `   📦 Qoldiq: <b>${item.quantity} ${item.product.unit || 'ta'}</b> (Min: ${item.minLevel})\n\n`;
      });
      text += `📥 <i>Excel yuklash: <code>/stock_export</code></i>`;

      const keyboard = this.buildPaginationKeyboard('cb_stock', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Qoldiqlarni olishda xatolik.', chatId);
    }
  }

  async sendUsersReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.user.count({
        where: { deletedAt: null, isActive: true },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage('👥 Faol xodimlar topilmadi.', chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          fullName: true,
          position: true,
          role: true,
          department: { select: { name: true } },
          assignments: {
            where: { returnedAt: null },
            select: { asset: { select: { product: { select: { name: true } } } } },
          },
        },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        orderBy: { fullName: 'asc' },
      });

      let text = `👥 <b>XODIMLAR RO'YXATI</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      users.forEach((u, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        const assetsCount = u.assignments.length;
        text += `🔹 <b>${index}. ${u.fullName}</b>\n` +
          `   💼 Lavozimi: <i>${u.position || u.role}</i>\n` +
          `   🏢 Bo'limi: ${u.department?.name || 'Bo\'limsiz'}\n` +
          `   📦 Biriktirilgan jihozlar: <b>${assetsCount} ta</b>\n\n`;
      });
      text += `📥 <i>Excel yuklash: <code>/users_export</code></i>`;

      const keyboard = this.buildPaginationKeyboard('cb_users', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Xodimlarni olishda xatolik.', chatId);
    }
  }

  async sendLowStockReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const allItems = await this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
        include: { product: { select: { name: true, unit: true } } },
      });

      const lowItems = allItems.filter((i) => i.quantity <= i.minLevel);

      if (lowItems.length === 0) {
        await this.sender.sendMessage('✅ Barcha mahsulotlar zaxirasi yetarli darajada!', chatId);
        return;
      }

      const totalCount = lowItems.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));
      const pagedLow = lowItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      let text = `⚠️ <b>KAMAYIB KETGAN TOVARLAR</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      pagedLow.forEach((item, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        text += `🔴 <b>${index}. ${item.product.name}</b>\n` +
          `   🔻 Joriy qoldiq: <b>${item.quantity} ${item.product.unit || 'ta'}</b> (Minimal chegara: ${item.minLevel})\n\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_lowstock', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Xatolik yuz berdi.', chatId);
    }
  }

  async sendRecentOperations(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.operation.count();

      if (totalCount === 0) {
        await this.sender.sendMessage('📜 Operatsiyalar tarixi bo\'sh.', chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const ops = await this.prisma.operation.findMany({
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true } },
          performedBy: { select: { fullName: true } },
        },
      });

      let text = `📜 <b>OXIRGI OPERATSIYALAR</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      ops.forEach((op, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        const typeLabel =
          op.type === 'STOCK_IN' ? '📥 Kirim qilindi' :
          op.type === 'GIVE_TO_USER' ? '📤 Xodimga berildi' :
          op.type === 'RETURN_FROM_USER' ? '↩️ Omborga qaytarildi' : '📋 Operatsiya';

        text += `🔹 <b>${index}. ${typeLabel}</b>\n` +
          `   📦 Mahsulot: <b>${op.product?.name || 'Mahsulot'}</b> (${op.quantity} ta)\n` +
          `   👨‍💼 Mas'ul: <i>${op.performedBy?.fullName || 'Tizim'}</i>\n\n`;
      });
      text += `📥 <i>Excel yuklash: <code>/recent_export</code></i>`;

      const keyboard = this.buildPaginationKeyboard('cb_recent', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Tarixni olishda xatolik.', chatId);
    }
  }

  async sendDepartmentsReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.department.count({ where: { deletedAt: null } });

      if (totalCount === 0) {
        await this.sender.sendMessage('🏢 Bo\'limlar topilmadi.', chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const depts = await this.prisma.department.findMany({
        where: { deletedAt: null },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { users: true } },
          assignments: { where: { returnedAt: null } },
        },
      });

      let text = `🏢 <b>BO'LIMLAR BO'YICHA JIHOZLAR</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      depts.forEach((d, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        text += `▪️ <b>${index}. ${d.name}</b>\n` +
          `   👥 Xodimlar: <b>${d._count.users} ta</b>  •  💻 Jihozlar: <b>${d.assignments.length} ta</b>\n\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_depts', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Bo\'limlarni olishda xatolik.', chatId);
    }
  }

  async sendOffboardingReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.user.count({
        where: {
          employmentStatus: 'OFFBOARDING_PENDING',
          deletedAt: null,
        },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage(`🚨 Hozirda ishdan bo'shatish (offboarding) jarayonidagi va jihozlarini topshirmagan xodimlar yo'q. ✅`, chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const offboardingUsers = await this.prisma.user.findMany({
        where: {
          employmentStatus: 'OFFBOARDING_PENDING',
          deletedAt: null,
        },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: {
          department: true,
          assignments: {
            where: { returnedAt: null },
            include: { asset: { include: { product: true } } },
          },
        },
      });

      let text = `🚨 <b>ISHDAN BO'SHATISH VA JIHOZLAR TOPSHIRISH NAZORATI</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;

      offboardingUsers.forEach((u, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        text += `🔴 <b>${index}. ${u.fullName}</b> (${u.department?.name || 'Bo\'limsiz'})\n` +
          `   💻 Qaytarilishi kerak bo'lgan jihozlar: <b>${u.assignments.length} ta</b>\n`;
        u.assignments.forEach((a) => {
          text += `      • ${a.asset?.product?.name} (Inv: <code>${a.asset?.inventoryNumber}</code>)\n`;
        });
        text += `\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_offboarding', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Offboarding ma\'lumotlarini olishda xatolik.', chatId);
    }
  }

  async sendMyAssets(chatId: string, boundUser: any, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.assignment.count({
        where: { userId: boundUser.id, returnedAt: null },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage(
          `📱 <b>${boundUser.fullName.toUpperCase()}</b>\n\n` +
          `Sizga hozirda biror bir active jihoz biriktirilmagan.`,
          chatId,
        );
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const activeAssignments = await this.prisma.assignment.findMany({
        where: { userId: boundUser.id, returnedAt: null },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: { asset: { include: { product: true } } },
      });

      let text = `📱 <b>${boundUser.fullName.toUpperCase()} — BIRIKTIRILGAN JIHOZLAR</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;

      activeAssignments.forEach((assign, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        const assetName = assign.asset?.product?.name || 'Jihoz';
        const invNumber = assign.asset?.inventoryNumber || 'Raqamsiz';
        const dateStr = assign.assignedAt ? new Date(assign.assignedAt).toLocaleDateString('uz-UZ') : '—';

        text += `🔹 <b>${index}. ${assetName}</b>\n` +
          `   🏷 Inv №: <code>${invNumber}</code>\n` +
          `   📅 Biriktirilgan sana: <i>${dateStr}</i>\n\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_myassets', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Shaxsiy jihozlarni olishda xatolik.', chatId);
    }
  }

  async searchProducts(query: string, chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.product.count({
        where: {
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage(`🔍 "<b>${query}</b>" bo'yicha hech narsa topilmadi.`, chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const products = await this.prisma.product.findMany({
        where: {
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
        include: { inventory: true },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      });

      let text = `🔍 <b>QIDIRUV NATIJALARI ("${query}")</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;
      products.forEach((p, i) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        text += `📦 <b>${index}. ${p.name}</b>\n` +
          `   Qoldiq: <b>${p.inventory?.quantity ?? 0} ${p.unit || 'ta'}</b>  •  Minimal: ${p.inventory?.minLevel ?? 0}\n\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_find', currentPage, totalPages, `:${query}`);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Qidiruvda xatolik.', chatId);
    }
  }

  async sendUserPersonalHistory(chatId: string, boundUser: any, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.operation.count({
        where: {
          OR: [
            { userId: boundUser.id },
            { fromUserId: boundUser.id },
          ],
        },
      });

      if (totalCount === 0) {
        await this.sender.sendMessage(`📜 <b>${boundUser.fullName.toUpperCase()}</b>\n\nSizda hali ombor operatsiyalari tarixi mavjud emas.`, chatId);
        return;
      }

      const totalPages = Math.ceil(totalCount / pageSize);
      const currentPage = Math.max(1, Math.min(page, totalPages));

      const ops = await this.prisma.operation.findMany({
        where: {
          OR: [
            { userId: boundUser.id },
            { fromUserId: boundUser.id },
          ],
        },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true } },
          asset: { select: { inventoryNumber: true } },
        },
      });

      let text = `📜 <b>${boundUser.fullName.toUpperCase()} — SHAXSIY OPERATSIYALAR TARIHI</b> (${currentPage}/${totalPages}-sahifa, jami ${totalCount} ta)\n\n`;

      ops.forEach((op: any, i: number) => {
        const index = (currentPage - 1) * pageSize + i + 1;
        const typeIcon = op.type === 'GIVE_TO_USER' ? '📥 Berilgan' : op.type === 'RETURN_FROM_USER' ? '↩️ Qaytarilgan' : '📋 Operatsiya';
        const invStr = op.asset?.inventoryNumber ? ` (Inv №: <code>${op.asset.inventoryNumber}</code>)` : '';
        const dateStr = new Date(op.createdAt).toLocaleDateString('uz-UZ');

        text += `🔹 <b>${index}. ${typeIcon}</b>\n` +
          `   📦 Mahsulot: <b>${op.product?.name || 'Mahsulot'}</b> (${op.quantity} ta)${invStr}\n` +
          `   📅 Sana: <i>${dateStr}</i>\n\n`;
      });

      const keyboard = this.buildPaginationKeyboard('cb_myhistory', currentPage, totalPages);
      if (keyboard) {
        await this.sender.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sender.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sender.sendMessage('❌ Shaxsiy tarixni olishda xatolik yuz berdi.', chatId);
    }
  }

  async sendUserMyDeptInfo(chatId: string, boundUser: any) {
    try {
      if (!boundUser.departmentId) {
        await this.sender.sendMessage(`🏢 Siz hali biror-bir bo'limga biriktirilmagansiz.`, chatId);
        return;
      }

      const dept = await this.prisma.department.findUnique({
        where: { id: boundUser.departmentId },
        include: {
          _count: { select: { users: true } },
          users: { select: { fullName: true, position: true } },
          assignments: { where: { returnedAt: null } },
        },
      });

      if (!dept) {
        await this.sender.sendMessage(`🏢 Bo'lim ma'lumotlari topilmadi.`, chatId);
        return;
      }

      let text = `🏢 <b>${dept.name.toUpperCase()} BO'LIMI</b>\n\n` +
        `👥 Hamkasblar soni: <b>${dept._count.users} ta xodim</b>\n` +
        `💻 Bo'limga biriktirilgan aktivlar: <b>${dept.assignments.length} ta</b>\n\n` +
        `📋 <b>Bo'lim xodimlari:</b>\n`;

      dept.users.forEach((u, i) => {
        text += `${i + 1}. <b>${u.fullName}</b> — <i>${u.position || 'Xodim'}</i>\n`;
      });

      await this.sender.sendMessage(text, chatId);
    } catch (err) {
      await this.sender.sendMessage('❌ Bo\'lim ma\'lumotlarini olishda xatolik.', chatId);
    }
  }

  async sendOrganizationContacts(chatId: string) {
    const text =
      `📞 <b>VAZIRLIK VA OMBORXONA MAS'ULLARI ALOQA MA'LUMOTLARI</b>\n\n` +
      `🏢 <b>O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi</b>\n\n` +
      `📦 <b>Omborxona va WMS Boshqarmasi:</b>\n` +
      `👨‍💼 Bosh Omborchi: <b>Urinbadalov Abdulaziz</b> (+998 71 200 00 00)\n` +
      `👩‍💼 Kadrlar Bo'limi: <b>Karimova Shahnoza</b>\n` +
      `💻 IT va Texnik Qo'llab-quvvatlash: <b>Hasanov Ahmadillo</b>\n\n` +
      `📍 <b>Manzil:</b> Toshkent shahri, Abay ko'chasi 6\n` +
      `🌐 <b>Veb-sayt:</b> http://localhost:5173`;

    await this.sender.sendMessage(text, chatId);
  }

  async sendUserHelpGuide(chatId: string, boundUser: any) {
    const isStaff = STAFF_ROLES.includes(boundUser.role);

    let text = `❓ <b>WMS TELEGRAM BOT QO'LLANMASI</b>\n\n`;

    if (isStaff) {
      text += `👑 <b>Mas'ul/Admin Buyruqlari:</b>\n` +
        `• <b>/stock</b> — Ombordagi joriy tovarlar qoldig'i (10 ta dan)\n` +
        `• <b>/users</b> — Xodimlar ro'yxati (10 ta dan)\n` +
        `• <b>/lowstock</b> — Zaxirasi tugab borayotgan tovarlar\n` +
        `• <b>/recent</b> — Kirim/chiqim operatsiyalari (10 ta dan)\n` +
        `• <b>/depts</b> — Bo'limlar kesimida jihozlar\n` +
        `• <b>/status</b> — Tizim statistikasi\n` +
        `• <b>/stock_export</b> — Ombor Excel faylini yuklab olish\n` +
        `• <b>/users_export</b> — Xodimlar Excel faylini yuklab olish\n` +
        `• <b>/recent_export</b> — Tarix Excel faylini yuklab olish\n` +
        `• <b>/stats_export</b> — Statistika Excel faylini yuklab olish\n` +
        `• <b>/offboarding</b> — Ishdan bo'shash nazorati\n` +
        `• <b>/logout</b> — Botdan chiqish`;
    } else {
      text += `👤 <b>Xodim Buyruqlari:</b>\n` +
        `• <b>/myassets</b> — Nomingizdagi biriktirilgan aktivlar\n` +
        `• <b>/myhistory</b> — Jihozlarni olish va omborga topshirish tarixi\n` +
        `• <b>/mydept</b> — Bo'limdagi hamkasblar va jihozlar\n` +
        `• <b>/murojaat</b> — Omborchiga murojaat yoki talabnoma yuborish\n` +
        `• <b>/contacts</b> — Omborchi va mas'ullar telefoni\n` +
        `• <b>/logout</b> — Botdan chiqish`;
    }

    await this.sender.sendMessage(text, chatId);
  }

  async sendServerLogsFile(chatId: string, lineCount = 1000) {
    try {
      if (serverLogBuffer.length === 0) {
        await this.sender.sendMessage('ℹ️ Hozircha serverda yangi loglar yig‘ilmadi.', chatId);
        return;
      }

      const count = Math.max(10, Math.min(lineCount, serverLogBuffer.length));
      const lines = serverLogBuffer.slice(-count);
      const logContent = lines.join('\n');
      const buffer = Buffer.from(logContent, 'utf-8');

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateTag = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `server_logs_${dateTag}.log`;
      const sizeKb = (buffer.length / 1024).toFixed(1);

      const formattedDate = now.toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const caption =
        `📊 <b>Server loglari</b>\n\n` +
        `📝 <b>Qatorlar soni:</b> ${lines.length} ta\n` +
        `💾 <b>Fayl hajmi:</b> ${sizeKb} KB\n` +
        `📅 <b>Vaqt:</b> ${formattedDate}`;

      await this.sender.sendDocumentBuffer(filename, buffer, caption, chatId);
    } catch (err: any) {
      await this.sender.sendMessage(`❌ Log faylini yuborishda xatolik: ${err.message}`, chatId);
    }
  }

  async sendOfficialDocument(docTitle: string, data: any, overrideChatId?: string) {
    try {
      const docContent =
        `========================================================================\n` +
        `               O'ZBEKISTON RESPUBLIKASI QURILISH VA UY-JOY              \n` +
        `                     KOMMUNAL XO'JALIGI VAZIRLIGI                        \n` +
        `========================================================================\n\n` +
        `                       ${docTitle.toUpperCase()}                        \n` +
        `  Hujjat №: DOC-${Date.now().toString().slice(-6)}                     Sana: ${new Date().toLocaleDateString('uz-UZ')}\n\n` +
        `------------------------------------------------------------------------\n` +
        `1. BAJARUVCHI (OMBORCHI): ${data.performerName || 'Bosh Omborchi'}\n` +
        `2. QABUL QILUVCHI: ${data.targetName || 'Xodim / Bo\'lim'}\n` +
        `3. OPERATSIYA TURI: ${data.opType}\n` +
        `------------------------------------------------------------------------\n\n` +
        `MAHSULOT / ASSET MA'LUMOTLARI:\n` +
        `• Mahsulot nomi: ${data.productName}\n` +
        `• Miqdori: ${data.quantity} ${data.unit || 'ta'}\n` +
        `• Inventar raqami: ${data.inventoryNumber || 'Mavjud emas'}\n` +
        `• Seriya raqami: ${data.serialNumber || 'Mavjud emas'}\n\n` +
        `SHARTLAR VA MODDIY JAVOBGARLIK:\n` +
        `Ushbu hujjat tasdiqlanishi bilan qabul qiluvchi shaxs topshirilgan mol-mulkning\n` +
        `butligi, saqlanishi va sozligi uchun moddiy javobgarlikni o'z zimmasiga oladi.\n\n` +
        `------------------------------------------------------------------------\n` +
        `Topshirdi (Omborchi): _______________    Qabul qildi: _______________\n` +
        `========================================================================\n`;

      const buffer = Buffer.from(docContent, 'utf-8');
      const safeTitle = docTitle.replace(/[^a-zA-Z0-9_]/g, '_');
      const filename = `${safeTitle}_${Date.now().toString().slice(-4)}.doc`;
      const formattedDate = new Date().toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const caption =
        `📄 <b>${docTitle}</b>\n\n` +
        `📤 <b>Kimdan:</b> ${data.performerName || 'Bosh Omborchi'}\n` +
        `📥 <b>Kimga:</b> ${data.targetName || 'Xodim / Bo‘lim'}\n` +
        `📦 <b>Mahsulot:</b> ${data.productName} (${data.quantity} ${data.unit || 'ta'})\n` +
        `📅 <b>Sana:</b> ${formattedDate}`;

      await this.sender.sendDocumentBuffer(filename, buffer, caption, overrideChatId);
    } catch (err: any) {
      this.logger.error(`Rasmiy hujjat yaratishda xatolik: ${err.message}`);
    }
  }
}
