import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeletionRequestDto {
  @ApiProperty({ enum: EntityType, description: "O'chirilishi kerak bo'lgan obyekt turi (PRODUCT, ASSET, OPERATION, USER, DEPARTMENT)" })
  @IsEnum(EntityType)
  @IsNotEmpty()
  entityType: EntityType;

  @ApiProperty({ description: "O'chirilishi kerak bo'lgan obyekt ID si" })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({ description: "O'chirilayotgan obyekt nomi yoki tavsifi" })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiProperty({ description: "O'chirish sababi", example: "Jihoz buzulgan va foydalanishga yaroqsiz" })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
