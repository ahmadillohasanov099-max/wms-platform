import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class SetMinLevelDto {
  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, description: 'Minimal daraja' })
  @IsInt()
  @Min(0)
  minLevel: number;
}
