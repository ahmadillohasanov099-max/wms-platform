import api from '../axios';
import type {
  DeletionRequest,
  CreateDeletionRequestDto,
  RejectDeletionRequestDto,
  DeletionStatus,
} from '../../types';

export const deletionRequestsApi = {
  create: async (data: CreateDeletionRequestDto) => {
    return api.post<any, { data: DeletionRequest } | DeletionRequest>('/deletion-requests', data);
  },

  getAll: async (params?: { status?: DeletionStatus }) => {
    return api.get<any, { data: DeletionRequest[] } | DeletionRequest[]>('/deletion-requests', { params });
  },

  getById: async (id: string) => {
    return api.get<any, { data: DeletionRequest } | DeletionRequest>(`/deletion-requests/${id}`);
  },

  approve: async (id: string) => {
    return api.patch<any, { data: DeletionRequest } | DeletionRequest>(`/deletion-requests/${id}/approve`);
  },

  reject: async (id: string, data: RejectDeletionRequestDto) => {
    return api.patch<any, { data: DeletionRequest } | DeletionRequest>(`/deletion-requests/${id}/reject`, data);
  },
};
