import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class StockInDto {
  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 20, description: 'Kirim miqdori' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 10000000, description: "1 ta narxi (so'mda)" })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({
    example: 'AKT-2024-001',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Yangi keldi', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
