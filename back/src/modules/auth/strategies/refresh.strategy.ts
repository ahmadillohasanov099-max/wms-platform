import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET as string,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const refreshToken = req.body?.refreshToken;
    const tokenId = payload.tokenId;

    if (!tokenId) {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });

    if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "Refresh token yaroqsiz yoki muddati o'tgan",
      );
    }

    const match = await bcrypt.compare(refreshToken, dbToken.tokenHash);
    if (!match) {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        "Foydalanuvchi bloklangan yoki o'chirilgan",
      );
    }

    return { ...payload, refreshTokenId: dbToken.id };
  }
}
