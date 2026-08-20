import type {
  CreateDepartmentDto,
  Department,
  UpdateDepartmentDto,
} from "../../types";
import api from "../axios";
export const departmentsApi = {
  getAll: (params?: { organizationId?: string }) =>
    api.get<Department[]>("/departments", { params }).then((r) => r.data),
  getOne: (id: string) =>
    api.get<Department>(`/departments/${id}`).then((r) => r.data),
  getStats: (id: string) =>
    api.get(`/departments/${id}/stats`).then((r) => r.data),
  create: (dto: CreateDepartmentDto) =>
    api.post<Department>("/departments", dto).then((r) => r.data),
  update: (id: string, dto: UpdateDepartmentDto) =>
    api.put<Department>(`/departments/${id}`, dto).then((r) => r.data),
  remove: (id: string) => api.delete(`/departments/${id}`).then((r) => r.data),
};
