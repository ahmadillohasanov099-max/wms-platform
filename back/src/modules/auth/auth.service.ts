import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        department: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    if (!user || user.deletedAt)
      throw new UnauthorizedException("Username yoki parol noto'g'ri");

    if (user.employmentStatus === 'OFFBOARDED')
      throw new UnauthorizedException("Username yoki parol noto'g'ri");

    if (!user.isActive)
      throw new UnauthorizedException("Kechirasiz siz bloklangansiz");

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException("Username yoki parol noto'g'ri");
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
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        position: user.position,
        departmentId: user.departmentId,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
        organizationId: user.organizationId,
        organization: user.organization ? { id: user.organization.id, name: user.organization.name, code: user.organization.code, type: user.organization.type } : null,
        phone: user.phone,
        internalPhone: user.internalPhone,
      },
    };
  }

  async logout(userId: string, refreshTokenId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        id: refreshTokenId,
        userId: userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { message: 'Tizimdan muvaffaqiyatli chiqdingiz' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  async verifyPassword(userId: string, password?: string) {
    if (!password) {
      throw new BadRequestException("Parol kiritilishi shart");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new BadRequestException("Joriy parolingiz noto'g'ri");
    }
    return { success: true };
  }

  async refresh(userId: string, refreshTokenId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        "Foydalanuvchi bloklangan yoki o'chirilgan",
      );
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });

    // Generate new pair
    const tokens = await this.generateTokenPair(
      user.id,
      user.username,
      user.role,
      user.organizationId,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async generateTokenPair(
    userId: string,
    username: string,
    role: string,
    organizationId?: string | null,
  ) {
    // 1. Create a RefreshToken record in DB to get a unique ID
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: '',
        expiresAt,
      },
    });

    // 2. Generate tokens, include refreshTokenId (tokenId) in refresh token payload
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

    // 3. Update the token record with a hash of the refresh token
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { tokenHash },
    });

    // 4. Asynchronously clean up old/expired tokens for this user to prevent DB bloat
    this.prisma.refreshToken
      .deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Remove tokens revoked more than 24h ago
          ],
        },
      })
      .catch(() => {
        // Fail silently
      });

    return { accessToken, refreshToken };
  }
}
