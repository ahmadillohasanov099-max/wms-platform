import api from '../axios';
import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '../../types';

export const organizationsApi = {
  getAll: async () => {
    return api.get<any, { data: Organization[] } | Organization[]>('/organizations');
  },

  getMy: async () => {
    return api.get<any, { data: Organization } | Organization>('/organizations/my');
  },

  getById: async (id: string) => {
    return api.get<any, { data: Organization } | Organization>(`/organizations/${id}`);
  },

  create: async (data: CreateOrganizationDto) => {
    return api.post<any, { data: Organization } | Organization>('/organizations', data);
  },

  update: async (id: string, data: UpdateOrganizationDto) => {
    return api.patch<any, { data: Organization } | Organization>(`/organizations/${id}`, data);
  },
};
