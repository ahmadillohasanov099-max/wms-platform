import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { BulkTransferDto } from './dto/bulk-transfer.dto';
import { UsersService } from './users.service';
import { CurrentUser, Roles } from '../auth';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.RAHBAR,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

const USER_MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.ADMIN,
  UserRole.KADR,
];

const USER_DELETE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.ADMIN,
  UserRole.KADR,
];

const ASSET_TRANSFER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
];

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: "Barcha xodimlar ro'yxati" })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get()
  findAll(
    @Query() query: UserQueryDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.findAll(query, currentUser);
  }

  @ApiOperation({ summary: "Xodimlarni Excel (.xlsx) formatida eksport qilish" })
  @Roles(...MANAGERS)
  @Get('export')
  async exportExcel(
    @Query() query: UserQueryDto,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const buffer = await this.usersService.exportExcel(query, user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=xodimlar.xlsx',
    );
    return res.status(200).send(buffer);
  }

  @ApiOperation({ summary: 'Excel fayl orqali xodimlarni ommaviy yuklash' })
  @Roles(...USER_MANAGE_ROLES)
  @Post('import-excel')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max file size
    }),
  )
  importExcel(
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Excel fayli yuklanmadi");
    }
    return this.usersService.importExcel(file.buffer, user.id);
  }

  @ApiOperation({ summary: "Ishdan bo'shash jarayonidagi xodimlar ro'yxati" })
  @Roles(...MANAGERS)
  @Get('offboarding/pending')
  getPendingOffboardings() {
    return this.usersService.getPendingOffboardings();
  }

  @ApiOperation({ summary: "Bitta xodim ma'lumoti" })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    let targetId = id;
    if (currentUser.role === UserRole.XODIM && currentUser.id !== id) {
      targetId = currentUser.id;
    }
    return this.usersService.findOne(targetId);
  }

  @ApiOperation({ summary: 'Xodimda hozir nima bor' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id/assignments')
  getAssignments(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    let targetId = id;
    if (currentUser.role === UserRole.XODIM && currentUser.id !== id) {
      targetId = currentUser.id;
    }
    return this.usersService.getAssignments(targetId);
  }

  @ApiOperation({ summary: 'Xodim tarixi' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id/history')
  getHistory(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    let targetId = id;
    if (currentUser.role === UserRole.XODIM && currentUser.id !== id) {
      targetId = currentUser.id;
    }
    return this.usersService.getHistory(targetId);
  }

  @ApiOperation({ summary: "Yangi xodim qo'shish" })
  @Roles(...USER_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimni tahrirlash' })
  @Roles(...USER_MANAGE_ROLES)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimni bloklash / faollashtirish' })
  @Roles(...USER_MANAGE_ROLES)
  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.toggleStatus(id, user.id);
  }

  @ApiOperation({ summary: "Xodimni o'chirish (soft delete)" })
  @Roles(...USER_DELETE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Xodimning barcha jihozlarini qaytarish' })
  @Roles(...ASSET_TRANSFER_ROLES)
  @Post(':id/bulk-return')
  bulkReturn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.bulkReturn(id, user.id);
  }

  @ApiOperation({
    summary: "Xodimning barcha jihozlarini boshqa xodimga o'tkazish",
  })
  @Roles(...ASSET_TRANSFER_ROLES)
  @Post(':id/bulk-transfer')
  bulkTransfer(
    @Param('id') id: string,
    @Body() dto: BulkTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.bulkTransfer(id, dto.toUserId, user.id);
  }

  @ApiOperation({ summary: "Xodimni ishdan bo'shatish jarayonini boshlash" })
  @Roles(...USER_MANAGE_ROLES)
  @Post(':id/offboarding/start')
  startOffboarding(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.startOffboarding(id, user.id);
  }

  @ApiOperation({ summary: "Omborchi tomonidan jihozlar qaytarilganini tasdiqlash" })
  @Roles(...ASSET_TRANSFER_ROLES)
  @Post(':id/offboarding/warehouse-approve')
  warehouseApproveOffboarding(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.warehouseApproveOffboarding(id, user.id);
  }

  @ApiOperation({ summary: "Xodimni ishdan bo'shatishni yakunlash" })
  @Roles(...USER_MANAGE_ROLES)
  @Post(':id/offboarding/complete')
  completeOffboarding(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.completeOffboarding(id, user.id);
  }

  @ApiOperation({ summary: "Ishdan bo'shatish dalolatnomasi (Akt)" })
  @Roles(...MANAGERS)
  @Get(':id/offboarding/akt')
  getOffboardingAkt(@Param('id') id: string) {
    return this.usersService.getOffboardingAkt(id);
  }
}
