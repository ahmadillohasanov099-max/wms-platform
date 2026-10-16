import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, UnitType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkStockInItemDto {
  @ApiProperty({ example: 'Lenovo ThinkPad E15' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ProductType, example: ProductType.BERILADIGAN })
  @IsEnum(ProductType)
  productType: ProductType;

  @ApiPropertyOptional({ enum: UnitType, example: UnitType.DONA })
  @IsOptional()
  @IsEnum(UnitType)
  unit?: UnitType;

  @ApiPropertyOptional({ example: 500, description: '1 pachkadagi donalar soni' })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageSize?: number;

  @ApiPropertyOptional({ example: '2024 yoki 2026.09.12' })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({ example: 'Dell Latitude 5520' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 9000000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ example: 'AKT-2024-001' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Yangi keldi' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: ['INV-001', 'INV-002'], type: [String] })
  @IsOptional()
  @IsString({ each: true })
  inventoryNumbers?: string[];

  @ApiPropertyOptional({ example: ['SN-001', 'SN-002'], type: [String] })
  @IsOptional()
  @IsString({ each: true })
  serialNumbers?: string[];
}

export class BulkStockInDto {
  @ApiProperty({ type: [BulkStockInItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockInItemDto)
  items: BulkStockInItemDto[];
}
