import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TelegramLoginDto {
  @ApiProperty({ example: 'alisher', description: 'Username yoki telefon raqami' })
  @IsString()
  @IsNotEmpty({ message: 'Login kiritilishi shart' })
  username: string;

  @ApiProperty({ example: 'parol123', description: 'Foydalanuvchi paroli' })
  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;

  @ApiProperty({ example: '123456789', description: 'Telegram chat ID' })
  @IsString()
  @IsNotEmpty({ message: 'Telegram chat ID kiritilishi shart' })
  chatId: string;
}
