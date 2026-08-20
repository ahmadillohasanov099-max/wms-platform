import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, UnitType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StockInDto {
  @ApiProperty({ example: 'Noutbuk Dell' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ProductType, example: ProductType.BERILADIGAN })
  @IsEnum(ProductType)
  productType: ProductType;

  @ApiPropertyOptional({ enum: UnitType, example: UnitType.DONA })
  @IsOptional()
  @IsEnum(UnitType)
  unit?: UnitType;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 12500000 })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minLevel?: number;

  @ApiPropertyOptional({ example: 'Dell Latitude 5520' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'AKT-2024-001' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @ApiPropertyOptional({ example: 'Yangi yil uchun' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: ['INV-1001', 'INV-1002'],
    description:
      'Faqat BERILADIGAN mahsulotlar uchun inventar raqamlari ro‘yxati',
  })
  @IsOptional()
  @IsString({ each: true })
  inventoryNumbers?: string[];

  @ApiPropertyOptional({
    example: ['SN-001', 'SN-002'],
    description: 'Seriya raqamlari ro‘yxati (tartib bo‘yicha)',
  })
  @IsOptional()
  @IsString({ each: true })
  serialNumbers?: string[];
}
