import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class CanDeleteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if HTTP method is DELETE
    if (request.method === 'DELETE') {
      const allowedRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.VAZIRLIK_OMBORCHI,
        UserRole.ADMIN,
      ];

      if (!user || !allowedRoles.includes(user.role)) {
        throw new ForbiddenException(
          "Quyi tashkilotlar resurslarni to'g'ridan-to'g'ri o'chira olmaydi. O'chirish uchun Vazirlikka so'rov yuboring.",
        );
      }
    }

    return true;
  }
}
