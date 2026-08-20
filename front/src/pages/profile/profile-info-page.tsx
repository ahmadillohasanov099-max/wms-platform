import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

import ProfileHeaderBanner from './components/profile-header-banner';
import ProfileStatsCards from './components/profile-stats-cards';
import ProfilePersonalInfoCard from './components/profile-personal-info-card';
import ProfileSecurityCard from './components/profile-security-card';

export default function ProfileInfoPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const { data: userDetailData, isLoading } = useQuery({
    queryKey: ['profile-user-detail', user?.id],
    queryFn: () => usersApi.getOne(user!.id),
    enabled: !!user?.id,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['profile-assignments', user?.id],
    queryFn: () => usersApi.getAssignments(user!.id),
    enabled: !!user?.id,
  });

  const { data: historyData } = useQuery({
    queryKey: ['profile-history', user?.id],
    queryFn: () => usersApi.getHistory(user!.id),
    enabled: !!user?.id,
  });

  if (!user || isLoading) return <PageLoader />;

  const profileUser: any = userDetailData ?? user;
  const assignments = assignmentsData ?? [];
  const history = historyData ?? [];

  const totalValue = assignments.reduce(
    (sum: number, a: any) => sum + Number(a.asset?.purchasePrice ?? 0),
    0
  );

  const latestAssignment = assignments.length > 0
    ? [...assignments].sort((a: any, b: any) => new Date(b.assignedAt || b.createdAt).getTime() - new Date(a.assignedAt || a.createdAt).getTime())[0]
    : null;

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.profileInfo')}
        subtitle={t('profile.personalInfo')}
      />

      <ProfileHeaderBanner user={profileUser} totalValue={totalValue} />

      <ProfileStatsCards
        assignmentsCount={assignments.length}
        totalValue={totalValue}
        latestAssignment={latestAssignment}
        historyCount={history.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProfilePersonalInfoCard profileUser={profileUser} />
        </div>
        <div>
          <ProfileSecurityCard />
        </div>
      </div>
    </div>
  );
}
