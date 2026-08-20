import Card, { CardHeader, CardContent } from '../../../components/ui/card';
import { OperationTypeBadge } from '../../../components/ui/badge';
import { PageLoader } from '../../../components/ui/spinner';
import { formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { History, Calendar, Activity } from 'lucide-react';

interface Props {
  history: any[];
  isLoading: boolean;
}

export default function ProfileActivityTable({ history, isLoading }: Props) {
  const { t } = useTranslation();

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
      <CardHeader
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span className="font-bold">{t('profile.recentActivity')}</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-extrabold border border-teal-200 dark:border-teal-900/50">
              {history.length} ta yozuv
            </span>
          </div>
        }
        className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
      />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6"><PageLoader /></div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
            <Activity className="w-10 h-10 text-gray-300 dark:text-slate-700 stroke-1" />
            <span>{t('profile.noActivity')}</span>
          </div>
        ) : (
          <>
            {/* Mobile Responsive Timeline Feed View (screens < 768px) */}
            <div className="md:hidden p-4 space-y-4">
              <div className="relative border-l-2 border-teal-500/30 dark:border-teal-400/20 ml-2 pl-4 space-y-4">
                {history.slice(0, 20).map((item: any) => (
                  <div
                    key={item.id}
                    className="relative bg-white dark:bg-slate-900/90 p-3.5 rounded-xl border border-gray-200/80 dark:border-slate-800 shadow-2xs space-y-2"
                  >
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-[23px] top-3.5 w-3.5 h-3.5 rounded-full bg-teal-500 border-2 border-white dark:border-slate-950 shadow-xs" />

                    {/* Header: Operation Badge & Date */}
                    <div className="flex items-center justify-between">
                      <OperationTypeBadge type={item.type} />
                      <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>

                    {/* Product Name & Quantity */}
                    <div className="flex items-center justify-between pt-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                        {item.product?.name ?? '—'}
                      </h4>
                      <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/50 shrink-0 ml-2">
                        {item.quantity} {t('common.pcs')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Table View (screens >= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200/70 dark:border-slate-800/80 text-left bg-gray-50/70 dark:bg-slate-800/40">
                    {[t('profile.headers.date'), t('profile.headers.operation'), t('profile.headers.product'), t('profile.headers.quantity')].map((h) => (
                      <th key={h} className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                  {history.slice(0, 20).map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors duration-200">
                      <td className="px-5 py-3 text-gray-500 text-xs font-mono">{formatDate(item.createdAt)}</td>
                      <td className="px-5 py-3"><OperationTypeBadge type={item.type} /></td>
                      <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{item.product?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-900 dark:text-white font-bold">{item.quantity} {t('common.pcs')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
