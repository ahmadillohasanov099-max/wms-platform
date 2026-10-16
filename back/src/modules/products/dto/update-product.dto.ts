import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitType, ProductType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Noutbuk' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'PRD-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({ example: '2024 yoki 2026.09.12' })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({ enum: UnitType })
  @IsOptional()
  @IsEnum(UnitType)
  unit?: UnitType;

  @ApiPropertyOptional({ example: 500, description: '1 pachkadagi donalar soni' })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageSize?: number;

  @ApiPropertyOptional({ example: 'Dell Latitude 5520' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
