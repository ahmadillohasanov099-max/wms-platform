import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import * as bcrypt from 'bcrypt';
import { TelegramSenderService } from './telegram-sender.service';

@Injectable()
export class TelegramAuthService {
  public loginSessions = new Map<string, { step: 'USERNAME' | 'PASSWORD'; username?: string; timestamp: number }>();

  constructor(
    private prisma: PrismaService,
    private sender: TelegramSenderService,
  ) {}

  async sendLoginPrompt(chatId: string) {
    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
    const webAppUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/login-page?chatId=${chatId}`;

    const replyKeyboard = {
      keyboard: [
        [{ text: '🔑 Tizimga Kirish (/login)' }],
      ],
      resize_keyboard: true,
    };

    await this.sender.sendMessageWithKeyboard(
      `🏛 <b>QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI</b>\n` +
      `📦 <b>WMS Ombor va Jihozlar Boshqaruv Tizimi Boti</b>\n\n` +
      `⚠️ <b>DIQQAT:</b> Botdan foydalanish uchun tizimdagi hisobingiz orqali ro'yxatdan o'tishingiz (tizimga kirishingiz) shart!\n\n` +
      `Muvaffaqiyatli kirilgandan so'ng sizga rolingizga mos xizmatlar va menyu ochiladi.\n\n` +
      `👉 <b>Tezkor buyruq orqali kirish:</b>\n` +
      `<code>/login username parol</code>\n\n` +
      `<i>Misol: <code>/login admin 123456</code> yoki <code>/login omborchi 123456</code></i>\n\n` +
      `Yoki quyidagi <b>"🔑 Tizimga Kirish (/login)"</b> tugmasini bosing:`,
      replyKeyboard,
      chatId,
    );

    if (webAppUrl.startsWith('https://')) {
      const inlineKeyboard = {
        inline_keyboard: [
          [{ text: '🔐 Web App orqali Tezkor Kirish', web_app: { url: webAppUrl } }],
        ],
      };
      await this.sender.sendMessageWithKeyboard(`✨ <b>Yoki Web App Modal oyna orqali kiring:</b>`, inlineKeyboard, chatId);
    }
  }

  async handleLoginFlow(
    text: string,
    chatId: string,
    onSuccess?: (user: any) => Promise<void>,
  ) {
    let session = this.loginSessions.get(chatId);

    // Sessiya 5 daqiqadan oshgan bo'lsa yangilaymiz
    if (session && Date.now() - session.timestamp > 5 * 60 * 1000) {
      this.loginSessions.delete(chatId);
      session = undefined;
    }

    if (text === '/cancel' || text.startsWith('/logout')) {
      this.loginSessions.delete(chatId);
      await this.sender.sendMessage(`❌ <b>Kirish jarayoni bekor qilindi.</b>`, chatId);
      await this.sendLoginPrompt(chatId);
      return;
    }

    if (text.startsWith('/login')) {
      const parts = text.replace('/login', '').trim().split(/\s+/);
      if (parts.length >= 2) {
        const username = parts[0];
        const password = parts.slice(1).join(' ');
        this.loginSessions.delete(chatId);
        await this.authenticateAndBind(username, password, chatId, onSuccess);
        return;
      }
    }

    if (!session) {
      this.loginSessions.set(chatId, { step: 'USERNAME', timestamp: Date.now() });
      await this.sender.sendMessage(
        `👤 <b>TIZIMGA KIRISH (1/2)</b>\n\n` +
        `Web-tizimdagi <b>loginingizni</b> (username yoki telefon raqam) yozing:`,
        chatId,
      );
      return;
    }

    if (session.step === 'USERNAME') {
      if (text === '🔑 Kirish (/login)' || text === '🔑 Tizimga Kirish (/login)' || text === '/login') {
        await this.sender.sendMessage(
          `👤 <b>TIZIMGA KIRISH (1/2)</b>\n\n` +
          `Web-tizimdagi <b>loginingizni</b> (username yoki telefon raqam) yozing:`,
          chatId,
        );
        return;
      }
      const username = text.trim();
      this.loginSessions.set(chatId, { step: 'PASSWORD', username, timestamp: Date.now() });
      await this.sender.sendMessage(
        `🔐 <b>TIZIMGA KIRISH (2/2)</b>\n\n` +
        `Endi <b>${username}</b> hisobingiz uchun <b>parolingizni</b> kiriting:`,
        chatId,
      );
      return;
    }

    if (session.step === 'PASSWORD') {
      const username = session.username!;
      const password = text.trim();
      this.loginSessions.delete(chatId);
      await this.authenticateAndBind(username, password, chatId, onSuccess);
      return;
    }
  }

  async authenticateAndBind(
    username: string,
    password: string,
    chatId: string,
    onSuccess?: (user: any) => Promise<void>,
  ) {
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
        include: { department: true, organization: true },
      });

      if (!user || !user.passwordHash) {
        await this.sender.sendMessage(
          `❌ <b>Login yoki parol noto'g'ri!</b>\n\n` +
          `Qaytatdan tekshirib kiring: <code>/login username parol</code>`,
          chatId,
        );
        return;
      }

      const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordMatch) {
        await this.sender.sendMessage(
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

      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
        include: { department: true, organization: true },
      });

      await this.sender.sendMessage(
        `✅ <b>MUVAFFAQIYATLI KIRILDINGIZ!</b>\n\n` +
        `Xush kelibsiz, <b>${updatedUser.fullName}</b>!\n` +
        `💼 Lavozim: <i>${updatedUser.position || updatedUser.role}</i>\n` +
        `🏢 Bo'lim: <b>${updatedUser.department?.name || 'Markaziy Boshqarma'}</b>`,
        chatId,
      );

      if (onSuccess) {
        await onSuccess(updatedUser);
      }
    } catch (err) {
      await this.sender.sendMessage(`❌ Kirishda xatolik yuz berdi. Qaytatdan urinib ko'ring.`, chatId);
    }
  }

  async handleLogoutAccount(chatId: string) {
    try {
      this.loginSessions.delete(chatId);
      await this.prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      });

      await this.sender.sendMessage(
        `🚪 <b>Tizimdan muvaffaqiyatli chiqdingiz.</b>\n\n` +
        `Telegram akkauntingiz tizimdan uzildi. Qayta kirish uchun <b>/login</b> buyrug'idan foydalaning.`,
        chatId,
      );
      await this.sendLoginPrompt(chatId);
    } catch (err) {
      await this.sender.sendMessage('❌ Tizimdan chiqishda xatolik yuz berdi.', chatId);
    }
  }
}
