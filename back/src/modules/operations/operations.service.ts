import { Injectable } from '@nestjs/common';
import { StockInDto } from './dto/stock-in.dto';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { WriteOffDto } from './dto/write-off.dto';
import { BulkWriteOffDto } from './dto/bulk-write-off.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { OperationsPdfService } from './services/operations-pdf.service';
import { OperationsNotifierService } from './services/operations-notifier.service';
import { OperationsStockService } from './services/operations-stock.service';
import { OperationsAssignmentService } from './services/operations-assignment.service';

@Injectable()
export class OperationsService {
  constructor(
    private stockService: OperationsStockService,
    private assignmentService: OperationsAssignmentService,
    private pdfService: OperationsPdfService,
    private notifierService: OperationsNotifierService,
  ) {}

  async stockIn(dto: StockInDto, performedById: string) {
    return this.stockService.stockIn(dto, performedById);
  }

  async giveToUser(dto: GiveToUserDto, performedById: string) {
    return this.assignmentService.giveToUser(dto, performedById);
  }

  async assignToDept(dto: AssignToDeptDto, performedById: string) {
    return this.assignmentService.assignToDept(dto, performedById);
  }

  async returnFromUser(dto: ReturnFromUserDto, performedById: string) {
    return this.assignmentService.returnFromUser(dto, performedById);
  }

  async transferUser(dto: TransferUserDto, performedById: string) {
    return this.assignmentService.transferUser(dto, performedById);
  }

  async giveToDept(dto: GiveToDeptDto, performedById: string) {
    return this.assignmentService.giveToDept(dto, performedById);
  }

  async returnFromDept(dto: ReturnFromDeptDto, performedById: string) {
    return this.assignmentService.returnFromDept(dto, performedById);
  }

  async writeOff(dto: WriteOffDto, performedById: string) {
    return this.stockService.writeOff(dto, performedById);
  }

  async bulkWriteOff(dto: BulkWriteOffDto, performedById: string) {
    return this.stockService.bulkWriteOff(dto, performedById);
  }

  async generatePdfAct(id: string): Promise<Buffer> {
    return this.pdfService.generatePdfAct(id);
  }

  async generateModdiyJavobgarlikPdf(data: any): Promise<Buffer> {
    return this.pdfService.generateModdiyJavobgarlikPdf(data);
  }

  async generateTalabnomaPdf(data: any): Promise<Buffer> {
    return this.pdfService.generateTalabnomaPdf(data);
  }

  async acceptAssignment(assignmentId: string, currentUserId: string, currentUserRole: string) {
    return this.assignmentService.acceptAssignment(assignmentId, currentUserId, currentUserRole);
  }

  async rejectAssignment(
    assignmentId: string,
    reason: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    return this.assignmentService.rejectAssignment(assignmentId, reason, currentUserId, currentUserRole);
  }
}
