import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { MailService, TelegramService, escapeHtml } from '../../nodemailer';
import { OperationsPdfService } from './operations-pdf.service';

@Injectable()
export class OperationsNotifierService {
  private readonly logger = new Logger(OperationsNotifierService.name);
  private pendingBatchDocTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private telegramService: TelegramService,
    private pdfService: OperationsPdfService,
  ) {}

  async checkStockAndAlert(productId: string) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { productId },
        include: { product: true },
      });

      if (
        inventory &&
        inventory.product &&
        inventory.quantity < inventory.minLevel
      ) {
        this.mailService
          .sendLowStockAlert(
            inventory.product.name,
            inventory.quantity,
            inventory.minLevel,
          )
          .catch((err) =>
            this.logger.error('Failed to send stock alert email:', err),
          );

        this.telegramService
          .sendLowStockAlert(
            inventory.product.name,
            inventory.quantity,
            inventory.minLevel,
          )
          .catch((err) =>
            this.logger.error('Failed to send Telegram stock alert:', err),
          );
      }
    } catch (error) {
      this.logger.error('Error checking stock level for email/telegram alert:', error);
    }
  }

  notifyTelegramForOperation(opId: string, documentNumber?: string | null) {
    const batchKey = documentNumber ? `DOC_${documentNumber}` : `OP_${opId}`;
    if (this.pendingBatchDocTimers.has(batchKey)) {
      clearTimeout(this.pendingBatchDocTimers.get(batchKey)!);
    }

    const timer = setTimeout(async () => {
      this.pendingBatchDocTimers.delete(batchKey);
      await this.processTelegramDocumentNotification(opId, documentNumber);
    }, 800);

    this.pendingBatchDocTimers.set(batchKey, timer);
  }

  async sendImmediateOperationAlert(opId: string) {
    try {
      const op = await this.prisma.operation.findUnique({
        where: { id: opId },
        include: {
          product: true,
          user: true,
          department: true,
          performedBy: true,
        },
      });
      if (!op) return;

      let alertTitle = '📦 OMBOR OPERATSIYASI';
      const targetName = op.user?.fullName || op.department?.name || 'Markaziy Ombor';

      if (op.type === 'GIVE_TO_USER') alertTitle = '📤 XODIMGA BERILDI';
      else if (op.type === 'ASSIGN_TO_DEPT') alertTitle = '🏢 BO‘LIMGA BIRIKTIRILDI';
      else if (op.type === 'GIVE_TO_DEPT') alertTitle = '📤 BO‘LIMGA BERILDI';
      else if (op.type === 'RETURN_FROM_USER') alertTitle = '↩️ XODIMDAN QAYTARILDI';
      else if (op.type === 'TRANSFER_USER') alertTitle = '🔄 XODIMDAN XODIMGA O‘TKAZILDI';
      else if (op.type === 'WRITE_OFF') alertTitle = '🗑️ HISOBDAN CHIQARILDI';

      void this.telegramService.sendOperationAlert(
        alertTitle,
        op.product?.name || 'Mahsulot',
        op.quantity,
        targetName,
        op.performedBy?.fullName || 'Bosh Omborchi',
        'ta',
        op.organizationId || undefined,
      );
    } catch (err) {
      this.logger.error('Error sending immediate Telegram operation alert:', err);
    }
  }

  private async processTelegramDocumentNotification(opId: string, documentNumber?: string | null) {
    try {
      const mainOp = await this.prisma.operation.findUnique({
        where: { id: opId },
        include: {
          product: true,
          asset: true,
          user: { include: { department: true } },
          department: true,
          performedBy: true,
        },
      });
      if (!mainOp) return;

      const relatedOps = documentNumber
        ? await this.prisma.operation.findMany({
            where: {
              documentNumber: documentNumber,
              type: mainOp.type,
            },
            include: {
              product: true,
              asset: true,
              user: { include: { department: true } },
              department: true,
              performedBy: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : [mainOp];

      if (relatedOps.length === 0) return;

      const opOrgId = mainOp.organizationId || mainOp.user?.organizationId || mainOp.department?.organizationId || undefined;
      const isAsosiyVosita = mainOp.product?.productType === ProductType.BERILADIGAN;

      if (isAsosiyVosita && (mainOp.type === 'GIVE_TO_USER' || mainOp.type === 'ASSIGN_TO_DEPT')) {
        const docNumStr = documentNumber || mainOp.documentNumber || `MJSH-${opId.slice(-6)}`;
        const targetUser = mainOp.user;
        const targetName = targetUser
          ? targetUser.fullName
          : mainOp.department
          ? mainOp.department.name
          : 'Xodim';

        const items = relatedOps.map((op) => ({
          name: op.product?.name || 'Mahsulot',
          inventoryNumber: op.asset?.inventoryNumber || '',
          serialNumber: op.asset?.serialNumber || '',
        }));

        const pdfBuffer = await this.pdfService.generateModdiyJavobgarlikPdf({
          documentNumber: docNumStr,
          date: mainOp.createdAt,
          toRecipient: targetName,
          recipientPassport: targetUser?.passport || '',
          recipientAddress: targetUser?.address || '',
          items,
        });

        const itemsSummary = items
          .slice(0, 3)
          .map((it) => it.name + (it.inventoryNumber ? ` (Inv: ${it.inventoryNumber})` : ''))
          .join(', ') + (items.length > 3 ? ` va yana ${items.length - 3} ta` : '');

        const formattedDate = new Date(mainOp.createdAt).toLocaleString('uz-UZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const filename = `moddiy_javobgarlik_shartnomasi_${docNumStr}.pdf`;
        const caption =
          `📄 <b>Moddiy javobgarlik shartnomasi № ${docNumStr}</b>\n\n` +
          `<b>${escapeHtml(targetName)}</b>\n` +
          `Jihozlar: ${escapeHtml(itemsSummary)}\n\n` +
          `<blockquote>📤 <b>Mas'ul:</b> ${escapeHtml(mainOp.performedBy?.fullName || 'Bosh Omborchi')}</blockquote>\n\n` +
          `📅 ${formattedDate}`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption, undefined, opOrgId);
      } else if (!isAsosiyVosita && (mainOp.type === 'GIVE_TO_USER' || mainOp.type === 'GIVE_TO_DEPT')) {
        const docNumStr = documentNumber || mainOp.documentNumber || `${opId.slice(-6)}`;
        const targetUser = mainOp.user;
        const targetName = targetUser
          ? `${targetUser.fullName}${targetUser.department?.name ? ` (${targetUser.department.name})` : ''}`
          : mainOp.department
          ? mainOp.department.name
          : 'Xodim';

        const items = relatedOps.map((op) => ({
          name: op.product?.name || 'Material',
          unit: op.product?.unit || 'ta',
          quantity: op.quantity,
        }));

        const itemsSummary = items
          .slice(0, 3)
          .map((it) => `${it.name} (${it.quantity} ${it.unit})`)
          .join(', ') + (items.length > 3 ? ` va yana ${items.length - 3} xil` : '');

        const formattedDate = new Date(mainOp.createdAt).toLocaleString('uz-UZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const pdfBuffer = await this.pdfService.generateTalabnomaPdf({
          seqNumber: docNumStr,
          date: mainOp.createdAt,
          fromUser: mainOp.performedBy?.fullName || "Xo‘jalik mudiri",
          toRecipient: targetName,
          items,
        });

        const filename = `talabnoma_${docNumStr}.pdf`;
        const caption =
          `📋 <b>Talabnoma № ${docNumStr}</b>\n\n` +
          `<b>${escapeHtml(targetName)}</b>\n` +
          `Materiallar: ${escapeHtml(itemsSummary)}\n\n` +
          `<blockquote>📤 <b>Mas'ul:</b> ${escapeHtml(mainOp.performedBy?.fullName || 'Xo‘jalik mudiri')}</blockquote>\n\n` +
          `📅 ${formattedDate}`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption, undefined, opOrgId);
      } else {
        const pdfBuffer = await this.pdfService.generatePdfAct(opId);
        const filename = `dalolatnoma_${opId.slice(-6)}.pdf`;
        const formattedDate = new Date(mainOp.createdAt).toLocaleString('uz-UZ', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const opTypeNames: Record<string, string> = {
          STOCK_IN: 'Kirim qilish',
          GIVE_TO_USER: 'Xodimga berish',
          RETURN_FROM_USER: 'Xodimdan qaytarish',
          GIVE_TO_DEPT: 'Bo‘limga berish',
          RETURN_FROM_DEPT: 'Bo‘limdan qaytarish',
          TRANSFER_USER: 'Xodimdan xodimga o‘tkazish',
          WRITE_OFF: 'Hisobdan chiqarish',
          ASSIGN_TO_DEPT: 'Bo‘limga biriktirish',
        };

        const caption =
          `📑 <b>Dalolatnoma № ${opId.slice(-6)}</b>\n\n` +
          `<b>${escapeHtml(mainOp.product?.name || 'Mahsulot')}</b> (${mainOp.quantity} ta)\n` +
          `Amal: <code>${escapeHtml(opTypeNames[mainOp.type] || mainOp.type)}</code>\n\n` +
          `<blockquote>📤 <b>Mas'ul:</b> ${escapeHtml(mainOp.performedBy?.fullName || 'Bosh Omborchi')}</blockquote>\n\n` +
          `📅 ${formattedDate}`;
        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption, undefined, opOrgId);
      }

      // Xodimga shaxsiy bildirishnoma yuborish (GIVE_TO_USER va RETURN_FROM_USER holatlarida)
      if (mainOp.user && mainOp.user.telegramChatId) {
        if (mainOp.type === 'GIVE_TO_USER') {
          const invStr = mainOp.asset?.inventoryNumber ? `№ <code>${escapeHtml(mainOp.asset.inventoryNumber)}</code>` : '';
          const senderName = mainOp.performedBy?.fullName ? escapeHtml(mainOp.performedBy.fullName) : 'Bosh omborchi';
          const personalMsg =
            `📦 <b>Yangi jihoz biriktirildi</b>\n\n` +
            `<b>${escapeHtml(mainOp.product?.name || 'Jihoz')}</b>\n` +
            (invStr ? `${invStr}\n\n` : '\n') +
            `<blockquote>ℹ️ <b>Javobgarlik:</b>\nJihoz shaxsiy foydalanishingizga biriktirildi va moddiy hisobingizga kiritildi.</blockquote>\n\n` +
            `📍 Bosh omborxona • ${senderName}`;

          void this.telegramService.sendMessage(personalMsg, mainOp.user.telegramChatId);
        } else if (mainOp.type === 'RETURN_FROM_USER') {
          const invStr = mainOp.asset?.inventoryNumber ? `№ <code>${escapeHtml(mainOp.asset.inventoryNumber)}</code>` : '';
          const receiverName = mainOp.performedBy?.fullName ? escapeHtml(mainOp.performedBy.fullName) : 'Bosh omborchi';
          const personalMsg =
            `↩️ <b>Jihoz omborga qabul qilindi</b>\n\n` +
            `<b>${escapeHtml(mainOp.product?.name || 'Jihoz')}</b>\n` +
            (invStr ? `${invStr}\n\n` : '\n') +
            `<blockquote>✅ <b>Natija:</b>\nJihoz butun va soz holatda omborga muvaffaqiyatli qabul qilindi hamda hisobingizdan yechildi.</blockquote>\n\n` +
            `📍 Bosh omborxona • ${receiverName}`;

          void this.telegramService.sendMessage(personalMsg, mainOp.user.telegramChatId);
        }
      }
    } catch (err: any) {
      this.logger.error('Telegram document generation error:', err);
    }
  }

  notifyRepairCompleted(
    targetUserId: string,
    productName: string,
    inventoryNumber?: string | null,
    serialNumber?: string | null,
    performerName?: string | null,
    note?: string | null,
  ) {
    const invStr = inventoryNumber ? `№ <code>${escapeHtml(inventoryNumber)}</code>` : '';
    const serialStr = serialNumber ? ` • Seriya: <code>${escapeHtml(serialNumber)}</code>` : '';
    const cleanNote = note?.trim() || "Jihoz to'liq sozlandi va sinovdan o'tkazildi.";
    const usta = performerName ? escapeHtml(performerName) : 'Mas\'ul mutaxassis';

    const message =
      `<b>${escapeHtml(productName)}</b>\n` +
      `${invStr}${serialStr}\n\n` +
      `<blockquote>💬 <b>Usta xulosasi:</b>\n${escapeHtml(cleanNote)}</blockquote>\n\n` +
      `📍 IT xizmati / Omborxona • ${usta}`;

    void this.telegramService.sendUserNotificationAlert(
      targetUserId,
      `🟢 <b>Jihoz ta'mirlandi</b>`,
      message,
    );
  }
}
