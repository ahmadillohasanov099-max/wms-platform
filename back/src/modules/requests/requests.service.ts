import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../nodemailer/telegram.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { AssetStatus, EntityType, OperationType, RequestStatus } from '@prisma/client';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
  ) {}

  async create(userId: any, organizationId: string, dto: CreateRequestDto) {
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
      if (!asset) throw new NotFoundException("So'ralayotgan jihoz (Asset) topilmadi");
      entityName = entityName || `${asset.product?.name || 'Jihoz'} (Inv: ${asset.inventoryNumber})`;
    } else if (dto.entityType === EntityType.PRODUCT) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.entityId } });
      if (!product) throw new NotFoundException("So'ralayotgan mahsulot (Product) topilmadi");
      entityName = entityName || product.name;
    } else if (dto.entityType === EntityType.USER) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.entityId } });
      if (!u) throw new NotFoundException("So'ralayotgan xodim topilmadi");
      entityName = entityName || u.fullName;
    } else if (dto.entityType === EntityType.DEPARTMENT) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.entityId } });
      if (!dept) throw new NotFoundException("So'ralayotgan bo'lim topilmadi");
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

    this.eventsGateway.broadcastRequestCreated(newRequest);
    return newRequest;
  }

  async findAll(status?: RequestStatus, targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const where: any = {};
    if (status) where.status = status;
    if (resolvedOrgId) where.organizationId = resolvedOrgId;

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

  async findMyRequests(userId?: any, organizationId?: any) {
    const actualUserId = typeof userId === 'object' && userId?.id ? userId.id : typeof userId === 'string' ? userId : '';
    const actualOrgId = typeof organizationId === 'string' ? organizationId : '';
    const where: any = {};
    if (actualUserId) {
      where.requestedById = actualUserId;
    } else if (actualOrgId) {
      where.organizationId = actualOrgId;
    }

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

  async approve(id: string, reviewerId: string, dto: ReviewRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    // Fetch reviewer information
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { id: true, role: true, organizationId: true },
    });

    if (!reviewer) {
      throw new NotFoundException("Ko'rib chiquvchi foydalanuvchi topilmadi");
    }

    const isMinistryAdmin =
      reviewer.role === 'SUPER_ADMIN' ||
      reviewer.role === 'VAZIRLIK_OMBORCHI';

    // 1. Anti-fraud check: Nobody can approve their own request
    if (request.requestedById === reviewerId) {
      throw new BadRequestException(
        "O'zingiz yuborgan so'rovni o'zingiz tasdiqlay olmaysiz!",
      );
    }

    // 2. Permission check: Structural resource deletions MUST be approved ONLY by Ministry
    if (
      request.entityType === EntityType.PRODUCT ||
      request.entityType === EntityType.USER ||
      request.entityType === EntityType.DEPARTMENT
    ) {
      if (!isMinistryAdmin) {
        throw new ForbiddenException(
          "Ushbu tizimli resursni o'chirish/tasdiqlash faqat Bosh Vazirlik (Super Admin) huquqida!",
        );
      }
    } else if (request.entityType === EntityType.ASSET) {
      // Internal employee return/repair: Must belong to the reviewer's organization unless ministry
      if (!isMinistryAdmin && reviewer.organizationId && request.organizationId !== reviewer.organizationId) {
        throw new ForbiddenException("Siz boshqa tashkilot jihoz so'rovini tasdiqlay olmaysiz");
      }
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

          // 3. Increment warehouse inventory quantity (+1)
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
          where: { id: request.entityId, deletedAt: null },
          include: { inventory: true },
        });

        if (!product) {
          throw new NotFoundException("O'chirilishi so'ralayotgan mahsulot topilmadi yoki allaqachon o'chirilgan");
        }

        // 1. Strict Integrity: Check active assignments with employees
        const activeAssignments = await tx.assignment.count({
          where: {
            asset: { productId: product.id },
            returnedAt: null,
          },
        });

        if (activeAssignments > 0) {
          throw new BadRequestException(
            `Ushbu mahsulot (${activeAssignments} ta) xodimlar zimmasida biriktirilgan! Uni o'chirish yoki hisobdan chiqarish uchun avval barcha xodimlardan omborga qaytarib olinishi shart.`,
          );
        }

        // 2. Strict Integrity: Check department allocations
        const deptAssets = await tx.departmentAsset.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        });

        if (deptAssets._sum.quantity && deptAssets._sum.quantity > 0) {
          throw new BadRequestException(
            `Ushbu mahsulot (${deptAssets._sum.quantity} ta) bo'limlar hisobida mavjud! Avval bo'limlardan omborga qaytarib olinishi shart.`,
          );
        }

        // 3. Strict Integrity: Check warehouse balance
        if (product.inventory && product.inventory.quantity > 0) {
          throw new BadRequestException(
            `Ushbu mahsulot omborda mavjud (qoldiq: ${product.inventory.quantity} ta)! Omborda bor tovar o'chirilmaydi.`,
          );
        }

        // Soft delete product
        await tx.product.update({
          where: { id: request.entityId },
          data: { deletedAt: now },
        });

        // Soft delete asset records
        await tx.asset.updateMany({
          where: { productId: product.id, deletedAt: null },
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
              ? `[Vazirlik tasdig'i bilan o'chirildi]: ${request.reason} (Izoh: ${dto.reviewComment})`
              : `[Vazirlik tasdig'i bilan o'chirildi]: ${request.reason}`,
          },
        });
      } else if (request.entityType === EntityType.USER) {
        const userAssignments = await tx.assignment.count({
          where: { userId: request.entityId, returnedAt: null },
        });

        if (userAssignments > 0) {
          throw new BadRequestException(
            `Xodim zimmasida (${userAssignments} ta) qaytarilmagan jihozlar mavjud! Avval barcha jihozlar omborga qaytarilishi shart.`,
          );
        }

        await tx.user.updateMany({
          where: { id: request.entityId },
          data: { deletedAt: now, isActive: false },
        });

        await tx.refreshToken.updateMany({
          where: { userId: request.entityId, revokedAt: null },
          data: { revokedAt: now },
        });
      } else if (request.entityType === EntityType.DEPARTMENT) {
        const deptUsers = await tx.user.count({
          where: { departmentId: request.entityId, deletedAt: null },
        });

        if (deptUsers > 0) {
          throw new BadRequestException(
            `Bo'limda (${deptUsers} ta) faol xodimlar mavjud! Avval xodimlarni boshqa bo'limga o'tkazing.`,
          );
        }

        await tx.department.updateMany({
          where: { id: request.entityId },
          data: { deletedAt: now },
        });
      }

      // Update request status to APPROVED
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

    this.eventsGateway.broadcastRequestUpdated(result);
    if (result.requestedById) {
      void this.telegramService.sendUserNotificationAlert(
        result.requestedById,
        "So'rov / Murojaat Tasdiqlandi",
        `Siz yuborgan so'rov/murojaat Bosh Vazirlik tomonidan ko'rib chiqilib, tasdiqlandi. ${dto.reviewComment ? `\n\nIzoh: ${dto.reviewComment}` : ''}`,
      );
    }
    return result;
  }

  async reject(id: string, reviewerId: string, dto: ReviewRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    // Fetch reviewer information
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { id: true, role: true, organizationId: true },
    });

    if (!reviewer) {
      throw new NotFoundException("Ko'rib chiquvchi foydalanuvchi topilmadi");
    }

    const isMinistryAdmin =
      reviewer.role === 'SUPER_ADMIN' ||
      reviewer.role === 'VAZIRLIK_OMBORCHI';

    // 1. Anti-fraud check: Nobody can reject their own request
    if (request.requestedById === reviewerId) {
      throw new BadRequestException(
        "O'zingiz yuborgan so'rovni o'zingiz rad eta olmaysiz!",
      );
    }

    // 2. Permission check: Structural resource deletions MUST be rejected ONLY by Ministry
    if (
      request.entityType === EntityType.PRODUCT ||
      request.entityType === EntityType.USER ||
      request.entityType === EntityType.DEPARTMENT
    ) {
      if (!isMinistryAdmin) {
        throw new ForbiddenException(
          "Ushbu so'rovni rad etish faqat Bosh Vazirlik (Super Admin) huquqida!",
        );
      }
    } else if (request.entityType === EntityType.ASSET) {
      if (!isMinistryAdmin && reviewer.organizationId && request.organizationId !== reviewer.organizationId) {
        throw new ForbiddenException("Siz boshqa tashkilot so'rovini rad eta olmaysiz");
      }
    }

    const comment = dto.reviewComment || dto.rejectionReason || 'Sabab ko‘rsatilmadi';
    const result = await this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        reviewedById: reviewerId,
        reviewComment: comment,
        reviewedAt: new Date(),
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    this.eventsGateway.broadcastRequestUpdated(result);
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

export { RequestsService as DeletionRequestsService };
