import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/modal';
import Button from '../../../components/ui/button';
import { RotateCcw, Wrench, CheckCircle2 } from 'lucide-react';
import { requestsApi } from '../../../api';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  assetItem: any | null;
  onClose: () => void;
  onSubmitSuccess: (assetId: string, requestType: 'RETURN' | 'REPAIR', reason: string) => void;
}

export default function ProfileRequestModal({ assetItem, onClose, onSubmitSuccess }: Props) {
  const { t } = useTranslation();
  const [requestType, setRequestType] = useState<'RETURN' | 'REPAIR'>('RETURN');
  const [requestReason, setRequestReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!assetItem) return null;

  const handleSend = async () => {
    if (!requestReason.trim()) {
      toast.error(t('profile.reasonEmptyError'));
      return;
    }

    setLoading(true);
    try {
      const typePrefix = requestType === 'RETURN' ? '[OMBORGA QAYTARISH] ' : "[TA'MIRLASH/SERVIS] ";
      
      const targetAssetId = assetItem.asset?.id || assetItem.assetId || assetItem.id;
      await requestsApi.create({
        entityType: 'ASSET',
        entityId: targetAssetId,
        reason: `${typePrefix}${requestReason.trim()}`,
        requestType,
      } as any);

      onSubmitSuccess(targetAssetId, requestType, requestReason);
      setRequestReason('');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || err?.message || t('profile.requestSentError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!assetItem}
      onClose={onClose}
      title={t('profile.requestModalTitle')}
      subtitle={t('profile.requestModalSubtitle')}
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
          <Button onClick={handleSend} loading={loading} className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {t('profile.sendToWarehouse')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
          <p className="text-3xs font-extrabold uppercase text-amber-700 dark:text-amber-400">{t('profile.selectedAsset')}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-900 dark:text-white">{assetItem?.asset?.product?.name || t('profile.asset')}</span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded">Inv: {assetItem?.asset?.inventoryNumber}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">{t('profile.requestType')}</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRequestType('RETURN')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all ${
                requestType === 'RETURN'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/20'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>{t('profile.typeReturn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setRequestType('REPAIR')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all ${
                requestType === 'REPAIR'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/20'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>{t('profile.typeRepair')}</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">{t('profile.reasonRequired')}</label>
          <textarea
            rows={3}
            placeholder={
              requestType === 'RETURN'
                ? t('profile.reasonPlaceholderReturn')
                : t('profile.reasonPlaceholderRepair')
            }
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
