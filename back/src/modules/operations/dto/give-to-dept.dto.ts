import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GiveToDeptDto {
  @ApiProperty({ example: 'uuid', description: "Bo'lim ID si" })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, description: 'Miqdor' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    example: 'AKT-2024-004',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: "Oylik ta'minot", description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
