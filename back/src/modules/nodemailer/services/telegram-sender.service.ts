import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';

export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'VAZIRLIK_OMBORCHI',
  'ORG_ADMIN',
  'ORG_OMBORCHI',
  'KADR',
];

export const NOTIFICATION_ROLES = [
  'SUPER_ADMIN',
  'VAZIRLIK_OMBORCHI',
  'ORG_OMBORCHI',
  'ORG_ADMIN',
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

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramSenderService {
  private readonly logger = new Logger(TelegramSenderService.name);

  constructor(private prisma: PrismaService) {}

  getCredentials() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    return { token, chatId };
  }

  async getAdminChatIds(overrideChatId?: string, organizationId?: string): Promise<string[]> {
    // If specific overrideChatId is provided, deliver ONLY to that target
    if (overrideChatId) {
      const targets = new Set<string>();
      overrideChatId.split(',').forEach((id) => targets.add(id.trim()));
      return Array.from(targets).filter(Boolean);
    }

    const targets = new Set<string>();

    try {
      // 2-VARIANT QOIDASI (Qat'iy ajratilgan — Tinch rejim):
      // Agar operatsiya quyi tashkilotda (SUB_ORG) bo'lsa, xabar FAQAT o'sha tashkilotning ORG_ADMIN va ORG_OMBORCHI siga boradi.
      // Super Admin (Vazirlik) quyi tashkilotlarning mayda operatsiyalari bilan bezovta qilinmaydi!
      // Agar operatsiya Vazirlik (MINISTRY) miqyosida bo'lsa, xabar SUPER_ADMIN va VAZIRLIK_OMBORCHI siga boradi.
      let targetOrg: { id: string; type: string } | null = null;
      if (organizationId) {
        targetOrg = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, type: true },
        });
      }

      let whereClause: any;

      if (targetOrg && targetOrg.type === 'SUB_ORG') {
        // Quyi tashkilot operatsiyasi: FAQAT shu quyi tashkilot mas'ullari oladi (Super Admin bezovta qilinmaydi)
        whereClause = {
          telegramChatId: { not: null },
          deletedAt: null,
          isActive: true,
          role: { in: ['ORG_ADMIN', 'ORG_OMBORCHI'] as any },
          organizationId: targetOrg.id,
        };
      } else {
        // Vazirlik (MINISTRY) operatsiyasi yoki umumiy tizim xabari: Vazirlik Super Admin va Vazirlik omborchisi oladi
        whereClause = {
          telegramChatId: { not: null },
          deletedAt: null,
          isActive: true,
          role: { in: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI'] as any },
          ...(organizationId ? { organizationId } : {}),
        };
      }

      const authorizedStaff = await this.prisma.user.findMany({
        where: whereClause,
        select: { telegramChatId: true },
      });

      authorizedStaff.forEach((u) => {
        if (u.telegramChatId && u.telegramChatId.trim()) {
          targets.add(u.telegramChatId.trim());
        }
      });
    } catch (err: any) {
      this.logger.error(`Xatolik bildirishnoma chat ID larni olishda: ${err.message}`);
    }

    return Array.from(targets).filter(Boolean);
  }

  /**
   * Get chat IDs of warehouse management staff (Super Admin, Ministry Warehouse, and target Org Warehouse)
   * Faqat botga start bosib login qilgan Super Admin va Omborchilar
   */
  async getWarehouseChatIds(organizationId?: string): Promise<string[]> {
    const targets = new Set<string>();

    try {
      // 2-VARIANT QOIDASI (Qat'iy ajratilgan — Tinch rejim):
      // Quyi tashkilot (SUB_ORG) talabnomasi bo'lsa -> FAQAT shu tashkilot omborchisi va adminiga boradi. Super Admin bezovta qilinmaydi!
      // Vazirlik talabnomasi bo'lsa -> Vazirlik omborchisi va Super Adminga boradi.
      let targetOrg: { id: string; type: string } | null = null;
      if (organizationId) {
        targetOrg = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, type: true },
        });
      }

      let whereClause: any;

      if (targetOrg && targetOrg.type === 'SUB_ORG') {
        whereClause = {
          telegramChatId: { not: null },
          deletedAt: null,
          isActive: true,
          role: { in: ['ORG_OMBORCHI', 'ORG_ADMIN'] as any },
          organizationId: targetOrg.id,
        };
      } else {
        whereClause = {
          telegramChatId: { not: null },
          deletedAt: null,
          isActive: true,
          role: { in: ['VAZIRLIK_OMBORCHI', 'SUPER_ADMIN'] as any },
          ...(organizationId ? { organizationId } : {}),
        };
      }

      const warehouseUsers = await this.prisma.user.findMany({
        where: whereClause,
        select: { telegramChatId: true },
      });

      warehouseUsers.forEach((u) => {
        if (u.telegramChatId && u.telegramChatId.trim()) {
          targets.add(u.telegramChatId.trim());
        }
      });
    } catch (err: any) {
      this.logger.error(`Xatolik omborchi chat ID larni olishda: ${err.message}`);
    }

    return Array.from(targets).filter(Boolean);
  }

  async sendWarehouseMessage(message: string, organizationId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getWarehouseChatIds(organizationId);
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
        this.logger.error(`Telegram warehouse error (${targetChatId}): ${err.message}`);
      }
    }
    return successCount > 0;
  }

  async sendMessage(message: string, overrideChatId?: string, organizationId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getAdminChatIds(overrideChatId, organizationId);
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
    const { token } = this.getCredentials();
    const rawTarget = overrideChatId;
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

  async sendDocumentBuffer(filename: string, buffer: Buffer, caption: string, overrideChatId?: string, organizationId?: string): Promise<boolean> {
    const { token } = this.getCredentials();
    if (!token) return false;

    const chatIds = await this.getAdminChatIds(overrideChatId, organizationId);
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
