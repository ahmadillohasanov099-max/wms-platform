import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AiService } from './ai.service';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';

import { EventsGateway } from '../events/events.gateway';

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'VAZIRLIK_OMBORCHI',
  'ADMIN',
  'OMBORCHI',
  'ORG_ADMIN',
  'ORG_OMBORCHI',
  'KADR',
];

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastUpdateId = 0;
  private isPollingActive = false;
  private processedUpdateIds = new Set<number>();
  private loginSessions = new Map<string, { step: 'USERNAME' | 'PASSWORD'; username?: string }>();
  private murojaatSessions = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private eventsGateway: EventsGateway,
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
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    return { token, chatId };
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
            { command: 'murojaat', description: 'Omborchiga murojaat yuborish' },
            { command: 'myassets', description: 'Mening biriktirilgan jihozlarim' },
            { command: 'myhistory', description: 'Mening operatsiyalar tarixim' },
            { command: 'mydept', description: 'Mening bo‘limim' },
            { command: 'stock_export', description: 'Ombor excel hisobot (Admin)' },
            { command: 'users_export', description: 'Xodimlar excel hisobot (Admin)' },
            { command: 'recent_export', description: 'Tarix excel hisobot (Admin)' },
            { command: 'stats_export', description: 'Statistika excel (Admin)' },
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

              await this.answerCallbackQuery(cb.id);

              const boundUser = await this.prisma.user.findFirst({
                where: { telegramChatId: chatId, deletedAt: null, isActive: true },
                include: { department: true },
              });

              if (!boundUser) {
                await this.sendLoginPrompt(chatId);
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
                if (text.startsWith('/login') || text === '🔑 Kirish (/login)' || this.loginSessions.has(chatId)) {
                  await this.handleLoginFlow(text, chatId);
                } else {
                  await this.sendLoginPrompt(chatId);
                }
                continue;
              }

              const isStaff = STAFF_ROLES.includes(boundUser.role);

              // Check if user is in Murojaat mode or typed murojaat:
              if (this.murojaatSessions.has(chatId) || text.toLowerCase().startsWith('murojaat:') || text.toLowerCase().startsWith('murojaat ')) {
                const userMsg = text.replace(/^murojaat:/i, '').replace(/^murojaat/i, '').trim();
                this.murojaatSessions.delete(chatId);
                if (!userMsg || userMsg === '✍️ Omborchiga Murojaat') {
                  await this.sendMessage('✍️ <b>OMBORCHI VA ADMINISTRATORGA MUROJAAT</b>\n\nMarhamat, murojaatingiz matnini yozing:', chatId);
                  this.murojaatSessions.add(chatId);
                } else {
                  await this.forwardMurojaatToAdmin(boundUser, userMsg, chatId);
                }
                continue;
              }

              if (text === '/logout' || text === '🚪 Tizimdan chiqish' || text === '🚪 Tizimdan Chiqish') {
                await this.handleLogoutAccount(chatId);
              } else if (text === '/start' || text === '/menu' || text === '📋 Asosiy Menyu 🏛️' || text === '📋 Bosh Menyu') {
                await this.sendMenuWithWelcome(chatId, boundUser);
              } else if (text === '✍️ Omborchiga Murojaat' || text === '/murojaat') {
                this.murojaatSessions.add(chatId);
                await this.sendMessage(
                  `✍️ <b>OMBORCHI VA ADMINISTRATORGA MUROJAAT / TALABNOMA</b>\n\n` +
                  `Marhamat, o'z so'rovingiz, talabnomangiz yoki murojaatingiz matnini yozib yuboring.\n` +
                  `<i>Xabaringiz zudlik bilan administrator chatiga yuboriladi.</i>`,
                  chatId,
                );
              } else if (text === '📱 Mening Jihozlarim 📦' || text === '📱 Mening Jihozlarim' || text.startsWith('/myassets')) {
                const page = parseInt(text.replace('/myassets', '').trim(), 10) || 1;
                await this.sendMyAssets(chatId, boundUser, page);
              } else if (text === '📜 Mening Tarixim' || text.startsWith('/myhistory')) {
                const page = parseInt(text.replace('/myhistory', '').trim(), 10) || 1;
                await this.sendUserPersonalHistory(chatId, boundUser, page);
              } else if (text === '🏢 Mening Bo‘limim' || text === '/mydept') {
                await this.sendUserMyDeptInfo(chatId, boundUser);
              } else if (text === '📞 Ichki Aloqa' || text === '/contacts') {
                await this.sendOrganizationContacts(chatId);
              } else if (text === '❓ Yordam / Qo‘llanma' || text === '/help') {
                await this.sendUserHelpGuide(chatId, boundUser);
              } else if (text === '👥 Xodimlar Ro‘yxati' || text === '👥 Xodimlar' || text.startsWith('/users')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/users', '').trim(), 10) || 1;
                  await this.sendUsersReport(chatId, page);
                }
              } else if (text === '📦 Ombor Qoldiqlari' || text === '📦 Qoldiqlar' || text.startsWith('/stock')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/stock', '').trim(), 10) || 1;
                  await this.sendStockReport(chatId, page);
                }
              } else if (text === '⚠️ Kamaygan Tovarlar' || text === '⚠️ Kam Qolganlar' || text.startsWith('/lowstock')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/lowstock', '').trim(), 10) || 1;
                  await this.sendLowStockReport(chatId, page);
                }
              } else if (text === '📜 Oxirgi Operatsiyalar' || text === '📜 Operatsiyalar' || text.startsWith('/recent')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/recent', '').trim(), 10) || 1;
                  await this.sendRecentOperations(chatId, page);
                }
              } else if (text === '🏢 Bo‘limlar Nazorati' || text === '🏢 Bo‘limlar' || text.startsWith('/depts')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/depts', '').trim(), 10) || 1;
                  await this.sendDepartmentsReport(chatId, page);
                }
              } else if (text === '📊 Tizim Statistikasi' || text === '📊 Statistika' || text === '/status') {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  await this.sendStatusReport(chatId);
                }
              } else if (text === '🚨 Qaytarishlar (Offboard)' || text.startsWith('/offboarding')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const page = parseInt(text.replace('/offboarding', '').trim(), 10) || 1;
                  await this.sendOffboardingReport(chatId, page);
                }
              } else if (text === '🔍 Mahsulot Qidirish' || text.startsWith('/find')) {
                if (!isStaff) {
                  await this.sendAccessDenied(chatId);
                } else {
                  const query = text.replace('🔍 Mahsulot Qidirish', '').replace('/find', '').trim();
                  if (!query) {
                    await this.sendMessage('🔍 <b>Mahsulot Qidirish</b>\n\nNomini yozing: <code>/find Lenovo</code>', chatId);
                  } else {
                    await this.searchProducts(query, chatId, 1);
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
                  await this.sendDepartmentsExcel(chatId);
                } else if (lower.includes('audit') || lower.includes('log') || lower.includes('/audit_export')) {
                  await this.sendAuditLogsExcel(chatId);
                } else if (lower.includes('berilgan') || lower.includes('jihoz') || lower.includes('asset') || lower.includes('biriktirilgan') || lower.includes('/assets_export')) {
                  await this.sendAssignmentsExcel(chatId);
                } else if (lower.includes('xodim') || lower.includes('user') || lower.includes('xodiml') || lower.includes('/users_export')) {
                  await this.sendUsersExcel(chatId);
                } else if (lower.includes('tarix') || lower.includes('recent') || lower.includes('operatsiya') || lower.includes('/recent_export')) {
                  await this.sendOperationsExcel(chatId);
                } else if (lower.includes('stat') || lower.includes('status') || lower.includes('/stats_export')) {
                  await this.sendStatsExcel(chatId);
                } else if (lower.includes('ombor') || lower.includes('qoldiq') || lower.includes('stock') || lower.includes('mahsulot') || lower.includes('/stock_export')) {
                  await this.sendStockExcel(chatId);
                } else {
                  // Default fallback for general excel request
                  await this.sendStockExcel(chatId);
                }
              } else if (text.startsWith('/ai ') || text.startsWith('🤖 AI') || text === '/ai') {
                const query = text.replace('/ai ', '').replace('🤖 AI Assistent', '').replace('🤖 AI', '').replace('/ai', '').trim();
                if (!query) {
                  await this.sendMessage(
                    `🤖 <b>WMS-AI Assistent</b>\n\nSavolingizni yozing. Misol: <code>${isStaff ? '/ai Omborda nechta noutbuk bor?' : '/ai Mening nomimda qanday jihozlar bor?'}</code>`,
                    chatId,
                  );
                } else {
                  await this.sendChatAction('typing', chatId);
                  const aiResponse = await this.aiService.askAi(query, boundUser);
                  await this.sendMessage(aiResponse, chatId);
                }
              } else {
                await this.sendChatAction('typing', chatId);
                const aiResponse = await this.aiService.askAi(text, boundUser);
                await this.sendMessage(aiResponse, chatId);
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

  private async forwardMurojaatToAdmin(boundUser: any, userText: string, chatId: string) {
    let orgId = boundUser.organizationId;
    if (!orgId) {
      const firstOrg = await this.prisma.organization.findFirst();
      orgId = firstOrg?.id || '';
    }

    try {
      const newRequest = await this.prisma.deletionRequest.create({
        data: {
          organizationId: orgId,
          requestedById: boundUser.id,
          entityType: 'USER',
          entityId: boundUser.id,
          entityName: boundUser.fullName,
          reason: `[BOT MUROJAAT] ${userText}`,
          status: 'PENDING',
        },
        include: {
          organization: { select: { id: true, name: true, code: true } },
          requestedBy: { select: { id: true, fullName: true, username: true } },
        },
      });

      this.eventsGateway.broadcastDeletionRequestCreated(newRequest);
    } catch (err: any) {
      this.logger.error(`Murojaatni DBga saqlashda xatolik: ${err.message}`);
    }

    const text =
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `📩 <b>YANGI MUROJAAT / TALABNOMA (XODIMDAN)</b>\n\n` +
      `👤 <b>Xodim:</b> ${boundUser.fullName}\n` +
      `💼 <b>Lavozimi:</b> ${boundUser.position || boundUser.role}\n` +
      `🏢 <b>Bo'limi:</b> ${boundUser.department?.name || 'Bo\'limsiz'}\n` +
      `📞 <b>Telefon:</b> ${boundUser.phone || boundUser.internalPhone || 'Ko\'rsatilmagan'}\n\n` +
      `💬 <b>Murojaat / So'rov matni:</b>\n<i>${userText}</i>\n\n` +
      `📅 Vaqti: <b>${new Date().toLocaleString('uz-UZ')}</b>\n` +
      `🌐 <i>Veb-sahifaga zudlik bilan kelib tushdi! (So'rovlar & Murojaatlar bo'limida)</i>`;

    await this.sendMessage(text);
    await this.sendMessage(
      `✅ <b>Murojaatingiz omborchi va administratorga muvaffaqiyatli yetkazildi!</b>\n\n` +
      `Siz yuborgan so'rov web sahifada va administrator botida zudlik bilan ko'rib chiqiladi.`,
      chatId,
    );
  }

  private async sendAccessDenied(chatId: string) {
    await this.sendMessage(
      `⛔ <b>Ruxsat etilmadi!</b>\n\n` +
      `Kechirasiz, ushbu ma'lumotlar va bo'lim faqat omborchi hamda mas'ul xodimlar uchun ochiq.\n` +
      `Siz "📱 Mening Jihozlarim", "✍️ Omborchiga Murojaat" yoki "🏢 Mening Bo'limim" imkoniyatlaridan foydalanishingiz mumkin.`,
      chatId,
    );
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const { token } = this.getCredentials();
    if (!token) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      });
    } catch (err) {
      // ignore
    }
  }

  /**
   * Dynamic Callback Parser with RBAC Enforcement & Excel Exports
   */
  private async handleCallbackAction(dataStr: string, chatId: string, boundUser: any) {
    const isStaff = STAFF_ROLES.includes(boundUser?.role);

    if (dataStr === 'cb_ai') {
      await this.sendMessage(
        `🤖 <b>WMS-AI Assistent</b>\n\n` +
        `Marhamat, savolingizni yozib yuboring:\n` +
        `<i>Misol: <code>${isStaff ? 'Omborda zaxirasi tugayotgan tovarlar bormi?' : 'Mening nomimda qanday jihozlar bor?'}</code></i>`,
        chatId,
      );
    } else if (dataStr === 'cb_murojaat') {
      this.murojaatSessions.add(chatId);
      await this.sendMessage(
        `✍️ <b>OMBORCHI VA ADMINISTRATORGA MUROJAAT / TALABNOMA</b>\n\n` +
        `Marhamat, o'z so'rovingiz, talabnomangiz yoki murojaatingiz matnini yozib yuboring.`,
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
        await this.sendAccessDenied(chatId);
        return;
      }

      if (dataStr === 'cb_excel_stock') {
        await this.sendStockExcel(chatId);
      } else if (dataStr === 'cb_excel_users') {
        await this.sendUsersExcel(chatId);
      } else if (dataStr === 'cb_excel_recent') {
        await this.sendOperationsExcel(chatId);
      } else if (dataStr === 'cb_excel_stats') {
        await this.sendStatsExcel(chatId);
      } else if (dataStr.startsWith('cb_stock')) {
        const page = parseInt(dataStr.replace('cb_stock_page_', '').replace('cb_stock', ''), 10) || 1;
        await this.sendStockReport(chatId, page);
      } else if (dataStr.startsWith('cb_users')) {
        const page = parseInt(dataStr.replace('cb_users_page_', '').replace('cb_users', ''), 10) || 1;
        await this.sendUsersReport(chatId, page);
      } else if (dataStr.startsWith('cb_lowstock')) {
        const page = parseInt(dataStr.replace('cb_lowstock_page_', '').replace('cb_lowstock', ''), 10) || 1;
        await this.sendLowStockReport(chatId, page);
      } else if (dataStr.startsWith('cb_recent')) {
        const page = parseInt(dataStr.replace('cb_recent_page_', '').replace('cb_recent', ''), 10) || 1;
        await this.sendRecentOperations(chatId, page);
      } else if (dataStr.startsWith('cb_depts')) {
        const page = parseInt(dataStr.replace('cb_depts_page_', '').replace('cb_depts', ''), 10) || 1;
        await this.sendDepartmentsReport(chatId, page);
      } else if (dataStr.startsWith('cb_offboarding')) {
        const page = parseInt(dataStr.replace('cb_offboarding_page_', '').replace('cb_offboarding', ''), 10) || 1;
        await this.sendOffboardingReport(chatId, page);
      } else if (dataStr.startsWith('cb_find')) {
        if (dataStr.includes('_page_')) {
          const rest = dataStr.replace('cb_find_page_', '');
          const [pageStr, queryStr] = rest.split(':');
          const page = parseInt(pageStr, 10) || 1;
          await this.searchProducts(queryStr || '', chatId, page);
        } else {
          await this.sendMessage('🔍 <b>Mahsulot Qidirish</b>\n\nNomini yozing: <code>/find Lenovo</code>', chatId);
        }
      } else if (dataStr === 'cb_status') {
        await this.sendStatusReport(chatId);
      }
    } else if (dataStr.startsWith('cb_myassets')) {
      const page = parseInt(dataStr.replace('cb_myassets_page_', '').replace('cb_myassets', ''), 10) || 1;
      await this.sendMyAssets(chatId, boundUser, page);
    } else if (dataStr.startsWith('cb_myhistory')) {
      const page = parseInt(dataStr.replace('cb_myhistory_page_', '').replace('cb_myhistory', ''), 10) || 1;
      await this.sendUserPersonalHistory(chatId, boundUser, page);
    } else if (dataStr === 'cb_mydept') {
      await this.sendUserMyDeptInfo(chatId, boundUser);
    } else if (dataStr === 'cb_contacts') {
      await this.sendOrganizationContacts(chatId);
    } else if (dataStr === 'cb_help') {
      await this.sendUserHelpGuide(chatId, boundUser);
    } else if (dataStr === 'cb_menu') {
      await this.sendMenuWithWelcome(chatId, boundUser);
    } else if (dataStr === 'cb_logout') {
      await this.handleLogoutAccount(chatId);
    }
  }

  private async sendLoginPrompt(chatId: string) {
    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
    const webAppUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/login-page?chatId=${chatId}`;
    const isHttps = webAppUrl.startsWith('https://');

    const text =
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `🔒 <b>TIZIMGA KIRISH TALAB ETILADI</b>\n\n` +
      `Botdan foydalanish uchun web-tizimdagi <b>login va parolingiz</b> bilan kiring.\n\n` +
      `🔑 <b>Kirish usullari:</b>\n` +
      `1️⃣ Pastdagi <b>🔑 Kirish (/login)</b> tugmasini bosing\n` +
      `2️⃣ yoki bitta qatorda yozing: <code>/login username parol</code>\n\n` +
      `<i>Misol uchun: <code>/login xodim xodim123</code></i>`;

    const keyboard = {
      keyboard: [[{ text: '🔑 Kirish (/login)' }]],
      resize_keyboard: true,
    };

    await this.sendMessageWithKeyboard(text, keyboard, chatId);

    if (isHttps) {
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '🔐 Kirish Modalini Ochish (Web App)',
              web_app: { url: webAppUrl },
            },
          ],
        ],
      };
      await this.sendMessageWithKeyboard(`✨ <b>Yoki Web App Modal oyna orqali kiring:</b>`, inlineKeyboard, chatId);
    }
  }

  private async handleLoginFlow(text: string, chatId: string) {
    const session = this.loginSessions.get(chatId);

    if (text.startsWith('/login')) {
      const parts = text.replace('/login', '').trim().split(/\s+/);
      if (parts.length >= 2) {
        const [username, password] = parts;
        this.loginSessions.delete(chatId);
        await this.authenticateAndBind(username, password, chatId);
        return;
      }
    }

    if (!session) {
      this.loginSessions.set(chatId, { step: 'USERNAME' });
      await this.sendMessage(
        `👤 <b>TIZIMGA KIRISH (1/2)</b>\n\n` +
        `Web-tizimdagi <b>loginingizni</b> (username yoki pochta) yozing:`,
        chatId,
      );
      return;
    }

    if (session.step === 'USERNAME') {
      if (text === '🔑 Kirish (/login)' || text === '/login') {
        await this.sendMessage(
          `👤 <b>TIZIMGA KIRISH (1/2)</b>\n\n` +
          `Web-tizimdagi <b>loginingizni</b> (username yoki pochta) yozing:`,
          chatId,
        );
        return;
      }
      const username = text.trim();
      this.loginSessions.set(chatId, { step: 'PASSWORD', username });
      await this.sendMessage(
        `🔐 <b>TIZIMGA KIRISH (2/2)</b>\n\n` +
        `Endi loginingiz (<b>${username}</b>) uchun <b>parolingizni</b> kiriting:`,
        chatId,
      );
      return;
    }

    if (session.step === 'PASSWORD') {
      const username = session.username!;
      const password = text.trim();
      this.loginSessions.delete(chatId);
      await this.authenticateAndBind(username, password, chatId);
      return;
    }
  }

  private async authenticateAndBind(username: string, password: string, chatId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [
            { username: { equals: username, mode: 'insensitive' } },
            { phone: { equals: username } },
          ],
        },
        include: { department: true },
      });

      if (!user || !user.passwordHash) {
        await this.sendMessage(
          `❌ <b>Login yoki parol noto'g'ri!</b>\n\n` +
          `Qaytatdan tekshirib kiring: <code>/login username parol</code>`,
          chatId,
        );
        return;
      }

      const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordMatch) {
        await this.sendMessage(
          `❌ <b>Login yoki parol noto'g'ri!</b>\n\n` +
          `Qaytatdan tekshirib kiring: <code>/login username parol</code>`,
          chatId,
        );
        return;
      }

      await this.prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      });

      await this.sendMessage(
        `✅ <b>MUVAFFAQIYATLI KIRILDINGIZ!</b>\n\n` +
        `Xush kelibsiz, <b>${user.fullName}</b>!\n` +
        `💼 Lavozim: <i>${user.position || user.role}</i>\n` +
        `🏢 Bo'lim: <b>${user.department?.name || 'Markaziy Boshqarma'}</b>`,
        chatId,
      );

      await this.sendMenuWithWelcome(chatId, user);
    } catch (err) {
      await this.sendMessage(`❌ Kirishda xatolik yuz berdi. Qaytatdan urinib ko'ring.`, chatId);
    }
  }

  private async handleLogoutAccount(chatId: string) {
    try {
      this.loginSessions.delete(chatId);
      this.murojaatSessions.delete(chatId);
      await this.prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      });

      await this.sendMessage(
        `🚪 <b>Tizimdan muvaffaqiyatli chiqdingiz.</b>`,
        chatId,
      );
      await this.sendLoginPrompt(chatId);
    } catch (err) {
      await this.sendMessage('❌ Tizimdan chiqishda xatolik yuz berdi.', chatId);
    }
  }

  async sendMenuWithWelcome(chatId: string, boundUser: any) {
    const isStaff = STAFF_ROLES.includes(boundUser.role);

    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
    const webAppUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/login-page?chatId=${chatId}`;

    const replyKeyboard = {
      keyboard: [
        [{ text: '📋 Asosiy Menyu 🏛️' }, { text: isStaff ? '📦 Ombor Qoldiqlari' : '📱 Mening Jihozlarim 📦' }],
        [{ text: '✍️ Omborchiga Murojaat' }, { text: '🚪 Tizimdan Chiqish' }],
      ],
      resize_keyboard: true,
    };

    await this.sendMessageWithKeyboard(
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
          { text: '🤖 AI Assistent', callback_data: 'cb_ai' },
          { text: '✍️ Omborchiga Murojaat', callback_data: 'cb_murojaat' },
        ],
        [
          { text: '📱 Mening Jihozlarim', callback_data: 'cb_myassets' },
          { text: '📜 Tarixim', callback_data: 'cb_myhistory' },
        ],
        [
          { text: '🏢 Mening Bo‘limim', callback_data: 'cb_mydept' },
          { text: '📞 Ichki Aloqa', callback_data: 'cb_contacts' },
        ],
        [
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

    await this.sendMessageWithKeyboard(
      `👇 <b>Interaktiv amallar va bo'limlar:</b>`,
      inlineKeyboard,
      chatId,
    );
  }

  /**
   * Reusable Pagination Keyboard Builder
   */
  private buildPaginationKeyboard(prefix: string, page: number, totalPages: number, extra = '') {
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

  /**
   * Tizim statistikasi (Status Report)
   */
  private async sendStatusReport(chatId: string) {
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

      await this.sendMessage(text, chatId);
    } catch (err) {
      await this.sendMessage('❌ Xatolik yuz berdi.', chatId);
    }
  }

  /**
   * 1. Qoldiqlar ro'yxati (10 ta dan Pagination)
   */
  private async sendStockReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.inventory.count({
        where: { product: { deletedAt: null } },
      });

      if (totalCount === 0) {
        await this.sendMessage('📦 Omborda mahsulotlar topilmadi.', chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Qoldiqlarni olishda xatolik.', chatId);
    }
  }

  /**
   * 2. Xodimlar ro'yxati (10 ta dan Pagination)
   */
  private async sendUsersReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.user.count({
        where: { deletedAt: null, isActive: true },
      });

      if (totalCount === 0) {
        await this.sendMessage('👥 Faol xodimlar topilmadi.', chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Xodimlarni olishda xatolik.', chatId);
    }
  }

  /**
   * 3. Kamayib ketganlar (10 ta dan Pagination)
   */
  private async sendLowStockReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const allItems = await this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
        include: { product: { select: { name: true, unit: true } } },
      });

      const lowItems = allItems.filter((i) => i.quantity <= i.minLevel);

      if (lowItems.length === 0) {
        await this.sendMessage('✅ Barcha mahsulotlar zaxirasi yetarli darajada!', chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Xatolik yuz berdi.', chatId);
    }
  }

  /**
   * 4. Oxirgi operatsiyalar (10 ta dan Pagination)
   */
  private async sendRecentOperations(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.operation.count();

      if (totalCount === 0) {
        await this.sendMessage('📜 Operatsiyalar tarixi bo\'sh.', chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Tarixni olishda xatolik.', chatId);
    }
  }

  /**
   * 5. Bo'limlar bo'yicha (10 ta dan Pagination)
   */
  private async sendDepartmentsReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.department.count({ where: { deletedAt: null } });

      if (totalCount === 0) {
        await this.sendMessage('🏢 Bo\'limlar topilmadi.', chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Bo\'limlarni olishda xatolik.', chatId);
    }
  }

  /**
   * EXCEL EXPORTERS (FAFAT ADMIN UCHUN)
   */
  async sendStockExcel(chatId: string) {
    try {
      const items = await this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
        include: { product: true },
        orderBy: { quantity: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Ombor Qoldiqlari');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Mahsulot Nomi', key: 'name', width: 32 },
        { header: 'Tovar Turi', key: 'productType', width: 18 },
        { header: 'Ombor Qoldig\'i', key: 'quantity', width: 16 },
        { header: 'O\'lchov Birligi', key: 'unit', width: 14 },
        { header: 'Min Chegara', key: 'minLevel', width: 14 },
        { header: 'Birlik Narxi (so\'m)', key: 'unitPrice', width: 20 },
        { header: 'Holati', key: 'status', width: 20 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      items.forEach((item, i) => {
        const isLow = item.quantity <= item.minLevel;
        ws.addRow({
          index: i + 1,
          name: item.product.name,
          productType: item.product.productType || 'Noma\'lum',
          quantity: item.quantity,
          unit: item.product.unit || 'ta',
          minLevel: item.minLevel,
          unitPrice: item.unitPrice ? String(item.unitPrice) : '—',
          status: isLow ? '⚠️ Kamaygan (Low)' : '✅ Yetarli (OK)',
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Ombor_Qoldiqlari_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📊 <b>OMBOR QOLDIQLARI EXCEL HISOBOTI</b>\n\nJami mahsulotlar: <b>${items.length} xil</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendUsersExcel(chatId: string) {
    try {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, isActive: true },
        include: {
          department: true,
          assignments: { where: { returnedAt: null }, include: { asset: { include: { product: true } } } },
        },
        orderBy: { fullName: 'asc' },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Xodimlar Ro\'yxati');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'F.I.SH', key: 'fullName', width: 30 },
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Lavozimi', key: 'position', width: 22 },
        { header: 'Roli', key: 'role', width: 16 },
        { header: 'Bo\'limi', key: 'department', width: 25 },
        { header: 'Telefon', key: 'phone', width: 18 },
        { header: 'Jihozlar Son', key: 'assetsCount', width: 14 },
        { header: 'Biriktirilgan Jihozlar', key: 'assetsStr', width: 45 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      users.forEach((u, i) => {
        const assetsStr = u.assignments.map((a) => `${a.asset.product.name} (Inv №${a.asset.inventoryNumber})`).join('; ');
        ws.addRow({
          index: i + 1,
          fullName: u.fullName,
          username: u.username || '—',
          position: u.position || '—',
          role: u.role,
          department: u.department?.name || 'Bo\'limsiz',
          phone: u.phone || u.internalPhone || '—',
          assetsCount: u.assignments.length,
          assetsStr: assetsStr || '—',
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Xodimlar_Royxati_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `👥 <b>XODIMLAR RO'YXATI EXCEL HISOBOTI</b>\n\nJami xodimlar: <b>${users.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendOperationsExcel(chatId: string) {
    try {
      const ops = await this.prisma.operation.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          performedBy: true,
          user: true,
        },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Operatsiyalar Tarixi');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Operatsiya Turi', key: 'type', width: 22 },
        { header: 'Mahsulot Nomi', key: 'productName', width: 30 },
        { header: 'Miqdori', key: 'quantity', width: 12 },
        { header: 'Bajaruvchi', key: 'performer', width: 25 },
        { header: 'Qabul Qiluvchi', key: 'target', width: 25 },
        { header: 'Hujjat №', key: 'docNum', width: 16 },
        { header: 'Sana', key: 'date', width: 20 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      ops.forEach((op, i) => {
        ws.addRow({
          index: i + 1,
          type: op.type,
          productName: op.product?.name || 'Noma\'lum',
          quantity: op.quantity,
          performer: op.performedBy?.fullName || 'Tizim',
          target: op.user?.fullName || '—',
          docNum: op.documentNumber || '—',
          date: new Date(op.createdAt).toLocaleString('uz-UZ'),
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Operatsiyalar_Tarixi_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📜 <b>OXIRGI OPERATSIYALAR EXCEL HISOBOTI</b>\n\nJami operatsiyalar: <b>${ops.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendStatsExcel(chatId: string) {
    try {
      const [prod, users, depts, activeAssets, lowStock] = await Promise.all([
        this.prisma.product.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.department.count({ where: { deletedAt: null } }),
        this.prisma.assignment.count({ where: { returnedAt: null } }),
        this.prisma.inventory.count({ where: { quantity: { lte: 5 } } }),
      ]);

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Tizim Statistikasi');

      ws.columns = [
        { header: 'Korsatkich', key: 'metric', width: 35 },
        { header: 'Qiymat', key: 'value', width: 20 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      ws.addRow({ metric: 'Barcha Mahsulot Turlari Soni', value: `${prod} ta` });
      ws.addRow({ metric: 'Tizimdagi Faol Xodimlar', value: `${users} ta` });
      ws.addRow({ metric: 'Mavjud Bo\'limlar Soni', value: `${depts} ta` });
      ws.addRow({ metric: 'Biriktirilgan Aktiv/TMZlar', value: `${activeAssets} ta` });
      ws.addRow({ metric: 'Zaxirasi Kamaygan Tovarlar', value: `${lowStock} ta` });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Tizim_Statistikasi_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📊 <b>TIZIM STATISTIKASI EXCEL HISOBOTI</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendDepartmentsExcel(chatId: string) {
    try {
      const depts = await this.prisma.department.findMany({
        where: { deletedAt: null },
        include: {
          organization: true,
          users: { select: { id: true, fullName: true } },
          departmentAssets: { include: { product: true } },
          assignments: { where: { returnedAt: null }, include: { asset: { include: { product: true } } } },
        },
        orderBy: { name: 'asc' },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Bolimlar Royxati');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Bo\'lim Nomi', key: 'name', width: 30 },
        { header: 'Tavsifi', key: 'description', width: 30 },
        { header: 'Tashkilot', key: 'orgName', width: 25 },
        { header: 'Xodimlar Soni', key: 'userCount', width: 15 },
        { header: 'Biriktirilgan Jihozlar Soni', key: 'assetCount', width: 25 },
        { header: 'Yaratilgan Vaqti', key: 'createdAt', width: 20 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      depts.forEach((d, i) => {
        ws.addRow({
          index: i + 1,
          name: d.name,
          description: d.description || '—',
          orgName: d.organization?.name || 'Vazirlik',
          userCount: d.users.length,
          assetCount: d.assignments.length + d.departmentAssets.length,
          createdAt: new Date(d.createdAt).toLocaleDateString('uz-UZ'),
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Bolimlar_Royxati_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `🏢 <b>BO'LIMLAR RO'YXATI EXCEL HISOBOTI</b>\n\nJami bo'limlar: <b>${depts.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Bo\'limlar Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendAuditLogsExcel(chatId: string) {
    try {
      const logs = await this.prisma.auditLog.findMany({
        take: 1000,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, username: true } },
        },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Audit Loglar');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Vaqti', key: 'createdAt', width: 20 },
        { header: 'Foydalanuvchi', key: 'userName', width: 25 },
        { header: 'Roli', key: 'userRole', width: 16 },
        { header: 'Amal (Action)', key: 'action', width: 25 },
        { header: 'Resurs', key: 'resource', width: 18 },
        { header: 'HTTP Method & Endpoint', key: 'endpoint', width: 35 },
        { header: 'IP Manzil', key: 'ipAddress', width: 18 },
        { header: 'Status Code', key: 'statusCode', width: 12 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      logs.forEach((l, i) => {
        ws.addRow({
          index: i + 1,
          createdAt: new Date(l.createdAt).toLocaleString('uz-UZ'),
          userName: l.userName || l.user?.fullName || 'Tizim / Mehmon',
          userRole: l.userRole || '—',
          action: l.action,
          resource: l.resource || '—',
          endpoint: `${l.method} ${l.endpoint}`,
          ipAddress: l.ipAddress || '127.0.0.1',
          statusCode: l.statusCode,
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Audit_Loglar_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📜 <b>AUDIT LOGLAR EXCEL HISOBOTI</b>\n\nJami loglar: <b>${logs.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Audit loglar Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  async sendAssignmentsExcel(chatId: string) {
    try {
      const assignments = await this.prisma.assignment.findMany({
        where: { returnedAt: null },
        include: {
          user: { include: { department: true } },
          department: true,
          asset: { include: { product: true } },
        },
        orderBy: { assignedAt: 'desc' },
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Berilgan Jihozlar');

      ws.columns = [
        { header: '№', key: 'index', width: 8 },
        { header: 'Jihoz / Mahsulot Nomi', key: 'productName', width: 30 },
        { header: 'Inventar №', key: 'invNum', width: 18 },
        { header: 'Seriya №', key: 'serialNum', width: 18 },
        { header: 'Biriktirilgan Shaxs / Bo\'lim', key: 'target', width: 30 },
        { header: 'Bo\'limi', key: 'deptName', width: 25 },
        { header: 'Biriktirilgan Sana', key: 'assignedAt', width: 20 },
        { header: 'Holati', key: 'status', width: 16 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };

      assignments.forEach((a, i) => {
        const targetStr = a.user?.fullName ? `👤 ${a.user.fullName}` : a.department?.name ? `🏢 ${a.department.name}` : '—';
        const deptStr = a.user?.department?.name || a.department?.name || '—';
        ws.addRow({
          index: i + 1,
          productName: a.asset?.product?.name || 'Jihoz',
          invNum: a.asset?.inventoryNumber || '—',
          serialNum: a.asset?.serialNumber || '—',
          target: targetStr,
          deptName: deptStr,
          assignedAt: new Date(a.assignedAt).toLocaleDateString('uz-UZ'),
          status: 'FAOL (Foydalanishda)',
        });
      });

      const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as any);
      await this.sendDocumentBuffer(
        `Berilgan_Jihozlar_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `💻 <b>BERILGAN (BIRIKTIRILGAN) JIHOZLAR EXCEL HISOBOTI</b>\n\nJami faol jihozlar: <b>${assignments.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sendMessage('❌ Berilgan jihozlar Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }

  /**
   * RASMIY HUJJAT / TALABNOMA / MODDIY JAVOBGARLIK SHARTNOMASI GENERATORI (TELEGRAM DOCUMENT)
   */
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
      const caption =
        `📄 <b>RASMIY HUJJAT / TALABNOMA</b>\n\n` +
        `📌 <b>Hujjat:</b> ${docTitle}\n` +
        `📦 <b>Mahsulot:</b> ${data.productName} (${data.quantity} ${data.unit || 'ta'})\n` +
        `👤 <b>Qabul qildi:</b> ${data.targetName}\n` +
        `✍️ <b>Bajaruvchi:</b> ${data.performerName}`;

      await this.sendDocumentBuffer(filename, buffer, caption, overrideChatId);
    } catch (err: any) {
      this.logger.error(`Rasmiy hujjat yaratishda xatolik: ${err.message}`);
    }
  }

  /**
   * 6. Shaxsiy operatsiyalar tarixi (10 ta dan Pagination)
   */
  private async sendUserPersonalHistory(chatId: string, boundUser: any, page = 1) {
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
        await this.sendMessage(`📜 <b>${boundUser.fullName.toUpperCase()}</b>\n\nSizda hali ombor operatsiyalari tarixi mavjud emas.`, chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Shaxsiy tarixni olishda xatolik yuz berdi.', chatId);
    }
  }

  /**
   * 7. Xodimning o'z bo'limi haqida ma'lumot
   */
  private async sendUserMyDeptInfo(chatId: string, boundUser: any) {
    try {
      if (!boundUser.departmentId) {
        await this.sendMessage(`🏢 Siz hali biror-bir bo'limga biriktirilmagansiz.`, chatId);
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
        await this.sendMessage(`🏢 Bo'lim ma'lumotlari topilmadi.`, chatId);
        return;
      }

      let text = `🏢 <b>${dept.name.toUpperCase()} BO'LIMI</b>\n\n` +
        `👥 Hamkasblar soni: <b>${dept._count.users} ta xodim</b>\n` +
        `💻 Bo'limga biriktirilgan aktivlar: <b>${dept.assignments.length} ta</b>\n\n` +
        `📋 <b>Bo'lim xodimlari:</b>\n`;

      dept.users.forEach((u, i) => {
        text += `${i + 1}. <b>${u.fullName}</b> — <i>${u.position || 'Xodim'}</i>\n`;
      });

      await this.sendMessage(text, chatId);
    } catch (err) {
      await this.sendMessage('❌ Bo\'lim ma\'lumotlarini olishda xatolik.', chatId);
    }
  }

  private async sendOrganizationContacts(chatId: string) {
    const text =
      `📞 <b>VAZIRLIK VA OMBORXONA MAS'ULLARI ALOQA MA'LUMOTLARI</b>\n\n` +
      `🏢 <b>O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi</b>\n\n` +
      `📦 <b>Omborxona va WMS Boshqarmasi:</b>\n` +
      `👨‍💼 Bosh Omborchi: <b>Urinbadalov Abdulaziz</b> (+998 71 200 00 00)\n` +
      `👩‍💼 Kadrlar Bo'limi: <b>Karimova Shahnoza</b>\n` +
      `💻 IT va Texnik Qo'llab-quvvatlash: <b>Hasanov Ahmadillo</b>\n\n` +
      `📍 <b>Manzil:</b> Toshkent shahri, Abay ko'chasi 6\n` +
      `🌐 <b>Veb-sayt:</b> http://localhost:5173`;

    await this.sendMessage(text, chatId);
  }

  private async sendUserHelpGuide(chatId: string, boundUser: any) {
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

    await this.sendMessage(text, chatId);
  }

  /**
   * 8. Offboarding nazorati (10 ta dan Pagination)
   */
  private async sendOffboardingReport(chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.user.count({
        where: {
          employmentStatus: 'OFFBOARDING_PENDING',
          deletedAt: null,
        },
      });

      if (totalCount === 0) {
        await this.sendMessage(`🚨 Hozirda ishdan bo'shatish (offboarding) jarayonidagi va jihozlarini topshirmagan xodimlar yo'q. ✅`, chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Offboarding ma\'lumotlarini olishda xatolik.', chatId);
    }
  }

  /**
   * 9. Xodimgaga biriktirilgan jihozlar (10 ta dan Pagination)
   */
  private async sendMyAssets(chatId: string, boundUser: any, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.assignment.count({
        where: { userId: boundUser.id, returnedAt: null },
      });

      if (totalCount === 0) {
        await this.sendMessage(
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Shaxsiy jihozlarni olishda xatolik.', chatId);
    }
  }

  /**
   * 10. Mahsulot qidirish (10 ta dan Pagination)
   */
  private async searchProducts(query: string, chatId: string, page = 1) {
    try {
      const pageSize = 10;
      const totalCount = await this.prisma.product.count({
        where: {
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
      });

      if (totalCount === 0) {
        await this.sendMessage(`🔍 "<b>${query}</b>" bo'yicha hech narsa topilmadi.`, chatId);
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
        await this.sendMessageWithKeyboard(text, keyboard, chatId);
      } else {
        await this.sendMessage(text, chatId);
      }
    } catch (err) {
      await this.sendMessage('❌ Qidiruvda xatolik.', chatId);
    }
  }

  private async sendMessageWithKeyboard(message: string, keyboard: any, overrideChatId?: string): Promise<boolean> {
    const { token, chatId: envChatId } = this.getCredentials();
    const rawTarget = overrideChatId || envChatId;
    if (!token || !rawTarget) return false;

    const chatIds = rawTarget.split(',').map((id) => id.trim()).filter(Boolean);
    let successCount = 0;

    for (const targetChatId of chatIds) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: keyboard,
            disable_web_page_preview: true,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          successCount++;
        } else {
          this.logger.error(`Telegram sendMessageWithKeyboard error (${targetChatId}): ${data.description}`);
        }
      } catch (err: any) {
        this.logger.error(`Telegram error (${targetChatId}): ${err.message}`);
      }
    }
    return successCount > 0;
  }

  private async getAdminChatIds(overrideChatId?: string): Promise<string[]> {
    const { chatId: envChatId } = this.getCredentials();
    const targets = new Set<string>();

    if (overrideChatId) {
      overrideChatId.split(',').forEach((id) => targets.add(id.trim()));
    } else if (envChatId) {
      envChatId.split(',').forEach((id) => targets.add(id.trim()));
    }

    try {
      const staffUsers = await this.prisma.user.findMany({
        where: {
          role: { in: STAFF_ROLES as any },
          telegramChatId: { not: null },
          deletedAt: null,
          isActive: true,
        },
        select: { telegramChatId: true },
      });

      staffUsers.forEach((u) => {
        if (u.telegramChatId) {
          targets.add(u.telegramChatId.trim());
        }
      });
    } catch (err) {
      // fallback to targets set so far
    }

    return Array.from(targets).filter(Boolean);
  }

  async sendDocumentBuffer(filename: string, buffer: Buffer, caption: string, overrideChatId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getAdminChatIds(overrideChatId);
    if (chatIds.length === 0) return false;

    let successCount = 0;

    for (const targetChatId of chatIds) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendDocument`;
        const formData = new FormData();
        formData.append('chat_id', targetChatId);
        formData.append('document', new Blob([new Uint8Array(buffer)]), filename);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');

        const res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.ok) {
          successCount++;
        } else {
          this.logger.error(`Telegram sendDocument error (${targetChatId}): ${data.description}`);
        }
      } catch (err: any) {
        this.logger.error(`Telegram document error (${targetChatId}): ${err.message}`);
      }
    }
    return successCount > 0;
  }

  async sendChatAction(action: string = 'typing', overrideChatId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getAdminChatIds(overrideChatId);
    for (const targetChatId of chatIds) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendChatAction`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            action: action,
          }),
        });
      } catch (err) {
        // ignore
      }
    }
    return true;
  }

  async sendMessage(message: string, overrideChatId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getAdminChatIds(overrideChatId);
    if (chatIds.length === 0) return false;

    let successCount = 0;

    for (const targetChatId of chatIds) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          successCount++;
        } else {
          const plainText = message.replace(/<[^>]*>/g, '');
          const fallbackRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              text: plainText,
              disable_web_page_preview: true,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.ok) {
            successCount++;
          }
        }
      } catch (err: any) {
        this.logger.error(`Telegram error (${targetChatId}): ${err.message}`);
      }
    }
    return successCount > 0;
  }

  async sendLowStockAlert(productName: string, currentStock: number, minLevel: number, chatId?: string) {
    const text =
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `⚠️ <b>OMBOR ZAXIRASI OGOHLANTIRISHI</b>\n\n` +
      `📦 Mahsulot: <b>${productName}</b>\n` +
      `🔴 Joriy qoldiq: <b>${currentStock} ta</b>\n` +
      `⚠️ Minimal chegara: <b>${minLevel} ta</b>`;

    return this.sendMessage(text, chatId);
  }

  async sendAdminNewUserAlert(userFullName: string, position: string, departmentName: string) {
    const text =
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `👤 <b>YANGI XODIM RO'YXATGA OLINDI</b>\n\n` +
      `• F.I.SH: <b>${userFullName}</b>\n` +
      `• Lavozimi: <i>${position}</i>\n` +
      `• Bo'limi: <b>${departmentName}</b>\n` +
      `• Sana: <i>${new Date().toLocaleString('uz-UZ')}</i>`;

    return this.sendMessage(text);
  }

  async sendOffboardingAlert(userFullName: string, departmentName: string, startedByName: string) {
    const text =
      `🚨 <b>ISHDAN BO'SHASH JARAYONI</b>\n\n` +
      `👤 Xodim: <b>${userFullName}</b>\n` +
      `🏢 Bo'lim: <b>${departmentName || "Bo'limsiz"}</b>\n` +
      `📝 Boshladi: <b>${startedByName}</b>`;

    return this.sendMessage(text);
  }

  async sendOperationAlert(opType: string, productName: string, quantity: number, targetName: string, performerName: string) {
    const text =
      `📋 <b>YANGI OMBOR OPERATSIYASI (SERVER REAL-TIME ALERT)</b>\n\n` +
      `📌 Operatsiya turi: <b>${opType}</b>\n` +
      `📦 Mahsulot: <b>${productName}</b>\n` +
      `🔢 Miqdori: <b>${quantity} ta</b>\n` +
      `🎯 Qabul qiluvchi: <b>${targetName}</b>\n` +
      `👨‍💼 Bajaruvchi: <b>${performerName}</b>\n` +
      `🟢 Server javobi: <b>200 OK (Muvaffaqiyatli bajarildi)</b>\n` +
      `📅 Vaqti: <b>${new Date().toLocaleString('uz-UZ')}</b>`;

    return this.sendMessage(text);
  }

  async sendUserNotificationAlert(userId: string, title: string, message: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, fullName: true },
      });

      if (!user || !user.telegramChatId) return false;

      const fullText =
        `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
        `🔔 <b>${title.toUpperCase()}</b>\n\n` +
        `Hurmatli <b>${user.fullName}</b>,\n\n` +
        `${message}`;

      return this.sendMessage(fullText, user.telegramChatId);
    } catch (err) {
      return false;
    }
  }
}
