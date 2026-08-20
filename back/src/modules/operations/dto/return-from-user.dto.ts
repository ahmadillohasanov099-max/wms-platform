import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ReturnFromUserDto {
  @ApiProperty({ example: 'uuid', description: 'Xodim ID si' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'uuid', description: 'Asset ID si' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({
    example: 'AKT-2024-002',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Xodim ketdi', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
