import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { UserRole, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      // 1. Asosiy tashkilotni tekshirish yoki yaratish
      let ministry = await this.prisma.organization.findFirst({
        where: { code: 'MINISTRY', deletedAt: null },
      });

      if (!ministry) {
        ministry = await this.prisma.organization.create({
          data: {
            name: "O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi",
            code: 'MINISTRY',
            type: OrganizationType.MINISTRY,
            address: "Toshkent shahri, Abay ko'chasi 6",
            phone: '+998 71 200 00 00',
          },
        });
      }

      // 2. Yagona Bosh Administrator (Super Admin) akkauntini tekshirish yoki yaratish
      const superAdminUsername = 'ahmadillohasanov099@gmail.com';
      const superAdminRawPass = '333053334aa';

      const existingSuperAdmin = await this.prisma.user.findFirst({
        where: { username: superAdminUsername, deletedAt: null },
      });

      if (!existingSuperAdmin) {
        const passwordHash = await bcrypt.hash(superAdminRawPass, 10);
        await this.prisma.user.create({
          data: {
            username: superAdminUsername,
            fullName: 'Ahmadillo Hasanov',
            passwordHash,
            role: UserRole.SUPER_ADMIN,
            organizationId: ministry.id,
            position: 'Bosh Administrator',
            phone: '+998900000000',
            isActive: true,
          },
        });
        this.logger.log(
          `Yagona Bosh Administrator yaratildi: login: ${superAdminUsername}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Dastlabki Super Adminni tekshirishda xatolik yuz berdi:',
        error,
      );
    }
  }
}
