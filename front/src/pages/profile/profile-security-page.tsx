import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

import ProfileSecurityCard from './components/profile-security-card';

export default function ProfileSecurityPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  if (!user) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <PageHeader
        title={t('menu.profileSecurity')}
        subtitle={t('profile.security')}
      />

      <ProfileSecurityCard />
    </div>
  );
}
