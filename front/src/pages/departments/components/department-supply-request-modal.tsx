import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestsApi } from '../../../api';
import Modal from '../../../components/ui/modal';
import Button from '../../../components/ui/button';
import toast from 'react-hot-toast';
import {
  Send,
  Boxes,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { invalidateAppQueries } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  open: boolean;
  onClose: () => void;
  departmentName?: string;
  onSuccess?: () => void;
}

type SupplyCategory = 'TMZ' | 'ASSET';

export default function DepartmentSupplyRequestModal({
  open,
  onClose,
  departmentName,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<SupplyCategory>('TMZ');
  const [reason, setReason] = useState('');

  const resetForm = () => {
    setCategory('TMZ');
    setReason('');
  };

  const { mutate: sendSupplyRequest, isPending } = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error(t('supplyRequests.emptyReasonError'));
      }

      const categoryLabel =
        category === 'TMZ'
          ? t('supplyRequests.categoryTmz')
          : t('supplyRequests.categoryAsset');

      const formattedReason = `[TALABNOMA] [${categoryLabel}] ${reason.trim()}`;

      return requestsApi.create({
        entityType: 'PRODUCT' as any,
        entityId: category === 'TMZ' ? 'SUPPLY_TMZ' : 'SUPPLY_ASSET',
        entityName: categoryLabel,
        reason: formattedReason,
        requestType: 'SUPPLY',
      } as any);
    },
    onSuccess: () => {
      toast.success(t('supplyRequests.sendSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['department-all-requests'] });
      resetForm();
      onClose();
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={t('supplyRequests.modalTitle')}
      subtitle={departmentName ? `"${departmentName}" — ${t('supplyRequests.modalBanner')}` : t('supplyRequests.modalBanner')}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => sendSupplyRequest()}
            loading={isPending}
            disabled={!reason.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {t('supplyRequests.sendBtn')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ehtiyoj toifasi: 2 ixcham tanlov */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {t('supplyRequests.categoryLabel')}
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            {/* 1) TMZ */}
            <button
              type="button"
              onClick={() => setCategory('TMZ')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                category === 'TMZ'
                  ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/20 shadow-xs'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    category === 'TMZ'
                      ? 'bg-teal-500 text-white'
                      : 'bg-teal-50 text-teal-600 dark:bg-slate-800 dark:text-teal-400'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0 pr-3">
                  <div className="font-bold text-xs text-gray-900 dark:text-gray-100">
                    {t('supplyRequests.categoryTmz')}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
                    {t('supplyRequests.categoryTmzDesc')}
                  </p>
                </div>
              </div>
              {category === 'TMZ' && (
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute top-2.5 right-2.5" />
              )}
            </button>

            {/* 2) Asosiy vosita */}
            <button
              type="button"
              onClick={() => setCategory('ASSET')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                category === 'ASSET'
                  ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/20 shadow-xs'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    category === 'ASSET'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400'
                  }`}
                >
                  <Laptop className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0 pr-3">
                  <div className="font-bold text-xs text-gray-900 dark:text-gray-100">
                    {t('supplyRequests.categoryAsset')}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
                    {t('supplyRequests.categoryAssetDesc')}
                  </p>
                </div>
              </div>
              {category === 'ASSET' && (
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute top-2.5 right-2.5" />
              )}
            </button>
          </div>
        </div>

        {/* Kerakli mahsulot va ehtiyoj asosini batafsil yozing */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {t('supplyRequests.step2Needs')}
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('supplyRequests.needsPlaceholder')}
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 p-3 resize-none leading-relaxed"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}
