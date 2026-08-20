import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto';

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Alisher',
    description: "Ism yoki username bo'yicha qidiruv",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: "Bo'lim ID si bo'yicha filtri",
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: UserRole, description: "Rol bo'yicha filtri" })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: EmploymentStatus, description: "Ish joyi holati bo'yicha filtri" })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ description: "Tashkilot ID si bo'yicha filtri" })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
