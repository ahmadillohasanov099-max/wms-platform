import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewRequestDto {
  @ApiPropertyOptional({
    description: "So'rovni ko'rib chiqish bo'yicha mas'ul xodim izohi",
    example: 'So‘rov tasdiqlandi, jihoz omborga qabul qilindi',
  })
  @IsString()
  @IsOptional()
  reviewComment?: string;

  @ApiPropertyOptional({
    description: "Rad etish sababi (agar rad etilayotgan bo'lsa)",
    example: 'Jihoz to‘liq tekshirilmagan',
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

// Backward compatibility alias
export class ReviewDeletionRequestDto extends ReviewRequestDto {}
