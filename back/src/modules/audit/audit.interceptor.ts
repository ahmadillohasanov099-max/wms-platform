import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const method = req.method?.toUpperCase();

    // Audit only mutation operations (POST, PUT, PATCH, DELETE) or specific login/action paths
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url: string = req.originalUrl || req.url || '';
    
    // Ignore static files, metrics, docs, etc.
    if (url.includes('/uploads/') || url.includes('/favicon.ico')) {
      return next.handle();
    }

    const startTime = Date.now();
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const user = req.user; // Set by JwtAuthGuard if authenticated

    const sanitizedPayload = this.sanitizePayload(req.body);
    const action = this.resolveActionName(method, url, sanitizedPayload);
    const resource = this.resolveResourceName(url);

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode || 200;

          // Asynchronously write audit log (non-blocking)
          this.auditService
            .create({
              organizationId: user?.organizationId || user?.organization?.id,
              userId: user?.id,
              userName: user?.fullName || user?.username || 'Anonym',
              userRole: user?.role || 'GUEST',
              action,
              resource,
              resourceId: responseData?.id || req.params?.id || req.body?.id,
              method,
              endpoint: url,
              ipAddress,
              userAgent,
              statusCode,
              durationMs,
              payload: sanitizedPayload,
            })
            .catch((err) => {
              this.logger.error(`Failed to record audit log: ${err?.message}`);
            });
        },
        error: (err) => {
          const durationMs = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;

          this.auditService
            .create({
              organizationId: user?.organizationId || user?.organization?.id,
              userId: user?.id,
              userName: user?.fullName || user?.username || 'Anonym',
              userRole: user?.role || 'GUEST',
              action: `${action}_FAILED`,
              resource,
              method,
              endpoint: url,
              ipAddress,
              userAgent,
              statusCode,
              durationMs,
              payload: {
                ...sanitizedPayload,
                error: err?.message || 'Internal Server Error',
              },
            })
            .catch(() => {});
        },
      }),
    );
  }

  private sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const sensitiveFields = ['password', 'confirmPassword', 'oldPassword', 'newPassword', 'token', 'refreshToken', 'secret'];
    const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.includes(key)) {
        sanitized[key] = '***MASKED***';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizePayload(sanitized[key]);
      }
    }

    return sanitized;
  }

  private resolveActionName(method: string, url: string, payload: any): string {
    if (url.includes('/auth/login')) return 'USER_LOGIN';
    if (url.includes('/auth/logout')) return 'USER_LOGOUT';
    if ((url.includes('/requests') || url.includes('/deletion-requests')) && method === 'POST') {
      if (url.includes('/approve')) return 'APPROVE_REQUEST';
      if (url.includes('/reject')) return 'REJECT_REQUEST';
      return 'CREATE_REQUEST';
    }

    const segments = url.split('?')[0].split('/').filter(Boolean);
    const mainSegment = segments[segments.length - 1] || segments[0] || 'RESOURCE';
    const resourceName = mainSegment.replace(/-/g, '_').toUpperCase();

    switch (method) {
      case 'POST':
        return `CREATE_${resourceName}`;
      case 'PUT':
      case 'PATCH':
        return `UPDATE_${resourceName}`;
      case 'DELETE':
        return `DELETE_${resourceName}`;
      default:
        return `${method}_${resourceName}`;
    }
  }

  private resolveResourceName(url: string): string {
    const cleanUrl = url.split('?')[0];
    if (cleanUrl.includes('/users')) return 'USER';
    if (cleanUrl.includes('/products')) return 'PRODUCT';
    if (cleanUrl.includes('/inventory')) return 'INVENTORY';
    if (cleanUrl.includes('/assets')) return 'ASSET';
    if (cleanUrl.includes('/departments')) return 'DEPARTMENT';
    if (cleanUrl.includes('/organizations')) return 'ORGANIZATION';
    if (cleanUrl.includes('/operations')) return 'OPERATION';
    if (cleanUrl.includes('/requests') || cleanUrl.includes('/deletion-requests')) return 'REQUEST';
    if (cleanUrl.includes('/auth')) return 'AUTH';
    return 'SYSTEM';
  }
}
