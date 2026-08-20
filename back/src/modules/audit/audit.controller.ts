import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { FindAuditLogDto } from './dto/find-audit-log.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, CurrentTenant, Roles } from '../auth/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Audit Logs (Xavfsizlik va Amallar Auditi)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Faqat Bosh Administrator uchun tizimdagi barcha audit va harakatlar tarixini olish' })
  findAll(
    @Query() query: FindAuditLogDto,
    @CurrentTenant('organizationId') organizationId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    return this.auditService.findAll(query, organizationId, isSuperAdmin);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Audit loglar bo\'yicha qisqacha statistikani olish' })
  getStats(
    @CurrentTenant('organizationId') organizationId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    return this.auditService.getStats(organizationId, isSuperAdmin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta audit logning batafsil ma\'lumotini olish' })
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
