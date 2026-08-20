export interface Department {
  id: string;
  name: string;
  description?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
  assignments?: any[];
  departmentAssets?: any[];
  assets?: any[];
  assignedAssets?: any[];
}
export interface CreateDepartmentDto {
  name: string;
  description?: string;
}
export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
}