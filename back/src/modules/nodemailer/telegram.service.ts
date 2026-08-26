import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AiService } from './ai.service';
import { EventsGateway } from '../events/events.gateway';
import { TelegramSenderService, STAFF_ROLES } from './services/telegram-sender.service';
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
            { command: 'ai', description: 'AI Assistentga savol berish' },
            { command: 'login', description: 'Tizimga kirish (/login username parol)' },
            { command: 'myassets', description: 'Mening biriktirilgan jihozlarim' },
            { command: 'myhistory', description: 'Mening operatsiyalar tarixim' },
            { command: 'mydept', description: 'Mening bo‘limim' },
            { command: 'stock_export', description: 'Ombor excel hisobot (Admin)' },
            { command: 'users_export', description: 'Xodimlar excel hisobot (Admin)' },
            { command: 'recent_export', description: 'Tarix excel hisobot (Admin)' },
            { command: 'stats_export', description: 'Statistika excel (Admin)' },
            { command: 'logs', description: 'Server loglarini yuklab olish (.log) (Admin)' },
            { command: 'logout', description: 'Tizimdan chiqish' },
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
  private startPolling() {
    const { token } = this.getCredentials();
    if (!token) return;

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
                include: { department: true },
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
                include: { department: true },
              });

              if (!boundUser) {
                if (text.startsWith('/login') || text === '🔑 Kirish (/login)' || this.auth.loginSessions.has(chatId)) {
                  await this.auth.handleLoginFlow(text, chatId, async (u) => {
                    await this.sendMenuWithWelcome(chatId, u);
                  });
                } else {
                  await this.auth.sendLoginPrompt(chatId);
                }
                continue;
              }

              const isStaff = STAFF_ROLES.includes(boundUser.role);

              if (text === '/logout' || text === '🚪 Tizimdan chiqish' || text === '🚪 Tizimdan Chiqish') {
                await this.auth.handleLogoutAccount(chatId);
              } else if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
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
              } else if (text === '👥 Xodimlar Ro‘yxati' || text === '👥 Xodimlar' || text.startsWith('/users')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/users', '').trim(), 10) || 1;
                  await this.reports.sendUsersReport(chatId, page);
                }
              } else if (text === '📦 Ombor Qoldiqlari' || text === '📦 Qoldiqlar' || text.startsWith('/stock')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/stock', '').trim(), 10) || 1;
                  await this.reports.sendStockReport(chatId, page);
                }
              } else if (text === '⚠️ Kamaygan Tovarlar' || text === '⚠️ Kam Qolganlar' || text.startsWith('/lowstock')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/lowstock', '').trim(), 10) || 1;
                  await this.reports.sendLowStockReport(chatId, page);
                }
              } else if (text === '📜 Oxirgi Operatsiyalar' || text === '📜 Operatsiyalar' || text.startsWith('/recent')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/recent', '').trim(), 10) || 1;
                  await this.reports.sendRecentOperations(chatId, page);
                }
              } else if (text === '🏢 Bo‘limlar Nazorati' || text === '🏢 Bo‘limlar' || text.startsWith('/depts')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/depts', '').trim(), 10) || 1;
                  await this.reports.sendDepartmentsReport(chatId, page);
                }
              } else if (text === '📊 Tizim Statistikasi' || text === '📊 Statistika' || text === '/status') {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  await this.reports.sendStatusReport(chatId);
                }
              } else if (text === '/logs' || text.startsWith('/log') || text === '📄 Server Loglari' || text === '📄 Loglar') {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const parts = text.split(' ');
                  const linesArg = parseInt(parts[1], 10) || 1000;
                  await this.reports.sendServerLogsFile(chatId, linesArg);
                }
              } else if (text === '🚨 Qaytarishlar (Offboard)' || text.startsWith('/offboarding')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/offboarding', '').trim(), 10) || 1;
                  await this.reports.sendOffboardingReport(chatId, page);
                }
              } else if (text === '🔍 Mahsulot Qidirish' || text.startsWith('/find')) {
                if (!isStaff) {
                  await this.reports.sendAccessDenied(chatId);
                } else {
                  const query = text.replace('🔍 Mahsulot Qidirish', '').replace('/find', '').trim();
                  if (!query) {
                    await this.sender.sendMessage('🔍 <b>Mahsulot Qidirish</b>\n\nNomini yozing: <code>/find Lenovo</code>', chatId);
                  } else {
                    await this.reports.searchProducts(query, chatId, 1);
                  }
                }
              } else if (
                isStaff &&
                (text.toLowerCase().includes('excel') ||
                  text.toLowerCase().includes('.xlsx') ||
                  text.toLowerCase().includes('yuklab ber') ||
                  text.toLowerCase().includes('yukla') ||
                  text.toLowerCase().includes('export') ||
                  text.toLowerCase().includes('fayl') ||
                  text.startsWith('/'))
              ) {
                const lower = text.toLowerCase();
                if (lower.includes('bo\'lim') || lower.includes('bolim') || lower.includes('dept') || lower.includes('/depts_export')) {
                  await this.excelReports.sendDepartmentsExcel(chatId);
                } else if (lower.includes('audit') || lower.includes('log') || lower.includes('/audit_export')) {
                  await this.excelReports.sendAuditLogsExcel(chatId);
                } else if (lower.includes('berilgan') || lower.includes('jihoz') || lower.includes('asset') || lower.includes('biriktirilgan') || lower.includes('/assets_export')) {
                  await this.excelReports.sendAssignmentsExcel(chatId);
                } else if (lower.includes('xodim') || lower.includes('user') || lower.includes('xodiml') || lower.includes('/users_export')) {
                  await this.excelReports.sendUsersExcel(chatId);
                } else if (lower.includes('tarix') || lower.includes('recent') || lower.includes('operatsiya') || lower.includes('/recent_export')) {
                  await this.excelReports.sendOperationsExcel(chatId);
                } else if (lower.includes('stat') || lower.includes('status') || lower.includes('/stats_export')) {
                  await this.excelReports.sendStatsExcel(chatId);
                } else if (lower.includes('ombor') || lower.includes('qoldiq') || lower.includes('stock') || lower.includes('mahsulot') || lower.includes('/stock_export')) {
                  await this.excelReports.sendStockExcel(chatId);
                } else {
                  await this.excelReports.sendStockExcel(chatId);
                }
              } else if (text.startsWith('/ai ') || text.startsWith('🤖 AI') || text === '/ai') {
                const query = text.replace('/ai ', '').replace('🤖 AI Assistent', '').replace('🤖 AI', '').replace('/ai', '').trim();
                if (!query) {
                  await this.sender.sendMessage(
                    `🤖 <b>WMS-AI Assistent</b>\n\nSavolingizni yozing. Misol: <code>${isStaff ? '/ai Omborda nechta noutbuk bor?' : '/ai Mening nomimda qanday jihozlar bor?'}</code>`,
                    chatId,
                  );
                } else {
                  await this.sender.sendChatAction('typing', chatId);
                  const aiResponse = await this.aiService.askAi(query, boundUser);
                  await this.sender.sendMessage(aiResponse, chatId);
                }
              } else {
                await this.sender.sendChatAction('typing', chatId);
                const aiResponse = await this.aiService.askAi(text, boundUser);
                await this.sender.sendMessage(aiResponse, chatId);
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

    if (dataStr === 'cb_ai') {
      await this.sender.sendMessage(
        `🤖 <b>WMS-AI Assistent</b>\n\n` +
        `Marhamat, savolingizni yozib yuboring:\n` +
        `<i>Misol: <code>${isStaff ? 'Omborda zaxirasi tugayotgan tovarlar bormi?' : 'Mening nomimda qanday jihozlar bor?'}</code></i>`,
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

      if (dataStr === 'cb_excel_stock') {
        await this.excelReports.sendStockExcel(chatId);
      } else if (dataStr === 'cb_excel_users') {
        await this.excelReports.sendUsersExcel(chatId);
      } else if (dataStr === 'cb_excel_recent') {
        await this.excelReports.sendOperationsExcel(chatId);
      } else if (dataStr === 'cb_excel_stats') {
        await this.excelReports.sendStatsExcel(chatId);
      } else if (dataStr.startsWith('cb_stock')) {
        const page = parseInt(dataStr.replace('cb_stock_page_', '').replace('cb_stock', ''), 10) || 1;
        await this.reports.sendStockReport(chatId, page);
      } else if (dataStr.startsWith('cb_users')) {
        const page = parseInt(dataStr.replace('cb_users_page_', '').replace('cb_users', ''), 10) || 1;
        await this.reports.sendUsersReport(chatId, page);
      } else if (dataStr.startsWith('cb_lowstock')) {
        const page = parseInt(dataStr.replace('cb_lowstock_page_', '').replace('cb_lowstock', ''), 10) || 1;
        await this.reports.sendLowStockReport(chatId, page);
      } else if (dataStr.startsWith('cb_recent')) {
        const page = parseInt(dataStr.replace('cb_recent_page_', '').replace('cb_recent', ''), 10) || 1;
        await this.reports.sendRecentOperations(chatId, page);
      } else if (dataStr.startsWith('cb_depts')) {
        const page = parseInt(dataStr.replace('cb_depts_page_', '').replace('cb_depts', ''), 10) || 1;
        await this.reports.sendDepartmentsReport(chatId, page);
      } else if (dataStr.startsWith('cb_offboarding')) {
        const page = parseInt(dataStr.replace('cb_offboarding_page_', '').replace('cb_offboarding', ''), 10) || 1;
        await this.reports.sendOffboardingReport(chatId, page);
      } else if (dataStr.startsWith('cb_find')) {
        if (dataStr.includes('_page_')) {
          const rest = dataStr.replace('cb_find_page_', '');
          const [pageStr, queryStr] = rest.split(':');
          const page = parseInt(pageStr, 10) || 1;
          await this.reports.searchProducts(queryStr || '', chatId, page);
        } else {
          await this.sender.sendMessage('🔍 <b>Mahsulot Qidirish</b>\n\nNomini yozing: <code>/find Lenovo</code>', chatId);
        }
      } else if (dataStr === 'cb_status') {
        await this.reports.sendStatusReport(chatId);
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
    const isStaff = STAFF_ROLES.includes(boundUser.role);

    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
    const webAppUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/login-page?chatId=${chatId}`;

    const replyKeyboard = {
      keyboard: [
        [{ text: '📋 Asosiy Menyu 🏛️' }, { text: isStaff ? '📦 Ombor Qoldiqlari' : '📱 Mening Jihozlarim 📦' }],
        [{ text: '❓ Yordam / Qo‘llanma' }, { text: '🚪 Tizimdan Chiqish' }],
      ],
      resize_keyboard: true,
    };

    await this.sender.sendMessageWithKeyboard(
      `🏛 <b>WMS WAREHOUSE MANAGEMENT SYSTEM</b>\n\n` +
      `👤 <b>${boundUser.fullName}</b> | <i>${boundUser.position || boundUser.role}</i>\n` +
      `🏢 Bo'lim: <b>${boundUser.department?.name || 'Markaziy Boshqarma'}</b>`,
      replyKeyboard,
      chatId,
    );

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

  async sendDocumentBuffer(filename: string, buffer: Buffer, caption: string, overrideChatId?: string): Promise<boolean> {
    return this.sender.sendDocumentBuffer(filename, buffer, caption, overrideChatId);
  }

  async sendChatAction(action: string = 'typing', overrideChatId?: string): Promise<boolean> {
    return this.sender.sendChatAction(action, overrideChatId);
  }

  async sendMessage(message: string, overrideChatId?: string): Promise<boolean> {
    return this.sender.sendMessage(message, overrideChatId);
  }

  async sendLowStockAlert(productName: string, currentStock: number, minLevel: number, chatId?: string) {
    const text =
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `⚠️ <b>OMBOR ZAXIRASI OGOHLANTIRISHI</b>\n\n` +
      `📦 Mahsulot: <b>${productName}</b>\n` +
      `🔴 Joriy qoldiq: <b>${currentStock} ta</b>\n` +
      `⚠️ Minimal chegara: <b>${minLevel} ta</b>`;

    return this.sender.sendMessage(text, chatId);
  }

  async sendAdminNewUserAlert(userFullName: string, position: string, departmentName: string) {
    const formattedDate = new Date().toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text =
      `👤 <b>Yangi xodim qo‘shildi</b>\n\n` +
      `👤 <b>F.I.SH:</b> ${userFullName}\n` +
      `💼 <b>Lavozim:</b> ${position || 'Xodim'}\n` +
      `🏢 <b>Bo‘lim:</b> ${departmentName || "Biriktirilmagan"}\n` +
      `📅 <b>Sana:</b> ${formattedDate}`;

    return this.sender.sendMessage(text);
  }

  async sendOffboardingAlert(userFullName: string, departmentName: string, startedByName: string) {
    const formattedDate = new Date().toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text =
      `🚨 <b>Ishdan bo‘shatish jarayoni</b>\n\n` +
      `👤 <b>Xodim:</b> ${userFullName}\n` +
      `🏢 <b>Bo‘lim:</b> ${departmentName || "Bo‘limsiz"}\n` +
      `✍️ <b>Boshladi:</b> ${startedByName}\n` +
      `📅 <b>Sana:</b> ${formattedDate}`;

    return this.sender.sendMessage(text);
  }

  async sendOperationAlert(opType: string, productName: string, quantity: number, targetName: string, performerName: string, unit = 'ta') {
    const formattedDate = new Date().toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text =
      `📦 <b>${opType}</b>\n\n` +
      `📤 <b>Kimdan:</b> ${performerName}\n` +
      `📥 <b>Kimga:</b> ${targetName}\n` +
      `📦 <b>Mahsulot:</b> ${productName} (${quantity} ${unit})\n` +
      `📅 <b>Sana:</b> ${formattedDate}`;

    return this.sender.sendMessage(text);
  }

  async sendUserNotificationAlert(userId: string, title: string, message: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, fullName: true },
      });

      if (!user || !user.telegramChatId) return false;

      const formattedDate = new Date().toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const fullText =
        `🔔 <b>${title}</b>\n\n` +
        `Hurmatli <b>${user.fullName}</b>,\n` +
        `${message}\n\n` +
        `📅 <i>${formattedDate}</i>`;

      return this.sender.sendMessage(fullText, user.telegramChatId);
    } catch (err) {
      return false;
    }
  }
}
