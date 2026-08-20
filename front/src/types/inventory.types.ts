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
  };
}
export interface SetMinLevelDto {
  productId: string;
  minLevel: number;
}
export interface BulkStockInItemDto {
  name: string;
  productType: 'BERILADIGAN' | 'SARFLANADIGAN';
  unit?: 'DONA' | 'PACHKA' | 'KOMPLEKT';
  year?: number;
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