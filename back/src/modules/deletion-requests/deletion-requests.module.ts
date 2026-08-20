import { Module } from '@nestjs/common';
import { DeletionRequestsController } from './deletion-requests.controller';
import { DeletionRequestsService } from './deletion-requests.service';
import { EventsModule } from '../events/events.module';
import { MailModule } from '../nodemailer';

@Module({
  imports: [EventsModule, MailModule],
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService],
  exports: [DeletionRequestsService],
})
export class DeletionRequestsModule {}
