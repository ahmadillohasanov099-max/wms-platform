import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteRepairDto {
  @ApiProperty({ description: 'Aktiv (jihoz) ID-si' })
  @IsUUID('4', { message: "Noto'g'ri aktiv ID formati" })
  @IsNotEmpty({ message: 'Aktiv ID-si kiritilishi shart' })
  assetId: string;

  @ApiPropertyOptional({ description: "Usta xulosasi / Ta'mirlash tavsifi (izoh)" })
  @IsString({ message: "Izoh matn ko'rinishida bo'lishi kerak" })
  @IsOptional()
  note?: string;
}
