import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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
  @IsInt()
  @Min(1)
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
