import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Organizations (Tashkilotlar)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: "Yangi quyi tashkilot qo'shish (Vazirlik Admini)" })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.VAZIRLIK_OMBORCHI, UserRole.ADMIN)
  @ApiOperation({ summary: "Barcha tashkilotlar ro'yxati (Vazirlik uchun)" })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get('my')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.VAZIRLIK_OMBORCHI,
    UserRole.ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.OMBORCHI,
    UserRole.ORG_OMBORCHI,
    UserRole.KADR,
    UserRole.XODIM,
  )
  @ApiOperation({ summary: "Joriy foydalanuvchining o'z tashkiloti ma'lumotlarini ko'rish" })
  findMy(@CurrentUser() user: any) {
    return this.organizationsService.findMyOrganization(user.organizationId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VAZIRLIK_OMBORCHI, UserRole.ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: "Tashkilot tafsilotlarini ko'rish" })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: "Tashkilot ma'lumotlarini tahrirlash" })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: "Tashkilotni o'chirish (Soft delete)" })
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}
