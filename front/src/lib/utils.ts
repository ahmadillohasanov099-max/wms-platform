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

export function formatCurrency(
  amount?: number | string | null,
  lang?: 'uz' | 'ru' | 'en',
  options?: { fractionDigits?: number }
): string {
  const currentLang = lang || useUiStore.getState().language || 'uz';
  const config = CURRENCY_CONFIG[currentLang] || CURRENCY_CONFIG.uz;

  if (amount === undefined || amount === null || amount === '') return `0 ${config.currency}`;
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return `0 ${config.currency}`;

  const fractionDigits = options?.fractionDigits ?? 0;
  const rounded = fractionDigits === 0 ? Math.round(num) : num;
  return `${new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rounded)} ${config.currency}`;
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


export const UZ_MONTH_NAMES = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'
];


export function formatLocalizedDateText(dateInput?: string | Date | null, lang?: 'uz' | 'ru' | 'en'): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const currentLang = lang || useUiStore.getState?.()?.language || 'uz';
  const day = d.getDate();
  const year = d.getFullYear();
  if (currentLang === 'ru') {
    const ruMonths = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${year}-й год, ${day} ${ruMonths[d.getMonth()]}`;
  }
  if (currentLang === 'en') {
    const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${enMonths[d.getMonth()]} ${day}, ${year}`;
  }
  const month = UZ_MONTH_NAMES[d.getMonth()];
  return `${year}-yil ${day}-${month}`;
}

export function formatLocalizedQuarter(
  periodCode?: string | null,
  periodName?: string | null,
  periodRange?: string | null,
  lang?: 'uz' | 'ru' | 'en'
): { name: string; range: string } {
  const currentLang = lang || useUiStore.getState?.()?.language || 'uz';
  let year = '2026';
  let quarter = '4';
  if (periodCode && periodCode.includes('-Q')) {
    const parts = periodCode.split('-Q');
    year = parts[0] || '2026';
    quarter = parts[1] || '4';
  } else if (periodName) {
    const m = periodName.match(/(\d{4}).*?([I|V|X]+|\d)/);
    if (m) {
      year = m[1];
      const qMap: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4' };
      quarter = qMap[m[2]] || m[2];
    }
  }

  const romanMap: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
  const roman = romanMap[quarter] || quarter;

  if (currentLang === 'ru') {
    const ranges: Record<string, string> = {
      '1': '1 января – 31 марта',
      '2': '1 апреля – 30 июня',
      '3': '1 июля – 30 сентября',
      '4': '1 октября – 31 декабря',
    };
    return {
      name: `${year} г. ${roman} квартал`,
      range: ranges[quarter] || periodRange || '1 октября – 31 декабря',
    };
  }

  if (currentLang === 'en') {
    const ranges: Record<string, string> = {
      '1': 'Jan 1 – Mar 31',
      '2': 'Apr 1 – Jun 30',
      '3': 'Jul 1 – Sep 30',
      '4': 'Oct 1 – Dec 31',
    };
    return {
      name: `${year} Q${quarter}`,
      range: ranges[quarter] || periodRange || 'Oct 1 – Dec 31',
    };
  }

  // uz
  const ranges: Record<string, string> = {
    '1': '1-yanvar – 31-mart',
    '2': '1-aprel – 30-iyun',
    '3': '1-iyul – 30-sentyabr',
    '4': '1-oktyabr – 31-dekabr',
  };
  return {
    name: `${year}-yil ${roman} chorak`,
    range: ranges[quarter] || periodRange || '1-oktyabr – 31-dekabr',
  };
}

export function formatUzbekDateText(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = UZ_MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return year + '-yil ' + day + '-' + month;
}

export function formatSimpleDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return day + '.' + month + '.' + year;
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

export function getDefaultRouteForRole(role?: string): string {
  if (role === 'XODIM') return '/profile';
  if (role === 'KADR') return '/users';
  return '/dashboard';
}