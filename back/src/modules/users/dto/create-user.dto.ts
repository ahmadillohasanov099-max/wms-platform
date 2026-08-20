import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Alisher Karimov' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'alisher01' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'parol123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.XODIM })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Tashkilot ID (Super Admin uchun)' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1025' })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Ichki telefon raqami kamida 4 xonali bo\'lishi shart' })
  internalPhone?: string;

  @ApiPropertyOptional({ example: 'Bosh mutaxassis' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ example: 'AD 1234567' })
  @IsOptional()
  @IsString()
  passport?: string;

  @ApiPropertyOptional({ example: '31508940001234' })
  @IsOptional()
  @IsString()
  pinfl?: string;

  @ApiPropertyOptional({ example: 'Toshkent sh., Yunusobod tumani' })
  @IsOptional()
  @IsString()
  address?: string;
}
