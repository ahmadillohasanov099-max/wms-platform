import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { CurrentUser, Roles } from '../auth';
import { UserRole } from '@prisma/client';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
  UserRole.XODIM,
];

@ApiTags('History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGERS)
@Controller('history')
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @ApiOperation({ summary: "Barcha operatsiyalar tarixini olish" })
  @Roles(...MANAGERS)
  @Get()
  findAll(@Query() query: HistoryQueryDto, @CurrentUser() user: any) {
    const isSuperOrMinistry =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    const targetOrgId = isSuperOrMinistry
      ? query.organizationId
      : user?.organizationId;

    return this.historyService.findAll(
      { ...query, organizationId: targetOrgId },
      user.id,
      user.role,
      user.organizationId,
    );
  }

  @ApiOperation({ summary: 'Tarixni CSV formatda eksport qilish' })
  @Get('export')
  async exportCsv(
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const isSuperOrMinistry =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;

    const targetOrgId = isSuperOrMinistry
      ? query.organizationId
      : user?.organizationId;

    const csvContent = await this.historyService.exportCsv(
      { ...query, organizationId: targetOrgId },
      user.id,
      user.role,
      user.organizationId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=amallar_tarixi.csv',
    );
    return res.status(200).send(csvContent);
  }
}

