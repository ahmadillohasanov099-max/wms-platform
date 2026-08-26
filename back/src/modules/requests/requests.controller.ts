import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestStatus, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';

const MODERATORS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.OMBORCHI,
  UserRole.ORG_OMBORCHI,
];

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['requests', 'deletion-requests'])
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
  ) {}

  @ApiOperation({ summary: "Yangi so'rov / murojaat yaratish (o'chirish, qaytarish, hisobdan chiqarish)" })
  @Post()
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateRequestDto,
  ) {
    return this.requestsService.create(user?.id, user?.organizationId, dto);
  }

  @ApiOperation({ summary: "Foydalanuvchining o'z so'rovlarini olish" })
  @Get('my')
  findMy(
    @CurrentUser() user: any,
  ) {
    return this.requestsService.findMyRequests(user?.id, user?.organizationId);
  }

  @ApiOperation({ summary: "Barcha so'rovlarni olish (Vazirlik, Admin yoki Omborchi uchun)" })
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.VAZIRLIK_OMBORCHI,
    UserRole.ORG_ADMIN,
    UserRole.ORG_OMBORCHI,
    UserRole.ADMIN,
    UserRole.OMBORCHI,
    UserRole.KADR,
  )
  @Get()
  findAll(
    @Query('status') status?: RequestStatus,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.requestsService.findAll(status, organizationId, user);
  }

  @ApiOperation({ summary: "Aynan bitta so'rov tafsilotini olish" })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @ApiOperation({ summary: "So'rovni tasdiqlash" })
  @Roles(...MODERATORS)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.requestsService.approve(id, reviewerId, dto);
  }

  @ApiOperation({ summary: "So'rovni rad etish" })
  @Roles(...MODERATORS)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.requestsService.reject(id, reviewerId, dto);
  }
}

// Backward compatibility alias
export { RequestsController as DeletionRequestsController };
