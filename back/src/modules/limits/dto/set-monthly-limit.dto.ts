import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetMonthlyLimitDto {
  @ApiProperty({ description: 'TMZ mahsulot ID' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: 'Bo‘lim ID (agar bo‘lim uchun limit bo‘lsa)' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Xodim ID (agar xodim uchun limit bo‘lsa)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Oylik meʼyor miqdori', example: 40 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  limitQuantity: number;

  @ApiPropertyOptional({
    description: 'Qonuniy meʼyoriy hujjat asosi',
    example: "Vazirlikning 14-sonli ichki me'yoriy buyrug'i",
  })
  @IsOptional()
  @IsString()
  decreeReference?: string;

  @ApiPropertyOptional({ description: 'Faollik holati', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
