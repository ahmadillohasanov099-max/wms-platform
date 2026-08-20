import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: '123456', description: 'Joriy parol' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'newpass123',
    description: 'Yangi parol (minimum 6 ta belgi)',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
