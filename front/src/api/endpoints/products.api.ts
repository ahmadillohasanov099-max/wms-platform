import type { Product } from '../../types';
import api from '../axios';
export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  productType?: string;
}
export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface UpdateProductDto {
  name?: string;
  year?: number;
  unit?: string;
  description?: string;
  imageUrl?: string;
}
export const productsApi = {
  getAll: (query?: ProductQuery) =>
    api.get<PaginatedProducts>('/products', { params: query }).then((r) => r.data),
  getOne: (id: string) =>
    api.get<Product>(`/products/${id}`).then((r) => r.data),
  getHistory: (id: string) =>
    api.get(`/products/${id}/history`).then((r) => r.data),
  getLowStock: () =>
    api.get('/products/low-stock').then((r) => r.data),
  update: (id: string, dto: UpdateProductDto) =>
    api.put<Product>(`/products/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/products/${id}`).then((r) => r.data),
};