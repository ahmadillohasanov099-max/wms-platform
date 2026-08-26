import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectAssignmentDto {
  @ApiPropertyOptional({ example: 'Jihoz nosoz holatda keldi', description: 'Rad etish sababi' })
  @IsOptional()
  @IsString()
  reason?: string;
}
