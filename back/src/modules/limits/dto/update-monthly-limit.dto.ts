import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateMonthlyLimitDto {
  @ApiProperty({ description: 'Yangi oylik meʼyor miqdori', example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  limitQuantity: number;

  @ApiPropertyOptional({ description: 'Faollik holati', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
