import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class SetMinLevelDto {
  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, description: 'Minimal daraja' })
  @IsNumber()
  @Min(0)
  minLevel: number;
}
