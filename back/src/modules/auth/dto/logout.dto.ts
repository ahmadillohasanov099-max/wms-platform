// auth/dto/logout.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ example: 'eyJhbGci...' })
  @IsString()
  refreshToken: string;
}
