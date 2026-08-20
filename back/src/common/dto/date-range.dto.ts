import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class DateRangeDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
