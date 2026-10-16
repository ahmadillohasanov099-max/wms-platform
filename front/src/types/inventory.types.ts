export interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  minLevel: number;
  unitPrice?: number;
  totalValue?: number;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    productType: string;
    unit: string;
    imageUrl?: string;
    year?: string | number;
    assets?: {
      inventoryNumber: string;
      serialNumber?: string | null;
    }[];
  };
}
export interface SetMinLevelDto {
  productId: string;
  minLevel: number;
}
import type { UnitType } from './product.types';

export interface BulkStockInItemDto {
  name: string;
  productType: 'BERILADIGAN' | 'SARFLANADIGAN';
  unit?: UnitType;
  packageSize?: number;
  year?: string | number;
  description?: string;
  quantity: number;
  unitPrice: number;
  documentNumber?: string;
  note?: string;
  inventoryNumbers?: string[];
  serialNumbers?: string[];
}
export interface BulkStockInDto {
  items: BulkStockInItemDto[];
}