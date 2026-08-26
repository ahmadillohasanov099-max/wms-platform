import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { MailService } from './mail.service';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { AiService } from './ai.service';
import { TelegramSenderService } from './services/telegram-sender.service';
import { TelegramExcelService } from './services/telegram-excel.service';
import { TelegramReportsService } from './services/telegram-reports.service';
import { TelegramAuthService } from './services/telegram-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [TelegramController],
  providers: [
    MailService,
    TelegramService,
    AiService,
    TelegramSenderService,
    TelegramExcelService,
    TelegramReportsService,
    TelegramAuthService,
  ],
  exports: [
    MailService,
    TelegramService,
    AiService,
    TelegramSenderService,
    TelegramExcelService,
    TelegramReportsService,
    TelegramAuthService,
  ],
})
export class MailModule {}
