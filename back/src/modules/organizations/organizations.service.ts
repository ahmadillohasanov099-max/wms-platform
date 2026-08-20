import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { validateAndFormatPhone } from 'src/common/helper/validation.helper';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Bunday koddagi (${dto.code}) tashkilot allaqachon mavjud`,
      );
    }

    const formattedOrgPhone = validateAndFormatPhone(dto.phone);
    const formattedAdminPhone = validateAndFormatPhone(dto.adminPhone || dto.phone);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          code: dto.code,
          type: dto.type || 'SUB_ORG',
          address: dto.address,
          phone: formattedOrgPhone || null,
          parentId: dto.parentId,
        },
      });

      let adminUser: any = null;
      if (dto.adminUsername && dto.adminPassword) {
        const cleanUsername = dto.adminUsername.trim().toLowerCase();
        const existingUser = await tx.user.findUnique({
          where: { username: cleanUsername },
        });
        if (existingUser) {
          throw new BadRequestException(
            `"${cleanUsername}" nomli foydalanuvchi logini allaqachon mavjud`,
          );
        }

        if (formattedAdminPhone) {
          const existingPhone = await tx.user.findFirst({
            where: { phone: formattedAdminPhone, deletedAt: null },
          });
          if (existingPhone) {
            throw new BadRequestException(
              `"${formattedAdminPhone}" telefon raqami boshqa foydalanuvchiga biriktirilgan`,
            );
          }
        }

        const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
        adminUser = await tx.user.create({
          data: {
            fullName: dto.adminFullName || `${dto.name} Administratori`,
            username: cleanUsername,
            passwordHash: hashedPassword,
            role: 'ADMIN',
            phone: formattedAdminPhone || null,
            organizationId: org.id,
            isActive: true,
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
          },
        });
      }

      return {
        ...org,
        adminUser,
      };
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            products: true,
            assets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        subOrgs: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, type: true },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            products: true,
            assets: true,
            deletionRequests: true,
          },
        },
      },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundException('Tashkilot topilmadi');
    }

    return org;
  }

  async findMyOrganization(organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('Foydalanuvchi hech qaysi tashkilotga biriktirilmagan');
    }
    return this.findOne(organizationId);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
