import { UserRole } from '@prisma/client';

export interface ActiveUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  departmentId?: string | null;
  organizationId?: string | null;
  phone?: string | null;
  internalPhone?: string | null;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  organizationId?: string | null;
  tokenId?: string;
  iat?: number;
  exp?: number;
}
