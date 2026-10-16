import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CurrentUser, Roles } from '../auth';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateLimitExceptionDto,
  QueryLimitsListDto,
  QueryLimitStatusDto,
  SetMonthlyLimitDto,
  UpdateMonthlyLimitDto,
} from './dto';
import { LimitsService } from './limits.service';

const LIMIT_VIEWERS = [
  UserRole.SUPER_ADMIN,
  UserRole.RAHBAR,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.KADR,
  UserRole.XODIM,
];

const LIMIT_MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.RAHBAR,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
];

@ApiTags('TMZ Monthly Limits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('limits')
export class LimitsController {
  constructor(private readonly limitsService: LimitsService) {}

  @ApiOperation({ summary: 'Xodim yoki bo‘lim uchun oylik limit holatini tekshirish' })
  @Roles(...LIMIT_VIEWERS)
  @Get('status')
  async getStatus(
    @Query() query: QueryLimitStatusDto,
    @CurrentUser() user: any,
  ) {
    if (!query.productId) {
      throw new BadRequestException('productId kiritilishi shart');
    }
    const isSuperOrMinistry =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    return this.limitsService.getLimitStatus(
      query.productId,
      isSuperOrMinistry ? null : user?.organizationId,
      {
        userId: query.userId,
        departmentId: query.departmentId,
        date: query.date,
      },
    );
  }

  @ApiOperation({ summary: 'Barcha sozlangan meʼyorlar ro‘yxati' })
  @Roles(...LIMIT_MANAGERS)
  @Get()
  async getLimits(
    @Query() query: QueryLimitsListDto,
    @CurrentUser() user: any,
  ) {
    const isSuper =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    return this.limitsService.getLimits(query, user?.organizationId, isSuper);
  }

  @ApiOperation({ summary: 'Oylik meʼyorni belgilash yoki o‘zgartirish' })
  @Roles(...LIMIT_MANAGERS)
  @Post()
  async setLimit(
    @Body() dto: SetMonthlyLimitDto,
    @CurrentUser() user: any,
  ) {
    const isSuper =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    return this.limitsService.setMonthlyLimit(
      dto,
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
      },
      isSuper,
    );
  }

  @ApiOperation({
    summary: 'Oylik meʼyorni tahrirlash (Buyruq va fayl biriktirish bilan)',
  })
  @Roles(...LIMIT_MANAGERS)
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
    }),
  )
  async updateLimit(
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyLimitDto,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    const isSuper =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    return this.limitsService.updateMonthlyLimit(
      id,
      dto,
      file,
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
      },
      isSuper,
    );
  }

  @ApiOperation({
    summary: 'Vazir / Rahbariyat buyrug‘i asosida limitni oshirish (Fayl biriktirish bilan)',
  })
  @Roles(...LIMIT_MANAGERS)
  @Post('exceptions')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
    }),
  )
  async addException(
    @Body() dto: CreateLimitExceptionDto,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.limitsService.addLimitException(dto, file, {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
  }

  @ApiOperation({ summary: 'Yuklangan buyruq faylini xavfsiz ko‘rish/yuklab olish' })
  @Roles(...LIMIT_VIEWERS)
  @Get('decrees/:filename')
  async getDecreeFile(
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'decrees', safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Buyruq fayli topilmadi');
    }

    return res.sendFile(filePath);
  }

  @ApiOperation({ summary: 'Oylik meʼyorni o‘chirish' })
  @Roles(...LIMIT_MANAGERS)
  @Delete(':id')
  async deleteLimit(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuper =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    return this.limitsService.deleteMonthlyLimit(id, user?.organizationId, isSuper);
  }
}
