export type OrganizationType = 'MINISTRY' | 'SUB_ORG';

export interface Organization {
  id: string;
  name: string;
  code?: string;
  type: OrganizationType;
  parentId?: string | null;
  parent?: Organization;
  subOrganizations?: Organization[];
  address?: string;
  phone?: string;
  isActive?: boolean;
  _count?: {
    users?: number;
    departments?: number;
    products?: number;
    assets?: number;
    deletionRequests?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationDto {
  name: string;
  code?: string;
  type?: OrganizationType;
  parentId?: string;
  address?: string;
  phone?: string;
  adminFullName?: string;
  adminUsername?: string;
  adminPassword?: string;
  adminPhone?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
}
