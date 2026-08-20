import api from '../axios';
import type { AuditLog, AuditLogQueryParams, AuditLogStats } from '../../types';

export interface PaginatedAuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const auditApi = {
  getAll: async (params?: AuditLogQueryParams): Promise<PaginatedAuditResponse> => {
    const res = await api.get<PaginatedAuditResponse>('/audit-logs', { params });
    return res.data;
  },

  getStats: async (): Promise<AuditLogStats> => {
    const res = await api.get<AuditLogStats>('/audit-logs/stats');
    return res.data;
  },

  getById: async (id: string): Promise<AuditLog> => {
    const res = await api.get<AuditLog>(`/audit-logs/${id}`);
    return res.data;
  },
};
