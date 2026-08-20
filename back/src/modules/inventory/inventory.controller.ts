import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryService } from './inventory.service';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { CurrentUser, Roles } from '../auth';
import { BulkStockInDto } from './dto';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Barcha ombor holati' })
  @Roles(...MANAGERS)
  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.findAll(targetOrgId, user);
  }

  @ApiOperation({ summary: 'Biriktirilgan jihozlar ro\'yxati' })
  @Roles(...MANAGERS)
  @Get('assigned-assets')
  getAssignedAssets(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.getAssignedAssets(targetOrgId, user);
  }

  @ApiOperation({ summary: 'Ombor hisobotini Excel (.xlsx) formatda eksport qilish' })
  @Roles(...MANAGERS)
  @Get('export')
  async exportExcel(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const isSuperOrMinistry = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.VAZIRLIK_OMBORCHI;
    const targetOrgId = isSuperOrMinistry ? organizationId : user?.organizationId;
    const buffer = await this.inventoryService.exportExcel(targetOrgId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=ombor_qoldiqlari.xlsx',
    );
    return res.status(200).send(buffer);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get('low-stock')
  getLowStock(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const isSuperOrMinistry = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.VAZIRLIK_OMBORCHI;
    const targetOrgId = isSuperOrMinistry ? organizationId : user?.organizationId;
    return this.inventoryService.getLowStock(targetOrgId);
  }

  @ApiOperation({ summary: 'Bitta mahsulot miqdori' })
  @Roles(...MANAGERS)
  @Get(':productId')
  findOne(@Param('productId') productId: string) {
    return this.inventoryService.findOne(productId);
  }

  @ApiOperation({ summary: 'Minimal daraja belgilash' })
  @Roles(...MANAGERS)
  @Patch('min-level')
  setMinLevel(@Body() dto: SetMinLevelDto) {
    return this.inventoryService.setMinLevel(dto);
  }

  @ApiOperation({ summary: "Bir vaqtda ko'p mahsulot kirim qilish" })
  @Roles(...MANAGERS)
  @Post('bulk-stock-in')
  bulkStockIn(@Body() dto: BulkStockInDto, @CurrentUser() user: any) {
    return this.inventoryService.bulkStockIn(dto, user.id);
  }

  @ApiOperation({ summary: 'Excel fayldan ommaviy mahsulotlar va jihozlarni omborga kirim qilish' })
  @Roles(...MANAGERS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @Post('import-excel')
  importExcel(
    @UploadedFile() file: any,
    @Body('productType') productType: string,
    @Body('type') type: string,
    @CurrentUser() user: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Excel fayli yuklanmadi");
    }
    const requestedProductType = productType || type;
    return this.inventoryService.importExcel(file.buffer, user.id, requestedProductType);
  }

  @ApiOperation({ summary: 'Master Excel Shablonini yuklab olish' })
  @Roles(...MANAGERS)
  @Get('master-template')
  async downloadMasterTemplate(@Res() res: express.Response) {
    const buffer = await this.inventoryService.generateMasterTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Master_Barcha_Malumotlar_Shabloni.xlsx',
    );
    return res.status(200).send(buffer);
  }

  @ApiOperation({ summary: "Yagona Master Excel orqali barcha ma'lumotlarni yuklash" })
  @Roles(...MANAGERS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @Post('master-import')
  importMasterExcel(
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Excel fayli yuklanmadi");
    }
    return this.inventoryService.importMasterExcel(file.buffer, user.id);
  }
}
