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

      // 2. Default tizim foydalanuvchilarini tekshirish (Admin, Omborchi, Kadr) - bo'limsiz
      const seedUsers = [
        {
          username: 'admin',
          fullName: 'Bosh Administrator',
          role: UserRole.SUPER_ADMIN,
          password: 'admin123',
          position: 'Bosh Administrator',
        },
        {
          username: 'omborchi',
          fullName: 'Bosh Omborchi',
          role: UserRole.VAZIRLIK_OMBORCHI,
          password: 'omborchi123',
          position: 'Bosh Omborchi',
        },
        {
          username: 'kadr',
          fullName: 'Kadrlar Bo‘limi Mas’uli',
          role: UserRole.KADR,
          password: 'kadr123',
          position: 'Kadrlar bo‘yicha mas’ul',
        },
      ];

      for (const u of seedUsers) {
        const existingUser = await this.prisma.user.findFirst({
          where: { username: u.username, deletedAt: null },
        });

        if (!existingUser) {
          const passwordHash = await bcrypt.hash(u.password, 10);
          await this.prisma.user.create({
            data: {
              username: u.username,
              fullName: u.fullName,
              passwordHash,
              role: u.role,
              organizationId: ministry.id,
              position: u.position,
              phone: '+998900000000',
              isActive: true,
            },
          });
          this.logger.log(
            `Default tizim foydalanuvchisi yaratildi (${u.role}): login: ${u.username}, parol: ${u.password}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Dastlabki foydalanuvchilarni tekshirishda xatolik yuz berdi:',
        error,
      );
    }
  }
}
