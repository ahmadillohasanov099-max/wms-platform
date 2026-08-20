import type { StatsByDepartment, StatsByProduct, StatsByUser, StatsMonthly, StatsOverview } from '../../types';
import api from '../axios';
export const statsApi = {
  getOverview: () =>
    api.get<StatsOverview>('/stats/overview').then((r) => r.data),
  getByDepartment: () =>
    api.get<StatsByDepartment[]>('/stats/by-department').then((r) => r.data),
  getByProduct: () =>
    api.get<StatsByProduct[]>('/stats/by-product').then((r) => r.data),
  getByUser: () =>
    api.get<StatsByUser[]>('/stats/by-user').then((r) => r.data),
  getMonthly: () =>
    api.get<StatsMonthly[]>('/stats/monthly').then((r) => r.data),
  getComparison: () =>
    api.get<any>('/stats/comparison').then((r) => r.data),
};