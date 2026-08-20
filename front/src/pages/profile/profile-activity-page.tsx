import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

import ProfileActivityTable from './components/profile-activity-table';

export default function ProfileActivityPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['profile-history', user?.id],
    queryFn: () => usersApi.getHistory(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return <PageLoader />;

  const history = historyData ?? [];

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.profileActivity')}
        subtitle={t('profile.recentActivity')}
      />

      <ProfileActivityTable
        history={history}
        isLoading={historyLoading}
      />
    </div>
  );
}
