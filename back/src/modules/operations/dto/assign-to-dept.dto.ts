import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignToDeptDto {
  @ApiProperty({ example: 'uuid', description: "Bo'lim ID si" })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'INV-2024-001', description: 'Inventar raqami' })
  @IsString()
  inventoryNumber: string;

  @ApiPropertyOptional({
    example: 'PF2X0001',
    description: 'Seriya raqami (ixtiyoriy)',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    example: 'AKT-2024-005',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: "Bo'lim uchun printer", description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
