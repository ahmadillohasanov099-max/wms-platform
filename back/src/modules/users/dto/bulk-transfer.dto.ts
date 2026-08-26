import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BulkTransferDto {
  @ApiProperty({ example: 'uuid', description: 'Qabul qiluvchi xodim ID si' })
  @IsString()
  @IsNotEmpty({ message: 'Qabul qiluvchi xodim tanlanishi shart' })
  toUserId: string;
}
