import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { OperationsPdfService } from './services/operations-pdf.service';
import { OperationsNotifierService } from './services/operations-notifier.service';
import { OperationsStockService } from './services/operations-stock.service';
import { OperationsAssignmentService } from './services/operations-assignment.service';
import { MailModule } from '../nodemailer/mail.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [MailModule, LimitsModule],
  controllers: [OperationsController],
  providers: [
    OperationsService,
    OperationsStockService,
    OperationsAssignmentService,
    OperationsPdfService,
    OperationsNotifierService,
  ],
  exports: [
    OperationsService,
    OperationsStockService,
    OperationsAssignmentService,
    OperationsPdfService,
    OperationsNotifierService,
  ],
})
export class OperationsModule {}
