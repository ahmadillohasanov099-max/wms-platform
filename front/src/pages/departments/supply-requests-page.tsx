import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { departmentsApi, usersApi } from '../../api';
import PageHeader from '../../components/ui/page-header';
import DepartmentRequestsTab from './components/department-requests-tab';
import { PageLoader } from '../../components/ui/spinner';
import { AlertCircle } from 'lucide-react';

export default function SupplyRequestsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const { data: userDetailData } = useQuery({
    queryKey: ['user-detail-supply-page', user?.id],
    queryFn: () => usersApi.getOne(user!.id),
    enabled: !!user?.id,
  });

  const currentUser = userDetailData || user;
  const departmentId = currentUser?.departmentId || currentUser?.department?.id;

  const { data: department, isLoading } = useQuery({
    queryKey: ['department-detail-supply-page', departmentId],
    queryFn: () => departmentsApi.getOne(departmentId!),
    enabled: !!departmentId,
  });

  if (isLoading) return <PageLoader />;

  const isLeader = Boolean(
    currentUser?.isDepartmentLeader ||
    (currentUser as any)?.ledDepartments?.length > 0 ||
    (department?.leaderId && currentUser?.id && department.leaderId === currentUser.id) ||
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'ORG_ADMIN'
  );

  const deptName = department?.name || currentUser?.department?.name || '';

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('supplyRequests.deptSupplyTitle')}
        subtitle={
          deptName
            ? `"${deptName}" — ${t('supplyRequests.deptSupplyDesc')}`
            : t('supplyRequests.deptSupplyDesc')
        }
      />

      {!departmentId && currentUser?.role === 'XODIM' ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-8 text-center text-amber-800 dark:text-amber-300 space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h3 className="text-lg font-bold">{t('profile.deptNotAssigned')}</h3>
          <p className="text-sm max-w-md mx-auto text-amber-700 dark:text-amber-400">
            {t('profile.deptNotAssignedDesc')}
          </p>
        </div>
      ) : (
        <DepartmentRequestsTab
          departmentId={departmentId}
          departmentName={deptName}
          isLeader={isLeader}
        />
      )}
    </div>
  );
}
