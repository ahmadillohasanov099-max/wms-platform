import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import {
  UserMinus,
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  Check,
  ShieldCheck,
  Building2,
  Phone,
} from 'lucide-react';
import Button from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui';
import { PageLoader } from '../../components/ui/spinner';
import toast from 'react-hot-toast';
import { formatDate, invalidateAppQueries } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import OffboardingAktModal from './offboarding-akt-modal';

interface Props {
  onSuccess?: () => void;
}

export default function PendingOffboardingsView({ onSuccess }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const isWarehouse =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'VAZIRLIK_OMBORCHI' ||
    currentUser?.role === 'ORG_ADMIN' ||
    currentUser?.role === 'ORG_OMBORCHI';

  const isHrOrAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'ORG_ADMIN' ||
    currentUser?.role === 'KADR';

  const [aktModalUser, setAktModalUser] = useState<string | null>(null);

  // Approve dialog
  const [approveDialog, setApproveDialog] = useState<any | null>(null);
  // Complete dialog
  const [completeDialog, setCompleteDialog] = useState<any | null>(null);
  // Cancel dialog
  const [cancelDialog, setCancelDialog] = useState<any | null>(null);

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['pending-offboardings'],
    queryFn: () => usersApi.getPendingOffboardings(),
  });

  const { mutate: approveOffboarding, isPending: isApproving } = useMutation({
    mutationFn: (userId: string) => usersApi.warehouseApproveOffboarding(userId),
    onSuccess: (res: any) => {
      toast.success(res?.message || t('offboarding.warehouseApprovedSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['pending-offboardings'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setApproveDialog(null);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  const { mutate: completeOffboarding, isPending: isCompleting } = useMutation({
    mutationFn: (userId: string) => usersApi.completeOffboarding(userId),
    onSuccess: (res: any, variables: string) => {
      toast.success(res?.message || t('offboarding.completeSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['pending-offboardings'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCompleteDialog(null);
      // Automatically show Akt for printing
      setAktModalUser(variables);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  const { mutate: cancelOffboarding, isPending: isCanceling } = useMutation({
    mutationFn: (userId: string) => usersApi.cancelOffboarding(userId),
    onSuccess: (res: any) => {
      toast.success(res?.message || t('offboarding.cancelSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['pending-offboardings'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCancelDialog(null);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <PageLoader />
      </div>
    );
  }

  const list = Array.isArray(pendingUsers) ? pendingUsers : [];

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {t('offboarding.noPendingTitle')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            {t('offboarding.noPendingDesc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {list.map((item: any) => {
            const isWarehouseApproved = !!item.warehouseApprovedAt;

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-gray-200/90 dark:border-slate-800 shadow-2xs space-y-4 transition-all hover:border-gray-300 dark:hover:border-slate-700"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm border border-amber-200 dark:border-amber-800/60">
                      {item.fullName?.slice(0, 2).toUpperCase() || 'US'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {item.fullName}
                        <span className="text-xs font-mono font-normal text-gray-500">
                          (@{item.username})
                        </span>
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {item.department?.name || t('offboarding.noDept')}
                        </span>
                        <span>•</span>
                        <span>{item.position || t('offboarding.noPosition')}</span>
                        {item.phone && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {item.phone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                    {t('offboarding.pendingBadge')}
                  </span>
                </div>

                {/* 3 Steps Visual Flow */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50/70 dark:bg-slate-950/50 border border-gray-100 dark:border-slate-800 text-xs">
                  {/* Step 1 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{t('offboarding.step1Label')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-5">
                      {formatDate(item.offboardingStartedAt)} ({item.offboardingStartedBy?.fullName || "Kadr"})
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-1">
                    <div
                      className={`flex items-center gap-1.5 font-bold ${
                        isWarehouseApproved
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isWarehouseApproved ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                      )}
                      <span>{t('offboarding.step2Label')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-5">
                      {isWarehouseApproved
                        ? t('offboarding.step2Approved', {
                            date: formatDate(item.warehouseApprovedAt),
                            name: item.warehouseApprovedBy?.fullName || "Omborchi",
                          })
                        : t('offboarding.step2Waiting', {
                            count: item.unreturnedAssetsCount || 0,
                          })}
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="space-y-1">
                    <div
                      className={`flex items-center gap-1.5 font-bold ${
                        isWarehouseApproved
                          ? 'text-teal-600 dark:text-teal-400'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>{t('offboarding.step3Label')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-5">
                      {isWarehouseApproved
                        ? t('offboarding.step3Ready')
                        : t('offboarding.step3Waiting')}
                    </p>
                  </div>
                </div>

                {/* Assigned Assets Detail (if any) */}
                {item.assignments && item.assignments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-gray-400" />
                      {t('offboarding.assetsToReturn')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.assignments.map((asg: any) => (
                        <span
                          key={asg.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          <span className="font-semibold">{asg.asset?.product?.name || "Jihoz"}</span>
                          <span className="font-mono text-2xs text-teal-600 dark:text-teal-400 font-bold">
                            ({asg.asset?.inventoryNumber || "—"})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {/* Cancel Offboarding */}
                    {isHrOrAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => setCancelDialog(item)}
                      >
                        {t('common.cancel')}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Warehouse Approve Button */}
                    {isWarehouse && !isWarehouseApproved && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        icon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => setApproveDialog(item)}
                      >
                        {t('offboarding.approveWarehouseBtn')}
                      </Button>
                    )}

                    {/* Complete Offboarding (HR / Admin) */}
                    {isHrOrAdmin && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!isWarehouseApproved}
                        icon={<UserMinus className="w-3.5 h-3.5" />}
                        onClick={() => setCompleteDialog(item)}
                        title={
                          !isWarehouseApproved
                            ? t('offboarding.completeDisabledHint')
                            : t('offboarding.completeOffboardingBtn')
                        }
                      >
                        {t('offboarding.completeOffboardingBtn')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Akt Modal */}
      {aktModalUser && (
        <OffboardingAktModal
          open={!!aktModalUser}
          onClose={() => setAktModalUser(null)}
          userId={aktModalUser}
        />
      )}

      {/* Warehouse Approve Confirm Dialog */}
      <ConfirmDialog
        open={!!approveDialog}
        onClose={() => setApproveDialog(null)}
        onConfirm={() => approveDialog && approveOffboarding(approveDialog.id)}
        title={t('offboarding.dialogApproveTitle')}
        description={t('offboarding.dialogApproveDesc', { name: approveDialog?.fullName || '' })}
        confirmText={t('offboarding.dialogApproveConfirm')}
        cancelText={t('common.cancel')}
        loading={isApproving}
      />

      {/* Complete Offboard Confirm Dialog */}
      <ConfirmDialog
        open={!!completeDialog}
        onClose={() => setCompleteDialog(null)}
        onConfirm={() => completeDialog && completeOffboarding(completeDialog.id)}
        title={t('offboarding.dialogCompleteTitle')}
        description={t('offboarding.dialogCompleteDesc', { name: completeDialog?.fullName || '' })}
        confirmText={t('offboarding.dialogCompleteConfirm')}
        variant="danger"
        cancelText={t('common.cancel')}
        loading={isCompleting}
      />

      {/* Cancel Offboarding Dialog */}
      <ConfirmDialog
        open={!!cancelDialog}
        onClose={() => setCancelDialog(null)}
        onConfirm={() => cancelDialog && cancelOffboarding(cancelDialog.id)}
        title={t('offboarding.dialogCancelTitle')}
        description={t('offboarding.dialogCancelDesc', { name: cancelDialog?.fullName || '' })}
        confirmText={t('offboarding.dialogCancelConfirm')}
        cancelText={t('common.cancel')}
        loading={isCanceling}
      />
    </div>
  );
}
