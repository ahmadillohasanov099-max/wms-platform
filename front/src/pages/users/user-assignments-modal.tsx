import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi, operationsApi } from '../../api';
import Modal from '../../components/ui/modal';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import { PageLoader } from '../../components/ui/spinner';

import { formatCurrency, formatDate } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';
import VerifyIdentityModal from '../../components/shared/verify-identity-modal';
interface Props {
  open: boolean;
  onClose: () => void;
  user: any;
}
export default function UserAssignmentsModal({ open, onClose, user }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: loggedInUser } = useAuthStore();
  const isAdmin = loggedInUser?.role !== 'XODIM' && loggedInUser?.role !== 'KADR';
  const { data, isLoading } = useQuery({
    queryKey: ['user-assignments', user?.id],
    queryFn: () => usersApi.getAssignments(user.id),
    enabled: !!user?.id && open,
  });
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const handleConfirmReturn = async () => {
    if (!selectedAssetId) return;
    await operationsApi.returnFromUser({
      userId: user.id,
      assetId: selectedAssetId,
    });
    toast.success(t('operations.returnFromUserSuccess'));
    queryClient.invalidateQueries({ queryKey: ['user-assignments', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    setSelectedAssetId(null);
  };
  const assignments = data ?? [];
  const totalValue = assignments.reduce(
    (sum: number, a: any) => sum + Number(a.asset?.purchasePrice ?? 0), 0
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.assignmentsTitle', { name: user?.fullName })}
      size="lg"
    >
      {isLoading ? (
        <PageLoader />
      ) : assignments.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">{t('users.noAssets')}</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800"
            >
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words">
                  {a.asset?.product?.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {a.asset?.inventoryNumber && (
                    <CopyableInventoryNumber
                      value={a.asset.inventoryNumber}
                      size="2xs"
                    />
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {formatDate(a.assignedAt)}
                  </span>
                </div>

              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(Number(a.asset?.purchasePrice ?? 0))}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setSelectedAssetId(a.asset?.id);
                      setPasswordModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    {t('userView.returnBtn')}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.totalValue')}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      )}
      <VerifyIdentityModal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setSelectedAssetId(null);
        }}
        onSuccess={handleConfirmReturn}
      />
    </Modal>
  );
}