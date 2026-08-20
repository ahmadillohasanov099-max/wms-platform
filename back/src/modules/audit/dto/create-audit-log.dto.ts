export class CreateAuditLogDto {
  organizationId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  method: string;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  durationMs?: number;
  payload?: any;
  oldData?: any;
  newData?: any;
}
