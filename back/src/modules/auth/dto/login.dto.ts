import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ahmadillohasanov099@gmail.com',
    description: 'Foydalanuvchi nomi',
  })
  @IsString()
  username: string;

  @ApiProperty({
    example: 'admin123',
    description: 'Parol (minimum 6 ta belgi)',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
