import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatCurrency(amount?: number | string | null): string {
  if (amount === undefined || amount === null || amount === '') return '0 so\'m';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return '0 so\'m';
  return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(num)} so'm`;
}

export function formatCompactCurrency(amount?: number | string | null, includeUnit: boolean = true): string {
  if (amount === undefined || amount === null || amount === '') return includeUnit ? '0 so\'m' : '0';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num) || num === 0) return includeUnit ? '0 so\'m' : '0';

  const formatNum = (val: number) => {
    return Number(val.toFixed(2)).toLocaleString('uz-UZ');
  };

  const suffix = includeUnit ? ' so\'m' : '';

  if (num >= 1_000_000_000) {
    return `${formatNum(num / 1_000_000_000)} mlrd${suffix}`;
  }
  if (num >= 1_000_000) {
    return `${formatNum(num / 1_000_000)} mln${suffix}`;
  }
  if (num >= 1_000) {
    return `${formatNum(num / 1_000)} ming${suffix}`;
  }
  return `${num.toLocaleString('uz-UZ')}${suffix}`;
}
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}
export function invalidateAppQueries(queryClient: any) {
  if (!queryClient) return;

  // Global invalidation with instant forced refetch for active queries
  queryClient.invalidateQueries({ refetchType: 'all' });

  // Specific query keys for targeted instant updates
  const keys = [
    'inventory',
    'products',
    'history',
    'history-recent',
    'stats-overview',
    'dashboard-stats',
    'assigned-assets',
    'my-assets',
    'profile-my-assets',
    'profile-history',
    'low-stock',
    'products-asset',
    'products-consumable',
    'products-beriladigan',
    'inventory-list-for-write-off-page',
    'user-assignments',
    'user-history',
    'users',
    'departments',
    'department-stats',
    'department-tmz-history',
    'department-detail',
    'inventory-detail',
    'product-detail',
    'deletion-requests',
    'audit-stats',
    'audit-logs',
  ];

  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' });
  }
}