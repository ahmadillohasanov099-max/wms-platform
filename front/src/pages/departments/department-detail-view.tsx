import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, usersApi, historyApi, operationsApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth.store';
import VerifyIdentityModal from '../../components/shared/verify-identity-modal';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/button';
import { invalidateAppQueries } from '../../lib/utils';
import DepartmentStatsCards from './components/department-stats-cards';
import EmployeesTab from './components/employees-tab';
import DepartmentAssetsTab from './components/department-assets-tab';
import DepartmentTmzTab from './components/department-tmz-tab';
import UserDetailSubView from './components/user-detail-sub-view';

interface Props {
  departmentId: string;
  selectedUserId?: string;
  onBack: () => void;
  onSelectUser: (userId: string) => void;
  onBackToDept: () => void;
}

export default function DepartmentDetailView({
  departmentId,
  selectedUserId,
  onBack,
  onSelectUser,
  onBackToDept,
}: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'employees' | 'assets' | 'tmz'>('employees');
  const queryClient = useQueryClient();
  const { user: loggedInUser } = useAuthStore();
  const isAdmin = loggedInUser?.role !== 'XODIM' && loggedInUser?.role !== 'KADR';

  const [selectedAssetItem, setSelectedAssetItem] = useState<any | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const handleReturnClick = (assetIdOrItem: any) => {
    if (typeof assetIdOrItem === 'string') {
      setSelectedAssetItem({ id: assetIdOrItem });
    } else {
      setSelectedAssetItem(assetIdOrItem);
    }
    setPasswordModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!selectedAssetItem) return;
    try {
      const assetId = selectedAssetItem.assetId || selectedAssetItem.asset?.id || selectedAssetItem.id;
      const productId = selectedAssetItem.productId || selectedAssetItem.product?.id || selectedAssetItem.asset?.productId;

      if (selectedUserId) {
        await operationsApi.returnFromUser({
          userId: selectedUserId,
          assetId: assetId,
        });
        toast.success(t('operations.returnFromUserSuccess'));
      } else {
        await operationsApi.returnFromDept({
          departmentId,
          productId: productId,
          assetId: assetId,
          quantity: 1,
        });
        toast.success(t('operations.returnFromDeptSuccess'));
      }

      invalidateAppQueries(queryClient);
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    } finally {
      setSelectedAssetItem(null);
      setPasswordModalOpen(false);
    }
  };

  const { data: deptAssetsHistoryData, isLoading: deptAssetsHistoryLoading } = useQuery({
    queryKey: ['department-assets-history', departmentId],
    queryFn: () =>
      historyApi.getAll({
        departmentId,
        operationType: 'ASSIGN_TO_DEPT',
        limit: 100,
      }),
    enabled: !!departmentId,
  });

  const { data: tmzHistoryData, isLoading: tmzHistoryLoading } = useQuery({
    queryKey: ['department-tmz-history', departmentId],
    queryFn: () =>
      historyApi.getAll({
        departmentId,
        operationType: 'GIVE_TO_DEPT',
        limit: 100,
      }),
    enabled: !!departmentId,
  });

  const { data: department, isLoading: deptLoading } = useQuery({
    queryKey: ['department-detail', departmentId],
    queryFn: () => departmentsApi.getOne(departmentId),
    enabled: !!departmentId,
  });

  const { data: selectedUser, isLoading: userLoading } = useQuery({
    queryKey: ['user-detail', selectedUserId],
    queryFn: () => usersApi.getOne(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['department-stats', departmentId],
    queryFn: () => departmentsApi.getStats(departmentId),
    enabled: !!departmentId,
  });

  const rawTmzData = tmzHistoryData as any;
  const tmzItems: any[] = Array.isArray(rawTmzData)
    ? rawTmzData
    : Array.isArray(rawTmzData?.items)
    ? rawTmzData.items
    : [];

  const totalTmzQty = tmzItems.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0);
  const displayTmzCount = totalTmzQty > 0 ? totalTmzQty : (stats?.sarflanadigan ?? 0);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['department-users', departmentId],
    queryFn: () => usersApi.getAll({ departmentId, limit: 100 }),
    enabled: !!departmentId && !selectedUserId,
  });

  const employees = usersData?.items ?? [];

  const headerTitle = selectedUser
    ? t('departments.employeeProfile')
    : department?.name;

  const headerSubtitle = selectedUser
    ? selectedUser.fullName
    : department?.description || t('departments.subtitle');

  const handleBackClick = () => {
    if (selectedUser) {
      onBackToDept();
    } else {
      onBack();
    }
  };

  if (deptLoading || (selectedUserId && userLoading)) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {headerTitle}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {headerSubtitle}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleBackClick}
          className="flex items-center gap-1.5 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
          {selectedUser ? t('departments.backToDept') : t('departments.title')}
        </Button>
      </div>

      {selectedUser ? (
        <UserDetailSubView
          selectedUser={selectedUser}
          selectedUserId={selectedUserId!}
          isAdmin={isAdmin}
          handleReturnClick={handleReturnClick}
        />
      ) : (
        <div className="space-y-6">
          {/* Top Stats Cards */}
          <DepartmentStatsCards stats={stats} isLoading={statsLoading} />

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
            <button
              className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
                activeTab === 'employees'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              onClick={() => setActiveTab('employees')}
            >
              {t('departments.staffList')} ({employees.length})
            </button>
            <button
              className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
                activeTab === 'assets'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              onClick={() => setActiveTab('assets')}
            >
              {t('departments.assetsTab', { count: stats?.assetCount ?? 0 })}
            </button>
            <button
              className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
                activeTab === 'tmz'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              onClick={() => setActiveTab('tmz')}
            >
              {t('departments.tmzTab', { count: displayTmzCount })}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'employees' ? (
            <EmployeesTab
              employees={employees}
              isLoading={usersLoading}
              onSelectUser={onSelectUser}
            />
          ) : activeTab === 'assets' ? (
            <DepartmentAssetsTab
              assignments={department?.assignments || department?.departmentAssets || department?.assets || (department as any)?.assignedAssets}
              assetsData={deptAssetsHistoryData}
              isLoading={deptAssetsHistoryLoading || deptLoading}
              isAdmin={isAdmin}
              isLeader={!!(loggedInUser?.id && (department?.leaderId === loggedInUser?.id || department?.leader?.id === loggedInUser?.id))}
              onReturnClick={handleReturnClick}
            />
          ) : (
            <DepartmentTmzTab
              tmzData={tmzHistoryData}
              isLoading={tmzHistoryLoading}
            />
          )}
        </div>
      )}

      {/* Return Asset Password Verification Modal */}
      <VerifyIdentityModal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setSelectedAssetItem(null);
        }}
        onSuccess={handleConfirmReturn}
      />
    </div>
  );
}
