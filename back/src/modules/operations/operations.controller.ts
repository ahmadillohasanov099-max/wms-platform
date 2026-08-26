import { Body, Controller, Post, UseGuards, Get, Param, Res } from '@nestjs/common';
import * as express from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OperationsService } from './operations.service';
import { CurrentUser, Roles } from '../auth';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { WriteOffDto } from './dto/write-off.dto';
import { BulkWriteOffDto } from './dto/bulk-write-off.dto';
import { StockInDto } from './dto/stock-in.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { RejectAssignmentDto } from './dto/reject-assignment.dto';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operations')
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @ApiOperation({ summary: 'Omborga kirim (mahsulot avtomatik yaratiladi)' })
  @Roles(...MANAGERS)
  @Post('stock-in')
  stockIn(@Body() dto: StockInDto, @CurrentUser() user: any) {
    return this.operationsService.stockIn(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimga jihoz berish (BERILADIGAN)' })
  @Roles(...MANAGERS)
  @Post('give-to-user')
  giveToUser(@Body() dto: GiveToUserDto, @CurrentUser() user: any) {
    return this.operationsService.giveToUser(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimdan jihoz qaytarish' })
  @Roles(...MANAGERS)
  @Post('return-from-user')
  returnFromUser(
    @Body() dto: ReturnFromUserDto,
    @CurrentUser() user: any,
  ) {
    return this.operationsService.returnFromUser(dto, user.id);
  }

  @ApiOperation({ summary: "Bir xodimdan ikkinchisiga o'tkazish" })
  @Roles(...MANAGERS)
  @Post('transfer-user')
  transferUser(@Body() dto: TransferUserDto, @CurrentUser() user: any) {
    return this.operationsService.transferUser(dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limga SARFLANADIGAN berish" })
  @Roles(...MANAGERS)
  @Post('give-to-dept')
  giveToDept(@Body() dto: GiveToDeptDto, @CurrentUser() user: any) {
    return this.operationsService.giveToDept(dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limga umumiy jihoz biriktirish (BERILADIGAN)" })
  @Roles(...MANAGERS)
  @Post('assign-to-dept')
  assignToDept(@Body() dto: AssignToDeptDto, @CurrentUser() user: any) {
    return this.operationsService.assignToDept(dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limdan qaytarish" })
  @Roles(...MANAGERS)
  @Post('return-from-dept')
  returnFromDept(
    @Body() dto: ReturnFromDeptDto,
    @CurrentUser() user: any,
  ) {
    return this.operationsService.returnFromDept(dto, user.id);
  }

  @ApiOperation({ summary: 'Hisobdan chiqarish' })
  @Roles(...MANAGERS)
  @Post('write-off')
  writeOff(@Body() dto: WriteOffDto, @CurrentUser() user: any) {
    return this.operationsService.writeOff(dto, user.id);
  }

  @ApiOperation({ summary: 'Ommaviy hisobdan chiqarish' })
  @Roles(...MANAGERS)
  @Post('bulk-write-off')
  bulkWriteOff(
    @Body() dto: BulkWriteOffDto,
    @CurrentUser() user: any,
  ) {
    return this.operationsService.bulkWriteOff(dto, user.id);
  }

  @ApiOperation({ summary: 'Operatsiya qabul-topshirish dalolatnomasini (PDF) yuklab olish' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: express.Response) {
    const pdfBuffer = await this.operationsService.generatePdfAct(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dalolatnoma_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @ApiOperation({ summary: 'Jihozni qabul qilishni tasdiqlash' })
  @Post('assignments/:id/accept')
  acceptAssignment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.operationsService.acceptAssignment(id, user.id, user.role);
  }

  @ApiOperation({ summary: 'Jihozni qabul qilishni rad etish' })
  @Post('assignments/:id/reject')
  rejectAssignment(
    @Param('id') id: string,
    @Body() dto: RejectAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.operationsService.rejectAssignment(id, dto?.reason || '', user.id, user.role);
  }
}
