import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLimitExceptionDto {
  @ApiProperty({ description: 'TMZ mahsulot ID' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Bo‘lim ID (agar bo‘lim uchun bo‘lsa)' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Xodim ID (agar xodim uchun bo‘lsa)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Oylik meʼyor yozuvi ID (agar mavjud bo‘lsa)' })
  @IsOptional()
  @IsString()
  monthlyLimitId?: string;

  @ApiPropertyOptional({ description: 'Yil-oy formati (masalan, "2026-10")', example: '2026-10' })
  @IsOptional()
  @IsString()
  yearMonth?: string;

  @ApiProperty({ description: 'Qo‘shiladigan ruxsat miqdori (oshirish)', example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  additionalQuantity: number;

  @ApiPropertyOptional({ description: 'Buyruq hujjati nomi / raqami (ixtiyoriy)' })
  @IsOptional()
  @IsString()
  documentNumber?: string;
}
