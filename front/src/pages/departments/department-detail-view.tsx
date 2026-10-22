import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, usersApi, historyApi, operationsApi, requestsApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth.store';
import VerifyIdentityModal from '../../components/shared/verify-identity-modal';
import toast from 'react-hot-toast';
import { ArrowLeft, Users, Package, Boxes, ClipboardList } from 'lucide-react';
import Button from '../../components/ui/button';
import { invalidateAppQueries, cn } from '../../lib/utils';
import DepartmentStatsCards from './components/department-stats-cards';
import EmployeesTab from './components/employees-tab';
import DepartmentAssetsTab from './components/department-assets-tab';
import DepartmentTmzTab from './components/department-tmz-tab';
import DepartmentRequestsTab from './components/department-requests-tab';
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
  const [activeTab, setActiveTab] = useState<'employees' | 'assets' | 'tmz' | 'requests'>('employees');
  const queryClient = useQueryClient();
  const { user: loggedInUser } = useAuthStore();
  const isAdmin = loggedInUser?.role !== 'XODIM' && loggedInUser?.role !== 'KADR' && loggedInUser?.role !== 'RAHBAR';

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

  const canManageRequests =
    loggedInUser?.role === 'SUPER_ADMIN' ||
    loggedInUser?.role === 'ORG_ADMIN' ||
    loggedInUser?.role === 'VAZIRLIK_OMBORCHI' ||
    loggedInUser?.role === 'ORG_OMBORCHI';

  const { data: requestsData } = useQuery({
    queryKey: canManageRequests ? ['department-all-requests', departmentId] : ['my-deletion-requests'],
    queryFn: () => (canManageRequests ? requestsApi.getAll() : requestsApi.getMy()),
    enabled: !!departmentId,
  });

  const rawReqList: any[] = Array.isArray(requestsData)
    ? requestsData
    : Array.isArray((requestsData as any)?.data)
    ? (requestsData as any).data
    : [];

  const requestsCount = useMemo(() => {
    return rawReqList.filter((item) => {
      const isSupply =
        item.requestType === 'SUPPLY' ||
        item.isSupply ||
        item.reason?.includes('[TALABNOMA]') ||
        item.reason?.includes("[MAHSULOT SO'ROVI]");

      if (!isSupply) return false;
      if (departmentId && canManageRequests) {
        return (
          item.requestedBy?.departmentId === departmentId ||
          item.recipientDeptId === departmentId
        );
      }
      return true;
    }).length;
  }, [rawReqList, departmentId, canManageRequests]);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['department-users', departmentId],
    queryFn: () => usersApi.getAll({ departmentId, limit: 100, employmentStatus: 'ACTIVE' }),
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

          {/* Modern Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/60 rounded-2xl border border-gray-200/80 dark:border-white/10 w-fit flex-wrap mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className={cn(
                'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'employees'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs border border-gray-200/60 dark:border-slate-700/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <Users className="w-4 h-4" />
              <span>{t('departments.tabEmployees', 'Xodimlar')}</span>
              <span
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-bold',
                  activeTab === 'employees'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-900/60'
                    : 'bg-gray-200/80 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300'
                )}
              >
                {employees.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assets')}
              className={cn(
                'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'assets'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs border border-gray-200/60 dark:border-slate-700/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <Package className="w-4 h-4" />
              <span>{t('departments.tabAssets', 'Asosiy vositalar')}</span>
              <span
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-bold',
                  activeTab === 'assets'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-900/60'
                    : 'bg-gray-200/80 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300'
                )}
              >
                {stats?.assetCount ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tmz')}
              className={cn(
                'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'tmz'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-gray-200/60 dark:border-slate-700/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <Boxes className="w-4 h-4" />
              <span>{t('departments.tabTmz', 'TMZ mahsulotlari')}</span>
              <span
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-bold',
                  activeTab === 'tmz'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60'
                    : 'bg-gray-200/80 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300'
                )}
              >
                {displayTmzCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={cn(
                'px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'requests'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-200/60 dark:border-slate-700/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <ClipboardList className="w-4 h-4" />
              <span>{t('departments.tabRequests', 'Talabnomalar')}</span>
              <span
                className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full font-bold',
                  activeTab === 'requests'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60'
                    : 'bg-gray-200/80 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300'
                )}
              >
                {requestsCount}
              </span>
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
              isDeptMember={loggedInUser?.departmentId === departmentId}
              onReturnClick={handleReturnClick}
              department={department}
            />
          ) : activeTab === 'tmz' ? (
            <DepartmentTmzTab
              tmzData={tmzHistoryData}
              isLoading={tmzHistoryLoading}
              departmentId={departmentId}
              departmentName={department?.name}
            />
          ) : (
            <DepartmentRequestsTab
              departmentId={departmentId}
              departmentName={department?.name}
              isLeader={!!(loggedInUser?.id && (department?.leaderId === loggedInUser?.id || department?.leader?.id === loggedInUser?.id))}
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
