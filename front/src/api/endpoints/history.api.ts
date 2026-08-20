import api from "../axios";
import type { Operation } from "../../types/operation.types";
export interface HistoryQuery {
  page?: number;
  limit?: number;
  operationType?: string;
  userId?: string;
  departmentId?: string;
  productId?: string;
  organizationId?: string;
  from?: string;
  to?: string;
}
export interface PaginatedHistory {
  items: Operation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export const historyApi = {
  getAll: (query?: HistoryQuery) =>
    api.get<PaginatedHistory>("/history", { params: query }).then((r) => r.data),
};