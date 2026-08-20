import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

import ProfileMyAssetsTable from './components/profile-my-assets-table';
import ProfileRequestModal from './components/profile-request-modal';

export default function ProfileAssetsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [requestModalAsset, setRequestModalAsset] = useState<any | null>(null);

  const [requestedAssetIds, setRequestedAssetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`user_requested_assets_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['profile-assignments', user?.id],
    queryFn: () => usersApi.getAssignments(user!.id),
    enabled: !!user?.id,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['profile-history', user?.id],
    queryFn: () => usersApi.getHistory(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return <PageLoader />;

  const assignments = assignmentsData ?? [];
  const historyList = historyData ?? [];

  // Filter TMZ material operations given to this user (strictly SARFLANADIGAN / no assetId)
  const tmzOperations = historyList.filter(
    (op: any) =>
      op.product?.productType === 'SARFLANADIGAN' ||
      (!op.assetId && !op.asset && op.product?.productType !== 'BERILADIGAN' && (op.type === 'GIVE_TO_USER' || op.type === 'GIVE_TO_DEPT'))
  );

  // Group TMZ operations by documentNumber
  const groupedTmzOperations: any[] = [];
  const mapTmzDoc = new Map<string, any>();
  for (const item of tmzOperations) {
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

  const handleRequestSuccess = (assetId: string, requestType: 'RETURN' | 'REPAIR') => {
    const updated = [...requestedAssetIds, assetId];
    setRequestedAssetIds(updated);
    try {
      localStorage.setItem(`user_requested_assets_${user?.id}`, JSON.stringify(updated));
    } catch {}

    const typeText = requestType === 'RETURN' ? "Omborga qaytarish" : "Ta'mirlash/Servis";
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
        isLoading={assignmentsLoading || historyLoading}
        totalValue={totalValue}
        requestedAssetIds={requestedAssetIds}
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
