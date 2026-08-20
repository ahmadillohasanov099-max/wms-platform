import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../nodemailer/telegram.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { ReviewDeletionRequestDto } from './dto/review-deletion-request.dto';
import { AssetStatus, EntityType, OperationType, RequestStatus } from '@prisma/client';

@Injectable()
export class DeletionRequestsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
  ) {}

  async create(userId: any, organizationId: string, dto: CreateDeletionRequestDto) {
    const actualUserId = typeof userId === 'object' && userId?.id ? userId.id : String(userId || '');
    const user = await this.prisma.user.findUnique({ where: { id: actualUserId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    let targetOrgId: string = organizationId || user.organizationId || '';
    if (!targetOrgId) {
      const firstOrg = await this.prisma.organization.findFirst();
      if (firstOrg) targetOrgId = firstOrg.id;
    }

    if (!targetOrgId) {
      throw new BadRequestException("Tashkilot ma'lumoti topilmadi");
    }

    // Verify entity existence
    let entityName = dto.entityName;
    if (dto.entityType === EntityType.ASSET) {
      const asset = await this.prisma.asset.findUnique({
        where: { id: dto.entityId },
        include: { product: true },
      });
      if (!asset) throw new NotFoundException("O'chirish/qaytarish so'ralayotgan jihoz (Asset) topilmadi");
      entityName = entityName || `${asset.product?.name || 'Jihoz'} (Inv: ${asset.inventoryNumber})`;
    } else if (dto.entityType === EntityType.PRODUCT) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.entityId } });
      if (!product) throw new NotFoundException("O'chirish so'ralayotgan mahsulot (Product) topilmadi");
      entityName = entityName || product.name;
    } else if (dto.entityType === EntityType.USER) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.entityId } });
      if (!u) throw new NotFoundException("O'chirish so'ralayotgan xodim topilmadi");
      entityName = entityName || u.fullName;
    } else if (dto.entityType === EntityType.DEPARTMENT) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.entityId } });
      if (!dept) throw new NotFoundException("O'chirish so'ralayotgan bo'lim topilmadi");
      entityName = entityName || dept.name;
    }

    const newRequest = await this.prisma.deletionRequest.create({
      data: {
        organizationId: targetOrgId,
        requestedById: actualUserId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        entityName,
        reason: dto.reason,
        status: RequestStatus.PENDING,
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    this.eventsGateway.broadcastDeletionRequestCreated(newRequest);
    return newRequest;
  }

  async findAll(status?: RequestStatus, organizationId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;

    return this.prisma.deletionRequest.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyRequests(organizationId: string) {
    return this.findAll(undefined, organizationId);
  }

  async findOne(id: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!req) {
      throw new NotFoundException("So'rov topilmadi");
    }

    return req;
  }

  async approve(id: string, reviewerId: string, dto: ReviewDeletionRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      if (request.entityType === EntityType.ASSET) {
        // Find asset to get product info
        const asset = await tx.asset.findFirst({
          where: { id: request.entityId },
          include: { product: true },
        });

        if (asset) {
          // Find active assignment for this asset to determine user or department
          const activeAssignment = await tx.assignment.findFirst({
            where: { assetId: request.entityId, returnedAt: null },
          });

          // 1. Close active assignment
          await tx.assignment.updateMany({
            where: { assetId: request.entityId, returnedAt: null },
            data: { returnedAt: now },
          });

          // 2. Reset asset status to ACTIVE in warehouse
          await tx.asset.update({
            where: { id: request.entityId },
            data: { status: AssetStatus.ACTIVE },
          });

          // 3. Increment central warehouse inventory quantity (+1)
          await tx.inventory.updateMany({
            where: { productId: asset.productId },
            data: { quantity: { increment: 1 } },
          });

          // 4. Record Operation entry in History (Tarix)
          const targetUserId = activeAssignment?.userId || request.requestedById;
          const targetDeptId = activeAssignment?.departmentId || null;
          const opType: OperationType = targetDeptId
            ? OperationType.RETURN_FROM_DEPT
            : OperationType.RETURN_FROM_USER;

          await tx.operation.create({
            data: {
              type: opType,
              quantity: 1,
              organizationId: request.organizationId,
              productId: asset.productId,
              assetId: asset.id,
              userId: targetUserId,
              departmentId: targetDeptId,
              performedById: reviewerId,
              documentNumber: `TLB-${request.id.slice(-6).toUpperCase()}`,
              note: dto.reviewComment
                ? `[So'rov bo'yicha omborga qaytarildi]: ${request.reason} (Tasdiq izohi: ${dto.reviewComment})`
                : `[Xodim so'rovi bo'yicha omborga qaytarildi]: ${request.reason}`,
            },
          });
        }
      } else if (request.entityType === EntityType.PRODUCT) {
        const product = await tx.product.findFirst({
          where: { id: request.entityId },
        });

        if (product) {
          await tx.product.update({
            where: { id: request.entityId },
            data: { deletedAt: now },
          });

          // Record WRITE_OFF Operation in History
          await tx.operation.create({
            data: {
              type: OperationType.WRITE_OFF,
              quantity: 1,
              organizationId: request.organizationId,
              productId: product.id,
              userId: request.requestedById,
              performedById: reviewerId,
              documentNumber: `DEL-${request.id.slice(-6).toUpperCase()}`,
              note: dto.reviewComment
                ? `[So'rov bo'yicha hisobdan chiqarildi]: ${request.reason} (Izoh: ${dto.reviewComment})`
                : `[So'rov bo'yicha hisobdan chiqarildi]: ${request.reason}`,
            },
          });
        }
      } else if (request.entityType === EntityType.USER) {
        await tx.user.updateMany({
          where: { id: request.entityId },
          data: { deletedAt: now, isActive: false },
        });
      } else if (request.entityType === EntityType.DEPARTMENT) {
        await tx.department.updateMany({
          where: { id: request.entityId },
          data: { deletedAt: now },
        });
      }

      // 5. Update request status to APPROVED
      return tx.deletionRequest.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          reviewedById: reviewerId,
          reviewComment: dto.reviewComment,
          reviewedAt: now,
        },
        include: {
          organization: { select: { id: true, name: true, code: true } },
          requestedBy: { select: { id: true, fullName: true, username: true } },
          reviewedBy: { select: { id: true, fullName: true, username: true } },
        },
      });
    });

    this.eventsGateway.broadcastDeletionRequestUpdated(result);
    if (result.requestedById) {
      void this.telegramService.sendUserNotificationAlert(
        result.requestedById,
        "So'rov / Murojaat Tasdiqlandi",
        `Siz yuborgan so'rov/murojaat administrator va omborchi tomonidan ko'rib chiqilib, tasdiqlandi. ${dto.reviewComment ? `\n\nIzoh: ${dto.reviewComment}` : ''}`,
      );
    }
    return result;
  }

  async reject(id: string, reviewerId: string, dto: ReviewDeletionRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    const result = await this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        reviewedById: reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    this.eventsGateway.broadcastDeletionRequestUpdated(result);
    if (result.requestedById) {
      void this.telegramService.sendUserNotificationAlert(
        result.requestedById,
        "So'rov / Murojaat Rad Etildi",
        `Siz yuborgan so'rov/murojaat rad etildi. ${dto.reviewComment ? `\n\nSababi: ${dto.reviewComment}` : ''}`,
      );
    }
    return result;
  }
}
