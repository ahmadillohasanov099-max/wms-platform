import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewDeletionRequestDto {
  @ApiPropertyOptional({ description: "Vazirlik mas'uli izohi", example: "Tekshirildi, o'chirishga ruxsat berildi" })
  @IsString()
  @IsOptional()
  reviewComment?: string;
}
