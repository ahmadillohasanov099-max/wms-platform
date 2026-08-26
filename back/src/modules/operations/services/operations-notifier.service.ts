import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { MailService, TelegramService } from '../../nodemailer';
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
          `📤 <b>Kimdan:</b> ${mainOp.performedBy?.fullName || 'Bosh Omborchi'}\n` +
          `📥 <b>Kimga:</b> ${targetName}\n` +
          `📦 <b>Jihozlar:</b> ${itemsSummary}\n` +
          `📅 <b>Sana:</b> ${formattedDate}`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
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
          `📤 <b>Kimdan:</b> ${mainOp.performedBy?.fullName || 'Xo‘jalik mudiri'}\n` +
          `📥 <b>Kimga:</b> ${targetName}\n` +
          `📦 <b>Materiallar:</b> ${itemsSummary}\n` +
          `📅 <b>Sana:</b> ${formattedDate}`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
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
          `🔄 <b>Amal:</b> ${opTypeNames[mainOp.type] || mainOp.type}\n` +
          `📤 <b>Mas'ul:</b> ${mainOp.performedBy?.fullName || 'Bosh Omborchi'}\n` +
          `📦 <b>Mahsulot:</b> ${mainOp.product?.name || 'Mahsulot'} (${mainOp.quantity} ta)\n` +
          `📅 <b>Sana:</b> ${formattedDate}`;
        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
      }
    } catch (err: any) {
      this.logger.error('Telegram document generation error:', err);
    }
  }
}
