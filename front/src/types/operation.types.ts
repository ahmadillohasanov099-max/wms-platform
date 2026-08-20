export type OperationType =
  | 'STOCK_IN'
  | 'GIVE_TO_DEPT'
  | 'RETURN_FROM_DEPT'
  | 'GIVE_TO_USER'
  | 'RETURN_FROM_USER'
  | 'TRANSFER_USER'
  | 'WRITE_OFF'
  | 'ASSIGN_TO_DEPT';
export interface Operation {
  id: string;
  type: OperationType;
  quantity: number;
  productId: string;
  assetId?: string;
  departmentId?: string;
  userId?: string;
  fromUserId?: string;
  performedById: string;
  documentNumber?: string;
  documentDate?: string;
  note?: string;
  createdAt: string;
  product?: { id: string; name: string; productType: string };
  asset?: { id: string; inventoryNumber: string };
  user?: { id: string; fullName: string; username: string };
  fromUser?: { id: string; fullName: string; username: string };
  department?: { id: string; name: string };
  performedBy?: { id: string; fullName: string; username: string };
}

export interface StockInDto {
  name: string;
  productType: 'BERILADIGAN' | 'SARFLANADIGAN';
  unit?: 'DONA' | 'PACHKA' | 'KOMPLEKT';
  year?: number;
  quantity: number;
  unitPrice?: number;
  minLevel?: number;
  description?: string;
  documentNumber?: string;
  documentDate?: string;
  note?: string;
  inventoryNumbers?: string[];
  serialNumbers?: string[];
}
export interface GiveToUserDto {
  userId: string;
  productId: string;
  inventoryNumber?: string;
  quantity?: number;
  serialNumber?: string;
  documentNumber?: string;
  note?: string;
}
export interface ReturnFromUserDto {
  userId: string;
  assetId: string;
  documentNumber?: string;
  note?: string;
}
export interface TransferUserDto {
  fromUserId: string;
  toUserId: string;
  assetId: string;
  documentNumber?: string;
  note?: string;
}
export interface GiveToDeptDto {
  departmentId: string;
  productId: string;
  quantity: number;
  documentNumber?: string;
  note?: string;
}
export interface ReturnFromDeptDto {
  departmentId: string;
  productId: string;
  assetId?: string;
  quantity: number;
  documentNumber?: string;
  note?: string;
}
export interface AssignToDeptDto {
  departmentId: string;
  productId: string;
  inventoryNumber: string;
  serialNumber?: string;
  documentNumber?: string;
  note?: string;
}
export interface WriteOffDto {
  assetId?: string;
  productId?: string;
  quantity?: number;
  departmentId?: string;
  documentNumber?: string;
  note?: string;
}