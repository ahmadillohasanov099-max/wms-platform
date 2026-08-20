import { Users, Package, Layers } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import StatsCard from '../../../components/ui/stats-card';
import { PageLoader } from '../../../components/ui/spinner';

interface DepartmentStatsCardsProps {
  stats: { userCount?: number; assetCount?: number; sarflanadigan?: number } | undefined;
  isLoading: boolean;
}

export default function DepartmentStatsCards({ stats, isLoading }: DepartmentStatsCardsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <StatsCard
        title={t('departments.activeEmployees')}
        value={`${stats?.userCount ?? 0} ${t('common.pcs')}`}
        icon={<Users className="w-5 h-5" />}
        iconBgColor="bg-blue-500/10 dark:bg-blue-950/20"
        iconTextColor="text-blue-600 dark:text-blue-400"
      />
      <StatsCard
        title={t('departments.assignedAssets')}
        value={`${stats?.assetCount ?? 0} ${t('common.pcs')}`}
        icon={<Package className="w-5 h-5" />}
        iconBgColor="bg-emerald-500/10 dark:bg-emerald-950/20"
        iconTextColor="text-emerald-600 dark:text-emerald-400"
      />
      <StatsCard
        title={t('departments.assignedConsumables')}
        value={`${stats?.sarflanadigan ?? 0} ${t('common.pcs')}`}
        icon={<Layers className="w-5 h-5" />}
        iconBgColor="bg-amber-500/10 dark:bg-amber-950/20"
        iconTextColor="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}
