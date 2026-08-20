import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, OrganizationType } from '@prisma/client';

export interface TenantContext {
  organizationId: string | null;
  isMinistry: boolean;
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi tizimga kirmagan');
    }

    const isMinistry =
      user.organization?.type === OrganizationType.MINISTRY ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.VAZIRLIK_OMBORCHI ||
      user.role === UserRole.ADMIN;

    request.tenant = {
      organizationId: user.organizationId || null,
      isMinistry,
      isSuperAdmin: user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN,
    } as TenantContext;

    return true;
  }
}
