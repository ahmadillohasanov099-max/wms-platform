import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { OperationsPdfService } from './services/operations-pdf.service';
import { OperationsNotifierService } from './services/operations-notifier.service';
import { MailModule } from '../nodemailer/mail.module';

@Module({
  imports: [MailModule],
  controllers: [OperationsController],
  providers: [
    OperationsService,
    OperationsPdfService,
    OperationsNotifierService,
  ],
  exports: [
    OperationsService,
    OperationsPdfService,
    OperationsNotifierService,
  ],
})
export class OperationsModule {}
