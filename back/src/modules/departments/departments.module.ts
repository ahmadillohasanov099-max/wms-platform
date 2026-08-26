import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { DepartmentsExcelService } from './services/departments-excel.service';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsExcelService],
  exports: [DepartmentsService, DepartmentsExcelService],
})
export class DepartmentsModule {}
