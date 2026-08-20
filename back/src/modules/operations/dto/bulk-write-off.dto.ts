import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkWriteOffItemDto {
  @ApiProperty({ example: 'uuid-product' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ example: 'uuid-asset' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class BulkWriteOffDto {
  @ApiProperty({ type: [BulkWriteOffItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkWriteOffItemDto)
  items: BulkWriteOffItemDto[];

  @ApiPropertyOptional({ example: 'AKT-2024-010' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Ommaviy hisobdan chiqarish' })
  @IsOptional()
  @IsString()
  note?: string;
}
