import type { Organization } from './organization.types';
export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'VAZIRLIK_OMBORCHI' 
  | 'ORG_ADMIN' 
  | 'ORG_OMBORCHI' 
  | 'KADR' 
  | 'XODIM'
  | 'ADMIN'
  | 'OMBORCHI';
export type EmploymentStatus = 'ACTIVE' | 'OFFBOARDING_PENDING' | 'OFFBOARDED';
export interface User {
  id: string;
  fullName: string;
  username: string;
  phone?: string;
  internalPhone?: string;
  email?: string;
  position?: string;
  passport?: string;
  passportSeries?: string;
  pinfl?: string;
  address?: string;
  role: UserRole;
  employmentStatus?: EmploymentStatus;
  isActive: boolean;
  departmentId?: string;
  department?: { id: string; name: string; code?: string };
  organizationId?: string;
  organization?: Organization;
  offboardingStartedAt?: string;
  offboardingStartedBy?: { id: string; fullName: string; username: string };
  warehouseApprovedAt?: string;
  warehouseApprovedBy?: { id: string; fullName: string; username: string };
  offboardingCompletedAt?: string;
  offboardingCompletedBy?: { id: string; fullName: string; username: string };
  unreturnedAssetsCount?: number;
  assignments?: any[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateUserDto {
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
  departmentId: string;
  phone?: string;
  internalPhone?: string;
  position?: string;
  passport?: string;
  pinfl?: string;
  address?: string;
}
export interface UpdateUserDto {
  fullName?: string;
  username?: string;
  role?: UserRole;
  departmentId?: string;
  phone?: string;
  internalPhone?: string;
  position?: string;
  passport?: string;
  pinfl?: string;
  address?: string;
}