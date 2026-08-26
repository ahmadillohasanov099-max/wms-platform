import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewDeletionRequestDto {
  @ApiPropertyOptional({ description: "Ko'rib chiqish izohi", example: "Tekshirildi, ruxsat berildi" })
  @IsString()
  @IsOptional()
  reviewComment?: string;

  @ApiPropertyOptional({ description: "Rad etish sababi", example: "Hozircha omborga qaytarib bo'lmaydi" })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
