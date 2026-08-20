import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface TenantUser {
  id?: string;
  role?: UserRole | string;
  organizationId?: string | null;
}

export function enforceTenantOrgId(
  currentUser?: TenantUser | null,
  requestedOrgId?: string | null,
): string | undefined {
  if (!currentUser) return undefined;

  const isSuperOrMinistry =
    currentUser.role === UserRole.SUPER_ADMIN ||
    currentUser.role === UserRole.VAZIRLIK_OMBORCHI;

  if (isSuperOrMinistry) {
    return requestedOrgId || currentUser.organizationId || undefined;
  }

  const userOrgId = currentUser.organizationId || undefined;

  if (requestedOrgId && requestedOrgId !== userOrgId) {
    throw new ForbiddenException(
      "Xavfsizlik cheklovi: Siz boshqa tashkilot ma'lumotlariga kirish huquqiga ega emassiz!",
    );
  }

  return userOrgId;
}
