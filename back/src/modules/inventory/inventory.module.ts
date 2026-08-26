import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryExcelService } from './services/inventory-excel.service';
import { InventoryScannerService } from './services/inventory-scanner.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryExcelService, InventoryScannerService],
  exports: [InventoryService, InventoryExcelService, InventoryScannerService],
})
export class InventoryModule {}
