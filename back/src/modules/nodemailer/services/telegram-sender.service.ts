import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';

export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'VAZIRLIK_OMBORCHI',
  'ADMIN',
  'OMBORCHI',
  'ORG_ADMIN',
  'ORG_OMBORCHI',
  'KADR',
];

export const MAX_LOG_BUFFER_SIZE = 2000;
export const serverLogBuffer: string[] = [];

// Intercept stdout & stderr to maintain live rolling buffer of server logs
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

const captureLog = (chunk: any) => {
  try {
    const raw = typeof chunk === 'string' ? chunk : chunk?.toString?.('utf-8') || '';
    const clean = stripAnsi(raw).trim();
    if (clean) {
      const lines = clean.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          serverLogBuffer.push(trimmed);
          if (serverLogBuffer.length > MAX_LOG_BUFFER_SIZE) {
            serverLogBuffer.shift();
          }
        }
      }
    }
  } catch {}
};

process.stdout.write = (chunk: any, ...args: any[]) => {
  captureLog(chunk);
  return (originalStdoutWrite as any)(chunk, ...args);
};

process.stderr.write = (chunk: any, ...args: any[]) => {
  captureLog(chunk);
  return (originalStderrWrite as any)(chunk, ...args);
};

@Injectable()
export class TelegramSenderService {
  private readonly logger = new Logger(TelegramSenderService.name);

  constructor(private prisma: PrismaService) {}

  getCredentials() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    return { token, chatId };
  }

  async getAdminChatIds(overrideChatId?: string): Promise<string[]> {
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
      // fallback
    }

    return Array.from(targets).filter(Boolean);
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

  async sendMessageWithKeyboard(message: string, keyboard: any, overrideChatId?: string): Promise<boolean> {
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

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
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
}
