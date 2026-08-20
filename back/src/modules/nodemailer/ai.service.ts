import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';

const MANAGER_ROLES = [
  'SUPER_ADMIN',
  'VAZIRLIK_OMBORCHI',
  'ADMIN',
  'OMBORCHI',
  'ORG_ADMIN',
  'ORG_OMBORCHI',
  'KADR',
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * WMS AI Server Data Engine — Strict Role-based RBAC
   */
  async askAi(userQuery: string, boundUser: any): Promise<string> {
    try {
      const userRole = boundUser?.role || 'XODIM';
      const isManager = MANAGER_ROLES.includes(userRole);

      // 1. ADAPTIK RUXSAT VA CONTEXT SHAKLLANTIRISH
      if (!isManager) {
        // Oddiy XODIM uchun faqat shaxsiy ma'lumotlar va ruxsat berilgan bo'limlar olinadi
        const [userAssignments, userDept, userHistory] = await Promise.all([
          this.prisma.assignment.findMany({
            where: { userId: boundUser.id, returnedAt: null },
            include: { asset: { include: { product: true } } },
          }),
          boundUser.departmentId
            ? this.prisma.department.findUnique({
                where: { id: boundUser.departmentId },
                include: {
                  _count: { select: { users: true } },
                  users: { select: { fullName: true, position: true } },
                  assignments: { where: { returnedAt: null } },
                },
              })
            : null,
          this.prisma.operation.findMany({
            where: { OR: [{ userId: boundUser.id }, { fromUserId: boundUser.id }] },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { product: { select: { name: true } } },
          }),
        ]);

        const userAssetsStr = userAssignments.length > 0
          ? userAssignments.map((a) => `• <b>${a.asset.product.name}</b> (Inv №: <code>${a.asset.inventoryNumber}</code>)`).join('\n')
          : "<i>Sizga hozirda biriktirilgan jihozlar yo'q</i>";

        const deptStr = userDept
          ? `• Bo'lim nomi: <b>${userDept.name}</b>\n• Hamkasblar soni: <b>${userDept._count.users} ta</b>\n• Hamkasblaringiz: ${userDept.users.map((u) => u.fullName).join(', ')}`
          : "<i>Siz biror-bir bo'limga biriktirilmagansiz</i>";

        const employeeContext = {
          userAssetsStr,
          deptStr,
          userAssignments,
          userDept,
          userHistory,
        };

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          return await this.callEmployeeGeminiApi(userQuery, boundUser, employeeContext, apiKey);
        }
        return this.smartLocalEmployeeAiResponse(userQuery, boundUser, employeeContext);
      }

      // 2. MAS'ULLAR VA ADMINLAR UCHUN TO'LIQ OMBOR CONTEXTI
      const [
        productsCount,
        inventoryItems,
        lowStockItems,
        usersCount,
        allUsers,
        allDepts,
        recentOps,
        activeAssignments,
      ] = await Promise.all([
        this.prisma.product.count({ where: { deletedAt: null } }),
        this.prisma.inventory.findMany({
          where: { product: { deletedAt: null } },
          include: { product: { select: { name: true, unit: true, productType: true } } },
          orderBy: { quantity: 'desc' },
        }),
        this.prisma.inventory.findMany({
          where: { product: { deletedAt: null }, quantity: { lte: 5 } },
          include: { product: { select: { name: true, unit: true } } },
        }),
        this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.user.findMany({
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            fullName: true,
            username: true,
            phone: true,
            internalPhone: true,
            role: true,
            position: true,
            department: { select: { name: true } },
            assignments: {
              where: { returnedAt: null },
              select: {
                asset: {
                  select: {
                    inventoryNumber: true,
                    serialNumber: true,
                    product: { select: { name: true, unit: true, productType: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.department.findMany({
          where: { deletedAt: null },
          include: {
            _count: { select: { users: true } },
            assignments: { where: { returnedAt: null } },
          },
        }),
        this.prisma.operation.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { name: true } },
            performedBy: { select: { fullName: true } },
          },
        }),
        this.prisma.assignment.findMany({
          where: { returnedAt: null },
          include: {
            user: { select: { fullName: true, department: { select: { name: true } } } },
            asset: { select: { inventoryNumber: true, serialNumber: true, product: { select: { name: true } } } },
          },
          take: 40,
        }),
      ]);

      const inventoryStr = inventoryItems
        .map((i) => `• <b>${i.product.name}</b>: ${i.quantity} ${i.product.unit}`)
        .join('\n');

      const lowStockStr = lowStockItems.length > 0
        ? lowStockItems.map((i) => `🔴 <b>${i.product.name}</b>: ${i.quantity} ${i.product.unit}`).join('\n')
        : "✅ Yo'q (hamma zaxiralar yetarli)";

      const usersDetailedStr = allUsers
        .map((u) => {
          const assets = u.assignments
            .map((a) => `${a.asset.product.name} (Inv №${a.asset.inventoryNumber})`)
            .join(', ');
          return `• <b>${u.fullName}</b> (${u.position || u.role}) — ${u.department?.name || 'Bo\'limsiz'}${assets ? `\n  ↳ TMZ/Jihozlar: <i>${assets}</i>` : ''}`;
        })
        .join('\n');

      const assignmentsStr = activeAssignments.length > 0
        ? activeAssignments
            .map((a) => `• <b>${a.asset.product.name}</b> (Inv №: <code>${a.asset.inventoryNumber}</code>) → <b>${a.user?.fullName || 'Noma\'lum'}</b> (${a.user?.department?.name || 'Bo\'limsiz'})`)
            .join('\n')
        : "✅ Hozirda biriktirilgan jihozlar yo'q";

      const deptsStr = allDepts
        .map((d) => `• <b>${d.name}</b>: ${d._count.users} xodim, ${d.assignments.length} ta jihoz`)
        .join('\n');

      const contextData = {
        productsCount,
        usersCount,
        inventoryItems,
        lowStockItems,
        allUsers,
        allDepts,
        recentOps,
        activeAssignments,
        inventoryStr,
        lowStockStr,
        usersDetailedStr,
        assignmentsStr,
        deptsStr,
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        return await this.callManagerGeminiApi(userQuery, boundUser, contextData, apiKey);
      }
      return this.smartLocalManagerAiResponse(userQuery, boundUser, contextData);
    } catch (err: any) {
      this.logger.error(`AI Service error: ${err.message}`);
      return `❌ Server ma'lumotlarini olishda xatolik yuz berdi.`;
    }
  }

  /**
   * ODDIY XODIM UCHUN GEMINI PROMPT (Faqat shaxsiy ma'lumotlar, qo'llanma va murojaatga ruxsat)
   */
  private async callEmployeeGeminiApi(
    query: string,
    boundUser: any,
    context: any,
    apiKey: string,
  ): Promise<string> {
    const systemPrompt =
      `Siz — WMS Ombor Tizimining rasmiy AI assistentisiz ("WMS AI Assistent").\n\n` +
      `Murojaatchi oddiy XODIM: ${boundUser.fullName} (Lavozimi: ${boundUser.position || 'Xodim'}).\n\n` +
      `QAT'IY RUXSAT QOIDALARI:\n` +
      `1. Oddiy xodimlarga umumiy ombor qoldiqlari, zaxirasi kamaygan tovarlar, boshqa xodimlarning jihozlari, tizim statistikasi, barcha operatsiyalar tarixi va qaytarishlar hisobotlari KO'RSATILMAYDI.\n` +
      `2. Agar foydalanuvchi taqiqlangan mavzular (ombor qoldiqlari, barcha bo'limlar, statistika, tarix, kam qolganlar, qaytarishlar) haqida so'rasa, QAT'IY TARZDA rad eting: "Kechirasiz, sizda umumiy ombor va boshqa xodimlar ma'lumotlarini ko'rish uchun ruxsat yo'q. Siz faqat '✍️ Omborchiga Murojaat' tugmasi orqali omborchiga murojaat yuborishingiz, o'zingizga biriktirilgan jihozlar yoki qo'llanmani ko'rishingiz mumkin."\n` +
      `3. RUXSAT ETILGAN MAVZULAR: Qo'llanma, Administrator ma'lumotlari, Tizim holati, Bot maqsadi, Omborchiga murojaat yuborish, shaxsiy jihozlar, shaxsiy bo'lim va shaxsiy tarix.\n` +
      `4. SALOMLASHMANG! HTML teglaridan (<b>, <code>, <i>) foydalaning.\n\n` +
      `XODIMNING SHAXSIY MA'LUMOTLARI:\n` +
      `- Biriktirilgan jihozlari:\n${context.userAssetsStr}\n\n` +
      `- Bo'lim ma'lumotlari:\n${context.deptStr}\n`;

    return this.executeGeminiRequest(systemPrompt, query, apiKey, () =>
      this.smartLocalEmployeeAiResponse(query, boundUser, context),
    );
  }

  /**
   * MAS'UL / ADMIN UCHUN GEMINI PROMPT (To'liq ombor ma'lumotlari)
   */
  private async callManagerGeminiApi(
    query: string,
    boundUser: any,
    context: any,
    apiKey: string,
  ): Promise<string> {
    const systemPrompt =
      `Siz — WMS Ombor Tizimining rasmiy va xolis server assistentisiz ("WMS AI Assistent").\n\n` +
      `QAT'IY QOIDALAR:\n` +
      `1. MUTLAQO SALOMLASHMANG!\n` +
      `2. AGAR XODIMLAR YOKI OMBOR MAHSULOTLARI BO'YICHA MA'LUMOT SO'RALSA VA RO'YXAT KATTA BO'LSA, MA'LUMOTLARNI 10 TA DAN PAGINATION (SAHIFALAB) TAQDIM ETING!\n` +
      `3. Foydalanuvchi so'ragan ma'lumotlarni to'g'ridan-to'g'ri server ma'lumotlaridan olib bering.\n\n` +
      `Murojaatchi MAS'UL/ADMIN: ${boundUser.fullName} (${boundUser.role})\n` +
      `SERVERDAGI BARCHA AKTUAL MA'LUMOTLAR:\n` +
      `- OMBORDA (${context.productsCount} xil tovar):\n${context.inventoryStr}\n\n` +
      `- ZAXIRASI KAMAYGAN TOVARLAR:\n${context.lowStockStr}\n\n` +
      `- XODIMLAR VA ULARNING JIHOZLARI (${context.usersCount} ta xodim):\n${context.usersDetailedStr}\n\n` +
      `- BIRIKTIRILGAN AKTUAL ASSETLAR / BRONLAR:\n${context.assignmentsStr}\n\n` +
      `- BO'LIMLAR:\n${context.deptsStr}\n\n` +
      `FAQAT YAKUNIY MA'LUMOTNI YOZING! HTML teglaridan foydalaning.`;

    return this.executeGeminiRequest(systemPrompt, query, apiKey, () =>
      this.smartLocalManagerAiResponse(query, boundUser, context),
    );
  }

  private async executeGeminiRequest(
    systemPrompt: string,
    query: string,
    apiKey: string,
    fallbackFn: () => string,
  ): Promise<string> {
    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
      'gemini-flash-latest',
    ];

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const body = {
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt }, { text: `Foydalanuvchi so'rovi: "${query}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          return data.candidates[0].content.parts[0].text.trim();
        }
      } catch (err: any) {
        this.logger.warn(`Gemini model ${modelName} fallback: ${err.message}`);
      }
    }

    return fallbackFn();
  }

  /**
   * ODDIY XODIM UCHUN LOCAL NLP FALLBACK (Strict Permission Checks)
   */
  private smartLocalEmployeeAiResponse(query: string, boundUser: any, context: any): string {
    const q = query.toLowerCase().trim();

    // Taqiqlangan mavzular: ombor qoldiqlari, barcha bo'limlar, statistika, tarix, kam qolganlar, qaytarishlar
    if (
      q.includes('ombor') ||
      q.includes('qoldiq') ||
      q.includes('baza') ||
      q.includes('zaxira') ||
      q.includes('kamaygan') ||
      q.includes('statistika') ||
      q.includes('offboard') ||
      q.includes('qaytarish') ||
      (q.includes('xodim') && !q.includes('bo\'lim') && !q.includes('hamkasb')) ||
      (q.includes('barcha') && !q.includes('jihoz'))
    ) {
      return `⛔ <b>Ruxsat etilmadi!</b>\n\nKechirasiz, sizda ombor qoldiqlari, statistika va boshqa xodimlar ma'lumotlarini ko'rish uchun ruxsat yo'q. Siz "✍️ Omborchiga Murojaat" tugmasi orqali omborchiga murojaat yuborishingiz yoki o'zingizga biriktirilgan jihozlarni ko'rishingiz mumkin.`;
    }

    // 1. Qo'llanma / Help
    if (q.includes('qo\'llanma') || q.includes('yo\'riqnoma') || q.includes('help')) {
      return (
        `❓ <b>WMS TELEGRAM BOT QO'LLANMASI</b>\n\n` +
        `Siz foydalanishingiz mumkin bo'lgan menyu va buyruqlar:\n` +
        `• <b>📱 Mening Jihozlarim</b> — nomingizdagi aktiv va TMZ lar\n` +
        `• <b>🏢 Mening Bo'limim</b> — bo'limdagi hamkasblar\n` +
        `• <b>📜 Mening Tarixim</b> — topshirgan va olgan jihozlaringiz tarixi\n` +
        `• <b>✍️ Omborchiga Murojaat</b> — omborchiga so'rov/murojaat yuborish\n` +
        `• <b>📞 Ichki Aloqa</b> — vazirlik mas'ullari telefon raqamlari`
      );
    }

    // 2. Administrator / Admin
    if (q.includes('admin') || q.includes('administrator') || q.includes('aloqa') || q.includes('kontakt')) {
      return (
        `👨‍💼 <b>WMS ADMINISTRATOR VA OMBORCHILAR:</b>\n\n` +
        `📦 Bosh Omborchi: <b>Urinbadalov Abdulaziz</b> (+998 71 200 00 00)\n` +
        `👩‍💼 Kadrlar Bo'limi: <b>Karimova Shahnoza</b>\n` +
        `💻 IT Admin: <b>Hasanov Ahmadillo</b>\n\n` +
        `💡 <i>To'g'ridan-to'g'ri xabar yuborish uchun "✍️ Omborchiga Murojaat" tugmasidan foydalaning.</i>`
      );
    }

    // 3. Tizim va Bot maqsadi
    if (q.includes('tizim') || q.includes('maqsad') || q.includes('bot')) {
      return (
        `🏛 <b>WMS TIZIMI VA BOT MAQSADI:</b>\n\n` +
        `Bot O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligining ombor va moddiy aktivlarini hisobga olish, xodimlarga TMZ biriktirish hamda tezkor murojaatlar uchun mo'ljallangan.`
      );
    }

    // 4. Murojaat
    if (q.includes('murojaat') || q.includes('yozish') || q.includes('so\'rov')) {
      return (
        `✍️ <b>OMBORCHIGA MUROJAAT YUBORISH:</b>\n\n` +
        `Omborchiga xabar yoki talabnoma yuborish uchun pastdagi <b>✍️ Omborchiga Murojaat</b> tugmasini bosing yoki matnni <code>murojaat: xabar matni</code> shaklida yuboring.`
      );
    }

    // 5. Jihozlar va TMZ lar
    if (q.includes('jihoz') || q.includes('tmz') || q.includes('biriktirilgan') || q.includes('mening')) {
      return (
        `📱 <b>Sizga Biriktirilgan Jihozlar va TMZ lar:</b>\n\n` +
        `${context.userAssetsStr}`
      );
    }

    // 6. Bo'lim
    if (q.includes('bo\'lim') || q.includes('hamkasb') || q.includes('dept')) {
      return (
        `🏢 <b>Sizning Bo'limingiz Ma'lumotlari:</b>\n\n` +
        `${context.deptStr}`
      );
    }

    // 7. Tarix
    if (q.includes('tarix') || q.includes('operatsiya')) {
      const historyStr = context.userHistory.length > 0
        ? context.userHistory.map((op: any, i: number) => `• ${i + 1}. ${op.product?.name || 'Mahsulot'} (${op.quantity} ta) — ${new Date(op.createdAt).toLocaleDateString('uz-UZ')}`).join('\n')
        : "<i>Operatsiyalar tarixi yo'q</i>";

      return (
        `📜 <b>Shaxsiy Operatsiyalar Tarihingiz:</b>\n\n` +
        `${historyStr}`
      );
    }

    return (
      `👤 <b>Xodim Ma'lumotlar Markazi:</b>\n\n` +
      `Siz quyidagi so'rovlarni berishingiz mumkin:\n` +
      `• "Mening jihozlarim" — sizga biriktirilgan aktivlar\n` +
      `• "Mening bo'limim" — bo'limingiz va hamkasblaringiz\n` +
      `• "Mening tarixim" — shaxsiy topshirish/olish tarihingiz\n` +
      `• "Omborchiga murojaat" — administratorga so'rov yuborish`
    );
  }

  /**
   * MAS'UL / ADMIN UCHUN LOCAL NLP FALLBACK (Full Data + Pagination)
   */
  private smartLocalManagerAiResponse(query: string, boundUser: any, context: any): string {
    const q = query.toLowerCase().trim();

    const pageMatch = q.match(/(\d+)(?:\s*|\s*-\s*)(?:sahifa|page)?/i) || q.match(/(?:sahifa|page)\s*(\d+)/i);
    const requestedPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    const page = isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;
    const pageSize = 10;

    if (q.includes('kam') || q.includes('kamaygan') || q.includes('zaxira') || q.includes('lowstock')) {
      return (
        `🔴 <b>Omborda Kam Qolgan Mahsulotlar:</b>\n\n` +
        `${context.lowStockStr}`
      );
    }

    if (q.includes('biriktirilgan') || q.includes('bron') || q.includes('jihoz') || q.includes('tmz')) {
      const totalAssignments = context.activeAssignments.length;
      const totalPages = Math.ceil(totalAssignments / pageSize) || 1;
      const currentPage = Math.min(page, totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const pagedAssignments = context.activeAssignments.slice(startIndex, startIndex + pageSize);

      const listStr = pagedAssignments.length > 0
        ? pagedAssignments
            .map((a: any, idx: number) => `• <b>${startIndex + idx + 1}. ${a.asset.product.name}</b> (Inv №: <code>${a.asset.inventoryNumber}</code>) → <b>${a.user?.fullName || 'Noma\'lum'}</b> (${a.user?.department?.name || 'Bo\'limsiz'})`)
            .join('\n')
        : "✅ Hozirda biriktirilgan jihozlar yo'q";

      return (
        `📦 <b>Biriktirilgan Jihozlar va TMZ lar (Bronlar)</b> (${currentPage}/${totalPages}-sahifa, jami ${totalAssignments} ta):\n\n` +
        `${listStr}\n\n` +
        (totalPages > 1 ? `💡 <i>Keyingi sahifalar uchun: "biriktirilgan ${currentPage < totalPages ? currentPage + 1 : 1}-sahifa" deb yozing.</i>` : '')
      );
    }

    const matchedUser = context.allUsers.find((u: any) =>
      q.includes(u.fullName.toLowerCase()) || (u.username && q.includes(u.username.toLowerCase()))
    );

    if (matchedUser) {
      const userAssets = matchedUser.assignments.length > 0
        ? matchedUser.assignments
            .map((a: any) => `  • <b>${a.asset.product.name}</b> (Inv №: <code>${a.asset.inventoryNumber}</code>)`)
            .join('\n')
        : '  <i>Biriktirilgan jihozlar yo\'q</i>';

      return (
        `👤 <b>Xodim haqida ma'lumot:</b>\n\n` +
        `• <b>Ism-sharifi:</b> ${matchedUser.fullName}\n` +
        `• <b>Lavozimi / Roli:</b> ${matchedUser.position || matchedUser.role}\n` +
        `• <b>Bo'limi:</b> ${matchedUser.department?.name || 'Bo\'limsiz'}\n` +
        `• <b>Telefon:</b> ${matchedUser.phone || matchedUser.internalPhone || 'Ko\'rsatilmagan'}\n\n` +
        `📦 <b>Biriktirilgan jihozlari (TMZ):</b>\n${userAssets}`
      );
    }

    if (q.includes('xodim') || q.includes('user') || q.includes('ishchi')) {
      const totalUsers = context.allUsers.length;
      const totalPages = Math.ceil(totalUsers / pageSize) || 1;
      const currentPage = Math.min(page, totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const pagedUsers = context.allUsers.slice(startIndex, startIndex + pageSize);

      const usersListStr = pagedUsers
        .map((u: any, idx: number) => {
          const assets = u.assignments
            .map((a: any) => `${a.asset.product.name} (Inv №${a.asset.inventoryNumber})`)
            .join(', ');
          return `• <b>${startIndex + idx + 1}. ${u.fullName}</b> (${u.position || u.role}) — ${u.department?.name || 'Bo\'limsiz'}${assets ? `\n  ↳ TMZ/Jihozlar: <i>${assets}</i>` : ''}`;
        })
        .join('\n');

      return (
        `👥 <b>Xodimlar Ro'yxati</b> (${currentPage}/${totalPages}-sahifa, jami ${totalUsers} ta):\n\n` +
        `${usersListStr}\n\n` +
        (totalPages > 1 ? `💡 <i>Keyingi sahifalarni ko'rish uchun: "xodimlar ${currentPage < totalPages ? currentPage + 1 : 1}-sahifa" deb yozing.</i>` : '')
      );
    }

    if (q.includes('qoldiq') || q.includes('ombor') || q.includes('mahsulot') || q.includes('tovar') || q.includes('baza')) {
      const totalItems = context.inventoryItems.length;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      const currentPage = Math.min(page, totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      const pagedItems = context.inventoryItems.slice(startIndex, startIndex + pageSize);

      const itemsListStr = pagedItems
        .map((i: any, idx: number) => `• <b>${startIndex + idx + 1}. ${i.product.name}</b>: ${i.quantity} ${i.product.unit}`)
        .join('\n');

      return (
        `📦 <b>Ombor Qoldiqlari</b> (${currentPage}/${totalPages}-sahifa, jami ${totalItems} xil):\n\n` +
        `${itemsListStr}\n\n` +
        `<b>Zaxirasi kamayganlar:</b>\n${context.lowStockStr}\n\n` +
        (totalPages > 1 ? `💡 <i>Keyingi sahifalarni ko'rish uchun: "ombor ${currentPage < totalPages ? currentPage + 1 : 1}-sahifa" deb yozing.</i>` : '')
      );
    }

    return (
      `📊 <b>WMS Server Ma'lumotlari:</b>\n\n` +
      `• Jami tovarlar: <b>${context.productsCount} xil</b>\n` +
      `• Jami xodimlar: <b>${context.usersCount} ta</b>\n` +
      `• Kam qolgan tovarlar: <b>${context.lowStockItems.length} ta</b>\n\n` +
      `Batafsil ma'lumotlar:\n` +
      `${context.inventoryStr}`
    );
  }
}
