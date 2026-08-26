export interface Department {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  leaderId?: string;
  leader?: {
    id: string;
    fullName: string;
    username?: string;
    position?: string;
    phone?: string;
  };
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
  organizationId?: string;
  leaderId?: string;
}
export interface UpdateDepartmentDto {
  name?: string;
  description?: string;
  organizationId?: string;
  leaderId?: string;
}