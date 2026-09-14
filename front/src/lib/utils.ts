import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useUiStore } from '../store/ui.store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_CONFIG: Record<string, {
  currency: string;
  billion: string;
  million: string;
  thousand: string;
  locale: string;
}> = {
  uz: {
    currency: "so'm",
    billion: 'mlrd',
    million: 'mln',
    thousand: 'ming',
    locale: 'uz-UZ',
  },
  ru: {
    currency: 'сум',
    billion: 'млрд',
    million: 'млн',
    thousand: 'тыс.',
    locale: 'ru-RU',
  },
  en: {
    currency: 'sum',
    billion: 'B',
    million: 'M',
    thousand: 'K',
    locale: 'en-US',
  },
};

export function formatCurrency(amount?: number | string | null, lang?: 'uz' | 'ru' | 'en'): string {
  const currentLang = lang || useUiStore.getState().language || 'uz';
  const config = CURRENCY_CONFIG[currentLang] || CURRENCY_CONFIG.uz;

  if (amount === undefined || amount === null || amount === '') return `0 ${config.currency}`;
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return `0 ${config.currency}`;
  return `${new Intl.NumberFormat(config.locale, { maximumFractionDigits: 2 }).format(num)} ${config.currency}`;
}

export function formatCompactCurrency(
  amount?: number | string | null,
  includeUnit: boolean = true,
  lang?: 'uz' | 'ru' | 'en'
): string {
  const currentLang = lang || useUiStore.getState().language || 'uz';
  const config = CURRENCY_CONFIG[currentLang] || CURRENCY_CONFIG.uz;
  const suffix = includeUnit ? ` ${config.currency}` : '';

  if (amount === undefined || amount === null || amount === '') return includeUnit ? `0 ${config.currency}` : '0';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num) || num === 0) return includeUnit ? `0 ${config.currency}` : '0';

  const formatNum = (val: number) => {
    return Number(val.toFixed(2)).toLocaleString(config.locale);
  };

  if (num >= 1_000_000_000) {
    return `${formatNum(num / 1_000_000_000)} ${config.billion}${suffix}`;
  }
  if (num >= 1_000_000) {
    return `${formatNum(num / 1_000_000)} ${config.million}${suffix}`;
  }
  if (num >= 1_000) {
    return `${formatNum(num / 1_000)} ${config.thousand}${suffix}`;
  }
  return `${num.toLocaleString(config.locale)}${suffix}`;
}

export function formatDate(dateString?: string | Date | null, lang?: 'uz' | 'ru' | 'en'): string {
  if (!dateString) return '—';
  try {
    const currentLang = lang || useUiStore.getState().language || 'uz';
    const locale = currentLang === 'ru' ? 'ru-RU' : currentLang === 'en' ? 'en-US' : 'uz-UZ';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale, {
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