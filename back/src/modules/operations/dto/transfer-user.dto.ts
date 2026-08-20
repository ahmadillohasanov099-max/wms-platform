import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class TransferUserDto {
  @ApiProperty({ example: 'uuid', description: 'Kimdan (xodim ID si)' })
  @IsUUID()
  fromUserId: string;

  @ApiProperty({ example: 'uuid', description: 'Kimga (xodim ID si)' })
  @IsUUID()
  toUserId: string;

  @ApiProperty({ example: 'uuid', description: 'Asset ID si' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({
    example: 'AKT-2024-003',
    description: 'Hujjat raqami',
  })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: "Bo'lim o'zgardi", description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}
