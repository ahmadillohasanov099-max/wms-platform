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
import { ProductType, UserRole } from '@prisma/client';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryService } from './inventory.service';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { CurrentUser, Roles } from '../auth';
import { BulkStockInDto } from './dto';
import { enforceTenantOrgId } from '../../common/helper/tenant.helper';

const INVENTORY_VIEWERS = [
  UserRole.SUPER_ADMIN,
  UserRole.RAHBAR,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.KADR,
];

const WAREHOUSE_MUTATORS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
];

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Barcha ombor holati' })
  @Roles(...INVENTORY_VIEWERS)
  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @Query('search') search: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.findAll(targetOrgId, user, search);
  }

  @ApiOperation({ summary: 'Biriktirilgan jihozlar ro\'yxati' })
  @Roles(...INVENTORY_VIEWERS)
  @Get('assigned-assets')
  getAssignedAssets(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.getAssignedAssets(targetOrgId, user);
  }

  @ApiOperation({ summary: 'Ta\'mirlashdagi jihozlar ro\'yxati' })
  @Roles(...INVENTORY_VIEWERS)
  @Get('in-repair')
  getInRepairAssets(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.getInRepairAssets(targetOrgId, user);
  }

  @ApiOperation({ summary: 'Ombor hisobotini Excel (.xlsx) formatda eksport qilish' })
  @Roles(...INVENTORY_VIEWERS)
  @Get('export')
  async exportExcel(
    @Query('organizationId') organizationId: string,
    @Query('type') type: string,
    @Query('productType') productType: string,
    @Query('search') search: string,
    @Query('lowStock') lowStock: string,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const targetOrgId = enforceTenantOrgId(user, organizationId);
    const chosenType = productType || type;
    const { buffer, organizationName, resolvedType } =
      await this.inventoryService.exportExcel({
        organizationId: targetOrgId,
        productType: chosenType,
        search,
        lowStock,
      });
    const safeOrgName = encodeURIComponent(
      (organizationName || 'ombor').replace(/[\s/\\:*?"<>|]+/g, '_'),
    );
    let typeSuffix = '';
    if (resolvedType === ProductType.BERILADIGAN) {
      typeSuffix = '_asosiy_vositalar';
    } else if (resolvedType === ProductType.SARFLANADIGAN) {
      typeSuffix = '_tmz';
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ombor_${safeOrgName}${typeSuffix}.xlsx"`,
    );
    return res.status(200).send(buffer);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(...INVENTORY_VIEWERS, UserRole.XODIM)
  @Get('low-stock')
  getLowStock(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const isSuperOrMinistry =
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.RAHBAR ||
      user?.role === UserRole.VAZIRLIK_OMBORCHI;
    const targetOrgId = isSuperOrMinistry ? organizationId : user?.organizationId;
    return this.inventoryService.getLowStock(targetOrgId);
  }

  @ApiOperation({ summary: 'Bitta mahsulot miqdori' })
  @Roles(...INVENTORY_VIEWERS)
  @Get(':productId')
  findOne(@Param('productId') productId: string) {
    return this.inventoryService.findOne(productId);
  }

  @ApiOperation({ summary: 'Minimal daraja belgilash' })
  @Roles(...WAREHOUSE_MUTATORS)
  @Patch('min-level')
  setMinLevel(@Body() dto: SetMinLevelDto) {
    return this.inventoryService.setMinLevel(dto);
  }

  @ApiOperation({ summary: "Bir vaqtda ko'p mahsulot kirim qilish" })
  @Roles(...WAREHOUSE_MUTATORS)
  @Post('bulk-stock-in')
  bulkStockIn(@Body() dto: BulkStockInDto, @CurrentUser() user: any) {
    return this.inventoryService.bulkStockIn(dto, user.id);
  }

  @ApiOperation({ summary: 'Excel fayldan ommaviy mahsulotlar va jihozlarni omborga kirim qilish' })
  @Roles(...WAREHOUSE_MUTATORS)
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
  @Roles(...INVENTORY_VIEWERS)
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
  @Roles(...WAREHOUSE_MUTATORS)
  @UseInterceptors( FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 }}),
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
