import api from '../axios';

export interface LimitHistoryItem {
  id: string;
  monthlyLimitId: string;
  actionType: string; // 'INITIAL_SET', 'INCREASED', 'DECREASED', 'MODIFIED', 'DECREE_EXCEPTION'
  previousQuantity?: number | null;
  newQuantity: number;
  documentNumber?: string | null;
  documentDate?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  reason?: string | null;
  createdBy?: {
    id?: string;
    fullName: string;
    role: string;
  } | null;
  createdAt: string;
}

export interface LimitStatusResponse {
  hasLimit: boolean;
  limitId: string | null;
  productId: string;
  productName: string;
  unit?: string;
  packageSize?: number | null;
  baseLimit: number | null;
  decreeReference?: string | null;
  fileUrl?: string | null;
  totalExceptions: number;
  totalAllowed: number | null;
  currentMonthSpent: number;
  currentQuarterSpent?: number;
  remaining: number | null;
  yearMonth: string;
  periodCode?: string;
  periodName?: string;
  periodRange?: string;
  limitSetDate?: string | null;
  nextResetDate?: string | Date | null;
  createdBy?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  history?: LimitHistoryItem[];
  exceptions: Array<{
    id: string;
    documentNumber: string;
    documentDate: string;
    additionalQuantity: number;
    reason?: string;
    fileUrl?: string;
    fileName?: string;
    createdBy?: {
      id: string;
      fullName: string;
      role: string;
    };
    createdAt: string;
  }>;
}

export interface SetMonthlyLimitPayload {
  productId: string;
  departmentId?: string;
  userId?: string;
  limitQuantity: number;
  decreeReference?: string;
  isActive?: boolean;
}

export interface UpdateMonthlyLimitPayload {
  limitQuantity: number;
  documentNumber?: string;
  documentDate?: string;
  decreeReference?: string;
  reason?: string;
  isActive?: boolean;
  file?: File | null;
}

export interface CreateLimitExceptionPayload {
  productId: string;
  departmentId?: string;
  userId?: string;
  monthlyLimitId?: string;
  yearMonth?: string;
  additionalQuantity: number;
  documentNumber?: string;
  documentDate?: string;
  reason?: string;
  file?: File | null;
}

export const limitsApi = {
  getStatus: (params: {
    productId: string;
    userId?: string;
    departmentId?: string;
    date?: string;
  }): Promise<LimitStatusResponse> =>
    api.get<LimitStatusResponse>('/limits/status', { params }).then((r) => r.data),

  getLimits: (params?: any) =>
    api.get('/limits', { params }).then((r) => r.data),

  setLimit: (data: SetMonthlyLimitPayload) =>
    api.post('/limits', data).then((r) => r.data),

  updateLimit: (id: string, payload: UpdateMonthlyLimitPayload) => {
    const formData = new FormData();
    formData.append('limitQuantity', String(payload.limitQuantity));
    if (payload.documentNumber) formData.append('documentNumber', payload.documentNumber);
    if (payload.documentDate) formData.append('documentDate', payload.documentDate);
    if (payload.decreeReference) formData.append('decreeReference', payload.decreeReference);
    if (payload.reason) formData.append('reason', payload.reason);
    if (payload.isActive !== undefined) formData.append('isActive', String(payload.isActive));
    if (payload.file) formData.append('file', payload.file);

    return api
      .put(`/limits/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  addException: (payload: CreateLimitExceptionPayload) => {
    const formData = new FormData();
    formData.append('productId', payload.productId);
    if (payload.departmentId) formData.append('departmentId', payload.departmentId);
    if (payload.userId) formData.append('userId', payload.userId);
    if (payload.monthlyLimitId) formData.append('monthlyLimitId', payload.monthlyLimitId);
    if (payload.yearMonth) formData.append('yearMonth', payload.yearMonth);
    formData.append('additionalQuantity', String(payload.additionalQuantity));
    if (payload.documentNumber) formData.append('documentNumber', payload.documentNumber);
    if (payload.documentDate) formData.append('documentDate', payload.documentDate);
    if (payload.reason) formData.append('reason', payload.reason);
    if (payload.file) formData.append('file', payload.file);

    return api
      .post('/limits/exceptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

    viewDecree: async (fileUrl: string) => {
    try {
      const url = fileUrl.startsWith('/api/v1') ? fileUrl.replace('/api/v1', '') : fileUrl;
      const res = (await api.get(url, { responseType: 'blob' })) as any;
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err: any) {
      console.error('Failed to view decree:', err);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const fullUrl = fileUrl + (fileUrl.includes('?') ? '&' : '?') + (token ? `token=${token}` : '');
      window.open(fullUrl, '_blank');
    }
  },

  downloadDecree: async (fileUrl: string, originalFileName?: string) => {
    try {
      const url = fileUrl.startsWith('/api/v1') ? fileUrl.replace('/api/v1', '') : fileUrl;
      const res = (await api.get(url, { responseType: 'blob' })) as any;
      const blob = res instanceof Blob ? res : new Blob([res]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', originalFileName || 'buyruq_hujjati.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err: any) {
      console.error('Failed to download decree:', err);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const fullUrl = fileUrl + (fileUrl.includes('?') ? '&' : '?') + (token ? `token=${token}` : '');
      const link = document.createElement('a');
      link.href = fullUrl;
      link.setAttribute('download', originalFileName || 'buyruq_hujjati.pdf');
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  deleteLimit: (id: string) =>
    api.delete(`/limits/${id}`).then((r) => r.data),
};
