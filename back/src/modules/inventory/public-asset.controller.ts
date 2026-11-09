import {
  Controller,
  Get,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma';

@ApiTags('Public Assets')
@Controller('public/assets')
export class PublicAssetController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'QR-kod orqali jihoz pasportini ochiq ko‘rish (Public View)',
    description:
      'Mobil telefon kamerasi orqali skaner qilinganda jihozning asosiy maʼlumotlari, javobgar shaxs va holatini ko‘rsatadi',
  })
  @ApiResponse({ status: 200, description: 'Jihoz pasporti topildi' })
  @ApiResponse({ status: 404, description: 'Bunday inventar raqamli jihoz mavjud emas' })
  @Get(':inventoryNumber')
  async getAssetPassport(@Param('inventoryNumber') inventoryNumber: string) {
    const trimmed = (inventoryNumber || '').trim();
    if (!trimmed) {
      throw new BadRequestException("Inventar raqami ko'rsatilmagan");
    }

    const asset = await this.prisma.asset.findFirst({
      where: {
        inventoryNumber: { equals: trimmed, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            year: true,
            description: true,
            imageUrl: true,
            productType: true,
            unit: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
          },
        },
        assignments: {
          where: { returnedAt: null },
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                position: true,
                phone: true,
                internalPhone: true,
                department: { select: { id: true, name: true } },
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`"${trimmed}" inventar raqamli jihoz tizimda topilmadi`);
    }

    const activeAssignment = asset.assignments?.[0];

    return {
      id: asset.id,
      inventoryNumber: asset.inventoryNumber,
      serialNumber: asset.serialNumber,
      status: asset.status,
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      warrantyExp: asset.warrantyExp,
      notes: asset.notes,
      product: asset.product,
      organization: asset.organization,
      assignedTo: activeAssignment
        ? {
            type: activeAssignment.userId ? 'USER' : 'DEPARTMENT',
            user: activeAssignment.user || null,
            department:
              activeAssignment.department ||
              activeAssignment.user?.department ||
              null,
            assignedAt: activeAssignment.assignedAt,
            documentNumber: activeAssignment.documentNumber,
            note: activeAssignment.note,
          }
        : null,
      isAssigned: Boolean(activeAssignment),
    };
  }
}
