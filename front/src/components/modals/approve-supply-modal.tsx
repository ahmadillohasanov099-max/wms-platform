import { useState, useEffect } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { CheckCircle2, MessageSquare, Package } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface ApproveSupplyModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
  productName?: string;
  requesterName?: string;
  quantity?: number;
  isLoading?: boolean;
}

export default function ApproveSupplyModal({
  open,
  onClose,
  onConfirm,
  productName,
  requesterName,
  isLoading = false,
}: ApproveSupplyModalProps) {
  const { t } = useTranslation();

  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setComment('');
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!comment.trim()) return;
    await onConfirm(comment.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('supplyRequests.approveModalTitle')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !comment.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{t('supplyRequests.approveBannerTitle')}</p>
            <p className="text-emerald-700 dark:text-emerald-400">
              {t('supplyRequests.approveSupplyDesc')}
            </p>
            {productName && (
              <div className="flex items-center gap-1.5 pt-1 text-slate-900 dark:text-white font-semibold">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>{t('supplyRequests.productLabel')}: {productName}</span>
                {requesterName && <span className="text-slate-500 font-normal">({requesterName})</span>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('supplyRequests.commentLabel')}</span>
              <span className="text-rose-500 font-bold">*</span>
            </div>
            <span className="text-2xs text-gray-400 font-normal">Majburiy</span>
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('supplyRequests.commentPlaceholder')}
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 p-3 resize-none"
            autoFocus
          />

          {/* Tezkor javob (Quick preset) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-2xs text-gray-400">{t('supplyRequests.quickCommentsLabel')}</span>
            <button
              type="button"
              onClick={() => setComment(t('supplyRequests.quickComment1'))}
              className="text-2xs px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 transition-colors cursor-pointer font-medium"
            >
              ⚡ {t('supplyRequests.quickComment1')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
