import React from 'react';
import { Activity, Calendar, AlertOctagon, Users } from 'lucide-react';
import { StatCard } from '../../../components/ui';

interface AuditLogsStatsGridProps {
  statsLoading: boolean;
  statsData?: {
    totalLogs?: number;
    todayLogs?: number;
    deleteCount?: number;
    activeUserCount?: number;
  };
  t: (key: string) => string;
}

export const AuditLogsStatsGrid: React.FC<AuditLogsStatsGridProps> = ({
  statsLoading,
  statsData,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label={t('auditLogs.totalLogs')}
        value={statsLoading ? '...' : `${statsData?.totalLogs ?? 0} ${t('common.pcs')}`}
        icon={<Activity className="w-5 h-5" />}
        color="blue"
      />
      <StatCard
        label={t('auditLogs.todayLogs')}
        value={statsLoading ? '...' : `${statsData?.todayLogs ?? 0} ${t('common.pcs')}`}
        icon={<Calendar className="w-5 h-5" />}
        color="green"
      />
      <StatCard
        label={t('auditLogs.deleteCount')}
        value={statsLoading ? '...' : `${statsData?.deleteCount ?? 0} ${t('common.pcs')}`}
        icon={<AlertOctagon className="w-5 h-5" />}
        color="red"
      />
      <StatCard
        label={t('auditLogs.activeUsers')}
        value={statsLoading ? '...' : `${statsData?.activeUserCount ?? 0} ${t('common.pcs')}`}
        icon={<Users className="w-5 h-5" />}
        color="purple"
      />
    </div>
  );
};
