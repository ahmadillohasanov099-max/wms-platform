export interface AuditLog {
  id: string;
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
    code: string;
  };
  userId?: string;
  userName?: string;
  userRole?: string;
  user?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
    phone?: string;
    position?: string;
  };
  action: string;
  resource?: string;
  resourceId?: string;
  method: string;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode: number;
  durationMs?: number;
  payload?: any;
  oldData?: any;
  newData?: any;
  createdAt: string;
}

export interface AuditLogQueryParams {
  search?: string;
  userId?: string;
  action?: string;
  resource?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  deleteCount: number;
  activeUserCount: number;
}
