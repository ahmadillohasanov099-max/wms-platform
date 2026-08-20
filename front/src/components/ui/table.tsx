import { cn } from '../../lib/utils';
import { TableSkeleton, EmptyState } from './spinner';
import { useTranslation } from '../../hooks/useTranslation';

export interface Column<T> {
  key: string;
  title: React.ReactNode;
  width?: string;
  className?: string;
  headerClassName?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export default function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  rowKey,
  onRowClick,
  className,
}: TableProps<T>) {
  const { t } = useTranslation();
  const finalEmptyTitle = emptyTitle || t('common.noData');

  return (
    <div className={cn('w-full overflow-x-auto min-h-[420px]', className)}>
      <table className="w-full text-sm">
        {}
        <thead>
          <tr className="border-b border-gray-200 dark:border-white/15">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                  'dark:text-slate-200 dark:font-extrabold',
                  col.headerClassName
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>

        {}
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4">
                <TableSkeleton rows={5} cols={columns.length} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  title={finalEmptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={rowKey ? rowKey(row) : index}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-gray-100 dark:border-white/10',
                  'hover:bg-gray-50 dark:hover:bg-slate-800/70',
                  'transition-colors duration-150 ease-out',
                  onRowClick && 'cursor-pointer',
                  index % 2 === 0
                    ? 'bg-white dark:bg-transparent'
                    : 'bg-gray-50/50 dark:bg-white/5',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    onClick={(e) => {
                      if (col.key === 'actions' || col.key === 'isActive' || col.key === 'status') {
                        e.stopPropagation();
                      }
                    }}
                    className={cn(
                      'px-4 py-3 text-gray-700 dark:text-slate-100 font-medium align-middle',
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}