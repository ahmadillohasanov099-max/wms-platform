import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma';
import { TelegramService } from './telegram.service';
import { AiService } from './ai.service';
import * as bcrypt from 'bcrypt';

@Controller('telegram')
export class TelegramController {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private aiService: AiService,
  ) {}

  @Post('ask-ai')
  async handleAskAi(@Body() body: { query: string; user?: any }) {
    const { query, user } = body;
    const boundUser = user || { fullName: 'Foydalanuvchi', role: 'SUPER_ADMIN' };
    const answer = await this.aiService.askAi(query, boundUser);
    return { success: true, answer };
  }

  /**
   * Telegram WebApp Modal Login sahifasi (HTML)
   */
  @Get('login-page')
  getLoginPage(@Query('chatId') chatId: string, @Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tizimga Kirish | WMS Telegram Modal</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(30, 41, 59, 0.85);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 28px 24px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .logo-box {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 8px 16px rgba(13, 148, 136, 0.3);
      margin-bottom: 12px;
    }
    h2 { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 4px; text-align: center; }
    p.subtitle { font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; text-align: left; }
    label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      color: #ffffff;
      font-size: 14px;
      outline: none;
      transition: all 0.2s ease;
    }
    input:focus { border-color: #14b8a6; box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.25); }
    .btn-submit {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
      border: none;
      border-radius: 12px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .btn-submit:active { opacity: 0.85; }
    .error-msg {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 12px;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: none;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-box">
      <div class="logo-icon">🏛</div>
      <h2>Vazirlik WMS Tizimi</h2>
      <p class="subtitle">Botdan foydalanish uchun web loginingiz bilan kiring</p>
    </div>

    <div id="errorBox" class="error-msg"></div>

    <form id="loginForm">
      <input type="hidden" id="chatId" value="${chatId || ''}">
      <div class="form-group">
        <label for="username">Login (Username / Telefon)</label>
        <input type="text" id="username" placeholder="xodim" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="password">Parol</label>
        <input type="password" id="password" placeholder="••••••••" required>
      </div>
      <button type="submit" class="btn-submit" id="submitBtn">🔑 Kirish</button>
    </form>
  </div>

  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser && tgUser.id) {
        document.getElementById('chatId').value = String(tgUser.id);
      }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const chatId = document.getElementById('chatId').value;

      const errorBox = document.getElementById('errorBox');
      const submitBtn = document.getElementById('submitBtn');

      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerText = 'Kirilmoqda...';

      try {
        const res = await fetch('/api/telegram/login-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, chatId })
        });
        const data = await res.json();

        if (data.success) {
          if (tg) {
            tg.close();
          } else {
            alert('Muvaffaqiyatli kirildi! Botga qaytishingiz mumkin.');
          }
        } else {
          errorBox.innerText = data.message || 'Login yoki parol noto‘g‘ri';
          errorBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerText = '🔑 Kirish';
        }
      } catch (err) {
        errorBox.innerText = 'Server bilan aloqa xatoligi';
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = '🔑 Kirish';
      }
    });
  </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  /**
   * Telegram WebApp Login Forma tekshiruvi
   */
  @Post('login-submit')
  async handleWebappLogin(@Body() body: { username: string; password: string; chatId: string }) {
    const { username, password, chatId } = body;

    if (!username || !password || !chatId) {
      return { success: false, message: 'Barcha maydonlarni to‘ldiring' };
    }

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
        return { success: false, message: 'Login yoki parol noto‘g‘ri' };
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return { success: false, message: 'Login yoki parol noto‘g‘ri' };
      }

      // Oldingi bog'langan chat ID larni tozash
      await this.prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      });

      // Foydalanuvchiga Telegram Chat ID ni bog'lash
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      });

      // Telegram boti orqali muvaffaqiyatli xabarni yuborib menyuni ochamiz
      await this.telegramService.sendMessage(
        `✅ <b>MUVAFFAQIYATLI KIRILDINGIZ!</b>\n\n` +
        `Xush kelibsiz, <b>${user.fullName}</b>!\n` +
        `💼 Lavozim: <i>${user.position || user.role}</i>\n` +
        `🏢 Bo'lim: <b>${user.department?.name || 'Markaziy Boshqarma'}</b>`,
        chatId,
      );

      await this.telegramService.sendMenuWithWelcome(chatId, user);

      return { success: true, user: { fullName: user.fullName } };
    } catch (err) {
      return { success: false, message: 'Tizimda xatolik yuz berdi' };
    }
  }
}
