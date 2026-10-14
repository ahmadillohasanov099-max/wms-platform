import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ReturnFromDeptDto {
  @ApiProperty({ example: 'uuid', description: "Bo'lim ID si" })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Miqdor (Faqat SARFLANADIGAN uchun)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Jihoz ID si (Faqat BERILADIGAN uchun)',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    example: 'AKT-2024-006',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({
    example: 'Eskirgan printer qaytarildi',
    description: 'Izoh',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
