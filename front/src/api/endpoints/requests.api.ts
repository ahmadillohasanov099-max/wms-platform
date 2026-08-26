import api from '../axios';
import type {
  RequestItem,
  CreateRequestDto,
  ReviewRequestDto,
  RequestStatus,
} from '../../types';

export const requestsApi = {
  create: async (data: CreateRequestDto) => {
    return api.post<any, { data: RequestItem } | RequestItem>('/requests', data);
  },

  getAll: async (params?: { status?: RequestStatus }) => {
    return api.get<any, { data: RequestItem[] } | RequestItem[]>('/requests', { params });
  },

  getMy: async () => {
    return api.get<any, { data: RequestItem[] } | RequestItem[]>('/requests/my');
  },

  getById: async (id: string) => {
    return api.get<any, { data: RequestItem } | RequestItem>(`/requests/${id}`);
  },

  approve: async (id: string, data?: ReviewRequestDto) => {
    return api.post<any, { data: RequestItem } | RequestItem>(`/requests/${id}/approve`, data || {});
  },

  reject: async (id: string, data: ReviewRequestDto) => {
    return api.post<any, { data: RequestItem } | RequestItem>(`/requests/${id}/reject`, data);
  },
};

// Backward compatibility alias
export const deletionRequestsApi = requestsApi;
