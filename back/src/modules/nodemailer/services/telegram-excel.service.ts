import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import * as ExcelJS from 'exceljs';
import { TelegramSenderService } from './telegram-sender.service';

@Injectable()
export class TelegramExcelService {
  constructor(
    private prisma: PrismaService,
    private sender: TelegramSenderService,
  ) {}

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
      await this.sender.sendDocumentBuffer(
        `Ombor_Qoldiqlari_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📊 <b>OMBOR QOLDIQLARI EXCEL HISOBOTI</b>\n\nJami mahsulotlar: <b>${items.length} xil</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Xodimlar_Royxati_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `👥 <b>XODIMLAR RO'YXATI EXCEL HISOBOTI</b>\n\nJami xodimlar: <b>${users.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Operatsiyalar_Tarixi_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📜 <b>OXIRGI OPERATSIYALAR EXCEL HISOBOTI</b>\n\nJami operatsiyalar: <b>${ops.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Tizim_Statistikasi_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📊 <b>TIZIM STATISTIKASI EXCEL HISOBOTI</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Bolimlar_Royxati_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `🏢 <b>BO'LIMLAR RO'YXATI EXCEL HISOBOTI</b>\n\nJami bo'limlar: <b>${depts.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Bo\'limlar Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Audit_Loglar_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `📜 <b>AUDIT LOGLAR EXCEL HISOBOTI</b>\n\nJami loglar: <b>${logs.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Audit loglar Excel hisobotini generatsiya qilishda xatolik.', chatId);
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
      await this.sender.sendDocumentBuffer(
        `Berilgan_Jihozlar_${new Date().toISOString().slice(0, 10)}.xlsx`,
        buffer,
        `💻 <b>BERILGAN (BIRIKTIRILGAN) JIHOZLAR EXCEL HISOBOTI</b>\n\nJami faol jihozlar: <b>${assignments.length} ta</b>`,
        chatId,
      );
    } catch (err: any) {
      await this.sender.sendMessage('❌ Berilgan jihozlar Excel hisobotini generatsiya qilishda xatolik.', chatId);
    }
  }
}
