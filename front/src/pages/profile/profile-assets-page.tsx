import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi, requestsApi } from '../../api';
import { socketService } from '../../lib/socket';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

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
    const typeText = requestType === 'RETURN' ? "Omborga qaytarish" : "Ta'mirlash";
    toast.success(`"${requestModalAsset?.asset?.product?.name || 'Jihoz'}" bo'yicha ${typeText} so'rovi omborchiga yuborildi!`);
    setRequestModalAsset(null);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.profileAssets')}
        subtitle="Sizga biriktirilgan asosiy vositalar va topshirilgan TMZ materiallari"
      />

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
