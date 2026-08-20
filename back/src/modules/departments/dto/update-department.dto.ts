import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: "Moliya bo'limi" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "Moliyaviy operatsiyalar bo'limi" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
