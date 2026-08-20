import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation();
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = getPages(page, totalPages);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-3 border-t border-gray-100 dark:border-slate-800/80 mt-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
        {t('common.showingPages', { total, from, to })}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn(
            'min-w-[36px] h-9 px-2 flex items-center justify-center rounded-xl text-xs font-bold shrink-0',
            'border border-gray-200 dark:border-slate-800',
            'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300',
            'disabled:opacity-40 disabled:cursor-not-allowed transition-colors select-none',
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`dots-${i}`}
              className="min-w-[36px] h-9 flex items-center justify-center text-gray-400 text-xs font-bold shrink-0 select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={cn(
                'min-w-[36px] h-9 px-2.5 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 transition-colors select-none',
                p === page
                  ? 'bg-teal-600 text-white font-extrabold shadow-xs dark:bg-teal-600 dark:text-white'
                  : 'border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={cn(
            'min-w-[36px] h-9 px-2 flex items-center justify-center rounded-xl text-xs font-bold shrink-0',
            'border border-gray-200 dark:border-slate-800',
            'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300',
            'disabled:opacity-40 disabled:cursor-not-allowed transition-colors select-none',
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function getPages(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}