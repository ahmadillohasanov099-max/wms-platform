import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: "1-sonli Toshkent Shahar Boshqarmasi", description: "Tashkilot nomi" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "ORG-TOSH-01", description: "Tashkilot kodi/INN" })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ enum: OrganizationType, default: OrganizationType.SUB_ORG })
  @IsEnum(OrganizationType)
  @IsOptional()
  type?: OrganizationType;

  @ApiPropertyOptional({ description: "Manzil" })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: "Telefon raqami" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "Yuqori tashkilot (Vazirlik) ID si" })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: "Boshqarma administratori F.I.Sh", example: "Samarqand Admin" })
  @IsString()
  @IsOptional()
  adminFullName?: string;

  @ApiPropertyOptional({ description: "Boshqarma administratori logini (username)", example: "sam_admin" })
  @IsString()
  @IsOptional()
  adminUsername?: string;

  @ApiPropertyOptional({ description: "Boshqarma administratori paroli", example: "admin123" })
  @IsString()
  @IsOptional()
  adminPassword?: string;

  @ApiPropertyOptional({ description: "Boshqarma administratori telefoni", example: "+998 90 123 45 67" })
  @IsString()
  @IsOptional()
  adminPhone?: string;
}
