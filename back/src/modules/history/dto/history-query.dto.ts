import { ApiPropertyOptional } from '@nestjs/swagger';
import { OperationType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class HistoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OperationType, description: 'Operatsiya turi' })
  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType;

  @ApiPropertyOptional({ example: 'uuid', description: 'Xodim ID si' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: "Bo'lim ID si" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Jihoz (Asset) ID si' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ example: 'INV-1001', description: 'Inventar raqami' })
  @IsOptional()
  @IsString()
  inventoryNumber?: string;

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Boshlanish sanasi',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Tugash sanasi' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: "Tashkilot ID si bo'yicha filtri" })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
