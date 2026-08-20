import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { CurrentUser, Roles } from '../auth';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';
import { ActiveUser } from 'src/common/interfaces';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  private resolveOrgId(user: ActiveUser, organizationId?: string): string | undefined {
    return enforceTenantOrgId(user, organizationId);
  }

  @ApiOperation({ summary: "Respublika bo'yicha yig'ma statistika (Faqat Super Admin uchun)" })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('consolidated')
  getConsolidated() {
    return this.statsService.getConsolidatedStats();
  }

  @ApiOperation({ summary: "Umumiy ko'rsatkichlar" })
  @Roles(...MANAGERS)
  @Get('overview')
  getOverview(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getOverview(targetOrgId);
  }

  @ApiOperation({ summary: "Bo'lim bo'yicha jihozlar" })
  @Roles(...MANAGERS)
  @Get('by-department')
  getByDepartment(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getByDepartment(targetOrgId);
  }

  @ApiOperation({ summary: "Mahsulot bo'yicha sarflash" })
  @Roles(...MANAGERS)
  @Get('by-product')
  getByProduct(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getByProduct(targetOrgId);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(...MANAGERS)
  @Get('low-stock')
  getLowStock(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getLowStock(targetOrgId);
  }

  @ApiOperation({ summary: 'Oylik dinamika' })
  @Roles(...MANAGERS)
  @Get('monthly')
  getMonthly(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getMonthly(targetOrgId);
  }

  @ApiOperation({ summary: "Oylik solishtirish (Bu oy vs O'tgan oy)" })
  @Roles(...MANAGERS)
  @Get('comparison')
  getComparison(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getComparison(targetOrgId);
  }

  @ApiOperation({ summary: "Xodim bo'yicha jihoz yuklamasi" })
  @Roles(...MANAGERS)
  @Get('by-user')
  getByUser(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = this.resolveOrgId(user, organizationId);
    return this.statsService.getByUser(targetOrgId);
  }
}

