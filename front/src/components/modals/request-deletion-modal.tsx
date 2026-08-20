import { useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { deletionRequestsApi } from '../../api';
import type { DeletionEntityType } from '../../types';

interface RequestDeletionModalProps {
  open: boolean;
  onClose: () => void;
  entityType: DeletionEntityType;
  entityId: string;
  entityTitle: string;
  onSuccess?: () => void;
}

const entityTypeNames: Record<DeletionEntityType, string> = {
  USER: 'Xodim',
  DEPARTMENT: 'Bo\'lim',
  PRODUCT: 'Mahsulot',
  ASSET: 'Aktiv / Jihoz',
};

export default function RequestDeletionModal({
  open,
  onClose,
  entityType,
  entityId,
  entityTitle,
  onSuccess,
}: RequestDeletionModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Iltimos, o\'chirish sababini kiritib o\'ting');
      return;
    }

    setLoading(true);
    try {
      await deletionRequestsApi.create({
        entityType,
        entityId,
        reason: reason.trim(),
      });
      toast.success('O\'chirish so\'rovi Vazirlikka yuborildi');
      setReason('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || error?.message || 'So\'rov yuborishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${entityTypeNames[entityType]}ni o'chirish so'rovi`}
      subtitle="Quyi tashkilotlar uchun to'g'ridan-to'g'ri o'chirish taqiqlangan. So'rov Vazirlikka tasdiqlash uchun yuboriladi."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">O'chirilishi so'ralayotgan resurs:</p>
          <p className="text-sm font-bold mt-0.5">{entityTitle}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            O'chirish sababi (Asoslash) <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima sababdan ushbu resurs o'chirilishi kerakligini izohlang..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" loading={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
            So'rov yuborish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
