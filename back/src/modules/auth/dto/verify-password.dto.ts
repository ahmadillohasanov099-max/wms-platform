import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPasswordDto {
  @ApiProperty({ example: '123456', description: 'Tasdiqlash uchun parol' })
  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;
}
