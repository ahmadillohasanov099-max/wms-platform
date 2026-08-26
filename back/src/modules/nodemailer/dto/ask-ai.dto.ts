import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AskAiDto {
  @ApiProperty({ example: 'Omborda nechta noutbuk bor?', description: 'Savol matni' })
  @IsString()
  @IsNotEmpty({ message: 'Savol matni kiritilishi shart' })
  query: string;

  @ApiPropertyOptional({ description: 'Foydalanuvchi ma\'lumotlari' })
  @IsOptional()
  user?: any;
}
