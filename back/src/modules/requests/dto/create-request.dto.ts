import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';

export class CreateRequestDto {
  @ApiProperty({
    enum: EntityType,
    description: "So'rov qaysi obyekt bo'yicha (ASSET, PRODUCT, USER, DEPARTMENT)",
    example: EntityType.ASSET,
  })
  @IsEnum(EntityType)
  @IsNotEmpty()
  entityType: EntityType;

  @ApiProperty({
    description: "Obyekt ID-si",
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({
    description: "Obyekt nomi yoki qo'shimcha ma'lumoti",
    example: 'Lenovo ThinkPad L14 (Inv: 100234)',
  })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiProperty({
    description: "So'rov / Murojaat yoki qaytarish sababi",
    example: 'Jihoz nosoz holatga keldi va yangisiga almashtirish kerak',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// Backward compatibility alias
export class CreateDeletionRequestDto extends CreateRequestDto {}
