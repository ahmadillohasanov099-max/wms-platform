import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryLimitStatusDto {
  @ApiPropertyOptional({ description: 'TMZ mahsulot ID' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Bo‘lim ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Xodim ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Sana (ISO formatda)', example: '2026-10-16' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class QueryLimitsListDto {
  @ApiPropertyOptional({ description: 'Qidiruv (mahsulot, xodim yoki bo‘lim nomi)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Mahsulot ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Bo‘lim ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Xodim ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Sahifa raqami', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Har bir sahifadagi elementlar soni', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
