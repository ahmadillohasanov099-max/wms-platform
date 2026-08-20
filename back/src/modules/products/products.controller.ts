import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';
import { CurrentUser, Roles } from '../auth';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @ApiOperation({ summary: "Barcha mahsulotlar ro'yxati" })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get()
  findAll(@Query() query: ProductQueryDto, @CurrentUser() user: any) {
    return this.productsService.findAll(query, user);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(...MANAGERS)
  @Get('low-stock')
  getLowStock(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ) {
    const isSuperOrMinistry = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.VAZIRLIK_OMBORCHI;
    const targetOrgId = isSuperOrMinistry ? organizationId : user?.organizationId;
    return this.productsService.getLowStock(targetOrgId);
  }

  @ApiOperation({ summary: 'Bitta mahsulot' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mahsulot harakatlari tarixi' })
  @Roles(...MANAGERS)
  @Get(':id/history')
  getHistory(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.getHistory(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Mahsulotni tahrirlash' })
  @Roles(...MANAGERS)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: "Mahsulotni o'chirish (soft delete)" })
  @Roles(...MANAGERS)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.id);
  }
}
