import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeletionRequestsService } from './deletion-requests.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { ReviewDeletionRequestDto } from './dto/review-deletion-request.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, CurrentTenant, Roles } from '../auth/decorators';
import { RequestStatus, UserRole } from '@prisma/client';

@ApiTags("Requests (So'rovlar va Bildirishnomalar)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['requests', 'deletion-requests'])
export class DeletionRequestsController {
  constructor(
    private readonly deletionRequestsService: DeletionRequestsService,
  ) {}

  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.ORG_OMBORCHI, UserRole.OMBORCHI, UserRole.ADMIN, UserRole.XODIM)
  @ApiOperation({ summary: "Resurs yoki mahsulotni o'chirish/qaytarish uchun so'rov yuborish" })
  create(
    @CurrentUser('id') userId: string,
    @CurrentTenant('organizationId') organizationId: string,
    @Body() dto: CreateDeletionRequestDto,
  ) {
    return this.deletionRequestsService.create(userId, organizationId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: "Xodim yoki tashkilot o'zining yuborgan so'rovlari ro'yxatini ko'rishi" })
  findMyRequests(
    @CurrentUser('id') userId: string,
    @CurrentTenant('organizationId') organizationId: string,
  ) {
    return this.deletionRequestsService.findMyRequests(userId, organizationId);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.VAZIRLIK_OMBORCHI,
    UserRole.ADMIN,
    UserRole.OMBORCHI,
    UserRole.ORG_OMBORCHI,
    UserRole.ORG_ADMIN,
    UserRole.XODIM
  )
  @ApiOperation({ summary: "Kelib tushgan barcha o'chirish/qaytarish so'rovlarini ko'rish" })
  @ApiQuery({ name: 'status', enum: RequestStatus, required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  findAll(
    @Query('status') status?: RequestStatus,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.deletionRequestsService.findAll(status, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Bitta o'chirish so'rovi tafsiloti" })
  findOne(@Param('id') id: string) {
    return this.deletionRequestsService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VAZIRLIK_OMBORCHI, UserRole.ADMIN, UserRole.OMBORCHI, UserRole.ORG_OMBORCHI)
  @ApiOperation({ summary: "O'chirish/Qaytarish so'rovini tasdiqlash" })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.deletionRequestsService.approve(id, reviewerId, dto);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VAZIRLIK_OMBORCHI, UserRole.ADMIN, UserRole.OMBORCHI, UserRole.ORG_OMBORCHI)
  @ApiOperation({ summary: "O'chirish/Qaytarish so'rovini rad etish" })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.deletionRequestsService.reject(id, reviewerId, dto);
  }
}
