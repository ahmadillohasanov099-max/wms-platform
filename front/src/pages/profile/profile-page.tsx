import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Package, History, Lock, Layers } from 'lucide-react';
import { usersApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import { useAuthStore } from '../../store/auth.store';

import ProfileHeaderBanner from './components/profile-header-banner';
import ProfileStatsCards from './components/profile-stats-cards';
import ProfilePersonalInfoCard from './components/profile-personal-info-card';
import ProfileSecurityCard from './components/profile-security-card';
import ProfileMyAssetsTable from './components/profile-my-assets-table';
import ProfileActivityTable from './components/profile-activity-table';
import ProfileRequestModal from './components/profile-request-modal';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'info';

  const [requestModalAsset, setRequestModalAsset] = useState<any | null>(null);
  const [requestedAssetIds, setRequestedAssetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`user_requested_assets_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { data: userDetailData } = useQuery({
    queryKey: ['profile-user-detail', user?.id],
    queryFn: () => usersApi.getOne(user!.id),
    enabled: !!user?.id,
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

  const tabsList = [
    { key: 'info', label: "Shaxsiy ma'lumotlar", icon: <User className="w-4 h-4" /> },
    { key: 'assets', label: "Mening jihozlarim", icon: <Package className="w-4 h-4" /> },
    { key: 'activity', label: "So'nggi harakatlar", icon: <History className="w-4 h-4" /> },
    { key: 'security', label: "Parolni almashtirish", icon: <Lock className="w-4 h-4" /> },
    { key: 'all', label: "Barchasini ko'rish", icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* 1. Header Banner */}
      <ProfileHeaderBanner user={profileUser} totalValue={totalValue} />

      {/* 2. Section Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto bg-white dark:bg-slate-900/60 p-2 rounded-2xl border border-gray-200/90 dark:border-white/15 shadow-2xs">
        {tabsList.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSearchParams({ tab: t.key })}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Quick Stats Cards */}
      <ProfileStatsCards
        assignmentsCount={assignments.length}
        totalValue={totalValue}
        latestAssignment={latestAssignment}
        historyCount={history.length}
      />

      {/* 4. Tab Dynamic View */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProfilePersonalInfoCard profileUser={profileUser} />
          </div>
          <div>
            <ProfileSecurityCard />
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <ProfileMyAssetsTable
          user={profileUser}
          assignments={assignments}
          isLoading={assignmentsLoading}
          totalValue={totalValue}
          requestedAssetIds={requestedAssetIds}
          onRequestModal={(asset) => setRequestModalAsset(asset)}
        />
      )}

      {activeTab === 'activity' && (
        <ProfileActivityTable
          history={history}
          isLoading={historyLoading}
        />
      )}

      {activeTab === 'security' && (
        <div className="max-w-xl mx-auto">
          <ProfileSecurityCard />
        </div>
      )}

      {activeTab === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <ProfilePersonalInfoCard profileUser={profileUser} />
            <ProfileSecurityCard />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <ProfileMyAssetsTable
              assignments={assignments}
              isLoading={assignmentsLoading}
              totalValue={totalValue}
              requestedAssetIds={requestedAssetIds}
              onRequestModal={(asset) => setRequestModalAsset(asset)}
            />
            <ProfileActivityTable
              history={history}
              isLoading={historyLoading}
            />
          </div>
        </div>
      )}

      {/* 5. Request Modal */}
      <ProfileRequestModal
        assetItem={requestModalAsset}
        onClose={() => setRequestModalAsset(null)}
        onSubmitSuccess={handleRequestSuccess}
      />
    </div>
  );
}