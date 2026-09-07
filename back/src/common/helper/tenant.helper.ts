import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

  const isGlobalViewer =
    currentUser.role === UserRole.SUPER_ADMIN ||
    currentUser.role === UserRole.RAHBAR;

  if (isGlobalViewer) {
    return requestedOrgId || currentUser.organizationId || undefined;
  }

  const userOrgId = currentUser.organizationId || undefined;

  if (requestedOrgId && requestedOrgId !== userOrgId) {
    throw new ForbiddenException(
      "Xavfsizlik cheklovi: Siz faqat o'z tashkilotingiz ma'lumotlariga kirishingiz mumkin!",
    );
  }

  return userOrgId;
}

export function enforceRequiredTenantOrgId(
  currentUser?: TenantUser | null,
  requestedOrgId?: string | null,
): string {
  const resolved = enforceTenantOrgId(currentUser, requestedOrgId);
  if (!resolved) {
    throw new BadRequestException(
      "Tashkilot tanlanishi shart! Eksport faqat bitta aniq boshqarma/tashkilot bo'yicha amalga oshiriladi.",
    );
  }
  return resolved;
}
