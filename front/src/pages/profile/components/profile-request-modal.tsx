import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/modal';
import Button from '../../../components/ui/button';
import { RotateCcw, Wrench, CheckCircle2 } from 'lucide-react';
import { deletionRequestsApi } from '../../../api';

interface Props {
  assetItem: any | null;
  onClose: () => void;
  onSubmitSuccess: (assetId: string, requestType: 'RETURN' | 'REPAIR', reason: string) => void;
}

export default function ProfileRequestModal({ assetItem, onClose, onSubmitSuccess }: Props) {
  const [requestType, setRequestType] = useState<'RETURN' | 'REPAIR'>('RETURN');
  const [requestReason, setRequestReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!assetItem) return null;

  const handleSend = async () => {
    if (!requestReason.trim()) {
      toast.error("Iltimos, so'rov sababi yoki izohini yozing!");
      return;
    }

    setLoading(true);
    try {
      const typeLabel = requestType === 'RETURN' ? "[OMBORGA QAYTARISH]" : "[TA'MIRLASH/SERVIS]";
      const assetInfo = `${assetItem?.asset?.product?.name || 'Jihoz'} (Inv: ${assetItem?.asset?.inventoryNumber || '—'})`;
      
      await deletionRequestsApi.create({
        entityType: 'ASSET' as any,
        entityId: assetItem.asset.id,
        reason: `${typeLabel} Jihoz: ${assetInfo}. ${requestReason.trim()}`,
      });

      onSubmitSuccess(assetItem.asset?.id, requestType, requestReason);
      setRequestReason('');
      toast.success("So'rov Omborchiga muvaffaqiyatli yuborildi");
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || err?.message || "So'rovni yuborishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!assetItem}
      onClose={onClose}
      title="🛠️ Jihozni qaytarish yoki ta'mirlash so'rovi"
      subtitle="Omborchiga jihoz bo'yicha bildirishnoma va so'rov yuborish"
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>Bekor qilish</Button>
          <Button onClick={handleSend} loading={loading} className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> So'rovni Omborchiga Yuborish
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1">
          <p className="text-3xs font-extrabold uppercase text-amber-700 dark:text-amber-400">Tanlangan jihoz</p>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-900 dark:text-white">{assetItem?.asset?.product?.name || 'Jihoz'}</span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded">Inv: {assetItem?.asset?.inventoryNumber}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">So'rov turi:</label>
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
              <span>🔄 Omborga qaytarish</span>
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
              <span>🛠️ Ta'mirlash / Servis</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">So'rov sababi yoki izoh kiritishingiz shart:</label>
          <textarea
            rows={3}
            placeholder={
              requestType === 'RETURN'
                ? "Masalan: Jihozdan foydalanilmayapti, omborga qaytarmoqchiman..."
                : "Masalan: Texnikaning displeyida nosozlik bor, servis xizmati kerak..."
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
