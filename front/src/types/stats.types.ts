export interface StatsOverview {
  totalProducts: number;
  totalUsers: number;
  totalDepartments: number;
  totalOperations: number;
  lowStockCount: number;
  activeAssets?: number;
  activeAssignments: number;
  totalInventoryValue: number;
  totalAssignedValue: number;
  trends?: any;
}
export interface StatsByDepartment {
  id: string;
  name: string;
  userCount: number;
  assets: {
    productName: string;
    productType: string;
    quantity: number;
  }[];
}
export interface StatsByProduct {
  id: string;
  name: string;
  productType: string;
  currentStock: number;
  minLevel: number;
  totalOut: number;
}
export interface StatsByUser {
  id: string;
  fullName: string;
  username: string;
  position?: string;
  department: { id: string; name: string };
  assetCount: number;
  totalValue: number;
  assets: {
    assetId: string;
    inventoryNumber: string;
    status: string;
    productName: string;
    purchasePrice: number;
    assignedAt: string;
  }[];
}
export interface StatsMonthly {
  month: string;
  stockIn: number;
  stockOut: number;
}