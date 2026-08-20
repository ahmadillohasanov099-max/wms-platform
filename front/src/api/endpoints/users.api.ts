import type { CreateUserDto,UpdateUserDto,  User } from '../../types';
import api from '../axios';
export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  role?: string;
  employmentStatus?: string;
  organizationId?: string;
}
export interface PaginatedUsers {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export const usersApi = {
  getAll: (query?: UserQuery) =>
    api.get<PaginatedUsers>('/users', { params: query }).then((r) => r.data),
  getOne: (id: string) =>
    api.get<User>(`/users/${id}`).then((r) => r.data),
  getAssignments: (id: string) =>
    api.get(`/users/${id}/assignments`).then((r) => r.data),
  getHistory: (id: string) =>
    api.get(`/users/${id}/history`).then((r) => r.data),
  create: (dto: CreateUserDto) =>
    api.post<User>('/users', dto).then((r) => r.data),
  update: (id: string, dto: UpdateUserDto) =>
    api.put<User>(`/users/${id}`, dto).then((r) => r.data),
  toggleStatus: (id: string) =>
    api.patch(`/users/${id}/status`).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
  bulkReturn: (id: string) =>
    api.post(`/users/${id}/bulk-return`).then((r) => r.data),
  bulkTransfer: (id: string, toUserId: string) =>
    api.post(`/users/${id}/bulk-transfer`, { toUserId }).then((r) => r.data),
  importExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};