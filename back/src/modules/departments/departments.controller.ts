import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

const DEPT_MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.ADMIN,
];

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @ApiOperation({ summary: "Barcha bo'limlar royxati" })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.departmentsService.findAll(targetOrgId, user);
  }

  @ApiOperation({ summary: "Bo'limlarni Excel (CSV) formatida eksport qilish" })
  @Roles(...MANAGERS)
  @Get('export')
  async exportCsv(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const isSuperOrMinistry = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.VAZIRLIK_OMBORCHI;
    const targetOrgId = isSuperOrMinistry ? organizationId : user?.organizationId;
    const csvContent = await this.departmentsService.exportCsv(targetOrgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bolimlar.csv',
    );
    return res.status(200).send(csvContent);
  }

  @ApiOperation({ summary: "Bitta bo'lim" })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @ApiOperation({ summary: "Bo'lim statistikasi" })
  @Roles(...MANAGERS)
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.departmentsService.getStats(id);
  }

  @ApiOperation({ summary: "Yangi bo'lim yaratish" })
  @Roles(...DEPT_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: any) {
    return this.departmentsService.create(dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limni tahrirlash" })
  @Roles(...DEPT_MANAGE_ROLES)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: any,
  ) {
    return this.departmentsService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limni o'chirish" })
  @Roles(...DEPT_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.departmentsService.remove(id, user.id);
  }
}
