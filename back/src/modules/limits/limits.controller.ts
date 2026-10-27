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
  Req,
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


const DECREE_FILE_INTERCEPTOR = FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Ruxsat berilmagan fayl formati (${ext})! Faqat PDF, rasm yoki Word hujjati yuklanishi shart!`,
        ),
        false,
      );
    }
  },
});

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
  @UseInterceptors(DECREE_FILE_INTERCEPTOR)
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
  @UseInterceptors(DECREE_FILE_INTERCEPTOR)
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

  @ApiOperation({ summary: 'Yuklangan buyruq faylini xavfsiz ko‘rish/yuklab olish (Stream orqali)' })
  @Roles(...LIMIT_VIEWERS)
  @Get('decrees/*path')
  async getDecreeFile(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    let rawPath = '';
    const pathParam = (req.params as any)?.path;
    if (Array.isArray(pathParam)) {
      rawPath = pathParam.join('/');
    } else if (typeof pathParam === 'string') {
      rawPath = pathParam;
    } else if ((req.params as any)[0]) {
      rawPath = (req.params as any)[0];
    }

    if (!rawPath) {
      const fullUrl = req.url || req.path || '';
      const marker = '/decrees/';
      const idx = fullUrl.indexOf(marker);
      if (idx !== -1) {
        rawPath = decodeURIComponent(fullUrl.slice(idx + marker.length).split('?')[0]);
      }
    }

    const safeRelativePath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(process.cwd(), 'uploads', 'decrees', safeRelativePath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new NotFoundException('Buyruq fayli topilmadi');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const baseName = path.basename(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}"`);

    // Stream orqali xotira (RAM) sarflamasdan oqimli uzatish
    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
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
