import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { MailService } from './mail.service';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { AiService } from './ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [TelegramController],
  providers: [MailService, TelegramService, AiService],
  exports: [MailService, TelegramService, AiService],
})
export class MailModule {}
