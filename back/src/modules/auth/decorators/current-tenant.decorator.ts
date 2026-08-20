import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../guards/tenant.guard';

export const CurrentTenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant: TenantContext = request.tenant || {
      organizationId: request.user?.organizationId || null,
      isMinistry:
        request.user?.organization?.type === 'MINISTRY' ||
        request.user?.role === 'SUPER_ADMIN' ||
        request.user?.role === 'ADMIN',
      isSuperAdmin:
        request.user?.role === 'SUPER_ADMIN' || request.user?.role === 'ADMIN',
    };

    return data ? tenant[data] : tenant;
  },
);
