import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { AuditAction, UserRole } from '@prisma/client';
import { UserQueryDto } from '../dto/user-query.dto';
import { ActiveUser } from 'src/common/interfaces';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';
import {
  validateAndFormatPhone,
  validateAndFormatPassport,
  validateAndFormatPinfl,
} from 'src/common/helper/validation.helper';
import * as xlsx from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersExcelService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async exportExcel(query: UserQueryDto, currentUser?: ActiveUser): Promise<Buffer> {
    const { search, departmentId, role, employmentStatus, organizationId } = query;

    const resolvedOrgId = enforceTenantOrgId(currentUser, organizationId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const where: any = {
      deletedAt: null,
      ...orgFilter,
      role: role ? role : UserRole.XODIM,
      ...(employmentStatus && { employmentStatus }),
      ...(departmentId && { departmentId }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { position: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [
        { department: { name: 'asc' } },
        { fullName: 'asc' },
      ],
      include: {
        department: { select: { name: true } },
        assignments: {
          where: { returnedAt: null },
          include: {
            asset: {
              select: { inventoryNumber: true },
            },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Xodimlar', {
      views: [{ showGridLines: true }],
    });

    const baseColumns = [
      { header: '№', key: 'num', baseWidth: 10 },
      { header: 'F.I.Sh.', key: 'fullName', baseWidth: 44 },
      { header: 'Username', key: 'username', baseWidth: 36 },
      { header: 'Bo‘lim', key: 'department', baseWidth: 44 },
      { header: 'Lavozim', key: 'position', baseWidth: 36 },
      { header: 'Telefon raqami', key: 'phone', baseWidth: 24 },
      { header: 'Ichki tel.', key: 'internalPhone', baseWidth: 16 },
      { header: 'Pasport seriyasi va №', key: 'passport', baseWidth: 25 },
      { header: 'JSHSHIR', key: 'pinfl', baseWidth: 20 },
      { header: 'Yashash manzili', key: 'address', baseWidth: 45 },
      { header: 'Holati', key: 'status', baseWidth: 16 },
      { header: 'jihozlar soni', key: 'assetCount', baseWidth: 18 },
      { header: 'Biriktirilgan jihozlar (Inventar №)', key: 'assetsList', baseWidth: 52 },
    ];

    worksheet.columns = baseColumns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.baseWidth,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' },
      };
      cell.font = {
        name: 'Yu Gothic UI',
        size: 11,
        bold: true,
        color: { argb: 'FF000000' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF8EA9DB' } },
        bottom: { style: 'medium', color: { argb: 'FF8EA9DB' } },
        left: { style: 'thin', color: { argb: 'FF8EA9DB' } },
        right: { style: 'thin', color: { argb: 'FF8EA9DB' } },
      };
    });

    users.forEach((u, index) => {
      const activeAssetsCount = u.assignments.length;
      const invNumbers = u.assignments
        .map((a) => a.asset?.inventoryNumber)
        .filter(Boolean)
        .join(', ');

      const rowValues = {
        num: index + 1,
        fullName: u.fullName || '',
        username: u.username ? `@${u.username}` : '',
        department: u.department?.name || "Bo'lim ko'rsatilmagan",
        position: u.position || '—',
        phone: u.phone || '—',
        internalPhone: u.internalPhone || '—',
        passport: u.passport || '—',
        pinfl: u.pinfl || '—',
        address: u.address || '—',
        status: u.isActive ? 'Faol' : 'Bloklangan',
        assetCount: activeAssetsCount,
        assetsList: invNumbers || '—',
      };

      const row = worksheet.addRow(rowValues);
      row.height = 26;

      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Yu Gothic UI',
          size: 10,
          bold: false,
          color: { argb: 'FF000000' },
        };

        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        };

        if (colNumber === 1 || colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });

    const totalRow = worksheet.addRow({
      num: 'JAMI',
      fullName: `${users.length} ta xodim`,
      username: '',
      department: '',
      position: '',
      phone: '',
      internalPhone: '',
      status: '',
      assetCount: users.reduce((sum, u) => sum + u.assignments.length, 0),
      assetsList: '',
    });

    totalRow.height = 28;
    totalRow.eachCell((cell) => {
      cell.font = { name: 'Yu Gothic UI', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF833C0C' } },
        bottom: { style: 'medium', color: { argb: 'FF833C0C' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExcel(fileBuffer: Buffer, performedById: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException("Excel fayli bo'sh yoki topilmadi");
    }

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xls fayl kiriting.");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException("Excel varaqlari bo'sh");
    }

    let headerRowIndex = -1;
    let fullNameCol = -1;
    let usernameCol = -1;
    let deptCol = -1;
    let positionCol = -1;
    let phoneCol = -1;
    let internalPhoneCol = -1;
    let passportCol = -1;
    let pinflCol = -1;
    let addressCol = -1;
    let passwordCol = -1;
    let roleCol = -1;

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").toLowerCase().trim();

        if ((val.includes("f.i.sh") || val.includes("fio") || val.includes("xodim") || val.includes("nomi") || val.includes("имя") || val.includes("фио") || val.includes("name")) && fullNameCol === -1) {
          fullNameCol = c;
          headerRowIndex = r;
        }
        if ((val.includes("username") || val.includes("login") || val.includes("логин")) && usernameCol === -1) {
          usernameCol = c;
        }
        if ((val.includes("bo'lim") || val.includes("bolim") || val.includes("отдел") || val.includes("dept") || val.includes("department")) && deptCol === -1) {
          deptCol = c;
        }
        if ((val.includes("lavozim") || val.includes("должность") || val.includes("position")) && positionCol === -1) {
          positionCol = c;
        }
        if ((val.includes("telefon") || val.includes("phone") || val.includes("тел")) && !val.includes("ichki") && phoneCol === -1) {
          phoneCol = c;
        }
        if ((val.includes("ichki") || val.includes("internal")) && internalPhoneCol === -1) {
          internalPhoneCol = c;
        }
        if ((val.includes("pasport") || val.includes("passport")) && passportCol === -1) {
          passportCol = c;
        }
        if ((val.includes("pinfl") || val.includes("jshshir") || val.includes("пинфл")) && pinflCol === -1) {
          pinflCol = c;
        }
        if ((val.includes("manzil") || val.includes("address") || val.includes("адрес")) && addressCol === -1) {
          addressCol = c;
        }
        if ((val.includes("parol") || val.includes("password") || val.includes("пароль")) && passwordCol === -1) {
          passwordCol = c;
        }
        if ((val.includes("rol") || val.includes("role") || val.includes("роль")) && roleCol === -1) {
          roleCol = c;
        }
      }

      if (fullNameCol !== -1 && (deptCol !== -1 || usernameCol !== -1)) {
        break;
      }
    }

    if (fullNameCol === -1) fullNameCol = 1;
    if (usernameCol === -1) usernameCol = 2;
    if (deptCol === -1) deptCol = 3;
    if (positionCol === -1) positionCol = 4;
    if (phoneCol === -1) phoneCol = 5;

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

    const existingUsers = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, username: true },
    });
    const usernameSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));

    const existingDepts = await this.prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    const deptMap = new Map<string, string>();
    existingDepts.forEach((d) => deptMap.set(d.name.toLowerCase().trim(), d.id));

    let createdUsers = 0;
    let updatedUsers = 0;
    let createdDepts = 0;
    const defaultPasswordHash = await bcrypt.hash("123456", 10);

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawFullName = String(row[fullNameCol] || "").trim();
      if (!rawFullName || rawFullName.toLowerCase().startsWith("jami") || rawFullName === "№") {
        continue;
      }

      let rawUsername = usernameCol !== -1 ? String(row[usernameCol] || "").trim().toLowerCase() : "";
      const rawDeptName = deptCol !== -1 ? String(row[deptCol] || "").trim() : "";
      const rawPosition = positionCol !== -1 ? String(row[positionCol] || "").trim() : undefined;
      const rawPhone = phoneCol !== -1 ? validateAndFormatPhone(String(row[phoneCol] || "")) || undefined : undefined;
      const rawInternalPhone = internalPhoneCol !== -1 ? String(row[internalPhoneCol] || "").trim() || undefined : undefined;
      const rawPassport = passportCol !== -1 ? validateAndFormatPassport(String(row[passportCol] || "")) || undefined : undefined;
      const rawPinfl = pinflCol !== -1 ? validateAndFormatPinfl(String(row[pinflCol] || "")) || undefined : undefined;
      const rawAddress = addressCol !== -1 ? String(row[addressCol] || "").trim() || undefined : undefined;
      const rawPassword = passwordCol !== -1 ? String(row[passwordCol] || "").trim() : undefined;
      const rawRole = roleCol !== -1 ? String(row[roleCol] || "").trim().toUpperCase() : undefined;

      let userRole: UserRole = UserRole.XODIM;
      if (rawRole && Object.values(UserRole).includes(rawRole as UserRole)) {
        userRole = rawRole as UserRole;
      }

      let deptId: string | undefined = undefined;
      if (rawDeptName) {
        const key = rawDeptName.toLowerCase().trim();
        if (deptMap.has(key)) {
          deptId = deptMap.get(key);
        } else {
          const newDept = await this.prisma.department.create({
            data: { name: rawDeptName },
          });
          deptId = newDept.id;
          deptMap.set(key, deptId);
          createdDepts++;
        }
      }

      if (!rawUsername) {
        const parts = rawFullName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
        const base = parts.length >= 2 ? `${parts[0][0]}_${parts[1]}` : parts[0] || `user_${Date.now().toString().slice(-4)}`;
        rawUsername = base;
        let suffix = 1;
        while (usernameSet.has(rawUsername)) {
          rawUsername = `${base}${suffix}`;
          suffix++;
        }
      }

      let passHash = defaultPasswordHash;
      if (rawPassword && rawPassword.length >= 6) {
        passHash = await bcrypt.hash(rawPassword, 10);
      }

      const existingUser = existingUsers.find(
        (u) => u.username.toLowerCase() === rawUsername
      );

      if (existingUser) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: rawFullName,
            departmentId: deptId,
            ...(rawPosition && { position: rawPosition }),
            ...(rawPhone && { phone: rawPhone }),
            ...(rawInternalPhone && { internalPhone: rawInternalPhone }),
            ...(rawPassport && { passport: rawPassport }),
            ...(rawPinfl && { pinfl: rawPinfl }),
            ...(rawAddress && { address: rawAddress }),
            role: userRole,
          },
        });
        updatedUsers++;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            fullName: rawFullName,
            username: rawUsername,
            passwordHash: passHash,
            role: userRole,
            departmentId: deptId,
            position: rawPosition,
            phone: rawPhone,
            internalPhone: rawInternalPhone,
            passport: rawPassport,
            pinfl: rawPinfl,
            address: rawAddress,
          },
        });
        usernameSet.add(rawUsername);
        createdUsers++;

        await this.auditService.log({
          userId: performedById,
          action: AuditAction.CREATE,
          tableName: "User",
          recordId: newUser.id,
          newData: newUser,
        });
      }
    }

    return {
      success: true,
      message: `${createdUsers + updatedUsers} ta xodim muvaffaqiyatli yuklandi${
        createdDepts > 0 ? ` (${createdDepts} ta yangi bo'lim yaratildi)` : ""
      }!`,
      totalRows: createdUsers + updatedUsers,
      createdUsers,
      updatedUsers,
      createdDepartments: createdDepts,
    };
  }
}
