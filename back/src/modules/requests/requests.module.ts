import { Module } from '@nestjs/common';
import { RequestsController, DeletionRequestsController } from './requests.controller';
import { RequestsService, DeletionRequestsService } from './requests.service';
import { MailModule } from '../nodemailer/mail.module';

@Module({
  imports: [MailModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}

// Backward compatibility alias
export { RequestsModule as DeletionRequestsModule };
