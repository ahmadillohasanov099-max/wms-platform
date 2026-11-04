import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  fullName: string;
  role: string;
  position: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  ledDepartments: Array<{ id: string; name: string }>;
  isDepartmentLeader: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
  phone: string | null;
  internalPhone: string | null;
}

export interface LoginResponse extends TokenPair {
  user: AuthUserResponse;
}

const BCRYPT_SALT_ROUNDS = 10;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const PURGE_REVOKED_HOURS = 24;
const FIRST_LOCKOUT_MINUTES = 15;
const SECOND_LOCKOUT_MINUTES = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const rawUser = await this.findUserForAuth(dto.username);
    const user = this.validateUserStatus(rawUser);

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      // 2-BOSQICH: Agar foydalanuvchi avval 15 daqiqalik blok olgan bo'lsa (failedLoginAttempts >= 3):
      // Blok muddati tugagach YANA 1 marta xato kiritsa -> 1 soatga (60 daqiqaga) qat'iy bloklash!
      if (user.failedLoginAttempts >= 3) {
        const lockedUntil = new Date(
          Date.now() + SECOND_LOCKOUT_MINUTES * 60 * 1000,
        );
        const newAttempts = user.failedLoginAttempts + 1;

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil,
          },
        });

        this.logger.warn(
          `Foydalanuvchi ${user.username} 15 daqiqalik blokdan so'ng yana noto'g'ri parol kiritdi va 1 soatga bloklandi.`,
        );

        const remainingSeconds = SECOND_LOCKOUT_MINUTES * 60;
        throw new UnauthorizedException({
          message:
            "Parol qayta xato kiritildi! Tizim xavfsizligini ta'minlash maqsadida hisobingiz 1 soat muddatga bloklandi. Zarurat tug'ilganda tashkilot ma'muriga murojaat qiling.",
          isLocked: true,
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds,
          errorCode: 'LOGIN_LOCKED_1H',
        });
      }

      // 1-BOSQICH: Hali 3 taga yetmagan xatolar (1, 2, 3)
      const newAttempts = user.failedLoginAttempts + 1;

      if (newAttempts >= 3) {
        // Aynan 3-xatoda -> 15 daqiqaga bloklash!
        const lockedUntil = new Date(
          Date.now() + FIRST_LOCKOUT_MINUTES * 60 * 1000,
        );

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil,
          },
        });

        this.logger.warn(
          `Foydalanuvchi ${user.username} 3 marta noto'g'ri parol kiritdi va 15 daqiqaga bloklandi.`,
        );

        const remainingSeconds = FIRST_LOCKOUT_MINUTES * 60;
        throw new UnauthorizedException({
          message:
            "Parol ketma-ket 3 marta noto'g'ri kiritildi. Tizim xavfsizligini ta'minlash maqsadida hisobingiz 15 daqiqaga vaqtincha bloklandi.",
          isLocked: true,
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds,
          errorCode: 'LOGIN_LOCKED_15M',
        });
      }

      // 1- yoki 2-xato:
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil: null,
        },
      });

      const remainingAttempts = 3 - newAttempts;
      if (remainingAttempts === 1) {
        throw new UnauthorizedException({
          message:
            "Diqqat, parol qayta noto'g'ri kiritildi! Yana 1 ta xato urinishdan so'ng hisobingiz 15 daqiqaga bloklanadi.",
          remainingAttempts: 1,
          errorCode: 'LOGIN_WARN_LAST_ATTEMPT',
        });
      }

      throw new UnauthorizedException({
        message:
          `Kiritilgan login yoki parol noto'g'ri. Xavfsizlik talablariga muvofiq, yana ${remainingAttempts} ta urinish imkoniyati mavjud.`,
        remainingAttempts,
        errorCode: 'LOGIN_FAILED_ATTEMPTS',
      });
    }

    // Parol to'g'ri bo'lsa: Agar avval xato urinishlar bo'lgan bo'lsa, ularni tozalash (0 qilish)
    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const tokens = await this.generateTokenPair(
      user.id,
      user.username,
      user.role,
      user.organizationId,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.mapUserResponse(user),
    };
  }

  async checkLockoutStatus(username?: string) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return { isLocked: false, remainingSeconds: 0, lockedUntil: null };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username.trim(), mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    if (!user || !user.lockedUntil) {
      return { isLocked: false, remainingSeconds: 0, lockedUntil: null };
    }

    const now = new Date();
    if (user.lockedUntil > now) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
      );
      return {
        isLocked: true,
        remainingSeconds,
        lockedUntil: user.lockedUntil.toISOString(),
      };
    }

    return { isLocked: false, remainingSeconds: 0, lockedUntil: null };
  }

  async refresh(userId: string, refreshTokenId: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Foydalanuvchi bloklangan yoki o'chirilgan",
      );
    }

    // Oldingi tokenni bekor qilish
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });

    return this.generateTokenPair(
      user.id,
      user.username,
      user.role,
      user.organizationId,
    );
  }

  async logout(
    userId: string,
    refreshTokenId: string,
  ): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: { id: refreshTokenId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Tizimdan muvaffaqiyatli chiqdingiz' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Parol o'zgarganda xavfsizlik uchun barcha sessiyalarni bekor qilish
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async verifyPassword(
    userId: string,
    password?: string,
  ): Promise<{ success: boolean }> {
    if (!password) {
      throw new BadRequestException('Parol kiritilishi shart');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException("Joriy parolingiz noto'g'ri");
    }

    return { success: true };
  }

  async generateTokenPair(
    userId: string,
    username: string,
    role: string,
    organizationId?: string | null,
  ): Promise<TokenPair> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: '', expiresAt },
    });

    const payload = { sub: userId, username, role, organizationId };
    const refreshPayload = { sub: userId, tokenId: refreshTokenRecord.id };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET as string,
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: process.env.JWT_REFRESH_SECRET as string,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any,
      }),
    ]);

    const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { tokenHash },
    });

    // Eskirgan tokenlarni fonda tozalash
    this.purgeExpiredTokens(userId);

    return { accessToken, refreshToken };
  }

  private purgeExpiredTokens(userId: string): void {
    const purgeRevokedThreshold = new Date(
      Date.now() - PURGE_REVOKED_HOURS * 60 * 60 * 1000,
    );

    this.prisma.refreshToken
      .deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { lt: purgeRevokedThreshold } },
          ],
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Token tozalashda xatolik (${userId}): ${err?.message || err}`,
        );
      });
  }

  private async findUserForAuth(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        department: { select: { id: true, name: true } },
        ledDepartments: { select: { id: true, name: true } },
        organization: {
          select: { id: true, name: true, code: true, type: true },
        },
      },
    });
  }

  private validateUserStatus<
    T extends {
      deletedAt: Date | null;
      employmentStatus?: string | null;
      isActive: boolean;
      lockedUntil?: Date | null;
      username: string;
    },
  >(user: T | null): T {
    if (!user || user.deletedAt || user.employmentStatus === 'OFFBOARDED') {
      throw new UnauthorizedException("Username yoki parol noto'g'ri");
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Kechirasiz siz bloklangansiz');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      const remainingMinutes = Math.max(
        1,
        Math.ceil(remainingMs / (60 * 1000)),
      );
      this.logger.warn(
        `Bloklangan hisobga kirishga urinish: ${user.username}. Qolgan vaqt: ${remainingMinutes} daqiqa`,
      );
      throw new UnauthorizedException({
        message: `Ushbu hisob xavfsizlik talablariga muvofiq vaqtincha bloklangan. Kirish huquqi tiklanishiga ${remainingMinutes} daqiqa qoldi. Zarur hollarda mas'ul adminga murojaat qiling.`,
        isLocked: true,
        lockedUntil: user.lockedUntil.toISOString(),
        remainingSeconds,
        remainingMinutes,
        errorCode: 'LOGIN_CURRENTLY_LOCKED',
      });
    }

    return user;
  }

  private mapUserResponse(user: any): AuthUserResponse {
    const isLeader = Boolean(
      user.ledDepartments && user.ledDepartments.length > 0,
    );

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      position: user.position || null,
      departmentId: user.departmentId || null,
      department: user.department
        ? { id: user.department.id, name: user.department.name }
        : null,
      ledDepartments: user.ledDepartments || [],
      isDepartmentLeader: isLeader,
      organizationId: user.organizationId || null,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            code: user.organization.code,
            type: user.organization.type,
          }
        : null,
      phone: user.phone || null,
      internalPhone: user.internalPhone || null,
    };
  }
}
