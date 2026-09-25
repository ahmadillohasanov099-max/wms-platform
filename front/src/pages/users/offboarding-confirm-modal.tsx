import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api';
import Modal from '../../components/ui/modal';
import Button from '../../components/ui/button';
import { AlertTriangle, CheckCircle2, ShieldAlert, Package, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageLoader } from '../../components/ui/spinner';
import { invalidateAppQueries } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  open: boolean;
  onClose: () => void;
  user: any;
  onSuccess?: () => void;
}

export default function OffboardingConfirmModal({ open, onClose, user, onSuccess }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-assignments-offboard-check', user?.id],
    queryFn: () => usersApi.getAssignments(user?.id),
    enabled: open && !!user?.id,
  });

  const { mutate: startOffboard, isPending: isSubmitting } = useMutation({
    mutationFn: (userId: string) => usersApi.startOffboarding(userId),
    onSuccess: (res: any) => {
      toast.success(res?.message || t('offboarding.startingToast'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['pending-offboardings'] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  if (!open || !user) return null;

  const assignments = Array.isArray(assignmentsData) ? assignmentsData : [];
  const activeAssignments = assignments.filter((a: any) => !a.returnedAt);
  const hasAssets = activeAssignments.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('offboarding.modalTitle')}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('offboarding.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => startOffboard(user.id)}
            loading={isSubmitting}
            icon={<UserMinus className="w-4 h-4" />}
          >
            {t('offboarding.startProcess')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* User Card */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              {user.fullName}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              @{user.username} • {user.department?.name || t('offboarding.noDept')} • {user.position || t('offboarding.noPosition')}
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {user.role}
          </span>
        </div>

        {/* 3-Step Process Guide */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 space-y-2">
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-blue-600" />
            {t('offboarding.stepsTitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/30">
              <span className="font-bold text-blue-600 block mb-0.5">{t('offboarding.step1Title')}</span>
              {t('offboarding.step1Desc')}
            </div>
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/30">
              <span className="font-bold text-amber-600 block mb-0.5">{t('offboarding.step2Title')}</span>
              {t('offboarding.step2Desc')}
            </div>
            <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/30">
              <span className="font-bold text-emerald-600 block mb-0.5">{t('offboarding.step3Title')}</span>
              {t('offboarding.step3Desc')}
            </div>
          </div>
        </div>

        {/* Assets check status */}
        {assignmentsLoading ? (
          <div className="py-6 flex justify-center">
            <PageLoader />
          </div>
        ) : hasAssets ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold">
                  {t('offboarding.warningWithAssets', { count: activeAssignments.length })}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  {t('offboarding.warningWithAssetsDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('offboarding.unreturnedListTitle')}
              </p>
              {activeAssignments.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.asset?.product?.name || item.product?.name || "Jihoz"}
                    </span>
                  </div>
                  <span className="font-mono text-2xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded border border-teal-200/50 dark:border-teal-800/40">
                    INV: {item.asset?.inventoryNumber || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <p className="font-bold">{t('offboarding.noAssetsTitle')}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                {t('offboarding.noAssetsDesc')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
