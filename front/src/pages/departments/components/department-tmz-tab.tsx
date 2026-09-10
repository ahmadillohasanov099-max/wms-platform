import Card, { CardHeader, CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import { formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { Boxes, FileText, User, Calendar, Package } from 'lucide-react';

interface DepartmentTmzTabProps {
  tmzData: any;
  isLoading: boolean;
}

export default function DepartmentTmzTab({ tmzData, isLoading }: DepartmentTmzTabProps) {
  const { t } = useTranslation();

  const items: any[] = Array.isArray(tmzData)
    ? tmzData
    : tmzData?.items || tmzData?.data || [];

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const columns = [
    {
      key: 'productName',
      title: t('inventory.productName'),
      className: 'whitespace-normal break-words min-w-[220px] max-w-md',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/40">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-xs sm:text-sm block">
              {row.product?.name || t('operations.product')}
            </span>
            {row.note && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">
                {row.note}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      title: t('inventory.quantity'),
      render: (val: any, row: any) => {
        const unit = row.product?.unit || t('common.pcs');
        return (
          <span className="inline-flex items-center gap-1 font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs">
            {val} {unit}
          </span>
        );
      },
    },
    {
      key: 'documentNumber',
      title: t('common.documentNumber'),
      render: (val: any) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
            {val || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'performedBy',
      title: t('userView.givenBy'),
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span>{row.performedBy?.fullName || '—'}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: t('common.date'),
      render: (val: any) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{val ? formatDate(val) : '—'}</span>
        </div>
      ),
    },
  ];

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
      <CardHeader
        title={
          <div className="flex items-center justify-between gap-4 w-full flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Boxes className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-slate-900 dark:text-white">
                {t('profile.deptTmzTitle')}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-200 dark:border-amber-900/50">
                {t('profile.recordsCount', { count: items.length })}
              </span>
              {totalQuantity > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-900/50">
                  {t('profile.totalPcs', { count: totalQuantity, unit: t('common.pcs') })}
                </span>
              )}
            </div>
          </div>
        }
        className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
      />

      <CardContent className="p-0">
        {/* Mobile View */}
        <div className="md:hidden p-3.5 space-y-3">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
              <Boxes className="w-10 h-10 text-gray-300 dark:text-slate-700 stroke-1" />
              <span>{t('profile.noDeptTmz')}</span>
            </div>
          ) : (
            items.map((item: any) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/40">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        {item.product?.name || t('operations.product')}
                      </h4>
                      {item.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center text-xs font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                    {item.quantity} {item.product?.unit || t('common.pcs')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[11px] text-gray-400 block">{t('profile.doc')}:</span>
                    <span className="font-mono font-semibold">{item.documentNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 block">{t('common.date')}:</span>
                    <span className="font-mono">{item.createdAt ? formatDate(item.createdAt) : '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-gray-400 block">{t('profile.giver')}:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {item.performedBy?.fullName || '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table
            columns={columns}
            data={items}
            loading={isLoading}
            rowKey={(row) => row.id}
            emptyTitle={t('profile.noDeptTmz')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
