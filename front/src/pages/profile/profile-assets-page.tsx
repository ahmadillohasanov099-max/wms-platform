import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi, requestsApi } from '../../api';
import { socketService } from '../../lib/socket';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCurrency } from '../../lib/utils';
import { Package, Coins, Boxes } from 'lucide-react';

import ProfileMyAssetsTable from './components/profile-my-assets-table';
import ProfileRequestModal from './components/profile-request-modal';

export default function ProfileAssetsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [requestModalAsset, setRequestModalAsset] = useState<any | null>(null);

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['profile-assignments', user?.id],
    queryFn: () => usersApi.getAssignments(user!.id),
    enabled: !!user?.id,
  });

  const { data: tmzData, isLoading: tmzLoading } = useQuery({
    queryKey: ['profile-tmz-materials', user?.id],
    queryFn: () => usersApi.getTmzMaterials(user!.id),
    enabled: !!user?.id,
  });

  // Fetch employee's active requests from API
  const { data: myRequestsData } = useQuery({
    queryKey: ['my-requests', user?.id],
    queryFn: () => requestsApi.getMy(),
    enabled: !!user?.id,
    refetchInterval: 8000,
  });

  // Real-time socket updates for return requests and assignments
  useEffect(() => {
    const socket = socketService.getSocket() || socketService.connect();

    const handleRefetch = () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['profile-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['profile-tmz-materials'] });
    };

    socket.on('request:created', handleRefetch);
    socket.on('request:updated', handleRefetch);
    socket.on('deletion-request:created', handleRefetch);
    socket.on('deletion-request:updated', handleRefetch);
    socket.on('assignment:updated', handleRefetch);

    return () => {
      socket.off('request:created', handleRefetch);
      socket.off('request:updated', handleRefetch);
      socket.off('deletion-request:created', handleRefetch);
      socket.off('deletion-request:updated', handleRefetch);
      socket.off('assignment:updated', handleRefetch);
    };
  }, [queryClient]);

  if (!user) return <PageLoader />;

  const assignments = assignmentsData ?? [];
  const myRequests: any[] = Array.isArray(myRequestsData)
    ? myRequestsData
    : (myRequestsData as any)?.data || [];

  // ONLY assets that are currently PENDING in requests are considered "So'rov yuborilgan"
  // If a request was REJECTED or APPROVED, it is no longer pending so user can re-request
  const pendingRequestedAssetIds = useMemo(() => {
    return myRequests
      .filter((r: any) => r.requestType !== 'ASSIGNMENT' && r.status === 'PENDING' && r.entityType === 'ASSET')
      .map((r: any) => r.entityId);
  }, [myRequests]);

  const tmzList = tmzData ?? [];

  // Group TMZ operations by documentNumber
  const groupedTmzOperations: any[] = [];
  const mapTmzDoc = new Map<string, any>();
  for (const item of tmzList) {
    const docNum = item.documentNumber;
    if (docNum && docNum.startsWith('TLB-')) {
      if (mapTmzDoc.has(docNum)) {
        mapTmzDoc.get(docNum).groupItems.push(item);
      } else {
        const newGroup = { ...item, groupItems: [item] };
        mapTmzDoc.set(docNum, newGroup);
        groupedTmzOperations.push(newGroup);
      }
    } else {
      groupedTmzOperations.push({ ...item, groupItems: [item] });
    }
  }

  const totalValue = assignments.reduce(
    (sum: number, a: any) => sum + Number(a.asset?.purchasePrice ?? 0),
    0
  );

  const handleRequestSuccess = (_assetId: string, requestType: 'RETURN' | 'REPAIR') => {
    queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
    const typeText = requestType === 'RETURN' ? t('profile.returnType') : t('profile.repairType');
    toast.success(t('profile.toastRequestSuccess', {
      name: requestModalAsset?.asset?.product?.name || t('profile.asset'),
      type: typeText,
    }));
    setRequestModalAsset(null);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.profileAssets')}
        subtitle={t('profile.assetsBannerSubtitle')}
      />

      {/* Assets Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 border border-teal-500/20">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t('menu.profileAssets')}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800">
                  {t('profile.assetsMainCount', { count: assignments.length })}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('profile.assetsBannerDesc')}
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {t('profile.fixedAssets')}
                </p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {assignments.length} {t('common.pcs')}
                </p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-2.5">
              <div className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-lg">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {t('profile.totalValue')}
                </p>
                <p className="text-xs font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {t('profile.tmzMaterials')}
                </p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {groupedTmzOperations.length} {t('common.pcs')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProfileMyAssetsTable
        assignments={assignments}
        tmzOperations={groupedTmzOperations}
        isLoading={assignmentsLoading || tmzLoading}
        totalValue={totalValue}
        requestedAssetIds={pendingRequestedAssetIds}
        onRequestModal={(asset) => setRequestModalAsset(asset)}
        user={user}
      />

      <ProfileRequestModal
        assetItem={requestModalAsset}
        onClose={() => setRequestModalAsset(null)}
        onSubmitSuccess={handleRequestSuccess}
      />
    </div>
  );
}
