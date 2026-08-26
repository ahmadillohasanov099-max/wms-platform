import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersExcelService } from './services/users-excel.service';
import { UsersOffboardingService } from './services/users-offboarding.service';
import { EventsModule } from '../events/events.module';
import { MailModule } from '../nodemailer';

@Module({
  imports: [EventsModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService, UsersExcelService, UsersOffboardingService],
  exports: [UsersService, UsersExcelService, UsersOffboardingService],
})
export class UsersModule {}
