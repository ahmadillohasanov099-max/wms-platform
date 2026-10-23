import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AiService } from './ai.service';
import { EventsGateway } from '../events/events.gateway';
import { TelegramSenderService, STAFF_ROLES, escapeHtml } from './services/telegram-sender.service';
import { TelegramExcelService } from './services/telegram-excel.service';
import { TelegramReportsService } from './services/telegram-reports.service';
import { TelegramAuthService } from './services/telegram-auth.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastUpdateId = 0;
  private isPollingActive = false;
  private processedUpdateIds = new Set<number>();

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private eventsGateway: EventsGateway,
    private sender: TelegramSenderService,
    private excelReports: TelegramExcelService,
    private reports: TelegramReportsService,
    private auth: TelegramAuthService,
  ) {}

  onModuleInit() {
    this.registerBotCommands();
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private getCredentials() {
    return this.sender.getCredentials();
  }

  /**
   * Telegram menyu komandalarini ro'yxatdan o'tkazish
   */
  private async registerBotCommands() {
    const { token } = this.getCredentials();
    if (!token) return;

    try {
      const url = `https://api.telegram.org/bot${token}/setMyCommands`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: 'Asosiy menyu' },
            { command: 'login', description: 'Tizimga kirish (/login login parol)' },
            { command: 'logout', description: 'Tizimdan chiqish (akkountni uzish)' },
            { command: 'stock_export', description: 'Ombor excel hisobot' },
            { command: 'users_export', description: 'Xodimlar excel hisobot' },
            { command: 'assets_export', description: 'Berilgan jihozlar excel hisobot' },
            { command: 'recent_export', description: 'Tarix excel hisobot' },
            { command: 'requests', description: 'Kutilayotgan talabnomalar' },
            { command: 'logs', description: 'Server loglarini yuklab olish (.log)' },
          ],
        }),
      });
    } catch (err) {
      this.logger.error('Telegram komandalarini sozlashda xatolik');
    }
  }

  /**
   * Background polling listener bilan Authentication & Role Guard
   */
  private async startPolling() {
    const { token } = this.getCredentials();
    if (!token) return;

    try {
      // Webhook mavjud bo'lsa ziddiyatni bartaraf etish uchun tozalaymiz
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    } catch {}

    this.pollingInterval = setInterval(async () => {
      if (this.isPollingActive) return;
      this.isPollingActive = true;
      try {
        const { token: currentToken } = this.getCredentials();
        if (!currentToken) {
          this.isPollingActive = false;
          return;
        }

        const url = `https://api.telegram.org/bot${currentToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=1`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            if (this.processedUpdateIds.has(update.update_id)) {
              continue;
            }
            this.processedUpdateIds.add(update.update_id);
            if (this.processedUpdateIds.size > 2000) {
              this.processedUpdateIds.clear();
            }

            this.lastUpdateId = update.update_id;

            // 1. Callback query (Inline keyboard)
            if (update.callback_query) {
              const cb = update.callback_query;
              const chatId = String(cb.message?.chat?.id || cb.from?.id);
              const dataStr = cb.data || '';

              await this.sender.answerCallbackQuery(cb.id);

              const boundUser = await this.prisma.user.findFirst({
                where: { telegramChatId: chatId, deletedAt: null, isActive: true },
                include: { department: true, organization: true },
              });

              if (!boundUser) {
                await this.auth.sendLoginPrompt(chatId);
                continue;
              }

              await this.handleCallbackAction(dataStr, chatId, boundUser);
              continue;
            }

            // 2. Text messages handler
            const msg = update.message;
            if (msg && msg.text) {
              const text = msg.text.trim();
              const chatId = String(msg.chat.id);

              const boundUser = await this.prisma.user.findFirst({
                where: { telegramChatId: chatId, deletedAt: null, isActive: true },
                include: { department: true, organization: true },
              });

              const lower = text.toLowerCase().trim();
              const isLogoutCmd =
                text === '/logout' ||
                lower.startsWith('/logout') ||
                lower === 'logout' ||
                lower === '/chiqish' ||
                lower === 'chiqish' ||
                text === '🚪 Tizimdan chiqish' ||
                text === '🚪 Tizimdan Chiqish' ||
                text === '🚪 Tizimdan Chiqish (/logout)' ||
                text === '🚪 Chiqish (/logout)';

              if (!boundUser) {
                if (isLogoutCmd || text === '/cancel') {
                  this.auth.loginSessions.delete(chatId);
                  await this.sender.sendMessage(
                    `ℹ️ <b>Siz hozirda tizimga kirmagansiz.</b>\n\nBotdan foydalanish uchun tizimdagi hisobingiz orqali kiring:`,
                    chatId,
                  );
                  await this.auth.sendLoginPrompt(chatId);
                  continue;
                }

                if (
                  text.startsWith('/login') ||
                  text === '🔑 Kirish (/login)' ||
                  text === '🔑 Tizimga Kirish (/login)' ||
                  this.auth.loginSessions.has(chatId)
                ) {
                  await this.auth.handleLoginFlow(text, chatId, async (u) => {
                    await this.sendMenuWithWelcome(chatId, u);
                  });
                } else {
                  await this.auth.sendLoginPrompt(chatId);
                }
                continue;
              }

              // Avtorizatsiyadan o'tgan barcha foydalanuvchilar uchun universal chiqish (Logout)
              if (isLogoutCmd) {
                await this.auth.handleLogoutAccount(chatId);
                continue;
              }

              const isSuperAdmin = boundUser.role === 'SUPER_ADMIN';
              const isOrgAdmin = boundUser.role === 'ORG_ADMIN';
              const isWarehouseStaff = boundUser.role === 'VAZIRLIK_OMBORCHI' || boundUser.role === 'ORG_OMBORCHI';
              const isEmployee = boundUser.role === 'XODIM';
              const isStaff = STAFF_ROLES.includes(boundUser.role);

              // ========================================================
              // 👑 1. SUPER ADMIN UCHUN MAXSUS QULAY VA TEZKOR REJIM
              // ========================================================
              if (isSuperAdmin) {

                // Asosiy menyu
                if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                  await this.sendMenuWithWelcome(chatId, boundUser);
                  continue;
                }

                // 1. 📊 Excel Ombor Holati
                if (
                  text === '📊 Excel Ombor Holati' ||
                  lower === 'excel ombor holati' ||
                  lower === 'excel ombor xolati' ||
                  lower === 'excel ombor' ||
                  text === '/stock_export' ||
                  text === '/stock'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendStockExcel(chatId);
                  continue;
                }

                // 2. 👥 Excel Xodimlar
                if (
                  text === '👥 Excel Xodimlar' ||
                  lower === 'excel xodimlar' ||
                  lower === 'excel xodim' ||
                  text === '/users_export' ||
                  text === '/users'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendUsersExcel(chatId);
                  continue;
                }

                // 3. 🏢 Excel Bo'lim Jihozlari
                if (
                  text === "🏢 Excel Bo'lim Jihozlari" ||
                  text === "🏢 Excel Bo‘lim Jihozlari" ||
                  lower.includes("bo'lim jihozlari") ||
                  lower.includes("bolim jihozlari") ||
                  lower.includes("biriktirilgan jihozlar") ||
                  text === '/assets_export' ||
                  text === '/depts_export'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendAssignmentsExcel(chatId);
                  continue;
                }

                // 4. 📦 Excel Operatsiyalar
                if (
                  text === '📦 Excel Operatsiyalar' ||
                  lower === 'excel operatsiyalar' ||
                  lower === 'excel operatsyalar'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendOperationsExcel(chatId);
                  continue;
                }

                // 5. 📜 Excel Tarix
                if (
                  text === '📜 Excel Tarix' ||
                  lower === 'excel tarix' ||
                  text === '/recent_export' ||
                  text === '/recent'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendOperationsExcel(chatId);
                  continue;
                }

                // 6. 📄 Server Loglari
                if (
                  text === '📄 Server Loglari' ||
                  lower === 'server loglari' ||
                  lower.includes('loglar excel') ||
                  lower === 'loglar' ||
                  text === '/logs' ||
                  text.startsWith('/log')
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  const parts = text.split(' ');
                  const linesArg = parseInt(parts[1], 10) || 1000;
                  await this.reports.sendServerLogsFile(chatId, linesArg);
                  continue;
                }

                // Inventar raqam yozilgan bo'lsa darhol tezkor kartochkani ko'rsatish
                const foundAsset = await this.searchAssetByInventoryNumber(text, chatId, boundUser);
                if (foundAsset) {
                  continue;
                }

                // Xodim ism-familiyasi yoki boshqa savollar berilganda AI javob beradi
                await this.sender.sendChatAction('typing', chatId);
                const aiResponse = await this.aiService.askAi(text, boundUser);
                await this.sender.sendMessage(aiResponse, chatId);
                continue;
              }

              // ========================================================
              // 🏢 2. ORG ADMIN (TASHKILOT ADMINI) UCHUN MAXSUS QULAY VA TEZKOR REJIM
              // ========================================================
              if (isOrgAdmin) {
                if (!boundUser.organizationId) {
                  await this.sender.sendMessage(
                    `⚠️ <b>Xavfsizlik ogohlantirishi!</b>\n\nSizning akkauntingizga biror tashkilot (organization) biriktirilmagan. Xavfsizlik qoidalariga binoan ma'lumotlarni ko'rish qat'iyan cheklangan. Iltimos, bosh administratorga murojaat qiling.`,
                    chatId,
                  );
                  continue;
                }

                const lower = text.toLowerCase().trim();
                const orgId = boundUser.organizationId;

                // Asosiy menyu
                if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                  await this.sendMenuWithWelcome(chatId, boundUser);
                  continue;
                }

                // 1. 📊 Excel Ombor Holati (faqat o'z tashkiloti bo'yicha)
                if (
                  text === '📊 Excel Ombor Holati' ||
                  lower === 'excel ombor holati' ||
                  lower === 'excel ombor xolati' ||
                  lower === 'excel ombor' ||
                  text === '/stock_export' ||
                  text === '/stock'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendStockExcel(chatId, orgId);
                  continue;
                }

                // 2. 👥 Excel Xodimlar (faqat o'z tashkiloti xodimlari)
                if (
                  text === '👥 Excel Xodimlar' ||
                  lower === 'excel xodimlar' ||
                  lower === 'excel xodim' ||
                  text === '/users_export' ||
                  text === '/users'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendUsersExcel(chatId, orgId);
                  continue;
                }

                // 3. 🏢 Excel Bo'lim Jihozlari (faqat o'z tashkiloti bo'lim va aktivlari)
                if (
                  text === "🏢 Excel Bo'lim Jihozlari" ||
                  text === "🏢 Excel Bo‘lim Jihozlari" ||
                  lower.includes("bo'lim jihozlari") ||
                  lower.includes("bolim jihozlari") ||
                  lower.includes("biriktirilgan jihozlar") ||
                  text === '/assets_export' ||
                  text === '/depts_export'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendAssignmentsExcel(chatId, orgId);
                  continue;
                }

                // 4. 📜 Excel Tarix (faqat o'z tashkiloti operatsiyalari)
                if (
                  text === '📜 Excel Tarix' ||
                  lower === 'excel tarix' ||
                  text === '/recent_export' ||
                  text === '/recent'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendOperationsExcel(chatId, orgId);
                  continue;
                }

                // 5. 📋 Tashkilot Talabnomalari (faqat o'z tashkiloti xodimlaridan kelgan so'rovlar)
                if (
                  text === '📋 Tashkilot Talabnomalari' ||
                  text === '📋 Yangi Talabnomalar' ||
                  text === '📋 Kutilayotgan Talabnomalar' ||
                  lower.includes('talabnoma') ||
                  text === '/requests'
                ) {
                  await this.sendPendingRequests(chatId, boundUser);
                  continue;
                }

                // 6. Jihoz Inventar yoki Seriya raqami bo'yicha qidiruv (faqat o'z tashkiloti doirasida)
                const foundAsset = await this.searchAssetByInventoryNumber(text, chatId, boundUser);
                if (foundAsset) {
                  continue;
                }

                // 7. Xodim F.I.SH yoki username bo'yicha qidiruv (faqat o'z tashkiloti doirasida)
                const foundUser = await this.searchUserByName(text, chatId, boundUser);
                if (foundUser) {
                  continue;
                }

                // Natija topilmaganda
                await this.sender.sendMessage(
                  `🔍 <b>Natija topilmadi!</b>\n\n` +
                  `<code>${escapeHtml(text.trim())}</code> so'rovi bo'yicha tashkilotingizda jihoz (inventar/seriya) yoki xodim (F.I.SH) topilmadi.\n\n` +
                  `💡 <i>Iltimos, inventar raqamni yoki xodim ismini to'g'ri kiritganingizni tekshiring yoki menyu tugmalaridan foydalaning.</i>`,
                  chatId,
                );
                continue;
              }

              // ========================================================
              // 📦 3. OMBORCHI UCHUN MAXSUS QULAY VA TEZKOR REJIM
              // ========================================================
              if (isWarehouseStaff) {
                if (boundUser.role === 'ORG_OMBORCHI' && !boundUser.organizationId) {
                  await this.sender.sendMessage(
                    `⚠️ <b>Xavfsizlik ogohlantirishi!</b>\n\nSizning akkauntingizga biror tashkilot (organization) biriktirilmagan. Xavfsizlik qoidalariga binoan ma'lumotlarni ko'rish qat'iyan cheklangan. Iltimos, bosh administratorga murojaat qiling.`,
                    chatId,
                  );
                  continue;
                }

                const lower = text.toLowerCase().trim();
                const orgId = boundUser.role === 'ORG_OMBORCHI' ? (boundUser.organizationId || undefined) : undefined;

                // Asosiy menyu
                if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                  await this.sendMenuWithWelcome(chatId, boundUser);
                  continue;
                }

                // 1. 📊 Excel Ombor Holati
                if (
                  text === '📊 Excel Ombor Holati' ||
                  lower === 'excel ombor holati' ||
                  lower === 'excel ombor xolati' ||
                  lower === 'excel ombor' ||
                  text === '/stock_export' ||
                  text === '/stock'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendStockExcel(chatId, orgId);
                  continue;
                }

                // 2. 📜 Excel Tarix
                if (
                  text === '📜 Excel Tarix' ||
                  lower === 'excel tarix' ||
                  text === '/recent_export' ||
                  text === '/recent'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendOperationsExcel(chatId, orgId);
                  continue;
                }

                // 3. 👥 Excel Xodimlar
                if (
                  text === '👥 Excel Xodimlar' ||
                  lower === 'excel xodimlar' ||
                  lower === 'excel xodim' ||
                  text === '/users_export' ||
                  text === '/users'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendUsersExcel(chatId, orgId);
                  continue;
                }

                // 4. 🏢 Excel Berilgan Jihozlar
                if (
                  text === "🏢 Excel Berilgan Jihozlar" ||
                  text === "🏢 Excel Bo'lim Jihozlari" ||
                  text === "🏢 Excel Bo‘lim Jihozlari" ||
                  lower.includes('berilgan jihozlar') ||
                  lower.includes("bo'lim jihozlari") ||
                  lower.includes("biriktirilgan jihozlar") ||
                  text === '/assets_export' ||
                  text === '/depts_export'
                ) {
                  await this.sender.sendChatAction('upload_document', chatId);
                  await this.excelReports.sendAssignmentsExcel(chatId, orgId);
                  continue;
                }

                // 5. 📋 Yangi Talabnomalar
                if (
                  text === '📋 Yangi Talabnomalar' ||
                  text === '📋 Kutilayotgan Talabnomalar' ||
                  lower.includes('talabnoma') ||
                  text === '/requests'
                ) {
                  await this.sendPendingRequests(chatId, boundUser);
                  continue;
                }

                // 6. Inventar raqam bo'yicha qidiruv
                const found = await this.searchAssetByInventoryNumber(text, chatId, boundUser);
                if (found) {
                  continue;
                }

                // Agar topilmasa va raqam yoki qisqa kod bo'lsa
                const isNumericOrInv = /^[a-zA-Z0-9_\-\.\/]{3,35}$/.test(text.trim());
                if (isNumericOrInv) {
                  await this.sender.sendMessage(
                    `❌ <code>${escapeHtml(text.trim())}</code> — <i>Bunday inventar raqamli jihoz topilmadi. Iltimos, raqamni to'g'ri kiritganingizni tekshiring.</i>`,
                    chatId,
                  );
                } else {
                  await this.sender.sendMessage(
                    `ℹ️ <b>Hurmatli omborchi!</b>\n\n` +
                    `Siz bot orqali faqat jihozning <b>Inventar raqamini</b> yuborib qidirishingiz yoki quyidagi menyu tugmalaridan foydalanishingiz mumkin.\n\n` +
                    `<i>Misol: <code>22122150000012</code></i>`,
                    chatId,
                  );
                }
                continue;
              }

              // ========================================================
              // 👤 4. ODDIY XODIM (XODIM) UCHUN MAXSUS QULAY REJIM
              // ========================================================
              if (isEmployee) {
                const lower = text.toLowerCase().trim();

                // Asosiy menyu
                if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                  await this.sendMenuWithWelcome(chatId, boundUser);
                  continue;
                }

                // 1. 📱 Mening Jihozlarim
                if (
                  text === '📱 Mening Jihozlarim' ||
                  text === '📱 Mening Jihozlarim 📦' ||
                  lower.includes('jihozlarim') ||
                  text === '/myassets' ||
                  text.startsWith('/myassets')
                ) {
                  await this.sender.sendChatAction('typing', chatId);
                  const page = parseInt(text.replace('/myassets', '').trim(), 10) || 1;
                  await this.reports.sendMyAssets(chatId, boundUser, page);
                  continue;
                }

                // 2. 📜 Mening Tarixim
                if (
                  text === '📜 Mening Tarixim' ||
                  lower.includes('tarixim') ||
                  text === '/myhistory' ||
                  text.startsWith('/myhistory')
                ) {
                  await this.sender.sendChatAction('typing', chatId);
                  const page = parseInt(text.replace('/myhistory', '').trim(), 10) || 1;
                  await this.reports.sendUserPersonalHistory(chatId, boundUser, page);
                  continue;
                }

                // 3. 🏢 Mening Bo‘limim
                if (
                  text === '🏢 Mening Bo‘limim' ||
                  text === "🏢 Mening Bo'limim" ||
                  lower.includes('bolimim') ||
                  lower.includes("bo'limim") ||
                  text === '/mydept'
                ) {
                  await this.sender.sendChatAction('typing', chatId);
                  await this.reports.sendUserMyDeptInfo(chatId, boundUser);
                  continue;
                }

                // 4. 📋 Mening So‘rovlarim
                if (
                  text === '📋 Mening So‘rovlarim' ||
                  text === "📋 Mening So'rovlarim" ||
                  lower.includes("so'rovlarim") ||
                  lower.includes('sorovlarim') ||
                  text === '/myrequests'
                ) {
                  await this.sender.sendChatAction('typing', chatId);
                  await this.reports.sendUserMyRequests(chatId, boundUser);
                  continue;
                }

                // 5. ❓ Qo‘llanma / Aloqa
                if (
                  text === '❓ Qo‘llanma / Aloqa' ||
                  text === "❓ Qo'llanma / Aloqa" ||
                  lower.includes('qollanma') ||
                  lower.includes('aloqa') ||
                  text === '/help' ||
                  text === '/contacts'
                ) {
                  await this.reports.sendOrganizationContacts(chatId);
                  continue;
                }

                // 6. Xodim o'z jihozining inventar raqamini yuborgan bo'lsa
                const foundMyAsset = await this.searchMyAssetByInventoryNumber(text, chatId, boundUser);
                if (foundMyAsset) {
                  continue;
                }

                // 7. Agar xodim ma'murlar buyruqlarini yozmoqchi bo'lsa (Qat'iy bloklash)
                if (
                  text.startsWith('/stock') ||
                  text.startsWith('/users') ||
                  text.startsWith('/recent') ||
                  text.startsWith('/assets') ||
                  text.startsWith('/logs') ||
                  text.startsWith('/ai') ||
                  lower.includes('ombor holati') ||
                  lower.includes('ai assistent')
                ) {
                  await this.sender.sendMessage(
                    `⛔ <b>Ruxsat etilmadi!</b>\n\n` +
                    `Ushbu buyruq va ma'lumotlar faqat tizim ma'murlari hamda omborchilar uchun ruxsat etilgan.\n\n` +
                    `Siz o'zingizga biriktirilgan aktivlar va tarixingizni ko'rish uchun quyidagi menyu tugmalaridan foydalanishingiz mumkin.`,
                    chatId,
                  );
                  continue;
                }

                // Noma'lum matn yozilganda yo'naltirish
                await this.sender.sendMessage(
                  `ℹ️ <b>Hurmatli ${escapeHtml(boundUser.fullName)}!</b>\n\n` +
                  `Siz bot orqali faqat o'zingizga biriktirilgan jihozlar va shaxsiy tarixingizni ko'rishingiz mumkin.\n\n` +
                  `Marhamat, quyidagi menyu tugmalaridan birini tanlang yoki jihozingizning <b>Inventar raqamini</b> yuboring:`,
                  chatId,
                );
                continue;
              }

              // ========================================================
              // 👥 5. QOLGAN ROLLAR (Kadrlar, Rahbariyat)
              // ========================================================
              if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                await this.sendMenuWithWelcome(chatId, boundUser);
              } else if (text === '📱 Mening Jihozlarim 📦' || text === '📱 Mening Jihozlarim' || text.startsWith('/myassets')) {
                const page = parseInt(text.replace('/myassets', '').trim(), 10) || 1;
                await this.reports.sendMyAssets(chatId, boundUser, page);
              } else if (text === '📜 Mening Tarixim' || text.startsWith('/myhistory')) {
                const page = parseInt(text.replace('/myhistory', '').trim(), 10) || 1;
                await this.reports.sendUserPersonalHistory(chatId, boundUser, page);
              } else if (text === '🏢 Mening Bo‘limim' || text === '/mydept') {
                await this.reports.sendUserMyDeptInfo(chatId, boundUser);
              } else if (text === '📞 Ichki Aloqa' || text === '/contacts') {
                await this.reports.sendOrganizationContacts(chatId);
              } else if (text === '❓ Yordam / Qo‘llanma' || text === '/help') {
                await this.reports.sendUserHelpGuide(chatId, boundUser);
              } else if (text.startsWith('/ai') || text.toLowerCase().includes('ai assistent')) {
                await this.sender.sendMessage(
                  `⛔ <b>Ruxsat etilmadi!</b>\n\nAI Assistent bilan muloqot qilish imkoniyati faqat Super Admin uchun ajratilgan.`,
                  chatId,
                );
              } else {
                await this.sender.sendMessage(
                  `ℹ️ <b>Noma'lum buyruq!</b>\n\nIltimos, berilgan menyu buyruqlaridan foydalaning yoki <b>/help</b> deb yozing.\n<i>(AI Assistent faqat Super Admin uchun ruxsat etilgan)</i>`,
                  chatId,
                );
              }
            }
          }
        }
      } catch (err) {
        // Silent catch for network glitches
      } finally {
        this.isPollingActive = false;
      }
    }, 2500);
  }

  /**
   * Dynamic Callback Parser with RBAC Enforcement & Excel Exports
   */
  private async handleCallbackAction(dataStr: string, chatId: string, boundUser: any) {
    const isStaff = STAFF_ROLES.includes(boundUser?.role);
    const isSuperAdmin = boundUser?.role === 'SUPER_ADMIN';

    if (dataStr === 'cb_ai') {
      if (!isSuperAdmin) {
        await this.sender.sendMessage(
          `⛔ <b>Ruxsat etilmadi!</b>\n\nAI Assistent bilan muloqot qilish imkoniyati faqat Super Admin uchun ajratilgan.`,
          chatId,
        );
        return;
      }
      await this.sender.sendMessage(
        `🤖 <b>WMS-AI Assistent</b>\n\n` +
        `Marhamat, savolingizni yozib yuboring:\n` +
        `<i>Misol: <code>Omborda zaxirasi tugayotgan tovarlar bormi?</code></i>`,
        chatId,
      );
    } else if (
      dataStr.startsWith('cb_stock') ||
      dataStr.startsWith('cb_users') ||
      dataStr.startsWith('cb_lowstock') ||
      dataStr.startsWith('cb_recent') ||
      dataStr.startsWith('cb_depts') ||
      dataStr === 'cb_status' ||
      dataStr.startsWith('cb_offboarding') ||
      dataStr.startsWith('cb_find') ||
      dataStr.startsWith('cb_excel_')
    ) {
      if (!isStaff) {
        await this.reports.sendAccessDenied(chatId);
        return;
      }

      const isOrgScoped = boundUser?.role === 'ORG_ADMIN' || boundUser?.role === 'ORG_OMBORCHI';
      if (isOrgScoped && !boundUser?.organizationId) {
        await this.sender.sendMessage(
          `⚠️ <b>Xavfsizlik ogohlantirishi!</b>\n\nSizning akkauntingizga biror tashkilot biriktirilmagan. Xavfsizlik qoidalariga binoan ma'lumotlarni ko'rish qat'iyan cheklangan. Bosh administratorga murojaat qiling.`,
          chatId,
        );
        return;
      }

      const userOrgId = isOrgScoped ? boundUser.organizationId : undefined;
      if (dataStr === 'cb_excel_stock') {
        await this.excelReports.sendStockExcel(chatId, userOrgId);
      } else if (dataStr === 'cb_excel_users') {
        await this.excelReports.sendUsersExcel(chatId, userOrgId);
      } else if (dataStr === 'cb_excel_recent') {
        await this.excelReports.sendOperationsExcel(chatId, userOrgId);
      } else if (dataStr === 'cb_excel_stats') {
        await this.excelReports.sendStatsExcel(chatId, userOrgId);
      } else if (dataStr.startsWith('cb_stock')) {
        const page = parseInt(dataStr.replace('cb_stock_page_', '').replace('cb_stock', ''), 10) || 1;
        await this.reports.sendStockReport(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_users')) {
        const page = parseInt(dataStr.replace('cb_users_page_', '').replace('cb_users', ''), 10) || 1;
        await this.reports.sendUsersReport(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_lowstock')) {
        const page = parseInt(dataStr.replace('cb_lowstock_page_', '').replace('cb_lowstock', ''), 10) || 1;
        await this.reports.sendLowStockReport(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_recent')) {
        const page = parseInt(dataStr.replace('cb_recent_page_', '').replace('cb_recent', ''), 10) || 1;
        await this.reports.sendRecentOperations(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_depts')) {
        const page = parseInt(dataStr.replace('cb_depts_page_', '').replace('cb_depts', ''), 10) || 1;
        await this.reports.sendDepartmentsReport(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_offboarding')) {
        const page = parseInt(dataStr.replace('cb_offboarding_page_', '').replace('cb_offboarding', ''), 10) || 1;
        await this.reports.sendOffboardingReport(chatId, page, userOrgId);
      } else if (dataStr.startsWith('cb_find')) {
        if (dataStr.includes('_page_')) {
          const rest = dataStr.replace('cb_find_page_', '');
          const [pageStr, queryStr] = rest.split(':');
          const page = parseInt(pageStr, 10) || 1;
          await this.reports.searchProducts(queryStr || '', chatId, page, userOrgId);
        } else {
          await this.sender.sendMessage('🔍 <b>Mahsulot Qidirish</b>\n\nNomini yozing: <code>/find Lenovo</code>', chatId);
        }
      } else if (dataStr === 'cb_status') {
        await this.reports.sendStatusReport(chatId, userOrgId);
      }
    } else if (dataStr.startsWith('cb_myassets')) {
      const page = parseInt(dataStr.replace('cb_myassets_page_', '').replace('cb_myassets', ''), 10) || 1;
      await this.reports.sendMyAssets(chatId, boundUser, page);
    } else if (dataStr.startsWith('cb_myhistory')) {
      const page = parseInt(dataStr.replace('cb_myhistory_page_', '').replace('cb_myhistory', ''), 10) || 1;
      await this.reports.sendUserPersonalHistory(chatId, boundUser, page);
    } else if (dataStr === 'cb_mydept') {
      await this.reports.sendUserMyDeptInfo(chatId, boundUser);
    } else if (dataStr === 'cb_contacts') {
      await this.reports.sendOrganizationContacts(chatId);
    } else if (dataStr === 'cb_help') {
      await this.reports.sendUserHelpGuide(chatId, boundUser);
    } else if (dataStr === 'cb_menu') {
      await this.sendMenuWithWelcome(chatId, boundUser);
    } else if (dataStr === 'cb_logout') {
      await this.auth.handleLogoutAccount(chatId);
    }
  }

  async sendMenuWithWelcome(chatId: string, boundUser: any) {
    const isSuperAdmin = boundUser.role === 'SUPER_ADMIN';
    const isStaff = STAFF_ROLES.includes(boundUser.role);

    // 1. SUPER ADMIN UCHUN MAXSUS SODDA VA QULAY MENYU
    if (isSuperAdmin) {
      const superAdminReplyKeyboard = {
        keyboard: [
          [{ text: '📊 Excel Ombor Holati' }, { text: '👥 Excel Xodimlar' }],
          [{ text: "🏢 Excel Bo'lim Jihozlari" }, { text: '📦 Excel Operatsiyalar' }],
          [{ text: '📜 Excel Tarix' }, { text: '📄 Server Loglari' }],
          [{ text: '🚪 Tizimdan Chiqish (/logout)' }],
        ],
        resize_keyboard: true,
      };

      await this.sender.sendMessageWithKeyboard(
        `🏛 <b>WMS Boshqaruv Tizimi</b>\n\n` +
        `<b>${escapeHtml(boundUser.fullName)}</b>\n` +
        `Super Administrator • ${escapeHtml(boundUser.department?.name || 'Markaziy Boshqarma')}\n\n` +
        `<blockquote>ℹ️ Kerakli hisobotlarni olish uchun quyidagi tugmalardan foydalaning yoki xodim F.I.SH/jihoz inventar raqamini yuboring.</blockquote>`,
        superAdminReplyKeyboard,
        chatId,
      );

      return;
    }

    const isOrgAdmin = boundUser.role === 'ORG_ADMIN';

    // 2. ORG ADMIN (TASHKILOT ADMINI) UCHUN MAXSUS REJIM
    if (isOrgAdmin) {
      if (!boundUser.organizationId) {
        await this.sender.sendMessage(
          `⚠️ <b>Xavfsizlik ogohlantirishi!</b>\n\nSizning akkauntingizga biror tashkilot biriktirilmagan. Xavfsizlik qoidalariga binoan ma'lumotlarni ko'rish qat'iyan cheklangan. Bosh administratorga murojaat qiling.`,
          chatId,
        );
        return;
      }

      const orgAdminReplyKeyboard = {
        keyboard: [
          [{ text: '📊 Excel Ombor Holati' }, { text: '👥 Excel Xodimlar' }],
          [{ text: "🏢 Excel Bo'lim Jihozlari" }, { text: '📜 Excel Tarix' }],
          [{ text: '📋 Tashkilot Talabnomalari' }, { text: '🚪 Tizimdan Chiqish (/logout)' }],
        ],
        resize_keyboard: true,
      };

      await this.sender.sendMessageWithKeyboard(
        `🏛 <b>Tashkilot Admini Paneli</b>\n\n` +
        `<b>${escapeHtml(boundUser.fullName)}</b>\n` +
        `Tashkilot: ${escapeHtml(boundUser.organization?.name || 'Tashkilot')} • ${escapeHtml(boundUser.department?.name || 'Boshqaruv')}\n\n` +
        `<blockquote>ℹ️ Tashkilotingiz hisobotlari va talabnomalarini boshqarish uchun quyidagi menyudan foydalaning.</blockquote>`,
        orgAdminReplyKeyboard,
        chatId,
      );
      return;
    }

    const isWarehouseStaff = boundUser.role === 'VAZIRLIK_OMBORCHI' || boundUser.role === 'ORG_OMBORCHI';

    // 3. OMBORCHI UCHUN MAXSUS REJIM (VAZIRLIK_OMBORCHI & ORG_OMBORCHI)
    if (isWarehouseStaff) {
      if (boundUser.role === 'ORG_OMBORCHI' && !boundUser.organizationId) {
        await this.sender.sendMessage(
          `⚠️ <b>Xavfsizlik ogohlantirishi!</b>\n\nSizning akkauntingizga biror tashkilot biriktirilmagan. Xavfsizlik qoidalariga binoan ma'lumotlarni ko'rish qat'iyan cheklangan. Bosh administratorga murojaat qiling.`,
          chatId,
        );
        return;
      }

      const warehouseReplyKeyboard = {
        keyboard: [
          [{ text: '📊 Excel Ombor Holati' }, { text: '📜 Excel Tarix' }],
          [{ text: '👥 Excel Xodimlar' }, { text: '🏢 Excel Berilgan Jihozlar' }],
          [{ text: '📋 Yangi Talabnomalar' }, { text: '🚪 Tizimdan Chiqish (/logout)' }],
        ],
        resize_keyboard: true,
      };

      await this.sender.sendMessageWithKeyboard(
        `📦 <b>Omborxona Boshqaruvi</b>\n\n` +
        `<b>${escapeHtml(boundUser.fullName)}</b>\n` +
        `Omborchi • ${escapeHtml(boundUser.department?.name || 'Omborxona')}\n\n` +
        `<blockquote>ℹ️ Ombor hisobotlari va talabnomalarni ko'rish uchun quyidagi menyudan foydalaning yoki jihoz inventar raqamini yuboring.</blockquote>`,
        warehouseReplyKeyboard,
        chatId,
      );
      return;
    }

    const isEmployee = boundUser.role === 'XODIM';

    // 4. ODDIY XODIM (XODIM) UCHUN MAXSUS REJIM
    if (isEmployee) {
      const employeeReplyKeyboard = {
        keyboard: [
          [{ text: '📱 Mening Jihozlarim' }, { text: '📜 Mening Tarixim' }],
          [{ text: '🏢 Mening Bo‘limim' }, { text: '📋 Mening So‘rovlarim' }],
          [{ text: '❓ Qo‘llanma / Aloqa' }, { text: '🚪 Tizimdan Chiqish (/logout)' }],
        ],
        resize_keyboard: true,
      };

      await this.sender.sendMessageWithKeyboard(
        `📱 <b>Xodim Shaxsiy Kabineti</b>\n\n` +
        `<b>${escapeHtml(boundUser.fullName)}</b>\n` +
        `${escapeHtml(boundUser.position || 'Xodim')} • ${escapeHtml(boundUser.department?.name || 'Biriktirilmagan')}\n\n` +
        `<blockquote>ℹ️ O'zingizga biriktirilgan jihozlar, tarixingiz va so'rovlaringizni ko'rish uchun quyidagi menyudan foydalaning.</blockquote>`,
        employeeReplyKeyboard,
        chatId,
      );
      return;
    }

    // 5. QOLGAN ROLLAR UCHUN ASOSIY MENYU (Kadrlar, Rahbariyat)
    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
    const webAppUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/login-page?chatId=${chatId}`;

    const replyKeyboard = {
      keyboard: [
        [{ text: '📋 Asosiy Menyu 🏛️' }, { text: isStaff ? '📦 Ombor Qoldiqlari' : '📱 Mening Jihozlarim 📦' }],
        [{ text: '❓ Yordam / Qo‘llanma' }, { text: '🚪 Tizimdan Chiqish (/logout)' }],
      ],
      resize_keyboard: true,
    };

    await this.sender.sendMessageWithKeyboard(
      `🏛 <b>WMS Boshqaruv Tizimi</b>\n\n` +
      `<b>${escapeHtml(boundUser.fullName)}</b>\n` +
      `${escapeHtml(boundUser.position || boundUser.role)} • ${escapeHtml(boundUser.department?.name || 'Markaziy Boshqarma')}`,
      replyKeyboard,
      chatId,
    );

    /*
    // Interaktiv inline amallar va bo'limlar kartochkasi vaqtinchalik kommentga olindi:
    let inlineRows: any[][] = [];

    if (isStaff) {
      inlineRows = [
        [
          { text: '📦 Ombor Qoldiqlari', callback_data: 'cb_stock' },
          { text: '👥 Xodimlar Ro‘yxati', callback_data: 'cb_users' },
        ],
        [
          { text: '⚠️ Kamayganlar', callback_data: 'cb_lowstock' },
          { text: '📜 Operatsiyalar', callback_data: 'cb_recent' },
        ],
        [
          { text: '🏢 Bo‘limlar', callback_data: 'cb_depts' },
          { text: '📊 Statistika', callback_data: 'cb_status' },
        ],
        [
          { text: '📥 Excel Qoldiqlar', callback_data: 'cb_excel_stock' },
          { text: '📥 Excel Xodimlar', callback_data: 'cb_excel_users' },
        ],
        [
          { text: '📥 Excel Tarix', callback_data: 'cb_excel_recent' },
          { text: '📥 Excel Stats', callback_data: 'cb_excel_stats' },
        ],
        [
          { text: '🤖 AI Assistent', callback_data: 'cb_ai' },
          { text: '🚨 Qaytarishlar', callback_data: 'cb_offboarding' },
        ],
      ];
    } else {
      inlineRows = [
        [
          { text: '📱 Mening Jihozlarim', callback_data: 'cb_myassets' },
          { text: '📜 Tarixim', callback_data: 'cb_myhistory' },
        ],
        [
          { text: '🏢 Mening Bo‘limim', callback_data: 'cb_mydept' },
          { text: '📞 Ichki Aloqa', callback_data: 'cb_contacts' },
        ],
        [
          { text: '🤖 AI Assistent', callback_data: 'cb_ai' },
          { text: '❓ Qo‘llanma', callback_data: 'cb_help' },
        ],
      ];
    }

    if (webAppUrl.startsWith('https://')) {
      inlineRows.push([
        { text: '🌐 WMS Web App Tizimiga Kirish ↗', web_app: { url: webAppUrl } },
      ]);
    }

    const inlineKeyboard = {
      inline_keyboard: inlineRows,
    };

    await this.sender.sendMessageWithKeyboard(
      `👇 <b>Interaktiv amallar va bo'limlar:</b>`,
      inlineKeyboard,
      chatId,
    );
    */
  }

  // --- Delegated Public Helpers & Methods ---

  async sendStockExcel(chatId: string) {
    return this.excelReports.sendStockExcel(chatId);
  }

  async sendUsersExcel(chatId: string) {
    return this.excelReports.sendUsersExcel(chatId);
  }

  async sendOperationsExcel(chatId: string) {
    return this.excelReports.sendOperationsExcel(chatId);
  }

  async sendStatsExcel(chatId: string) {
    return this.excelReports.sendStatsExcel(chatId);
  }

  async sendDepartmentsExcel(chatId: string) {
    return this.excelReports.sendDepartmentsExcel(chatId);
  }

  async sendAuditLogsExcel(chatId: string) {
    return this.excelReports.sendAuditLogsExcel(chatId);
  }

  async sendAssignmentsExcel(chatId: string) {
    return this.excelReports.sendAssignmentsExcel(chatId);
  }

  async sendOfficialDocument(docTitle: string, data: any, overrideChatId?: string) {
    return this.reports.sendOfficialDocument(docTitle, data, overrideChatId);
  }

  async sendDocumentBuffer(filename: string, buffer: Buffer, caption: string, overrideChatId?: string, organizationId?: string): Promise<boolean> {
    return this.sender.sendDocumentBuffer(filename, buffer, caption, overrideChatId, organizationId);
  }

  async sendChatAction(action: string = 'typing', overrideChatId?: string): Promise<boolean> {
    return this.sender.sendChatAction(action, overrideChatId);
  }

  async sendMessage(message: string, overrideChatId?: string, organizationId?: string): Promise<boolean> {
    return this.sender.sendMessage(message, overrideChatId, organizationId);
  }

  async sendLowStockAlert(productName: string, currentStock: number, minLevel: number, chatId?: string, organizationId?: string) {
    const text =
      `⚠️ <b>Zaxira tugamoqda</b>\n\n` +
      `<b>${escapeHtml(productName)}</b>\n` +
      `Qoldiq: <code>${currentStock} ta</code> • Chegara: <code>${minLevel} ta</code>\n\n` +
      `<blockquote>📝 <b>Tavsiya:</b>\nZaxira kritik minimumdan tushib ketdi. Yangi xarid buyurtmasini shakllantiring.</blockquote>`;

    return this.sender.sendMessage(text, chatId, organizationId);
  }

  async sendAdminNewUserAlert(userFullName: string, position: string, departmentName: string, organizationId?: string) {
    const text =
      `👤 <b>Yangi xodim qo‘shildi</b>\n\n` +
      `<b>${escapeHtml(userFullName)}</b>\n` +
      `${escapeHtml(position || 'Xodim')} • ${escapeHtml(departmentName || 'Bo‘limsiz')}\n\n` +
      `<blockquote>ℹ️ Tizimga yangi xodim muvaffaqiyatli ro'yxatdan o'tkazildi.</blockquote>`;

    return this.sender.sendMessage(text, undefined, organizationId);
  }

  async sendOffboardingAlert(userFullName: string, departmentName: string, startedByName: string, organizationId?: string) {
    const text =
      `🚨 <b>Ishdan bo‘shatish jarayoni</b>\n\n` +
      `<b>${escapeHtml(userFullName)}</b>\n` +
      `${escapeHtml(departmentName || 'Bo‘limsiz')}\n\n` +
      `<blockquote>✍️ <b>Boshladi:</b> ${escapeHtml(startedByName)}\nOffboarding doirasida biriktirilgan jihozlar qaytarilishi nazoratga olindi.</blockquote>`;

    return this.sender.sendMessage(text, undefined, organizationId);
  }

  async sendOperationAlert(opType: string, productName: string, quantity: number, targetName: string, performerName: string, unit = 'ta', organizationId?: string) {
    const text =
      `📦 <b>${escapeHtml(opType)}</b>\n\n` +
      `<b>${escapeHtml(productName)}</b> (${quantity} ${escapeHtml(unit)})\n` +
      `Qabul qiluvchi: <b>${escapeHtml(targetName)}</b>\n\n` +
      `<blockquote>📤 <b>Mas'ul:</b> ${escapeHtml(performerName)}</blockquote>`;

    return this.sender.sendMessage(text, undefined, organizationId);
  }

  /**
   * Omborchilarga yangi talabnoma (mahsulot so'rovi) bo'yicha bildirishnoma yuborish
   */
  async notifySupplyRequestCreated(data: {
    senderName: string;
    departmentName?: string;
    organizationName?: string;
    organizationId?: string;
    productName: string;
    reason: string;
  }) {
    const deptStr = data.departmentName ? ` • ${escapeHtml(data.departmentName)}` : '';
    const orgStr = data.organizationName ? `\n🏢 <b>Tashkilot:</b> ${escapeHtml(data.organizationName)}` : '';

    const message =
      `📋 <b>Yangi talabnoma kelib tushdi</b>\n\n` +
      `<b>${escapeHtml(data.productName)}</b>` +
      orgStr + `\n` +
      `👤 ${escapeHtml(data.senderName)}${deptStr}\n\n` +
      `<blockquote>📝 <b>Ehtiyoj asosi:</b>\n${escapeHtml(data.reason)}</blockquote>\n\n` +
      `ℹ️ Ko'rib chiqish uchun veb-tizimga kiring.`;

    return this.sender.sendWarehouseMessage(message, data.organizationId);
  }

  async sendUserNotificationAlert(userId: string, title: string, message: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, fullName: true },
      });

      if (!user || !user.telegramChatId) return false;

      const fullText =
        `${title}\n\n` +
        `${message}`;

      return this.sender.sendMessage(fullText, user.telegramChatId);
    } catch (err) {
      return false;
    }
  }

  /**
   * Inventar yoki seriya raqami bo'yicha tezkor bazaviy qidiruv (0.05 soniya)
   */
  async searchAssetByInventoryNumber(query: string, chatId: string, boundUser: any): Promise<boolean> {
    if (!query) return false;
    const cleanQuery = query.trim();
    if (cleanQuery.startsWith('/') || cleanQuery.length < 3 || cleanQuery.length > 50) {
      return false;
    }

    try {
      const isOrgScoped = boundUser?.role === 'ORG_OMBORCHI' || boundUser?.role === 'ORG_ADMIN';

      // Qat'iy xavfsizlik: Tashkilot omborchisi yoki admini o'z organizationId siga ega bo'lmasa, hech narsa ko'rsatilmaydi!
      if (isOrgScoped && !boundUser?.organizationId) {
        return false;
      }

      const orgId = isOrgScoped ? boundUser.organizationId : undefined;

      const asset = await this.prisma.asset.findFirst({
        where: {
          deletedAt: null,
          ...(orgId ? { organizationId: orgId } : {}),
          OR: [
            { inventoryNumber: { equals: cleanQuery, mode: 'insensitive' } },
            { serialNumber: { equals: cleanQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          product: true,
          organization: true,
          assignments: {
            where: { returnedAt: null },
            include: {
              user: {
                include: {
                  department: true,
                },
              },
              department: true,
            },
            orderBy: { assignedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!asset) {
        return false;
      }

      // Xavfsizlik: Boshqa tashkilot jihozi bo'lsa darhol bloklash
      if (isOrgScoped && asset.organizationId !== boundUser.organizationId) {
        return false;
      }

      const activeAssignment = asset.assignments && asset.assignments.length > 0 ? asset.assignments[0] : null;
      const serialStr = asset.serialNumber ? ` • Seriya: <code>${escapeHtml(asset.serialNumber)}</code>` : '';
      let statusQuote = '';

      if (activeAssignment && (activeAssignment.user || activeAssignment.department)) {
        const assigneeName = activeAssignment.user?.fullName || 'Noma\'lum xodim';
        const deptName = activeAssignment.department?.name || activeAssignment.user?.department?.name || '';
        const deptStr = deptName ? ` (${deptName})` : '';
        const assignDate = activeAssignment.assignedAt
          ? new Date(activeAssignment.assignedAt).toLocaleDateString('uz-UZ')
          : '';

        statusQuote =
          `<blockquote>✅ <b>Foydalanishda:</b> ${escapeHtml(assigneeName)}${escapeHtml(deptStr)}\n` +
          `📅 Biriktirilgan: ${assignDate}</blockquote>`;
      } else {
        statusQuote = `<blockquote>📦 <b>Holati:</b> Omborda mavjud</blockquote>`;
      }

      const orgStr = asset.organization?.name ? `\n🏢 ${escapeHtml(asset.organization.name)}` : '';

      const textCard =
        `🔍 <b>Aktiv ma'lumoti</b>\n\n` +
        `<b>${escapeHtml(asset.product?.name || 'Jihoz')}</b>\n` +
        `№ <code>${escapeHtml(asset.inventoryNumber)}</code>${serialStr}\n\n` +
        statusQuote + orgStr;

      await this.sender.sendMessage(textCard, chatId);
      return true;
    } catch (err: any) {
      this.logger.error(`Asset lookup error for query "${cleanQuery}": ${err?.message}`);
      return false;
    }
  }

  /**
   * Xodim ismi yoki familiyasi bo'yicha tezkor bazaviy qidiruv (Tashkilot admini va Super Admin uchun)
   */
  async searchUserByName(query: string, chatId: string, boundUser: any): Promise<boolean> {
    if (!query) return false;
    const cleanQuery = query.trim();
    if (cleanQuery.startsWith('/') || cleanQuery.length < 3) {
      return false;
    }

    try {
      const isOrgAdmin = boundUser?.role === 'ORG_ADMIN';
      const isSuperAdmin = boundUser?.role === 'SUPER_ADMIN';

      if (!isOrgAdmin && !isSuperAdmin) {
        return false;
      }

      // Xavfsizlik: Org Admin faqat o'z tashkilotidagi xodimlarni qidira oladi
      const orgFilter: any = {};
      if (isOrgAdmin) {
        if (!boundUser.organizationId) {
          return false;
        }
        orgFilter.organizationId = boundUser.organizationId;
      }

      const users = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...orgFilter,
          OR: [
            { fullName: { contains: cleanQuery, mode: 'insensitive' } },
            { username: { contains: cleanQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          department: true,
          organization: true,
          assignments: {
            where: { returnedAt: null },
            include: { asset: { include: { product: true } } },
          },
        },
        take: 5,
      });

      if (!users || users.length === 0) {
        return false;
      }

      for (const u of users) {
        const assetsCount = u.assignments?.length || 0;
        let assetsListStr = '';
        if (assetsCount > 0) {
          assetsListStr = u.assignments
            .slice(0, 5)
            .map((a, i) => `  ${i + 1}. <b>${escapeHtml(a.asset.product.name)}</b> (Inv №: <code>${escapeHtml(a.asset.inventoryNumber)}</code>)`)
            .join('\n');
          if (assetsCount > 5) {
            assetsListStr += `\n  <i>...va yana ${assetsCount - 5} ta jihoz</i>`;
          }
        } else {
          assetsListStr = `  <i>Hozirda biriktirilgan jihozlar yo'q</i>`;
        }

        const userCard =
          `👤 <b>XODIM MA'LUMOTI</b>\n\n` +
          `• <b>F.I.SH:</b> <b>${escapeHtml(u.fullName)}</b>\n` +
          `• <b>Lavozimi:</b> ${escapeHtml(u.position || 'Xodim')}\n` +
          `• <b>Bo'limi:</b> ${escapeHtml(u.department?.name || 'Biriktirilmagan')}\n` +
          `• <b>Tashkilot:</b> ${escapeHtml(u.organization?.name || 'Asosiy')}\n` +
          `• <b>Telefon:</b> <code>${escapeHtml(u.phone || u.internalPhone || '—')}</code>\n` +
          `• <b>Holati:</b> ${u.isActive ? '🟢 Faol' : '🔴 Nofaol'}\n\n` +
          `📦 <b>Biriktirilgan jihozlar (${assetsCount} ta):</b>\n${assetsListStr}`;

        await this.sender.sendMessage(userCard, chatId);
      }

      return true;
    } catch (err: any) {
      this.logger.error(`Error in searchUserByName: ${err?.message}`);
      return false;
    }
  }

  /**
   * Omborchi, Tashkilot Admini yoki Super Admin uchun yangi kutilayotgan talabnomalar va so'rovlar ro'yxatini chiqarish
   */
  async sendPendingRequests(chatId: string, boundUser: any) {
    try {
      await this.sender.sendChatAction('typing', chatId);
      const isOrgScoped = boundUser?.role === 'ORG_OMBORCHI' || boundUser?.role === 'ORG_ADMIN';

      if (isOrgScoped && !boundUser?.organizationId) {
        await this.sender.sendMessage(
          `⚠️ <b>Tashkilot aniqlanmadi!</b>\n\nSizning hisobingizga biriktirilgan tashkilot ma'lumoti topilmadi.`,
          chatId,
        );
        return;
      }

      const orgId = isOrgScoped ? boundUser.organizationId : undefined;

      const requests = await this.prisma.deletionRequest.findMany({
        where: {
          status: 'PENDING',
          ...(orgId ? { organizationId: orgId } : {}),
        },
        include: {
          requestedBy: {
            include: {
              department: true,
            },
          },
          organization: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (!requests || requests.length === 0) {
        await this.sender.sendMessage(
          `📋 <b>KUTILAYOTGAN TALABNOMALAR VA SO'ROVLAR</b>\n\n` +
          `✅ Hozirda ko'rib chiqilishi kutilayotgan yangi talabnomalar mavjud emas. Barcha so'rovlar ko'rib chiqilgan!`,
          chatId,
        );
        return;
      }

      let msg = `📋 <b>KUTILAYOTGAN TALABNOMALAR VA SO'ROVLAR (${requests.length} ta):</b>\n\n`;

      requests.forEach((req, idx) => {
        const reqDate = new Date(req.createdAt).toLocaleString('uz-UZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const rLower = (req.reason || '').toLowerCase();
        let badge = '📋 So\'rov';
        if (rLower.includes('talabnoma') || rLower.includes('so\'rovi') || rLower.includes('supply')) {
          badge = '📦 Talabnoma (Mahsulot so\'rovi)';
        } else if (rLower.includes('tamir') || rLower.includes('repair')) {
          badge = '🔧 Ta\'mir so\'rovi';
        } else if (rLower.includes('qaytarish') || rLower.includes('return')) {
          badge = '📥 Qaytarish so\'rovi';
        } else {
          badge = '🗑 O\'chirish / Hisobdan chiqarish';
        }

        msg +=
          `<b>${idx + 1}. ${badge}</b>\n` +
          `👤 <b>Kimdan:</b> ${escapeHtml(req.requestedBy?.fullName || 'Noma\'lum')} (<i>${escapeHtml(req.requestedBy?.department?.name || 'Bo\'limsiz')}</i>)\n` +
          `📦 <b>Obyekt / Nomi:</b> ${escapeHtml(req.entityName || 'Noma\'lum')}\n` +
          `📝 <b>Izoh:</b> ${escapeHtml((req.reason || '—').slice(0, 120))}\n` +
          `📅 <b>Sana:</b> <i>${reqDate}</i>\n\n`;
      });

      msg += `ℹ️ <i>Talabnomalarni tasdiqlash yoki rad etish uchun tizim veb-platformasiga kiring.</i>`;
      await this.sender.sendMessage(msg, chatId);
    } catch (err: any) {
      this.logger.error(`Error in sendPendingRequests: ${err?.message}`);
      await this.sender.sendMessage(`❌ Talabnomalarni yuklashda xatolik yuz berdi.`, chatId);
    }
  }

  /**
   * Xodim yuborgan inventar yoki seriya raqami bo'yicha unga biriktirilgan aktivni qidirish
   */
  async searchMyAssetByInventoryNumber(query: string, chatId: string, boundUser: any): Promise<boolean> {
    if (!query) return false;
    const cleanQuery = query.trim();
    if (cleanQuery.startsWith('/') || cleanQuery.length < 3 || cleanQuery.length > 50) return false;

    try {
      const assignment = await this.prisma.assignment.findFirst({
        where: {
          userId: boundUser.id,
          returnedAt: null,
          asset: {
            deletedAt: null,
            OR: [
              { inventoryNumber: { equals: cleanQuery, mode: 'insensitive' } },
              { serialNumber: { equals: cleanQuery, mode: 'insensitive' } },
            ],
          },
        },
        include: {
          asset: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!assignment || !assignment.asset) return false;

      const a = assignment.asset;
      const assignDate = assignment.assignedAt
        ? new Date(assignment.assignedAt).toLocaleDateString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—';

      const serialStr = a.serialNumber ? ` • Seriya: <code>${escapeHtml(a.serialNumber)}</code>` : '';
      const textCard =
        `📱 <b>Sizning shaxsiy jihozingiz</b>\n\n` +
        `<b>${escapeHtml(a.product?.name || 'Jihoz')}</b>\n` +
        `№ <code>${escapeHtml(a.inventoryNumber)}</code>${serialStr}\n\n` +
        `<blockquote>✅ <b>Holati:</b> Foydalanishingizda\n📅 <b>Biriktirilgan:</b> ${assignDate}</blockquote>\n\n` +
        `ℹ️ Jihozni ta'mirlash yoki topshirish lozim bo'lsa, tizim orqali talabnoma yuborishingiz mumkin.`;

      await this.sender.sendMessage(textCard, chatId);
      return true;
    } catch (err: any) {
      return false;
    }
  }
}
