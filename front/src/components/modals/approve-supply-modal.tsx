import { useState, useEffect, useMemo } from 'react';
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
  quantity,
  isLoading = false,
}: ApproveSupplyModalProps) {
  const { t } = useTranslation();

  const quickComments = useMemo(
    () => [
      t('supplyRequests.quickComment1'),
      t('supplyRequests.quickComment2'),
      t('supplyRequests.quickComment3'),
    ],
    [t]
  );

  const defaultComment = useMemo(() => {
    return quantity && quantity > 0
      ? `${t('supplyRequests.quickComment1')} (${quantity} ${t('common.pcs')})`
      : t('supplyRequests.quickComment1');
  }, [quantity, t]);

  const [comment, setComment] = useState(defaultComment);

  useEffect(() => {
    if (open) {
      setComment(defaultComment);
    }
  }, [open, defaultComment]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('supplyRequests.commentLabel')}</span>
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('supplyRequests.commentPlaceholder')}
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 p-3 resize-none"
            autoFocus
          />

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-2xs text-gray-400 self-center">{t('supplyRequests.quickCommentsLabel')}</span>
            {quickComments.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setComment(preset)}
                className="text-2xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
