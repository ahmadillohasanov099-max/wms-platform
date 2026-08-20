import { Package, Coins, Clock, History } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  assignmentsCount: number;
  totalValue: number;
  latestAssignment: any | null;
  historyCount: number;
}

export default function ProfileStatsCards({
  assignmentsCount,
  totalValue,
  latestAssignment,
  historyCount,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* STAT 1: Biriktirilgan jihozlar soni */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('profile.myAssets')}</p>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {assignmentsCount} <span className="text-xs font-normal text-gray-500">{t('common.pcs')}</span>
          </h3>
        </div>
      </div>

      {/* STAT 2: Jami qiymati */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('profile.totalValue')}</p>
          <h3 className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-0.5">
            {formatCurrency(totalValue)}
          </h3>
        </div>
      </div>

      {/* STAT 3: Oxirgi olingan jihoz */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40">
          <Clock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('profile.headers.assetName')}</p>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate" title={latestAssignment?.asset?.product?.name || t('common.noData')}>
            {latestAssignment?.asset?.product?.name || t('common.noData')}
          </h3>
          {latestAssignment && (
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
              {formatDate(latestAssignment.assignedAt || latestAssignment.createdAt)}
            </p>
          )}
        </div>
      </div>

      {/* STAT 4: Operatsiyalar tarixi */}
      <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
          <History className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('profile.recentActivity')}</p>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {historyCount} <span className="text-xs font-normal text-gray-500">{t('common.pcs')}</span>
          </h3>
        </div>
      </div>
    </div>
  );
}
