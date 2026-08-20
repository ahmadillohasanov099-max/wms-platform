import { Building2 } from 'lucide-react';
import { RoleBadge } from '../../../components/ui/badge';
import { formatCurrency } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  user: any;
  totalValue: number;
}

export default function ProfileHeaderBanner({ user, totalValue }: Props) {
  const { t } = useTranslation();

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-lg font-bold shadow-sm flex-shrink-0 border border-slate-700/50">
            {user?.fullName?.slice(0, 2).toUpperCase() || 'US'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {user?.fullName}
              </h2>
              <RoleBadge role={user?.role} />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-medium text-slate-700 dark:text-slate-300">@{user?.username}</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="flex items-center gap-1 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {user?.department?.name ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('profile.totalValue')}: </span>
          <span className="font-bold text-slate-900 dark:text-white ml-1 text-sm">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </div>
    </div>
  );
}
