export type ProductType = 'BERILADIGAN' | 'SARFLANADIGAN';
export type UnitType = 'DONA' | 'PACHKA' | 'KOMPLEKT';
export type AssetStatus = 'ACTIVE' | 'BROKEN' | 'LOST' | 'WRITTEN_OFF';
export interface Product {
  id: string;
  name: string;
  year?: number;
  productType: ProductType;
  unit: UnitType;
  description?: string;
  imageUrl?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  inventory?: {
    quantity: number;
    minLevel: number;
    unitPrice?: number;
    totalValue?: number;
  };
  assets?: Asset[];
}
export interface Asset {
  id: string;
  productId: string;
  inventoryNumber: string;
  serialNumber?: string;
  status: AssetStatus;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExp?: string;
  notes?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}